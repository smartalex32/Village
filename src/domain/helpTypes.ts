import type { HelpRequestType, VillageMember } from "./types";

export function sortHelpRequestTypes(types: HelpRequestType[]) {
  return [...types].sort((left, right) => {
    if (left.isOther !== right.isOther) return left.isOther ? 1 : -1;

    return left.label.localeCompare(right.label, undefined, {
      sensitivity: "base",
    });
  });
}

export const defaultHelpRequestTypes: HelpRequestType[] = sortHelpRequestTypes([
  {
    id: "BABYSITTING",
    label: "Babysitting",
    capability: "BABYSITTING",
    isOther: false,
  },
  {
    id: "DROPOFF",
    label: "Dropoff",
    capability: "DROPOFF",
    isOther: false,
  },
  {
    id: "TRANSPORTATION",
    label: "Transportation",
    capability: "TRANSPORTATION",
    isOther: false,
  },
  { id: "OTHER", label: "Other", isOther: true },
]);

export function isEligibleForHelpType(
  member: VillageMember,
  childId: string,
  type: HelpRequestType,
) {
  return (
    member.childIds.includes(childId) &&
    (!type.capability || member.capabilities.includes(type.capability))
  );
}
