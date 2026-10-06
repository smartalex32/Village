import { act, renderHook } from "@testing-library/react-native";
import { VillageProvider, useVillage } from "./VillageProvider";

jest.mock("@/src/lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));
jest.mock("@/src/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "demo-user" } }),
}));
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

test("cancelling an unresolved handoff preserves completed acknowledgment history", async () => {
  const { result } = await renderHook(() => useVillage(), {
    wrapper: VillageProvider,
  });
  const receipt = result.current.handoffs.find(
    (handoff) => handoff.status === "COMPLETED",
  )!;
  let handoffId = "";
  await act(() => {
    handoffId = result.current.createHandoff({
      childId: "emma",
      fromMemberId: result.current.currentMemberId,
      toMemberId: "grandma",
      scheduledAt: "2026-10-01T18:00:00Z",
      items: [],
    }).id;
  });
  await act(() => result.current.cancelHandoff(handoffId));
  expect(
    result.current.handoffs.find((handoff) => handoff.id === handoffId)?.status,
  ).toBe("CANCELLED");
  await act(() => result.current.cancelHandoff(receipt.id));
  expect(
    result.current.handoffs.find((handoff) => handoff.id === receipt.id),
  ).toEqual(receipt);
});

test("declined responses remain visible and asking more caregivers preserves one request and event", async () => {
  const { result } = await renderHook(() => useVillage(), {
    wrapper: VillageProvider,
  });
  const beforeEvents = result.current.events.length;
  let requestId = "";
  await act(() => {
    requestId = result.current.createHelpRequest({
      childId: "emma",
      type: result.current.helpRequestTypes.find(
        (type) => type.id === "BABYSITTING",
      )!,
      startsAt: "2026-10-06T18:00:00Z",
      location: "Home",
      recipientIds: ["grandma"],
    }).id;
  });
  const eventId = result.current.helpRequests[0].eventId;
  await act(() => result.current.declineHelpRequest(requestId, "grandma"));
  expect(result.current.helpRequests[0].recipientIds).toEqual(["grandma"]);
  expect(result.current.helpRequests[0].recipientResponses).toEqual({
    grandma: "DECLINED",
  });
  await act(async () => {
    expect(
      await result.current.addHelpRequestRecipients(requestId, ["taylor"]),
    ).toBe(true);
  });
  const request = result.current.helpRequests[0];
  expect(result.current.helpRequests).toHaveLength(1);
  expect(result.current.events).toHaveLength(beforeEvents + 1);
  expect(request.eventId).toBe(eventId);
  expect(request.recipientResponses).toEqual({
    grandma: "DECLINED",
    taylor: "PENDING",
  });
  await act(() => {
    expect(result.current.acceptHelpRequest(requestId, "taylor")).toBe(true);
  });
  expect(
    result.current.events.find((event) => event.id === eventId)?.caregiverId,
  ).toBe("taylor");
  await act(async () => {
    expect(
      await result.current.addHelpRequestRecipients(requestId, ["grandpa"]),
    ).toBe(false);
  });
});

test("editing linked care synchronizes its open request and completing care removes its coverage gap", async () => {
  const { result } = await renderHook(() => useVillage(), {
    wrapper: VillageProvider,
  });
  let eventId = "";
  await act(() => {
    eventId = result.current.createHelpRequest({
      childId: "emma",
      type: result.current.helpRequestTypes.find(
        (type) => type.id === "BABYSITTING",
      )!,
      startsAt: "2026-10-01T18:00:00Z",
      location: "Home",
      recipientIds: ["grandma"],
    }).eventId;
  });
  expect(result.current.gaps.some((event) => event.id === eventId)).toBe(true);
  await act(() =>
    result.current.updateEvent(eventId, {
      startsAt: "2026-10-06T18:00:00Z",
      location: "School",
      endsAt: undefined,
    }),
  );
  expect(result.current.helpRequests[0].startsAt).toBe("2026-10-06T18:00:00Z");
  expect(result.current.helpRequests[0].location).toBe("School");
  await act(() => result.current.updateEvent(eventId, { status: "COMPLETED" }));
  expect(result.current.helpRequests[0].status).toBe("COMPLETED");
  expect(result.current.gaps.some((event) => event.id === eventId)).toBe(false);
});

test("removing an accepted caregiver reopens future care and preserves pending responses", async () => {
  const { result } = await renderHook(() => useVillage(), {
    wrapper: VillageProvider,
  });
  let requestId = "";
  await act(() => {
    requestId = result.current.createHelpRequest({
      childId: "emma",
      type: result.current.helpRequestTypes.find(
        (type) => type.id === "BABYSITTING",
      )!,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      location: "Home",
      recipientIds: ["grandma", "taylor"],
    }).id;
  });
  const eventId = result.current.helpRequests[0].eventId;
  await act(() => {
    expect(result.current.acceptHelpRequest(requestId, "grandma")).toBe(true);
  });
  await act(() => result.current.removeMember("grandma"));
  expect(result.current.helpRequests[0]).toMatchObject({
    id: requestId,
    eventId,
    status: "OPEN",
    recipientIds: ["taylor"],
    recipientResponses: { taylor: "PENDING" },
  });
  expect(result.current.helpRequests[0].assignedMemberId).toBeUndefined();
  expect(
    result.current.events.find((event) => event.id === eventId)?.caregiverId,
  ).toBeUndefined();
  await act(() => {
    expect(result.current.acceptHelpRequest(requestId, "taylor")).toBe(true);
  });
});

test("asking again about a linked event returns its existing request without duplicating care", async () => {
  const { result } = await renderHook(() => useVillage(), {
    wrapper: VillageProvider,
  });
  const event = result.current.events.find(
    (item) => !item.caregiverId && item.status === "SCHEDULED",
  )!;
  const beforeEvents = result.current.events.length;
  let originalId = "";
  const input = {
    eventId: event.id,
    childId: event.childId,
    type: result.current.helpRequestTypes[0],
    startsAt: event.startsAt,
    location: event.location ?? "Home",
    recipientIds: ["grandma"],
  };
  await act(() => {
    originalId = result.current.createHelpRequest(input).id;
  });
  await act(() => {
    expect(result.current.createHelpRequest(input).id).toBe(originalId);
  });
  expect(result.current.helpRequests).toHaveLength(1);
  expect(result.current.events).toHaveLength(beforeEvents);
});
