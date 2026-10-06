import { fireEvent, render, screen } from "@testing-library/react-native";
import TodayScreen from "../../app/(tabs)/index";
import type { CareEvent, Child, Handoff, HelpRequest } from "./types";

const mockPush = jest.fn();
const mockNow = new Date("2026-10-05T18:00:00Z");
const mockData = {
  children: [{ id: "child", firstName: "Emma", archived: false }] as Child[],
  members: [
    { id: "parent", role: "OWNER", displayName: "Alex" },
    { id: "grandma", displayName: "Grandma" },
  ],
  currentMemberId: "parent",
  householdTimezone: "America/Chicago",
  backendState: "demo",
  events: [] as CareEvent[],
  helpRequests: [] as HelpRequest[],
  handoffs: [] as Handoff[],
  notifications: [],
  refreshRemote: jest.fn(),
};

jest.mock("@/src/providers/VillageProvider", () => ({
  useVillage: () => mockData,
}));
jest.mock("@/src/lib/useCurrentTime", () => ({
  useCurrentTime: () => mockNow,
}));
jest.mock("@/src/lib/useAppRouter", () => ({
  useAppRouter: () => ({ push: mockPush, navigate: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

beforeEach(() => {
  mockPush.mockClear();
  mockData.events = [];
  mockData.helpRequests = [];
  mockData.handoffs = [];
});

test.each(["2026-10-05T16:00:00Z", "2026-10-04T18:00:00Z"])(
  "care with a future end time stays visible, including overnight care starting %s",
  async (startsAt) => {
    mockData.events = [
      {
        id: "ongoing",
        childId: "child",
        type: "BABYSITTING",
        title: "Afternoon care",
        startsAt,
        endsAt: "2026-10-05T20:00:00Z",
        caregiverId: "grandma",
        requiresCaregiver: true,
        status: "SCHEDULED",
      },
    ];
    await render(<TodayScreen />);
    expect(screen.getByText("Emma — Afternoon care")).toBeTruthy();
    expect(screen.getByText(/In progress/)).toBeTruthy();
    expect(screen.queryByText("No later events today")).toBeNull();
  },
);

test("the dashboard presents the timestamped receipt without asserting a child's current location", async () => {
  mockData.handoffs = [
    {
      id: "receipt",
      childId: "child",
      fromMemberId: "parent",
      toMemberId: "grandma",
      status: "COMPLETED",
      scheduledAt: "2026-10-04T13:00:00Z",
      acceptedAt: "2026-10-04T13:05:00Z",
      items: [],
    },
  ];
  await render(<TodayScreen />);
  expect(screen.getByText("Last acknowledged with")).toBeTruthy();
  expect(screen.getByText("Grandma")).toBeTruthy();
  expect(screen.getByText(/Oct 4.*8:05 AM/)).toBeTruthy();
  expect(screen.queryByText("Currently with")).toBeNull();
});

test("parents can expand all unresolved attention items and open the overdue handoff", async () => {
  mockData.events = [
    {
      id: "gap",
      childId: "child",
      type: "PICKUP",
      title: "Pickup",
      startsAt: "2026-10-05T16:00:00Z",
      requiresCaregiver: true,
      status: "SCHEDULED",
    },
    {
      id: "future",
      childId: "child",
      type: "BABYSITTING",
      title: "Babysitting",
      startsAt: "2026-10-06T16:00:00Z",
      requiresCaregiver: true,
      status: "SCHEDULED",
    },
  ];
  mockData.handoffs = [
    {
      id: "late",
      childId: "child",
      fromMemberId: "grandma",
      toMemberId: "parent",
      scheduledAt: "2026-10-05T17:00:00Z",
      status: "READY",
      items: [],
    },
  ];
  await render(<TodayScreen />);
  expect(screen.getByText("Overdue · No caregiver assigned")).toBeTruthy();
  expect(screen.queryByText("No unresolved coverage gaps")).toBeNull();
  expect(screen.queryByText("Emma — Babysitting")).toBeNull();
  await fireEvent.press(screen.getByText("See all (3)"));
  expect(screen.getByText("Emma — Babysitting")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "View overdue handoff" }),
  );
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/handoff/[id]",
    params: { id: "late" },
  });
});
