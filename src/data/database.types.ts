// Generated-compatible schema snapshot. Refresh it from a running local stack
// with `npm run supabase:types` whenever a migration changes.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type MemberRole =
  "OWNER" | "PARENT_GUARDIAN" | "TRUSTED_CAREGIVER" | "LIMITED_CAREGIVER";
type Capability =
  | "PICKUP"
  | "DROPOFF"
  | "TRANSPORTATION"
  | "BABYSITTING"
  | "EMERGENCY"
  | "OTHER";
type VillagePlanType =
  | "TRIAL"
  | "MONTHLY"
  | "ANNUAL"
  | "LIFETIME_FOUNDING_1"
  | "LIFETIME_FOUNDING_2";
type VillageEntitlementStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "GRACE_PERIOD"
  | "EXPIRED"
  | "LIFETIME"
  | "CANCELLED";

export type Database = {
  public: {
    Tables: {
      profiles: Table<{
        id: string;
        display_name: string;
        email: string;
        phone: string | null;
        avatar_path: string | null;
        created_at: string;
        updated_at: string;
      }>;
      households: Table<{
        id: string;
        name: string;
        owner_user_id: string;
        timezone: string;
        created_at: string;
      }>;
      household_members: Table<{
        id: string;
        household_id: string;
        user_id: string;
        role: MemberRole;
        relationship_label: string;
        status: "ACTIVE" | "REMOVED";
        joined_at: string;
        removed_at: string | null;
      }>;
      billing_settings: Table<{
        id: boolean;
        trial_days: number;
        grace_days: number;
        founding_total_limit: number;
        founding_offer_available: boolean;
        updated_at: string;
      }>;
      billing_catalog: Table<{
        plan_type: VillagePlanType;
        billing_interval: "MONTH" | "YEAR" | "LIFETIME" | null;
        amount_minor: number;
        currency: string;
        provider_name: string | null;
        provider_product_id: string | null;
        provider_price_id: string | null;
        founding_quantity_limit: number | null;
        available: boolean;
        updated_at: string;
      }>;
      village_entitlements: Table<{
        household_id: string;
        plan_type: VillagePlanType;
        lifecycle_status: VillageEntitlementStatus;
        trial_started_at: string | null;
        trial_ends_at: string | null;
        paid_period_started_at: string | null;
        paid_period_ends_at: string | null;
        cancelled_at: string | null;
        effective_ends_at: string | null;
        grace_expires_at: string | null;
        provider_name: string | null;
        provider_customer_id: string | null;
        provider_subscription_id: string | null;
        provider_product_id: string | null;
        provider_price_id: string | null;
        founding_cohort: number | null;
        founding_allocation_number: number | null;
        founding_purchased_at: string | null;
        last_provider_event_id: string | null;
        last_provider_event_created_at: string | null;
        provider_state_updated_at: string | null;
        last_reconciled_at: string | null;
        version: number;
        created_at: string;
        updated_at: string;
      }>;
      village_entitlement_events: Table<{
        id: string;
        household_id: string;
        entitlement_version: number;
        event_type: string;
        provider_name: string | null;
        provider_event_id: string | null;
        provider_event_created_at: string | null;
        previous_plan_type: VillagePlanType | null;
        plan_type: VillagePlanType;
        previous_lifecycle_status: VillageEntitlementStatus | null;
        lifecycle_status: VillageEntitlementStatus;
        effective_at: string;
        event_data: Json;
        recorded_at: string;
      }>;
      children: Table<{
        id: string;
        household_id: string;
        first_name: string;
        last_name: string | null;
        birth_date: string | null;
        avatar_path: string | null;
        archived_at: string | null;
        created_at: string;
      }>;
      child_care_notes: Table<{
        child_id: string;
        content: string;
        updated_by: string;
        updated_at: string;
      }>;
      member_child_permissions: Table<{
        member_id: string;
        child_id: string;
        can_view_profile: boolean;
        can_view_schedule: boolean;
        can_view_care_notes: boolean;
        can_participate_handoffs: boolean;
      }>;
      member_capabilities: Table<{
        member_id: string;
        capability: Capability;
      }>;
      household_invitations: Table<{
        id: string;
        household_id: string;
        invited_email: string;
        relationship_label: string;
        role: Exclude<MemberRole, "OWNER">;
        capabilities: Capability[];
        token_hash: string;
        status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
        expires_at: string;
        invited_by: string;
        accepted_by: string | null;
        created_at: string;
        responded_at: string | null;
      }>;
      invitation_child_permissions: Table<{
        invitation_id: string;
        child_id: string;
        can_view_profile: boolean;
        can_view_schedule: boolean;
        can_view_care_notes: boolean;
        can_participate_handoffs: boolean;
      }>;
      care_events: Table<{
        id: string;
        household_id: string;
        child_id: string;
        event_type: string;
        title: string;
        starts_at: string;
        ends_at: string | null;
        location: string | null;
        assigned_member_id: string | null;
        notes: string | null;
        requires_caregiver: boolean;
        status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
        created_by: string;
        created_at: string;
      }>;
      help_requests: Table<{
        id: string;
        household_id: string;
        child_id: string;
        event_id: string;
        request_type: Capability;
        starts_at: string;
        location: string;
        notes: string | null;
        status: "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
        assigned_member_id: string | null;
        created_by: string;
        created_at: string;
        completed_at: string | null;
        cancelled_at: string | null;
      }>;
      help_request_recipients: Table<{
        request_id: string;
        member_id: string;
        response: "PENDING" | "ACCEPTED" | "DECLINED";
        responded_at: string | null;
      }>;
      handoffs: Table<{
        id: string;
        household_id: string;
        child_id: string;
        from_member_id: string;
        to_member_id: string;
        scheduled_at: string;
        location: string | null;
        notes: string | null;
        associated_event_id: string | null;
        status: "SCHEDULED" | "READY" | "COMPLETED" | "CANCELLED";
        accepted_by: string | null;
        accepted_at: string | null;
        created_by: string;
        created_at: string;
      }>;
      handoff_items: Table<{
        id: string;
        handoff_id: string;
        label: string;
        is_ready: boolean;
        position: number;
      }>;
      notifications: Table<{
        id: string;
        household_id: string;
        recipient_member_id: string;
        type:
          | "INVITATION"
          | "HELP_REQUEST"
          | "HELP_ACCEPTED"
          | "ASSIGNMENT_CHANGED"
          | "HANDOFF_UPCOMING"
          | "HANDOFF_COMPLETED"
          | "HANDOFF_CANCELLED"
          | "COVERAGE_GAP";
        title: string;
        body: string;
        route: string | null;
        read_at: string | null;
        created_at: string;
      }>;
      device_push_tokens: Table<{
        id: string;
        user_id: string;
        expo_push_token: string;
        platform: "ios" | "android";
        active: boolean;
        updated_at: string;
      }>;
      notification_outbox: Table<{
        id: string;
        notification_id: string | null;
        invitation_id: string | null;
        channel: "PUSH" | "EMAIL";
        status: "PENDING" | "PROCESSING" | "DELIVERED" | "FAILED";
        attempts: number;
        next_attempt_at: string;
        lock_token: string | null;
        locked_at: string | null;
        delivered_at: string | null;
        last_error_code: string | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: {
          p_name: string;
          p_timezone: string;
          p_child_first_name: string;
        };
        Returns: string;
      };
      create_household_invitation: {
        Args: {
          p_household_id: string;
          p_email: string;
          p_relationship_label: string;
          p_role: Exclude<MemberRole, "OWNER">;
          p_child_ids: string[];
          p_capabilities: Capability[];
        };
        Returns: Json;
      };
      accept_household_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      decline_household_invitation: {
        Args: { p_token: string };
        Returns: undefined;
      };
      create_help_request_with_event: {
        Args: Record<string, Json>;
        Returns: string;
      };
      accept_help_request: {
        Args: { p_request_id: string };
        Returns: string;
      };
      respond_to_help_request: {
        Args: { p_request_id: string; p_can_help: boolean };
        Returns: string;
      };
      close_help_request: {
        Args: {
          p_request_id: string;
          p_status: "COMPLETED" | "CANCELLED";
        };
        Returns: undefined;
      };
      acknowledge_handoff: {
        Args: { p_handoff_id: string };
        Returns: string;
      };
      remove_household_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      expire_household_invitations: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_village_entitled: {
        Args: { p_household_id: string; p_at?: string };
        Returns: boolean;
      };
      get_village_entitlement_summary: {
        Args: { p_household_id: string; p_at?: string };
        Returns: {
          household_id: string;
          plan_type: VillagePlanType;
          lifecycle_status: VillageEntitlementStatus;
          is_entitled: boolean;
          access_expires_at: string | null;
        }[];
      };
    };
    Enums: {
      member_role: MemberRole;
      capability_type: Capability;
      membership_status: "ACTIVE" | "REMOVED";
      invitation_status:
        "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
      care_event_status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
      help_request_status: "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
      recipient_response: "PENDING" | "ACCEPTED" | "DECLINED";
      handoff_status: "SCHEDULED" | "READY" | "COMPLETED" | "CANCELLED";
      delivery_channel: "PUSH" | "EMAIL";
      delivery_status: "PENDING" | "PROCESSING" | "DELIVERED" | "FAILED";
      village_plan_type: VillagePlanType;
      village_entitlement_status: VillageEntitlementStatus;
      billing_interval: "MONTH" | "YEAR" | "LIFETIME";
    };
    CompositeTypes: Record<string, never>;
  };
};
