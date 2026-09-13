import type {
  CareEvent,
  Child,
  Handoff,
  HelpRequest,
  HelpRequestType,
  VillageMember,
  VillageNotification,
} from "@/src/domain/types";
import { defaultHelpRequestTypes } from "@/src/domain/helpTypes";

function at(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export const currentMemberId = "member-you";

export const demoChildren: Child[] = [
  {
    id: "emma",
    firstName: "Emma",
    birthDate: "2018-04-12",
    notes: "Reading homework is in the front pocket.",
    archived: false,
  },
  {
    id: "noah",
    firstName: "Noah",
    birthDate: "2021-02-08",
    notes: "Blue water bottle goes to school.",
    archived: false,
  },
];

export const demoMembers: VillageMember[] = [
  {
    id: currentMemberId,
    displayName: "Alex",
    relationship: "Parent",
    role: "OWNER",
    capabilities: [
      "PICKUP",
      "DROPOFF",
      "TRANSPORTATION",
      "BABYSITTING",
      "EMERGENCY",
    ],
    childIds: ["emma", "noah"],
  },
  {
    id: "grandma",
    displayName: "Grandma",
    relationship: "Grandmother",
    role: "TRUSTED_CAREGIVER",
    capabilities: ["PICKUP", "BABYSITTING", "TRANSPORTATION"],
    availableLabel: "Available",
    childIds: ["emma", "noah"],
  },
  {
    id: "grandpa",
    displayName: "Grandpa",
    relationship: "Grandfather",
    role: "TRUSTED_CAREGIVER",
    capabilities: ["PICKUP", "EMERGENCY"],
    availableLabel: "Available",
    childIds: ["emma", "noah"],
  },
  {
    id: "sarah",
    displayName: "Sarah",
    relationship: "Friend",
    role: "LIMITED_CAREGIVER",
    capabilities: ["PICKUP", "TRANSPORTATION"],
    availableLabel: "Usually available",
    childIds: ["emma"],
  },
  {
    id: "michael",
    displayName: "Michael",
    relationship: "Brother",
    role: "TRUSTED_CAREGIVER",
    capabilities: ["EMERGENCY"],
    availableLabel: "Available",
    childIds: ["emma", "noah"],
  },
  {
    id: "taylor",
    displayName: "Taylor",
    relationship: "Babysitter",
    role: "LIMITED_CAREGIVER",
    capabilities: ["BABYSITTING"],
    availableLabel: "Available",
    childIds: ["emma", "noah"],
  },
];

export const demoEvents: CareEvent[] = [
  {
    id: "school",
    childId: "emma",
    type: "SCHOOL",
    title: "School",
    startsAt: at(0, 8),
    location: "Westside Elementary",
    caregiverId: currentMemberId,
    requiresCaregiver: false,
    status: "SCHEDULED",
  },
  {
    id: "pickup",
    childId: "emma",
    type: "PICKUP",
    title: "School pickup",
    startsAt: at(0, 15, 15),
    location: "Westside Elementary",
    caregiverId: "grandma",
    requiresCaregiver: true,
    status: "SCHEDULED",
  },
  {
    id: "dentist",
    childId: "noah",
    type: "APPOINTMENT",
    title: "Dentist",
    startsAt: at(0, 16),
    location: "Riverside Dental",
    caregiverId: currentMemberId,
    requiresCaregiver: true,
    status: "SCHEDULED",
  },
  {
    id: "soccer",
    childId: "emma",
    type: "ACTIVITY",
    title: "Soccer practice",
    startsAt: at(0, 17, 30),
    location: "Lakeside Fields",
    caregiverId: currentMemberId,
    requiresCaregiver: true,
    status: "SCHEDULED",
  },
  {
    id: "homework",
    childId: "emma",
    type: "OTHER",
    title: "Homework",
    startsAt: at(0, 19, 30),
    location: "At home",
    caregiverId: currentMemberId,
    requiresCaregiver: false,
    status: "SCHEDULED",
  },
  {
    id: "gap",
    childId: "emma",
    type: "PICKUP",
    title: "School pickup",
    startsAt: at(2, 15, 15),
    location: "Westside Elementary",
    requiresCaregiver: true,
    status: "SCHEDULED",
  },
];

export const demoHandoffs: Handoff[] = [
  {
    id: "handoff-emma-current",
    childId: "emma",
    fromMemberId: currentMemberId,
    toMemberId: "grandma",
    scheduledAt: at(0, 7, 45),
    location: "Westside Elementary",
    status: "COMPLETED",
    acceptedAt: at(0, 7, 48),
    items: [],
  },
  {
    id: "handoff-noah-current",
    childId: "noah",
    fromMemberId: "grandma",
    toMemberId: currentMemberId,
    scheduledAt: at(0, 7, 30),
    location: "At home",
    status: "COMPLETED",
    acceptedAt: at(0, 7, 32),
    items: [],
  },
  {
    id: "handoff-emma",
    childId: "emma",
    fromMemberId: "grandma",
    toMemberId: currentMemberId,
    scheduledAt: at(0, 17, 15),
    location: "At home",
    notes: "Reading homework still needs to be finished.",
    associatedEventId: "soccer",
    status: "SCHEDULED",
    items: [
      { id: "backpack", label: "Backpack", ready: true },
      { id: "cleats", label: "Soccer cleats", ready: true },
      { id: "medication", label: "Medication", ready: true },
      { id: "water", label: "Water bottle", ready: false },
      { id: "homework-item", label: "Homework", ready: false },
    ],
  },
];

export const demoHelpRequests: HelpRequest[] = [];

export const demoHelpRequestTypes: HelpRequestType[] = defaultHelpRequestTypes;

export const demoNotifications: VillageNotification[] = [
  {
    id: "notification-1",
    title: "Handoff today",
    body: "Grandma will hand Emma off to you at 5:15 PM.",
    route: "/handoff/handoff-emma",
    read: false,
    createdAt: at(0, 9),
  },
];
