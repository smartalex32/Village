import type { CareEvent, Handoff, HelpRequest } from "./types";

export function coverageGaps(events: CareEvent[], now = new Date()) {
  return events
    .filter(
      (event) =>
        event.status === "SCHEDULED" &&
        event.requiresCaregiver &&
        !event.caregiverId,
    )
    .sort((left, right) => {
      const leftOverdue = new Date(left.startsAt) < now;
      const rightOverdue = new Date(right.startsAt) < now;
      if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
      return left.startsAt.localeCompare(right.startsAt);
    });
}

export function canAcceptHelp(request: HelpRequest, memberId: string) {
  return (
    request.status === "OPEN" &&
    request.recipientIds.includes(memberId) &&
    request.recipientResponses[memberId] === "PENDING" &&
    !request.assignedMemberId
  );
}

export function canAcknowledgeHandoff(handoff: Handoff, memberId: string) {
  return (
    (handoff.status === "SCHEDULED" || handoff.status === "READY") &&
    handoff.toMemberId === memberId
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
