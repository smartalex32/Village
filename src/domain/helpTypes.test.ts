import {
  defaultHelpRequestTypes,
  isEligibleForHelpType,
  sortHelpRequestTypes,
} from "./helpTypes";
import type { VillageMember } from "./types";

const caregiver: VillageMember = {
  id: "caregiver",
  displayName: "Caregiver",
  relationship: "Friend",
  role: "TRUSTED_CAREGIVER",
  capabilities: ["PICKUP"],
  childIds: ["child"],
};

test("Other and custom request types are available without a matching capability", () => {
  const other = defaultHelpRequestTypes.find((type) => type.isOther)!;
  const custom = { id: "custom", label: "Medication pickup", isOther: false };

  expect(isEligibleForHelpType(caregiver, "child", other)).toBe(true);
  expect(isEligibleForHelpType(caregiver, "child", custom)).toBe(true);
  expect(
    isEligibleForHelpType(
      caregiver,
      "child",
      defaultHelpRequestTypes.find((type) => type.id === "BABYSITTING")!,
    ),
  ).toBe(false);
});

test("child access remains required for every help request type", () => {
  const other = defaultHelpRequestTypes.find((type) => type.isOther)!;

  expect(isEligibleForHelpType(caregiver, "another-child", other)).toBe(false);
});

test("help request types are alphabetical with Other last", () => {
  const types = sortHelpRequestTypes([
    defaultHelpRequestTypes.find((type) => type.id === "OTHER")!,
    { id: "z", label: "Zoo visit", isOther: false },
    { id: "b", label: "Babysitting", isOther: false },
    { id: "a", label: "airport ride", isOther: false },
  ]);

  expect(types.map((type) => type.label)).toEqual([
    "airport ride",
    "Babysitting",
    "Zoo visit",
    "Other",
  ]);
});
