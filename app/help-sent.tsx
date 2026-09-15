import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
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

export default function HelpSentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const data = useVillage();
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
  const statusLabel =
    request.status === "ASSIGNED"
      ? "Covered"
      : request.status.charAt(0) + request.status.slice(1).toLowerCase();
  const title =
    request.status === "ASSIGNED"
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
            request.status === "ASSIGNED" || request.status === "COMPLETED"
              ? "check-circle"
              : request.status === "CANCELLED"
                ? "close-circle-outline"
                : "party-popper"
          }
          size={58}
          color={colors.forest}
        />
        <Text style={styles.subtitle}>
          {assigned
            ? `${assigned.displayName} can help.`
            : request.status === "CANCELLED"
              ? "This request and its linked care event were cancelled."
              : request.status === "COMPLETED"
                ? "This care responsibility is complete."
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
                : request.status === "CANCELLED"
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
          📅 {format(new Date(request.startsAt), "MMM d 'at' h:mm a")}
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
        return (
          <View key={memberId} style={uiStyles.between}>
            <View style={[uiStyles.row, styles.recipient]}>
              <Avatar
                name={member?.displayName ?? "Caregiver"}
                uri={member?.avatarUrl}
                size={36}
              />
              <Text style={uiStyles.strong}>{member?.displayName}</Text>
            </View>
            <Text style={uiStyles.muted}>
              {assigned?.id === memberId
                ? "Accepted"
                : assigned
                  ? "Covered"
                  : "Notified"}
            </Text>
          </View>
        );
      })}
      {request.status === "OPEN" &&
      request.recipientIds.includes(data.currentMemberId) ? (
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
      {request.status === "OPEN" &&
      !request.recipientIds.includes(data.currentMemberId) ? (
        <Button
          label="Cancel Request"
          variant="danger"
          onPress={() => data.closeHelpRequest(request.id, "CANCELLED")}
        />
      ) : null}
      {request.status === "ASSIGNED" ? (
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
});
