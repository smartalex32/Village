import {
  coordinationAttention,
  isHandoffOverdue,
  latestAcknowledgment,
  nextActiveHandoff,
  nobodyAvailable,
} from "./coordination";
import type { CareEvent, Handoff, HelpRequest } from "./types";

const now = new Date("2026-10-05T18:00:00Z");
const event: CareEvent = {
  id: "event",
  childId: "child",
  type: "PICKUP",
  title: "Pickup",
  startsAt: "2026-10-05T19:00:00Z",
  requiresCaregiver: true,
  status: "SCHEDULED",
};
const request: HelpRequest = {
  id: "request",
  childId: "child",
  eventId: "event",
  typeId: "PICKUP",
  typeLabel: "Pickup",
  startsAt: event.startsAt,
  location: "School",
  recipientIds: ["grandma", "grandpa"],
  recipientResponses: { grandma: "DECLINED", grandpa: "PENDING" },
  createdByMemberId: "parent",
  status: "OPEN",
};
const handoff: Handoff = {
  id: "handoff",
  childId: "child",
  fromMemberId: "grandma",
  toMemberId: "parent",
  scheduledAt: "2026-10-05T17:00:00Z",
  status: "READY",
  items: [],
};

test("an unanswered handoff becomes overdue without changing its status", () => {
  expect(isHandoffOverdue(handoff, now)).toBe(true);
  expect(
    isHandoffOverdue({ ...handoff, scheduledAt: now.toISOString() }, now),
  ).toBe(false);
  expect(isHandoffOverdue({ ...handoff, status: "COMPLETED" }, now)).toBe(
    false,
  );
  expect(isHandoffOverdue({ ...handoff, status: "CANCELLED" }, now)).toBe(
    false,
  );
});

test("the first unresolved handoff is selected chronologically instead of insertion order", () => {
  expect(
    nextActiveHandoff(
      [
        { ...handoff, id: "future", scheduledAt: "2026-10-06T17:00:00Z" },
        { ...handoff, id: "closed", status: "COMPLETED" },
        handoff,
      ],
      "child",
    )?.id,
  ).toBe("handoff");
});

test("last acknowledgment uses receipt time and ignores incomplete and cancelled records", () => {
  const previous = {
    ...handoff,
    id: "previous",
    status: "COMPLETED" as const,
    acceptedAt: "2026-10-04T17:00:00Z",
  };
  const latest = {
    ...previous,
    id: "latest",
    acceptedAt: "2026-10-05T17:00:00Z",
  };
  expect(
    latestAcknowledgment(
      [previous, handoff, latest, { ...latest, status: "CANCELLED" }],
      "child",
    )?.id,
  ).toBe("latest");
  expect(latestAcknowledgment([handoff], "child")).toBeUndefined();
});

test("nobody available requires actual declines from every recipient on an open request", () => {
  expect(nobodyAvailable(request)).toBe(false);
  const declined = {
    ...request,
    recipientResponses: {
      grandma: "DECLINED" as const,
      grandpa: "DECLINED" as const,
    },
  };
  expect(nobodyAvailable(declined)).toBe(true);
  expect(nobodyAvailable({ ...declined, status: "ASSIGNED" })).toBe(false);
  expect(nobodyAvailable({ ...declined, recipientIds: [] })).toBe(true);
});

test("attention shows urgent work first and does not duplicate a request's coverage gap", () => {
  const future = { ...event, id: "future", startsAt: "2026-10-06T19:00:00Z" };
  const overdue = { ...event, id: "overdue", startsAt: "2026-10-05T16:00:00Z" };
  const declined = {
    ...request,
    recipientResponses: {
      grandma: "DECLINED" as const,
      grandpa: "DECLINED" as const,
    },
  };
  expect(
    coordinationAttention(
      [event, future, overdue],
      [declined],
      [handoff],
      now,
    ).map((item) => item.kind),
  ).toEqual(["gap", "handoff", "request", "gap"]);
  expect(
    coordinationAttention(
      [],
      [{ ...request, status: "ASSIGNED" }],
      [{ ...handoff, status: "COMPLETED" }],
      now,
    ),
  ).toEqual([]);
});
