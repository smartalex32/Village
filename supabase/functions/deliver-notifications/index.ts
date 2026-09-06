import { createClient } from "@supabase/supabase-js";
import { json, retryDelaySeconds, safeErrorCode } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  if (
    request.headers.get("x-webhook-secret") !==
    Deno.env.get("NOTIFICATION_WEBHOOK_SECRET")
  )
    return json({ error: "not_authorized" }, 401);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  await admin.rpc("expire_household_invitations");
  await admin
    .from("notification_outbox")
    .update({ status: "PENDING", lock_token: null, locked_at: null })
    .eq("status", "PROCESSING")
    .lt("locked_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  const { data: jobs, error } = await admin
    .from("notification_outbox")
    .select(
      "id, attempts, notification:notifications(id,title,body,route,recipient:household_members(user_id))",
    )
    .eq("channel", "PUSH")
    .eq("status", "PENDING")
    .lte("next_attempt_at", new Date().toISOString())
    .limit(100);
  if (error) return json({ error: "outbox_unavailable" }, 500);
  let delivered = 0;
  for (const job of jobs ?? []) {
    const lockToken = crypto.randomUUID();
    const { data: claim } = await admin
      .from("notification_outbox")
      .update({
        status: "PROCESSING",
        lock_token: lockToken,
        locked_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle();
    if (!claim) continue;
    const notification = job.notification as unknown as {
      title: string;
      body: string;
      route?: string;
      recipient: { user_id: string };
    };
    try {
      const { data: tokens } = await admin
        .from("device_push_tokens")
        .select("expo_push_token")
        .eq("user_id", notification.recipient.user_id)
        .eq("active", true);
      if (!tokens?.length) {
        await admin
          .from("notification_outbox")
          .update({
            status: "DELIVERED",
            delivered_at: new Date().toISOString(),
            lock_token: null,
            locked_at: null,
          })
          .eq("id", job.id)
          .eq("lock_token", lockToken);
        continue;
      }
      const messages = tokens.map(({ expo_push_token }) => ({
        to: expo_push_token,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: { route: notification.route },
        channelId: "coordination",
      }));
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!response.ok) throw new Error("expo_push_rejected");
      const tickets =
        (
          (await response.json()) as {
            data?: { status: string; details?: { error?: string } }[];
          }
        ).data ?? [];
      await Promise.all(
        tickets.map((ticket, index) =>
          ticket.details?.error === "DeviceNotRegistered"
            ? admin
                .from("device_push_tokens")
                .update({ active: false, updated_at: new Date().toISOString() })
                .eq("expo_push_token", tokens[index].expo_push_token)
            : Promise.resolve(),
        ),
      );
      await admin
        .from("notification_outbox")
        .update({
          status: "DELIVERED",
          delivered_at: new Date().toISOString(),
          attempts: job.attempts + 1,
          lock_token: null,
          locked_at: null,
        })
        .eq("id", job.id)
        .eq("lock_token", lockToken);
      delivered += 1;
    } catch (deliveryError) {
      const attempts = job.attempts + 1;
      const retryAt = new Date(
        Date.now() + retryDelaySeconds(attempts) * 1000,
      ).toISOString();
      await admin
        .from("notification_outbox")
        .update({
          status: attempts >= 5 ? "FAILED" : "PENDING",
          attempts,
          next_attempt_at: retryAt,
          last_error_code: safeErrorCode(deliveryError),
          lock_token: null,
          locked_at: null,
        })
        .eq("id", job.id)
        .eq("lock_token", lockToken);
    }
  }
  return json({ processed: jobs?.length ?? 0, delivered });
});
