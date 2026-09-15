import {
  canAcceptHelp,
  canAcknowledgeHandoff,
  coverageGaps,
  initials,
} from "./rules";
import type { CareEvent, Handoff, HelpRequest } from "./types";

const event = (overrides: Partial<CareEvent> = {}): CareEvent => ({
  id: "event",
  childId: "child",
  type: "PICKUP",
  title: "Pickup",
  startsAt: "2026-09-06T20:00:00.000Z",
  requiresCaregiver: true,
  status: "SCHEDULED",
  ...overrides,
});

test("coverage gaps include only future scheduled responsibilities without a caregiver", () => {
  const now = new Date("2026-09-06T18:00:00.000Z");
  expect(
    coverageGaps(
      [
        event(),
        event({ id: "assigned", caregiverId: "grandma" }),
        event({ id: "past", startsAt: "2026-09-06T17:00:00.000Z" }),
        event({ id: "cancelled", status: "CANCELLED" }),
        event({ id: "optional", requiresCaregiver: false }),
      ],
      now,
    ).map((item) => item.id),
  ).toEqual(["event"]);
});

test("only an invited caregiver can accept an open unassigned request", () => {
  const request: HelpRequest = {
    id: "request",
    childId: "child",
    eventId: "event",
    typeId: "PICKUP",
    typeLabel: "Pickup",
    startsAt: "2026-09-06T20:00:00.000Z",
    location: "School",
    recipientIds: ["grandma"],
    status: "OPEN",
  };
  expect(canAcceptHelp(request, "grandma")).toBe(true);
  expect(canAcceptHelp(request, "stranger")).toBe(false);
  expect(canAcceptHelp({ ...request, status: "CANCELLED" }, "grandma")).toBe(
    false,
  );
  expect(
    canAcceptHelp({ ...request, assignedMemberId: "grandpa" }, "grandma"),
  ).toBe(false);
});

test("only the receiving caregiver can acknowledge an active handoff", () => {
  const handoff: Handoff = {
    id: "handoff",
    childId: "child",
    fromMemberId: "grandma",
    toMemberId: "parent",
    scheduledAt: "2026-09-06T22:00:00.000Z",
    status: "READY",
    items: [],
  };
  expect(canAcknowledgeHandoff(handoff, "parent")).toBe(true);
  expect(canAcknowledgeHandoff(handoff, "grandma")).toBe(false);
  expect(
    canAcknowledgeHandoff({ ...handoff, status: "COMPLETED" }, "parent"),
  ).toBe(false);
});

test("initials remain compact and predictable", () => {
  expect(initials("Alex Morgan")).toBe("AM");
  expect(initials("Grandma")).toBe("G");
});
