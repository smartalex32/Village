import { fireEvent, render, screen } from "@testing-library/react-native";
import HelpSentScreen from "../../app/help-sent";
import type { HelpRequest } from "./types";

const request: HelpRequest = {
  id: "request",
  eventId: "event",
  childId: "child",
  typeId: "BABYSITTING",
  typeLabel: "Babysitting",
  requiredCapability: "BABYSITTING",
  startsAt: "2026-10-06T18:00:00Z",
  location: "Home",
  createdByMemberId: "owner",
  recipientIds: ["grandma"],
  recipientResponses: { grandma: "DECLINED" },
  status: "OPEN",
};
const mockData = {
  currentMemberId: "owner",
  householdTimezone: "America/Chicago",
  children: [{ id: "child", firstName: "Emma" }],
  members: [
    {
      id: "owner",
      displayName: "Alex",
      role: "OWNER",
      childIds: ["child"],
      capabilities: [],
    },
    {
      id: "grandma",
      displayName: "Grandma",
      role: "TRUSTED_CAREGIVER",
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
    {
      id: "ineligible",
      displayName: "Ineligible",
      role: "TRUSTED_CAREGIVER",
      childIds: ["child"],
      capabilities: [],
    },
  ],
  helpRequests: [request],
  helpRequestTypes: [],
  addHelpRequestRecipients: jest.fn(),
  createHelpRequest: jest.fn(),
  acceptHelpRequest: jest.fn(),
  declineHelpRequest: jest.fn(),
  closeHelpRequest: jest.fn(),
};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "request" }),
}));
jest.mock("@/src/providers/VillageProvider", () => ({
  useVillage: () => mockData,
}));
jest.mock("@/src/lib/useAppRouter", () => ({
  useAppRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockData.currentMemberId = "owner";
  mockData.helpRequests = [request];
  mockData.addHelpRequestRecipients.mockResolvedValue(true);
});

test("a parent can ask an eligible backup on the same request after everyone declines", async () => {
  await render(<HelpSentScreen />);
  expect(screen.getByText("Nobody Available")).toBeTruthy();
  expect(screen.getByText("Declined")).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: "Ask Ineligible" })).toBeNull();
  await fireEvent.press(screen.getByRole("checkbox", { name: "Ask Backup" }));
  await fireEvent.press(screen.getByText("Send to selected caregivers"));
  expect(mockData.addHelpRequestRecipients).toHaveBeenCalledWith("request", [
    "backup",
  ]);
  expect(mockData.createHelpRequest).not.toHaveBeenCalled();
  mockData.helpRequests = [
    {
      ...request,
      recipientIds: ["grandma", "backup"],
      recipientResponses: { grandma: "DECLINED", backup: "PENDING" },
    },
  ];
  await screen.rerender(<HelpSentScreen />);
  expect(screen.getByText("Waiting for response")).toBeTruthy();
  expect(screen.queryByText("Nobody Available")).toBeNull();
});

test("a failed addition keeps selected caregivers available for a retry", async () => {
  mockData.addHelpRequestRecipients.mockResolvedValue(false);
  await render(<HelpSentScreen />);
  await fireEvent.press(screen.getByRole("checkbox", { name: "Ask Backup" }));
  await fireEvent.press(screen.getByText("Send to selected caregivers"));
  expect(
    screen.getByText(
      "Could not add caregivers. Check your connection and try again.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "Ask Backup" })).toBeChecked();
  expect(
    screen.getByRole("button", { name: "Send to selected caregivers" }),
  ).toBeEnabled();
});

test("declined recipients cannot accept and nonresponders remain covered after acceptance", async () => {
  mockData.currentMemberId = "grandma";
  await render(<HelpSentScreen />);
  expect(screen.queryByText("I Can Help")).toBeNull();
  expect(screen.queryByText("Ask more caregivers")).toBeNull();
  mockData.helpRequests = [
    {
      ...request,
      status: "ASSIGNED",
      assignedMemberId: "backup",
      recipientIds: ["grandma", "backup"],
      recipientResponses: { grandma: "PENDING", backup: "ACCEPTED" },
    },
  ];
  await screen.rerender(<HelpSentScreen />);
  expect(screen.getByText("Accepted")).toBeTruthy();
  expect(screen.getAllByText("Covered")).toHaveLength(2);
  expect(screen.queryByText("Declined")).toBeNull();
  expect(screen.queryByText("Mark Complete")).toBeNull();
});
