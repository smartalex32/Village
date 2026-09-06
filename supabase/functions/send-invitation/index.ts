import { createClient } from "@supabase/supabase-js";
import { corsHeaders, escapeHtml, json } from "../_shared/http.ts";

type Capability =
  | "PICKUP"
  | "DROPOFF"
  | "TRANSPORTATION"
  | "BABYSITTING"
  | "EMERGENCY"
  | "OTHER";
type InvitationBody = {
  householdId: string;
  email: string;
  relationshipLabel: string;
  role: "PARENT_GUARDIAN" | "TRUSTED_CAREGIVER" | "LIMITED_CAREGIVER";
  childIds: string[];
  capabilities: Capability[];
  householdName: string;
  inviterName: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "authentication_required" }, 401);
  try {
    const body = (await request.json()) as InvitationBody;
    if (
      !body.householdId ||
      !body.email?.includes("@") ||
      !body.childIds?.length ||
      !body.capabilities?.length
    )
      return json({ error: "invalid_invitation" }, 400);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data, error } = await client.rpc("create_household_invitation", {
      p_household_id: body.householdId,
      p_email: body.email,
      p_relationship_label: body.relationshipLabel,
      p_role: body.role,
      p_child_ids: body.childIds,
      p_capabilities: body.capabilities,
    });
    if (error)
      return json(
        { error: "invitation_not_created" },
        error.code === "42501" ? 403 : 400,
      );
    const linkBase =
      Deno.env.get("LINK_BASE_URL") ?? "https://links.village.app";
    const inviteUrl = `${linkBase}/accept-invite/${encodeURIComponent(data.token)}`;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            Deno.env.get("INVITATION_FROM_EMAIL") ??
            "Village <invites@village.app>",
          to: [body.email],
          subject: `${body.inviterName} invited you to ${body.householdName}`,
          html: `<h1>You're invited to their Village</h1><p>${escapeHtml(body.inviterName)} invited you to help coordinate care in ${escapeHtml(body.householdName)}.</p><p><a href="${escapeHtml(inviteUrl)}">Accept invitation</a></p><p>This private link expires in 7 days.</p>`,
        }),
      });
      if (!response.ok)
        return json(
          {
            invitationId: data.invitation_id,
            inviteUrl,
            emailDelivered: false,
          },
          202,
        );
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await admin
        .from("notification_outbox")
        .update({
          status: "DELIVERED",
          delivered_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq("invitation_id", data.invitation_id)
        .eq("channel", "EMAIL");
    }
    return json(
      {
        invitationId: data.invitation_id,
        inviteUrl,
        emailDelivered: Boolean(resendKey),
      },
      201,
    );
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
});
