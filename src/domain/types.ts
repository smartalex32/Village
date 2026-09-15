export type MemberRole =
  "OWNER" | "PARENT_GUARDIAN" | "TRUSTED_CAREGIVER" | "LIMITED_CAREGIVER";
export type Capability =
  | "PICKUP"
  | "DROPOFF"
  | "TRANSPORTATION"
  | "BABYSITTING"
  | "EMERGENCY"
  | "OTHER";
export type CareEventStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type HelpRequestStatus = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
export type HandoffStatus = "SCHEDULED" | "READY" | "COMPLETED" | "CANCELLED";
export type InvitationStatus =
  "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
export type VillagePlanType =
  | "TRIAL"
  | "MONTHLY"
  | "ANNUAL"
  | "LIFETIME_FOUNDING_1"
  | "LIFETIME_FOUNDING_2";
export type VillageEntitlementStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "GRACE_PERIOD"
  | "EXPIRED"
  | "LIFETIME"
  | "CANCELLED";

export interface VillageEntitlementSummary {
  householdId: string;
  planType: VillagePlanType;
  lifecycleStatus: VillageEntitlementStatus;
  isEntitled: boolean;
  accessExpiresAt?: string;
}

export interface VillageEntitlement {
  householdId: string;
  planType: VillagePlanType;
  lifecycleStatus: VillageEntitlementStatus;
  trialStartedAt?: string;
  trialEndsAt?: string;
  paidPeriodStartedAt?: string;
  paidPeriodEndsAt?: string;
  cancelledAt?: string;
  effectiveEndsAt?: string;
  graceExpiresAt?: string;
  providerName?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerProductId?: string;
  providerPriceId?: string;
  foundingCohort?: number;
  foundingAllocationNumber?: number;
  foundingPurchasedAt?: string;
  lastProviderEventId?: string;
  lastProviderEventCreatedAt?: string;
  providerStateUpdatedAt?: string;
  lastReconciledAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSettings {
  trialDays: number;
  graceDays: number;
  foundingTotalLimit: number;
  foundingOfferAvailable: boolean;
}

export interface BillingCatalogPlan {
  planType: VillagePlanType;
  billingInterval?: "MONTH" | "YEAR" | "LIFETIME";
  amountMinor: number;
  currency: string;
  providerName?: string;
  providerProductId?: string;
  providerPriceId?: string;
  foundingQuantityLimit?: number;
  available: boolean;
}

export interface Child {
  id: string;
  firstName: string;
  lastName?: string;
  birthDate?: string;
  notes?: string;
  avatarUrl?: string;
  archived: boolean;
}

export interface VillageMember {
  id: string;
  displayName: string;
  relationship: string;
  role: MemberRole;
  capabilities: Capability[];
  availableLabel?: string;
  avatarUrl?: string;
  childIds: string[];
  childPermissions?: Record<string, ChildPermission>;
}

export type ChildPermissionScope =
  "profile" | "schedule" | "careNotes" | "handoffs";
export type ChildPermission = Record<ChildPermissionScope, boolean>;

export interface HouseholdInvitation {
  id: string;
  email: string;
  relationship: string;
  role: MemberRole;
  capabilities: Capability[];
  childIds: string[];
  status: InvitationStatus;
  expiresAt: string;
}

export interface CareEvent {
  id: string;
  childId: string;
  type: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  caregiverId?: string;
  notes?: string;
  requiresCaregiver: boolean;
  status: CareEventStatus;
}

export interface HelpRequestType {
  id: string;
  label: string;
  capability?: Capability;
  isOther: boolean;
}

export interface HelpRequest {
  id: string;
  childId: string;
  eventId: string;
  typeId: string;
  typeLabel: string;
  startsAt: string;
  location: string;
  context?: string;
  notes?: string;
  recipientIds: string[];
  assignedMemberId?: string;
  status: HelpRequestStatus;
}

export interface HandoffItem {
  id: string;
  label: string;
  ready: boolean;
}
export interface Handoff {
  id: string;
  childId: string;
  fromMemberId: string;
  toMemberId: string;
  scheduledAt: string;
  location?: string;
  notes?: string;
  associatedEventId?: string;
  status: HandoffStatus;
  items: HandoffItem[];
  acceptedAt?: string;
}

export interface VillageNotification {
  id: string;
  title: string;
  body: string;
  route?: string;
  read: boolean;
  createdAt: string;
}
