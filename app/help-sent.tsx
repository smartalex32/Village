import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  Pill,
  Screen,
  uiStyles,
} from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";
import { useAppRouter } from "@/src/lib/useAppRouter";
import { isEligibleForHelpType } from "@/src/domain/helpTypes";
import { canAcceptHelp } from "@/src/domain/rules";
import { nobodyAvailable } from "@/src/domain/coordination";
import { formatHouseholdDate } from "@/src/lib/dateTime";

export default function HelpSentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const data = useVillage();
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    [],
  );
  const [addingRecipients, setAddingRecipients] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const request = data.helpRequests.find((item) => item.id === id);
  if (!request)
    return (
      <Screen>
        <AppHeader
          title="Request unavailable"
          onBack={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  const child = data.children.find((item) => item.id === request.childId);
  const assigned = data.members.find(
    (item) => item.id === request.assignedMemberId,
  );
  const currentMember = data.members.find(
    (item) => item.id === data.currentMemberId,
  );
  const canManage =
    request.createdByMemberId === data.currentMemberId ||
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  const unavailable = nobodyAvailable(request);
  const requestType = data.helpRequestTypes.find(
    (item) => item.id === request.typeId,
  ) ?? {
    id: request.typeId,
    label: request.typeLabel,
    capability: request.requiredCapability,
    isOther: false,
  };
  const eligibleRecipients = data.members.filter(
    (item) =>
      item.id !== data.currentMemberId &&
      !request.recipientIds.includes(item.id) &&
      isEligibleForHelpType(item, request.childId, requestType),
  );
  const selectedEligibleIds = eligibleRecipients
    .filter((item) => selectedRecipientIds.includes(item.id))
    .map((item) => item.id);
  async function askMore() {
    if (!request || addingRecipients || selectedEligibleIds.length === 0)
      return;
    setRecoveryError("");
    setAddingRecipients(true);
    try {
      if (await data.addHelpRequestRecipients(request.id, selectedEligibleIds))
        setSelectedRecipientIds([]);
      else
        setRecoveryError(
          "Could not add caregivers. Check your connection and try again.",
        );
    } catch {
      setRecoveryError(
        "Could not add caregivers. Check your connection and try again.",
      );
    } finally {
      setAddingRecipients(false);
    }
  }
  const statusLabel = unavailable
    ? "Nobody available"
    : request.status === "ASSIGNED"
      ? "Covered"
      : request.status.charAt(0) + request.status.slice(1).toLowerCase();
  const title = unavailable
    ? "Nobody Available"
    : request.status === "ASSIGNED"
      ? "Help Is Covered"
      : request.status === "COMPLETED"
        ? "Request Complete"
        : request.status === "CANCELLED"
          ? "Request Cancelled"
          : "Help Request Sent";
  return (
    <Screen style={styles.screen}>
      <AppHeader title={title} onBack={() => router.replace("/(tabs)")} />
      <View style={styles.success}>
        <MaterialCommunityIcons
          name={
            unavailable
              ? "account-alert-outline"
              : request.status === "ASSIGNED" || request.status === "COMPLETED"
                ? "check-circle"
                : request.status === "CANCELLED"
                  ? "close-circle-outline"
                  : "party-popper"
          }
          size={58}
          color={colors.forest}
        />
        <Text style={styles.subtitle}>
          {unavailable
            ? request.recipientIds.length
              ? "Everyone asked has declined. Ask more caregivers to find coverage for this care responsibility."
              : "There are no caregivers waiting to respond. Ask more caregivers to find coverage."
            : request.status === "CANCELLED"
              ? "This request and its linked care event were cancelled."
              : request.status === "COMPLETED"
                ? "This care responsibility is complete."
                : assigned
                  ? `${assigned.displayName} can help.`
                  : `We’ve notified ${request.recipientIds.length} ${request.recipientIds.length === 1 ? "person" : "people"}. You’ll be updated as soon as someone responds.`}
        </Text>
      </View>
      <Card style={styles.summary}>
        <View style={uiStyles.between}>
          <Text style={styles.type}>{request.typeLabel}</Text>
          <Pill
            label={statusLabel}
            tone={
              request.status === "ASSIGNED" || request.status === "COMPLETED"
                ? "green"
                : request.status === "CANCELLED" || unavailable
                  ? "red"
                  : "amber"
            }
          />
        </View>
        <View style={[uiStyles.row, styles.person]}>
          <Avatar
            name={child?.firstName ?? "Child"}
            uri={child?.avatarUrl}
            size={42}
          />
          <Text style={uiStyles.strong}>{child?.firstName}</Text>
        </View>
        <Text style={uiStyles.body}>
          📅{" "}
          {formatHouseholdDate(request.startsAt, data.householdTimezone, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </Text>
        <Text style={uiStyles.body}>⌖ {request.location}</Text>
        {request.context ? (
          <Text style={uiStyles.body}>✎ {request.context}</Text>
        ) : null}
        {request.notes ? (
          <Text style={uiStyles.muted}>“{request.notes}”</Text>
        ) : null}
      </Card>
      <Text style={styles.sent}>Sent to</Text>
      {request.recipientIds.map((memberId) => {
        const member = data.members.find((item) => item.id === memberId);
        const response = request.recipientResponses[memberId] ?? "PENDING";
        const responseLabel =
          request.assignedMemberId === memberId || response === "ACCEPTED"
            ? "Accepted"
            : response === "DECLINED"
              ? "Declined"
              : request.status === "OPEN"
                ? "Waiting for response"
                : request.status === "CANCELLED"
                  ? "Closed"
                  : "Covered";
        return (
          <View key={memberId} style={uiStyles.between}>
            <View style={[uiStyles.row, styles.recipient]}>
              <Avatar
                name={member?.displayName ?? "Caregiver"}
                uri={member?.avatarUrl}
                size={36}
              />
              <Text style={uiStyles.strong}>
                {member?.displayName ?? "Former caregiver"}
              </Text>
            </View>
            <Pill
              label={responseLabel}
              tone={
                response === "DECLINED"
                  ? "red"
                  : request.status === "OPEN"
                    ? "amber"
                    : "green"
              }
            />
          </View>
        );
      })}
      {canAcceptHelp(request, data.currentMemberId) ? (
        <View style={styles.responseActions}>
          <Button
            label="I Can Help"
            onPress={() => data.acceptHelpRequest(request.id)}
          />
          <Button
            label="I Can't Help"
            variant="secondary"
            onPress={() => data.declineHelpRequest(request.id)}
          />
        </View>
      ) : null}
      {request.status === "OPEN" && canManage ? (
        <Card style={styles.recovery}>
          <Text style={uiStyles.strong}>Ask more caregivers</Text>
          <Text style={uiStyles.muted}>
            Add people to this request for the same care responsibility.
          </Text>
          {eligibleRecipients.map((recipient) => {
            const selected = selectedRecipientIds.includes(recipient.id);
            return (
              <Pressable
                key={recipient.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`Ask ${recipient.displayName}`}
                accessibilityState={{
                  checked: selected,
                  disabled: addingRecipients,
                }}
                disabled={addingRecipients}
                onPress={() =>
                  setSelectedRecipientIds((items) =>
                    items.includes(recipient.id)
                      ? items.filter((item) => item !== recipient.id)
                      : [...items, recipient.id],
                  )
                }
                style={[uiStyles.between, styles.recipientOption]}
              >
                <View style={[uiStyles.row, styles.recipient]}>
                  <Avatar
                    name={recipient.displayName}
                    uri={recipient.avatarUrl}
                    size={36}
                  />
                  <Text style={uiStyles.strong}>{recipient.displayName}</Text>
                </View>
                <MaterialCommunityIcons
                  name={selected ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={24}
                  color={colors.forest}
                />
              </Pressable>
            );
          })}
          {eligibleRecipients.length ? (
            <Button
              label={
                addingRecipients ? "Sending…" : "Send to selected caregivers"
              }
              disabled={addingRecipients || selectedEligibleIds.length === 0}
              onPress={() => void askMore()}
            />
          ) : (
            <Text style={uiStyles.muted}>
              No additional eligible caregivers are available for this child and
              help type.
            </Text>
          )}
          {recoveryError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {recoveryError}
            </Text>
          ) : null}
        </Card>
      ) : null}
      {(request.status === "OPEN" || request.status === "ASSIGNED") &&
      canManage ? (
        <Button
          label="Cancel Request"
          variant="danger"
          onPress={() => data.closeHelpRequest(request.id, "CANCELLED")}
        />
      ) : null}
      {request.status === "ASSIGNED" && canManage ? (
        <Button
          label="Mark Complete"
          onPress={() => data.closeHelpRequest(request.id, "COMPLETED")}
        />
      ) : null}
      <Button
        label="Done"
        variant="secondary"
        onPress={() => router.replace("/(tabs)")}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  success: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  subtitle: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 330,
  },
  summary: { gap: spacing.sm },
  type: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  person: { gap: spacing.sm },
  sent: { color: colors.ink, fontWeight: "800", marginTop: spacing.sm },
  recipient: { gap: spacing.sm },
  responseActions: { flexDirection: "row", gap: spacing.sm },
  recovery: { gap: spacing.sm },
  recipientOption: { minHeight: 52, gap: spacing.sm },
  error: { color: colors.danger, lineHeight: 20 },
});
