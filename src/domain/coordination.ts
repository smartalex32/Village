import { coverageGaps } from "./rules";
import type { CareEvent, Handoff, HelpRequest } from "./types";

export function isHandoffOverdue(handoff: Handoff, now: Date) {
  return (
    (handoff.status === "SCHEDULED" || handoff.status === "READY") &&
    new Date(handoff.scheduledAt) < now
  );
}

export function nextActiveHandoff(handoffs: Handoff[], childId: string) {
  return handoffs
    .filter(
      (handoff) =>
        handoff.childId === childId &&
        (handoff.status === "SCHEDULED" || handoff.status === "READY"),
    )
    .sort((left, right) =>
      left.scheduledAt.localeCompare(right.scheduledAt),
    )[0];
}

export function latestAcknowledgment(handoffs: Handoff[], childId: string) {
  return handoffs
    .filter(
      (handoff) =>
        handoff.childId === childId &&
        handoff.status === "COMPLETED" &&
        handoff.acceptedAt,
    )
    .sort((left, right) =>
      (right.acceptedAt ?? "").localeCompare(left.acceptedAt ?? ""),
    )[0];
}

export function nobodyAvailable(request: HelpRequest) {
  return (
    request.status === "OPEN" &&
    request.recipientIds.every(
      (id) => request.recipientResponses[id] === "DECLINED",
    )
  );
}

export type CoordinationAttention =
  | { kind: "gap"; gap: CareEvent }
  | { kind: "request"; request: HelpRequest }
  | { kind: "handoff"; handoff: Handoff };

export function coordinationAttention(
  events: CareEvent[],
  requests: HelpRequest[],
  handoffs: Handoff[],
  now: Date,
): CoordinationAttention[] {
  const openRequests = requests.filter((request) => request.status === "OPEN");
  const requestedEvents = new Set(
    openRequests.map((request) => request.eventId),
  );
  const items: CoordinationAttention[] = [
    ...coverageGaps(events, now)
      .filter((event) => !requestedEvents.has(event.id))
      .map((gap) => ({ kind: "gap" as const, gap })),
    ...openRequests.map((request) => ({ kind: "request" as const, request })),
    ...handoffs
      .filter((handoff) => isHandoffOverdue(handoff, now))
      .map((handoff) => ({ kind: "handoff" as const, handoff })),
  ];
  const time = (item: CoordinationAttention) =>
    item.kind === "handoff"
      ? item.handoff.scheduledAt
      : item.kind === "gap"
        ? item.gap.startsAt
        : item.request.startsAt;
  return items.sort((left, right) => {
    const leftUrgent =
      new Date(time(left)) < now ||
      (left.kind === "request" && nobodyAvailable(left.request));
    const rightUrgent =
      new Date(time(right)) < now ||
      (right.kind === "request" && nobodyAvailable(right.request));
    if (leftUrgent !== rightUrgent) return leftUrgent ? -1 : 1;
    return time(left).localeCompare(time(right));
  });
}
