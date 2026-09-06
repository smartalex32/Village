import { randomUUID } from "expo-crypto";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  currentMemberId as demoCurrentMemberId,
  demoChildren,
  demoEvents,
  demoHandoffs,
  demoHelpRequests,
  demoMembers,
  demoNotifications,
} from "@/src/data/demo";
import {
  acknowledgeRemoteHandoff,
  acceptRemoteHelp,
  createRemoteHelp,
  loadRemoteVillage,
  removeRemoteMember,
} from "@/src/data/supabaseRepository";
import {
  canAcceptHelp,
  canAcknowledgeHandoff,
  coverageGaps,
} from "@/src/domain/rules";
import type {
  Capability,
  CareEvent,
  Child,
  ChildPermissionScope,
  Handoff,
  HelpRequest,
  HouseholdInvitation,
  VillageMember,
  VillageNotification,
} from "@/src/domain/types";
import { isSupabaseConfigured, supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";

type NewHelp = {
  childId: string;
  type: Capability;
  startsAt: string;
  location: string;
  notes?: string;
  recipientIds: string[];
  eventId?: string;
};
type VillageContextValue = {
  householdName: string;
  householdTimezone: string;
  householdId?: string;
  backendState: "demo" | "syncing" | "connected" | "error";
  setHouseholdName(name: string): void;
  currentMemberId: string;
  children: Child[];
  members: VillageMember[];
  events: CareEvent[];
  helpRequests: HelpRequest[];
  handoffs: Handoff[];
  notifications: VillageNotification[];
  invitations: HouseholdInvitation[];
  gaps: CareEvent[];
  addChild(input: Omit<Child, "id" | "archived">): Child;
  updateChild(id: string, input: Partial<Omit<Child, "id">>): void;
  uploadChildAvatar(id: string, uri: string): Promise<void>;
  archiveChild(id: string): void;
  addEvent(input: Omit<CareEvent, "id" | "status">): CareEvent;
  updateEvent(id: string, input: Partial<Omit<CareEvent, "id">>): void;
  cancelEvent(id: string): void;
  createHelpRequest(input: NewHelp): HelpRequest;
  acceptHelpRequest(id: string, memberId?: string): boolean;
  declineHelpRequest(id: string, memberId?: string): void;
  closeHelpRequest(id: string, status: "COMPLETED" | "CANCELLED"): void;
  createHandoff(input: Omit<Handoff, "id" | "status" | "acceptedAt">): Handoff;
  toggleHandoffItem(handoffId: string, itemId: string): void;
  markHandoffReady(id: string): void;
  acknowledgeHandoff(id: string, memberId?: string): boolean;
  inviteMember(
    name: string,
    relationship: string,
    capabilities: Capability[],
  ): VillageMember;
  removeMember(id: string): void;
  toggleMemberChildAccess(memberId: string, childId: string): void;
  toggleMemberChildPermission(
    memberId: string,
    childId: string,
    scope: ChildPermissionScope,
  ): void;
  toggleMemberCapability(memberId: string, capability: Capability): void;
  revokeInvitation(id: string): void;
  markNotificationsRead(): void;
  refreshRemote(): Promise<void>;
};

const VillageContext = createContext<VillageContextValue | null>(null);

export function VillageProvider({ children: content }: PropsWithChildren) {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string>();
  const [activeMemberId, setActiveMemberId] = useState(
    isSupabaseConfigured ? "" : demoCurrentMemberId,
  );
  const [backendState, setBackendState] = useState<
    VillageContextValue["backendState"]
  >(isSupabaseConfigured ? "syncing" : "demo");
  const [householdName, setHouseholdName] = useState(
    isSupabaseConfigured ? "" : "The Alexander Family",
  );
  const [householdTimezone, setHouseholdTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [children, setChildren] = useState(
    isSupabaseConfigured ? [] : demoChildren,
  );
  const [members, setMembers] = useState(
    isSupabaseConfigured ? [] : demoMembers,
  );
  const [events, setEvents] = useState(isSupabaseConfigured ? [] : demoEvents);
  const [helpRequests, setHelpRequests] = useState(
    isSupabaseConfigured ? [] : demoHelpRequests,
  );
  const [handoffs, setHandoffs] = useState(
    isSupabaseConfigured ? [] : demoHandoffs,
  );
  const [notifications, setNotifications] = useState(
    isSupabaseConfigured ? [] : demoNotifications,
  );
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);

  const refreshRemote = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    setBackendState("syncing");
    try {
      const snapshot = await loadRemoteVillage();
      if (snapshot) {
        setHouseholdId(snapshot.householdId);
        setHouseholdName(snapshot.householdName);
        setHouseholdTimezone(snapshot.householdTimezone);
        setActiveMemberId(snapshot.currentMemberId);
        setChildren(snapshot.children);
        setMembers(snapshot.members);
        setEvents(snapshot.events);
        setHelpRequests(snapshot.helpRequests);
        setHandoffs(snapshot.handoffs);
        setNotifications(snapshot.notifications);
        setInvitations(snapshot.invitations);
      } else {
        setHouseholdId(undefined);
        setChildren([]);
        setMembers([]);
        setEvents([]);
        setHelpRequests([]);
        setHandoffs([]);
        setNotifications([]);
        setInvitations([]);
      }
      setBackendState("connected");
    } catch {
      setBackendState("error");
    }
  }, [user]);

  useEffect(() => {
    const hydration = setTimeout(() => void refreshRemote(), 0);
    return () => clearTimeout(hydration);
  }, [refreshRemote]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshRemote();
    });
    return () => subscription.remove();
  }, [refreshRemote]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected === false) setBackendState("error");
      else if (state.isConnected) void refreshRemote();
    });
  }, [refreshRemote]);

  useEffect(() => {
    if (!supabase || !householdId) return;
    const client = supabase;
    const channel = client
      .channel(`village:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        void refreshRemote();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [householdId, refreshRemote]);

  function notify(title: string, body: string, route?: string) {
    setNotifications((items) => [
      {
        id: randomUUID(),
        title,
        body,
        route,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
  }

  function addChild(input: Omit<Child, "id" | "archived">) {
    const child = { ...input, id: randomUUID(), archived: false };
    setChildren((items) => [...items, child]);
    if (supabase && householdId)
      void (async () => {
        const { error } = await supabase.from("children").insert({
          id: child.id,
          household_id: householdId,
          first_name: child.firstName,
          last_name: child.lastName,
          birth_date: child.birthDate,
        });
        if (error) throw error;
        if (child.notes) {
          const noteResult = await supabase.from("child_care_notes").insert({
            child_id: child.id,
            content: child.notes,
            updated_by: activeMemberId,
          });
          if (noteResult.error) throw noteResult.error;
        }
      })().catch(() => {
        setBackendState("error");
      });
    return child;
  }

  function archiveChild(id: string) {
    setChildren((items) =>
      items.map((child) =>
        child.id === id ? { ...child, archived: true } : child,
      ),
    );
    if (supabase)
      void supabase
        .from("children")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
  }

  function updateChild(id: string, input: Partial<Omit<Child, "id">>) {
    setChildren((items) =>
      items.map((child) => (child.id === id ? { ...child, ...input } : child)),
    );
    if (supabase)
      void (async () => {
        const { error } = await supabase
          .from("children")
          .update({
            first_name: input.firstName,
            last_name: input.lastName,
            birth_date: input.birthDate,
          })
          .eq("id", id);
        if (error) throw error;
        if (input.notes !== undefined) {
          if (input.notes.trim()) {
            const result = await supabase.from("child_care_notes").upsert({
              child_id: id,
              content: input.notes.trim(),
              updated_by: activeMemberId,
              updated_at: new Date().toISOString(),
            });
            if (result.error) throw result.error;
          } else {
            const result = await supabase
              .from("child_care_notes")
              .delete()
              .eq("child_id", id);
            if (result.error) throw result.error;
          }
        }
      })().catch(() => setBackendState("error"));
  }

  async function uploadChildAvatar(id: string, uri: string) {
    if (!supabase || !householdId) {
      updateChild(id, { avatarUrl: uri });
      return;
    }
    const path = `${householdId}/children/${id}.jpg`;
    const file = await fetch(uri).then((response) => response.arrayBuffer());
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (error) throw error;
    const result = await supabase
      .from("children")
      .update({ avatar_path: path })
      .eq("id", id);
    if (result.error) throw result.error;
    setChildren((items) =>
      items.map((child) =>
        child.id === id ? { ...child, avatarUrl: uri } : child,
      ),
    );
  }

  function addEvent(input: Omit<CareEvent, "id" | "status">) {
    const event: CareEvent = {
      ...input,
      id: randomUUID(),
      status: "SCHEDULED",
    };
    setEvents((items) => [...items, event]);
    if (supabase && householdId)
      void supabase
        .from("care_events")
        .upsert(
          {
            id: event.id,
            household_id: householdId,
            child_id: event.childId,
            event_type: event.type,
            title: event.title,
            starts_at: event.startsAt,
            ends_at: event.endsAt,
            location: event.location,
            assigned_member_id: event.caregiverId,
            notes: event.notes,
            requires_caregiver: event.requiresCaregiver,
            created_by: activeMemberId,
          },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
    return event;
  }

  function createHelpRequest(input: NewHelp) {
    const linked = input.eventId
      ? events.find((event) => event.id === input.eventId)
      : undefined;
    const event: CareEvent =
      linked ??
      ({
        id: randomUUID(),
        childId: input.childId,
        type: input.type,
        title: input.type.toLowerCase().replace("_", " "),
        startsAt: input.startsAt,
        location: input.location,
        notes: input.notes,
        requiresCaregiver: true,
        status: "SCHEDULED",
      } satisfies CareEvent);
    if (!linked) setEvents((items) => [...items, event]);
    const { eventId: _eventId, ...requestInput } = input;
    const request: HelpRequest = {
      ...requestInput,
      id: randomUUID(),
      eventId: event.id,
      status: "OPEN",
    };
    setHelpRequests((items) => [request, ...items]);
    if (supabase)
      void createRemoteHelp({
        requestId: request.id,
        eventId: event.id,
        childId: request.childId,
        type: request.type,
        startsAt: request.startsAt,
        location: request.location,
        notes: request.notes,
        recipientIds: request.recipientIds,
      }).catch(() => setBackendState("error"));
    notify(
      "Help request sent",
      `Your request was sent to ${input.recipientIds.length} people.`,
      `/help-sent?id=${request.id}`,
    );
    return request;
  }

  function updateEvent(id: string, input: Partial<Omit<CareEvent, "id">>) {
    setEvents((items) =>
      items.map((event) => (event.id === id ? { ...event, ...input } : event)),
    );
    if (supabase)
      void supabase
        .from("care_events")
        .update({
          child_id: input.childId,
          event_type: input.type,
          title: input.title,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          location: input.location,
          assigned_member_id: input.caregiverId,
          notes: input.notes,
          requires_caregiver: input.requiresCaregiver,
          status: input.status,
        })
        .eq("id", id)
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
  }

  function cancelEvent(id: string) {
    updateEvent(id, { status: "CANCELLED" });
    setHelpRequests((items) =>
      items.map((request) =>
        request.eventId === id && request.status === "OPEN"
          ? { ...request, status: "CANCELLED" }
          : request,
      ),
    );
    if (supabase)
      void supabase
        .from("help_requests")
        .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
        .eq("event_id", id)
        .eq("status", "OPEN");
  }

  function acceptHelpRequest(id: string, memberId = activeMemberId) {
    const request = helpRequests.find((item) => item.id === id);
    if (!request || !canAcceptHelp(request, memberId)) return false;
    setHelpRequests((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, status: "ASSIGNED", assignedMemberId: memberId }
          : item,
      ),
    );
    setEvents((items) =>
      items.map((event) =>
        event.id === request.eventId
          ? { ...event, caregiverId: memberId }
          : event,
      ),
    );
    notify(
      "Help is covered",
      `${members.find((member) => member.id === memberId)?.displayName ?? "A caregiver"} can help.`,
      `/help-sent?id=${id}`,
    );
    if (supabase)
      void acceptRemoteHelp(id).catch(() => {
        setBackendState("error");
        void refreshRemote();
      });
    return true;
  }

  function closeHelpRequest(id: string, status: "COMPLETED" | "CANCELLED") {
    const request = helpRequests.find((item) => item.id === id);
    if (!request) return;
    setHelpRequests((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    setEvents((items) =>
      items.map((event) =>
        event.id === request.eventId ? { ...event, status } : event,
      ),
    );
    if (supabase)
      void supabase
        .rpc("close_help_request", {
          p_request_id: id,
          p_status: status,
        })
        .then(({ error }) => {
          if (error) {
            setBackendState("error");
            void refreshRemote();
          }
        });
  }

  function declineHelpRequest(id: string, memberId = activeMemberId) {
    setHelpRequests((items) =>
      items.map((request) =>
        request.id === id
          ? {
              ...request,
              recipientIds: request.recipientIds.filter(
                (recipientId) => recipientId !== memberId,
              ),
            }
          : request,
      ),
    );
    if (supabase)
      void supabase
        .rpc("respond_to_help_request", {
          p_request_id: id,
          p_can_help: false,
        })
        .then(({ error }) => {
          if (error) {
            setBackendState("error");
            void refreshRemote();
          }
        });
  }

  function createHandoff(input: Omit<Handoff, "id" | "status" | "acceptedAt">) {
    const handoff: Handoff = {
      ...input,
      id: randomUUID(),
      status: "SCHEDULED",
    };
    setHandoffs((items) => [handoff, ...items]);
    if (supabase && householdId)
      void (async () => {
        const { error } = await supabase.from("handoffs").upsert(
          {
            id: handoff.id,
            household_id: householdId,
            child_id: handoff.childId,
            from_member_id: handoff.fromMemberId,
            to_member_id: handoff.toMemberId,
            scheduled_at: handoff.scheduledAt,
            location: handoff.location,
            notes: handoff.notes,
            associated_event_id: handoff.associatedEventId,
            created_by: activeMemberId,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (error) throw error;
        if (handoff.items.length) {
          const result = await supabase.from("handoff_items").upsert(
            handoff.items.map((item, position) => ({
              id: item.id,
              handoff_id: handoff.id,
              label: item.label,
              is_ready: item.ready,
              position,
            })),
            { onConflict: "id", ignoreDuplicates: true },
          );
          if (result.error) throw result.error;
        }
      })().catch(() => setBackendState("error"));
    notify(
      "New handoff",
      "A handoff has been scheduled.",
      `/handoff/${handoff.id}`,
    );
    return handoff;
  }

  function toggleHandoffItem(handoffId: string, itemId: string) {
    const current = handoffs
      .find((handoff) => handoff.id === handoffId)
      ?.items.find((item) => item.id === itemId);
    setHandoffs((items) =>
      items.map((handoff) =>
        handoff.id === handoffId
          ? {
              ...handoff,
              items: handoff.items.map((item) =>
                item.id === itemId ? { ...item, ready: !item.ready } : item,
              ),
            }
          : handoff,
      ),
    );
    if (supabase && current)
      void supabase
        .from("handoff_items")
        .update({ is_ready: !current.ready })
        .eq("id", itemId)
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
  }
  function markHandoffReady(id: string) {
    setHandoffs((items) =>
      items.map((item) =>
        item.id === id && item.status === "SCHEDULED"
          ? { ...item, status: "READY" }
          : item,
      ),
    );
    if (supabase)
      void supabase
        .from("handoffs")
        .update({ status: "READY" })
        .eq("id", id)
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
  }
  function acknowledgeHandoff(id: string, memberId = activeMemberId) {
    const handoff = handoffs.find((item) => item.id === id);
    if (!handoff || !canAcknowledgeHandoff(handoff, memberId)) return false;
    setHandoffs((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "COMPLETED",
              acceptedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    notify(
      "Handoff complete",
      "Responsibility has been acknowledged and transferred.",
      `/handoff/${id}`,
    );
    if (supabase)
      void acknowledgeRemoteHandoff(id).catch(() => {
        setBackendState("error");
        void refreshRemote();
      });
    return true;
  }

  function inviteMember(
    name: string,
    relationship: string,
    capabilities: Capability[],
  ) {
    const member: VillageMember = {
      id: randomUUID(),
      displayName: name,
      relationship,
      role: "TRUSTED_CAREGIVER",
      capabilities,
      childIds: children
        .filter((child) => !child.archived)
        .map((child) => child.id),
      availableLabel: "Invited",
    };
    setMembers((items) => [...items, member]);
    return member;
  }

  function removeMember(id: string) {
    setMembers((items) => items.filter((member) => member.id !== id));
    setEvents((items) =>
      items.map((event) =>
        event.caregiverId === id && new Date(event.startsAt) > new Date()
          ? { ...event, caregiverId: undefined }
          : event,
      ),
    );
    setHandoffs((items) =>
      items.map((handoff) =>
        (handoff.fromMemberId === id || handoff.toMemberId === id) &&
        handoff.status !== "COMPLETED"
          ? { ...handoff, status: "CANCELLED" }
          : handoff,
      ),
    );
    notify(
      "Coverage changed",
      "A removed caregiver’s future assignments now need attention.",
    );
    if (supabase)
      void removeRemoteMember(id).catch(() => {
        setBackendState("error");
        void refreshRemote();
      });
  }

  function toggleMemberChildAccess(memberId: string, childId: string) {
    const member = members.find((item) => item.id === memberId);
    if (!member) return;
    const hasAccess = member.childIds.includes(childId);
    setMembers((items) =>
      items.map((item) =>
        item.id === memberId
          ? {
              ...item,
              childIds: hasAccess
                ? item.childIds.filter((id) => id !== childId)
                : [...item.childIds, childId],
              childPermissions: hasAccess
                ? Object.fromEntries(
                    Object.entries(item.childPermissions ?? {}).filter(
                      ([id]) => id !== childId,
                    ),
                  )
                : {
                    ...item.childPermissions,
                    [childId]: {
                      profile: true,
                      schedule: false,
                      careNotes: false,
                      handoffs: true,
                    },
                  },
            }
          : item,
      ),
    );
    if (supabase) {
      const operation = hasAccess
        ? supabase
            .from("member_child_permissions")
            .delete()
            .eq("member_id", memberId)
            .eq("child_id", childId)
        : supabase.from("member_child_permissions").insert({
            member_id: memberId,
            child_id: childId,
            can_view_profile: true,
            can_view_schedule: false,
            can_view_care_notes: false,
            can_participate_handoffs: true,
          });
      void operation.then(({ error }) => {
        if (error) setBackendState("error");
      });
    }
  }

  function toggleMemberCapability(memberId: string, capability: Capability) {
    const member = members.find((item) => item.id === memberId);
    if (!member) return;
    const enabled = member.capabilities.includes(capability);
    setMembers((items) =>
      items.map((item) =>
        item.id === memberId
          ? {
              ...item,
              capabilities: enabled
                ? item.capabilities.filter((item) => item !== capability)
                : [...item.capabilities, capability],
            }
          : item,
      ),
    );
    if (supabase) {
      const operation = enabled
        ? supabase
            .from("member_capabilities")
            .delete()
            .eq("member_id", memberId)
            .eq("capability", capability)
        : supabase
            .from("member_capabilities")
            .insert({ member_id: memberId, capability });
      void operation.then(({ error }) => {
        if (error) setBackendState("error");
      });
    }
  }

  function toggleMemberChildPermission(
    memberId: string,
    childId: string,
    scope: ChildPermissionScope,
  ) {
    const member = members.find((item) => item.id === memberId);
    if (!member) return;
    const current = member.childPermissions?.[childId] ?? {
      profile: member.childIds.includes(childId),
      schedule: false,
      careNotes: false,
      handoffs: member.childIds.includes(childId),
    };
    const next = { ...current, [scope]: !current[scope] };
    const hasAny = Object.values(next).some(Boolean);
    setMembers((items) =>
      items.map((item) =>
        item.id === memberId
          ? {
              ...item,
              childIds: hasAny
                ? Array.from(new Set([...item.childIds, childId]))
                : item.childIds.filter((id) => id !== childId),
              childPermissions: {
                ...item.childPermissions,
                [childId]: next,
              },
            }
          : item,
      ),
    );
    if (supabase)
      void supabase
        .from("member_child_permissions")
        .upsert({
          member_id: memberId,
          child_id: childId,
          can_view_profile: next.profile,
          can_view_schedule: next.schedule,
          can_view_care_notes: next.careNotes,
          can_participate_handoffs: next.handoffs,
        })
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
  }

  function revokeInvitation(id: string) {
    setInvitations((items) =>
      items.map((item) =>
        item.id === id ? { ...item, status: "REVOKED" } : item,
      ),
    );
    if (supabase)
      void supabase
        .from("household_invitations")
        .update({ status: "REVOKED", responded_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "PENDING")
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
  }

  const markNotificationsRead = useCallback(() => {
    setNotifications((items) =>
      items.map((item) => (item.read ? item : { ...item, read: true })),
    );
    if (supabase)
      void supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .then(({ error }) => {
          if (error) setBackendState("error");
        });
  }, []);

  const value: VillageContextValue = {
    householdName,
    householdTimezone,
    householdId,
    backendState,
    setHouseholdName,
    currentMemberId: activeMemberId,
    children,
    members,
    events,
    helpRequests,
    handoffs,
    notifications,
    invitations,
    gaps: coverageGaps(events),
    addChild,
    updateChild,
    uploadChildAvatar,
    archiveChild,
    addEvent,
    updateEvent,
    cancelEvent,
    createHelpRequest,
    acceptHelpRequest,
    declineHelpRequest,
    closeHelpRequest,
    createHandoff,
    toggleHandoffItem,
    markHandoffReady,
    acknowledgeHandoff,
    inviteMember,
    removeMember,
    toggleMemberChildAccess,
    toggleMemberChildPermission,
    toggleMemberCapability,
    revokeInvitation,
    markNotificationsRead,
    refreshRemote,
  };
  return (
    <VillageContext.Provider value={value}>{content}</VillageContext.Provider>
  );
}

export function useVillage() {
  const value = useContext(VillageContext);
  if (!value) throw new Error("useVillage must be used inside VillageProvider");
  return value;
}
