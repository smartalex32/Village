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
        <AppHeader title="Handoff unavailable" onBack={() => router.back()} />
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
    <Screen scroll={false} style={styles.screen}>
      <AppHeader
        title="Handoff"
        onBack={() => router.back()}
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
            size={48}
          />
          <View style={styles.summaryText}>
            <Text style={styles.child}>{child?.firstName}</Text>
            <Text style={styles.transfer} numberOfLines={1}>
              {from?.displayName} → {to?.displayName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {format(new Date(handoff.scheduledAt), "EEEE 'at' h:mm a")}
              {handoff.location ? ` · ${handoff.location}` : ""}
            </Text>
          </View>
        </View>
        {upcoming ? (
          <Text style={styles.upcoming} numberOfLines={1}>
            Upcoming: {upcoming.title} at{" "}
            {format(new Date(upcoming.startsAt), "h:mm a")}
          </Text>
        ) : null}
        <Text style={styles.disclaimer} numberOfLines={1}>
          Coordination record—not verified physical location.
        </Text>
      </Card>
      <View style={styles.flexibleDetails}>
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Items to bring</Text>
          <View style={styles.itemsGrid}>
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
                    <MaterialCommunityIcons
                      name="check"
                      size={17}
                      color="#fff"
                    />
                  ) : null}
                </View>
                <Text
                  style={[styles.itemText, isClosed && styles.closed]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Card style={styles.notesCard}>
            <Text style={handoff.notes ? uiStyles.body : uiStyles.muted}>
              {handoff.notes || "No notes were added."}
            </Text>
          </Card>
        </View>
      </View>
      {isClosed ? (
        <Card
          style={
            handoff.status === "COMPLETED" ? styles.complete : styles.cancelled
          }
        >
          <Text style={styles.completeTitle}>
            {handoff.status === "COMPLETED"
              ? "Handoff acknowledged"
              : "Handoff cancelled"}
          </Text>
          {handoff.status === "COMPLETED" ? (
            <Text style={uiStyles.muted}>
              {handoff.acceptedAt
                ? format(new Date(handoff.acceptedAt), "MMM d 'at' h:mm a")
                : "Responsibility transferred."}
            </Text>
          ) : null}
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
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.md },
  summary: { gap: 6, padding: 12 },
  person: { gap: spacing.sm },
  summaryText: { flex: 1 },
  child: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  transfer: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 1 },
  upcoming: { color: colors.forestDark, fontSize: 12, fontWeight: "700" },
  disclaimer: { color: colors.muted, fontSize: 10 },
  flexibleDetails: { flex: 1, minHeight: 0, gap: spacing.sm },
  itemsSection: { gap: 4 },
  notesSection: { flex: 1, minHeight: 0, gap: 4 },
  notesCard: { flex: 1, minHeight: 56, padding: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  itemsGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md },
  checkRow: {
    minHeight: 44,
    flexBasis: "46%",
    flexGrow: 1,
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
  itemText: { flex: 1, color: colors.ink, fontSize: 14 },
  closed: { color: colors.muted },
  actions: { gap: spacing.sm },
  complete: { backgroundColor: colors.mint, borderColor: "#9CD2C3" },
  cancelled: { backgroundColor: colors.dangerSoft, borderColor: "#E6AAAA" },
  waiting: { padding: 12, backgroundColor: colors.surfaceMuted },
  completeTitle: {
    color: colors.forestDark,
    fontWeight: "800",
    marginBottom: 4,
  },
});
