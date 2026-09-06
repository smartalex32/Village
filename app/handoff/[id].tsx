import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  Pill,
  Screen,
  SectionHeader,
  uiStyles,
} from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";

export default function HandoffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const data = useVillage();
  const handoff = data.handoffs.find((item) => item.id === id);
  if (!handoff)
    return (
      <Screen>
        <AppHeader title="Handoff unavailable" />
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  const child = data.children.find((item) => item.id === handoff.childId);
  const from = data.members.find((item) => item.id === handoff.fromMemberId);
  const to = data.members.find((item) => item.id === handoff.toMemberId);
  const upcoming = data.events.find(
    (event) => event.id === handoff.associatedEventId,
  );
  const isClosed =
    handoff.status === "COMPLETED" || handoff.status === "CANCELLED";
  const isRecipient = handoff.toMemberId === data.currentMemberId;
  return (
    <Screen>
      <AppHeader
        title="Handoff"
        subtitle="A coordination record—not verified physical location."
        right={
          <Pill
            label={
              handoff.status.charAt(0) + handoff.status.slice(1).toLowerCase()
            }
            tone={
              handoff.status === "COMPLETED"
                ? "green"
                : handoff.status === "CANCELLED"
                  ? "red"
                  : "blue"
            }
          />
        }
      />
      <Card style={styles.summary}>
        <View style={[uiStyles.row, styles.person]}>
          <Avatar
            name={child?.firstName ?? "Child"}
            uri={child?.avatarUrl}
            size={58}
          />
          <View>
            <Text style={styles.child}>{child?.firstName}</Text>
            <Text style={uiStyles.strong}>
              {from?.displayName} → {to?.displayName}
            </Text>
            <Text style={uiStyles.muted}>
              {format(new Date(handoff.scheduledAt), "EEEE 'at' h:mm a")}
            </Text>
          </View>
        </View>
        {handoff.location ? (
          <Text style={uiStyles.body}>⌖ {handoff.location}</Text>
        ) : null}
        {upcoming ? (
          <Text style={uiStyles.body}>
            ⌖ Upcoming: {upcoming.title} at{" "}
            {format(new Date(upcoming.startsAt), "h:mm a")}
          </Text>
        ) : null}
      </Card>
      <SectionHeader title="Items to bring" />
      {handoff.items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="checkbox"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: item.ready, disabled: isClosed }}
          disabled={isClosed}
          onPress={() => data.toggleHandoffItem(handoff.id, item.id)}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, item.ready && styles.checked]}>
            {item.ready ? (
              <MaterialCommunityIcons name="check" size={17} color="#fff" />
            ) : null}
          </View>
          <Text style={[styles.itemText, isClosed && styles.closed]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
      <SectionHeader title="Notes" />
      <Card>
        <Text style={handoff.notes ? uiStyles.body : uiStyles.muted}>
          {handoff.notes || "No notes were added."}
        </Text>
      </Card>
      {handoff.status === "COMPLETED" ? (
        <Card style={styles.complete}>
          <Text style={styles.completeTitle}>Handoff acknowledged</Text>
          <Text style={uiStyles.muted}>
            {handoff.acceptedAt
              ? format(new Date(handoff.acceptedAt), "MMM d 'at' h:mm a")
              : "Responsibility transferred."}
          </Text>
        </Card>
      ) : (
        <View style={styles.actions}>
          <Button
            label={
              handoff.status === "READY" ? "Ready for Handoff" : "Mark as Ready"
            }
            variant="secondary"
            onPress={() => data.markHandoffReady(handoff.id)}
            disabled={handoff.status === "READY"}
          />
          {isRecipient ? (
            <Button
              label={`I've Received ${child?.firstName ?? "Child"}`}
              onPress={() => data.acknowledgeHandoff(handoff.id)}
            />
          ) : (
            <Card style={styles.waiting}>
              <Text style={uiStyles.muted}>
                Waiting for {to?.displayName ?? "the receiving caregiver"} to
                acknowledge receipt.
              </Text>
            </Card>
          )}
        </View>
      )}
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  summary: { gap: spacing.md },
  person: { gap: spacing.md },
  child: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  checkRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#9CB2AE",
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.forest, borderColor: colors.forest },
  itemText: { color: colors.ink, fontSize: 15 },
  closed: { color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.sm },
  complete: { backgroundColor: colors.mint, borderColor: "#9CD2C3" },
  waiting: { flex: 1, backgroundColor: colors.surfaceMuted },
  completeTitle: {
    color: colors.forestDark,
    fontWeight: "800",
    marginBottom: 4,
  },
});
