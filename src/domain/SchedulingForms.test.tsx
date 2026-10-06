import { fireEvent, render, screen } from "@testing-library/react-native";
import EventFormScreen from "../../app/event-form";
import HelpRequestScreen from "../../app/help-request";
import HandoffFormScreen from "../../app/handoff-form";
import type { CareEvent, HelpRequest } from "./types";

let mockParams: { id?: string; eventId?: string } = {};
const mockBack = jest.fn();
const mockData = {
  currentMemberId: "owner",
  householdTimezone: "America/Chicago",
  children: [{ id: "child", firstName: "Emma", archived: false }],
  members: [
    {
      id: "owner",
      displayName: "Alex",
      role: "OWNER",
      childIds: ["child"],
      capabilities: ["BABYSITTING"],
    },
    {
      id: "backup",
      displayName: "Backup",
      role: "TRUSTED_CAREGIVER",
      childIds: ["child"],
      capabilities: ["BABYSITTING"],
    },
  ],
  events: [] as CareEvent[],
  helpRequests: [] as HelpRequest[],
  helpRequestTypes: [
    {
      id: "BABYSITTING",
      label: "Babysitting",
      capability: "BABYSITTING",
      isOther: false,
    },
  ],
  updateEvent: jest.fn(),
  addEvent: jest.fn(),
  cancelEvent: jest.fn(),
  createHelpRequest: jest.fn(() => ({ id: "request" })),
  createHandoff: jest.fn(() => ({ id: "handoff" })),
};
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams }));
jest.mock("@/src/providers/VillageProvider", () => ({
  useVillage: () => mockData,
}));
jest.mock("@/src/lib/useAppRouter", () => ({
  useAppRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockData.events = [];
  mockData.helpRequests = [];
});

test("an edited event saves household time and an optional end, rejecting reversed times", async () => {
  mockParams = { id: "event" };
  mockData.events = [
    {
      id: "event",
      childId: "child",
      type: "BABYSITTING",
      title: "Care",
      startsAt: "2026-10-06T18:00:00Z",
      requiresCaregiver: true,
      status: "SCHEDULED",
    },
  ];
  await render(<EventFormScreen />);
  await fireEvent.changeText(
    screen.getByLabelText("Starts time (24-hour)"),
    "15:00",
  );
  await fireEvent.press(screen.getByText("Add end time (optional)"));
  await fireEvent.changeText(screen.getByLabelText("Ends date"), "2026-10-06");
  await fireEvent.changeText(
    screen.getByLabelText("Ends time (24-hour)"),
    "14:00",
  );
  expect(
    screen.getByText("End time must be after the start time."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  await fireEvent.changeText(
    screen.getByLabelText("Ends time (24-hour)"),
    "17:30",
  );
  await fireEvent.press(screen.getByText("Save Changes"));
  expect(mockData.updateEvent).toHaveBeenCalledWith(
    "event",
    expect.objectContaining({
      startsAt: "2026-10-06T20:00:00.000Z",
      endsAt: "2026-10-06T22:30:00.000Z",
    }),
  );
});

test("a linked request keeps the event schedule and prevents duplicate requests", async () => {
  mockParams = { eventId: "event" };
  mockData.events = [
    {
      id: "event",
      childId: "child",
      type: "BABYSITTING",
      title: "Care",
      startsAt: "2026-10-06T18:00:00Z",
      location: "Home",
      requiresCaregiver: true,
      status: "SCHEDULED",
    },
  ];
  mockData.helpRequests = [{ id: "request", eventId: "event" } as HelpRequest];
  await render(<HelpRequestScreen />);
  expect(screen.getByLabelText("When time (24-hour)")).toHaveProp(
    "editable",
    false,
  );
  expect(screen.getByText("View Existing Request")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Ask My Village" }));
  expect(mockData.createHelpRequest).not.toHaveBeenCalled();
});

test("a handoff saves the chosen household time and rejects a daylight-saving gap", async () => {
  await render(<HandoffFormScreen />);
  await fireEvent.changeText(screen.getByLabelText("When date"), "2026-03-08");
  await fireEvent.changeText(
    screen.getByLabelText("When time (24-hour)"),
    "02:30",
  );
  expect(screen.getByRole("button", { name: "Create Handoff" })).toBeDisabled();
  await fireEvent.changeText(
    screen.getByLabelText("When time (24-hour)"),
    "03:30",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Create Handoff" }));
  expect(mockData.createHandoff).toHaveBeenCalledWith(
    expect.objectContaining({
      scheduledAt: "2026-03-08T08:30:00.000Z",
      fromMemberId: "owner",
      toMemberId: "backup",
    }),
  );
});
