import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Capability,
  CareEvent,
  Child,
  Handoff,
  HouseholdInvitation,
  HelpRequest,
  HelpRequestType,
  MemberRole,
  VillageMember,
  VillageNotification,
} from "@/src/domain/types";
import { sortHelpRequestTypes } from "@/src/domain/helpTypes";
import { supabase } from "@/src/lib/supabase";

export type RemoteVillageSnapshot = {
  householdId: string;
  householdName: string;
  householdTimezone: string;
  currentMemberId: string;
  children: Child[];
  members: VillageMember[];
  events: CareEvent[];
  helpRequests: HelpRequest[];
  helpRequestTypes: HelpRequestType[];
  handoffs: Handoff[];
  notifications: VillageNotification[];
  invitations: HouseholdInvitation[];
};

function configured() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadRemoteVillage(): Promise<RemoteVillageSnapshot | null> {
  const client = configured();
  const preferredHousehold = await AsyncStorage.getItem(
    "village.active-household",
  );
  let membershipQuery = client
    .from("household_members")
    .select("id,household_id,household:households(name,timezone)")
    .eq("status", "ACTIVE")
    .limit(1);
  if (preferredHousehold)
    membershipQuery = membershipQuery.eq("household_id", preferredHousehold);
  let { data: membership, error } = await membershipQuery.maybeSingle();
  if (!membership && !error && preferredHousehold) {
    const fallback = await client
      .from("household_members")
      .select("id,household_id,household:households(name,timezone)")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();
    membership = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  if (!membership) return null;
  const householdId = membership.household_id as string;
  await AsyncStorage.setItem("village.active-household", householdId);
  const [
    childrenResult,
    membersResult,
    eventsResult,
    requestsResult,
    requestTypesResult,
    handoffsResult,
    notificationsResult,
    invitationsResult,
  ] = await Promise.all([
    client
      .from("children")
      .select("*,care_note:child_care_notes(content)")
      .eq("household_id", householdId),
    client
      .from("household_members")
      .select(
        "*,profile:profiles!household_members_user_id_fkey(display_name,avatar_path),member_capabilities(capability),member_child_permissions(child_id,can_view_profile,can_view_schedule,can_view_care_notes,can_participate_handoffs)",
      )
      .eq("household_id", householdId)
      .eq("status", "ACTIVE"),
    client
      .from("care_events")
      .select("*")
      .eq("household_id", householdId)
      .order("starts_at"),
    client
      .from("help_requests")
      .select("*,help_request_recipients(member_id)")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    client
      .from("help_request_types")
      .select("*")
      .eq("household_id", householdId)
      .is("archived_at", null)
      .order("created_at"),
    client
      .from("handoffs")
      .select("*,handoff_items(*)")
      .eq("household_id", householdId)
      .order("scheduled_at"),
    client
      .from("notifications")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    client
      .from("household_invitations")
      .select("*,invitation_child_permissions(child_id)")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
  ]);
  const firstError = [
    childrenResult,
    membersResult,
    eventsResult,
    requestsResult,
    requestTypesResult,
    handoffsResult,
    notificationsResult,
    invitationsResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  const children = (childrenResult.data ?? []).map((row: any): Child => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name ?? undefined,
    birthDate: row.birth_date ?? undefined,
    notes: (Array.isArray(row.care_note)
      ? row.care_note[0]?.content
      : row.care_note?.content) as string | undefined,
    avatarUrl: row.avatar_path ?? undefined,
    archived: Boolean(row.archived_at),
  }));
  const members = (membersResult.data ?? []).map((row: any): VillageMember => ({
    id: row.id,
    displayName: row.profile?.display_name ?? "Caregiver",
    relationship: row.relationship_label,
    role: row.role as MemberRole,
    capabilities: row.member_capabilities.map(
      (item: any) => item.capability as Capability,
    ),
    childIds: row.member_child_permissions.map((item: any) => item.child_id),
    childPermissions: Object.fromEntries(
      row.member_child_permissions.map((item: any) => [
        item.child_id,
        {
          profile: item.can_view_profile,
          schedule: item.can_view_schedule,
          careNotes: item.can_view_care_notes,
          handoffs: item.can_participate_handoffs,
        },
      ]),
    ),
    avatarUrl: row.profile?.avatar_path,
  }));
  await Promise.all(
    [...children, ...members].map(async (person) => {
      if (!person.avatarUrl) return;
      const { data } = await client.storage
        .from("avatars")
        .createSignedUrl(person.avatarUrl, 60 * 60);
      person.avatarUrl = data?.signedUrl;
    }),
  );
  return {
    householdId,
    householdName: (membership.household as any)?.name ?? "My Household",
    householdTimezone: (membership.household as any)?.timezone ?? "UTC",
    currentMemberId: membership.id as string,
    children,
    members,
    events: (eventsResult.data ?? []).map((row: any) => ({
      id: row.id,
      childId: row.child_id,
      type: row.event_type,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at ?? undefined,
      location: row.location ?? undefined,
      caregiverId: row.assigned_member_id ?? undefined,
      notes: row.notes ?? undefined,
      requiresCaregiver: row.requires_caregiver,
      status: row.status,
    })),
    helpRequests: (requestsResult.data ?? []).map((row: any) => ({
      id: row.id,
      childId: row.child_id,
      eventId: row.event_id,
      typeId: row.request_type,
      typeLabel: row.request_type_label,
      startsAt: row.starts_at,
      location: row.location,
      context: row.context ?? undefined,
      notes: row.notes ?? undefined,
      recipientIds: row.help_request_recipients.map(
        (item: any) => item.member_id,
      ),
      assignedMemberId: row.assigned_member_id ?? undefined,
      status: row.status,
    })),
    helpRequestTypes: sortHelpRequestTypes(
      (requestTypesResult.data ?? []).map((row: any): HelpRequestType => ({
        id: row.id,
        label: row.label,
        capability: row.capability ?? undefined,
        isOther: row.is_other,
      })),
    ),
    handoffs: (handoffsResult.data ?? []).map((row: any) => ({
      id: row.id,
      childId: row.child_id,
      fromMemberId: row.from_member_id,
      toMemberId: row.to_member_id,
      scheduledAt: row.scheduled_at,
      location: row.location ?? undefined,
      notes: row.notes ?? undefined,
      associatedEventId: row.associated_event_id ?? undefined,
      status: row.status,
      acceptedAt: row.accepted_at ?? undefined,
      items: row.handoff_items
        .sort((a: any, b: any) => a.position - b.position)
        .map((item: any) => ({
          id: item.id,
          label: item.label,
          ready: item.is_ready,
        })),
    })),
    notifications: (notificationsResult.data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      route: row.route ?? undefined,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
    })),
    invitations: (invitationsResult.data ?? []).map((row: any) => ({
      id: row.id,
      email: row.invited_email,
      relationship: row.relationship_label,
      role: row.role,
      capabilities: row.capabilities ?? [],
      childIds: row.invitation_child_permissions.map(
        (item: any) => item.child_id,
      ),
      status: row.status,
      expiresAt: row.expires_at,
    })),
  };
}

export async function createRemoteHousehold(
  name: string,
  timezone: string,
  childFirstName: string,
) {
  const { data, error } = await configured().rpc("create_household", {
    p_name: name,
    p_timezone: timezone,
    p_child_first_name: childFirstName,
  });
  if (error) throw error;
  return data as string;
}

export async function createRemoteHelp(input: {
  requestId: string;
  eventId: string;
  childId: string;
  typeId: string;
  startsAt: string;
  location: string;
  context?: string;
  notes?: string;
  recipientIds: string[];
}) {
  const { error } = await configured().rpc("create_help_request_with_event", {
    p_request_id: input.requestId,
    p_event_id: input.eventId,
    p_child_id: input.childId,
    p_request_type: input.typeId,
    p_starts_at: input.startsAt,
    p_location: input.location,
    p_context: input.context ?? null,
    p_notes: input.notes ?? null,
    p_recipient_member_ids: input.recipientIds,
  });
  if (error) throw error;
}
export async function acceptRemoteHelp(id: string) {
  const { error } = await configured().rpc("accept_help_request", {
    p_request_id: id,
  });
  if (error) throw error;
}
export async function acknowledgeRemoteHandoff(id: string) {
  const { error } = await configured().rpc("acknowledge_handoff", {
    p_handoff_id: id,
  });
  if (error) throw error;
}
export async function removeRemoteMember(id: string) {
  const { error } = await configured().rpc("remove_household_member", {
    p_member_id: id,
  });
  if (error) throw error;
}

export async function sendRemoteInvitation(input: {
  householdId: string;
  email: string;
  name: string;
  relationshipLabel: string;
  role: Exclude<MemberRole, "OWNER">;
  childIds: string[];
  capabilities: Capability[];
  householdName: string;
}) {
  const { data, error } = await configured().functions.invoke(
    "send-invitation",
    {
      body: {
        householdId: input.householdId,
        email: input.email,
        relationshipLabel: input.relationshipLabel,
        role: input.role,
        childIds: input.childIds,
        capabilities: input.capabilities,
        householdName: input.householdName,
        inviterName: input.name,
      },
    },
  );
  if (error) throw error;
  return data as {
    invitationId: string;
    inviteUrl: string;
    emailDelivered: boolean;
  };
}

export async function saveRemotePushToken(
  userId: string,
  token: string,
  platform: "ios" | "android",
) {
  const client = configured();
  const retired = await client
    .from("device_push_tokens")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("platform", platform)
    .neq("expo_push_token", token);
  if (retired.error) throw retired.error;
  const { error } = await client
    .from("device_push_tokens")
    .upsert(
      { user_id: userId, expo_push_token: token, platform, active: true },
      { onConflict: "expo_push_token" },
    );
  if (error) throw error;
}
