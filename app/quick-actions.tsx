import {
  CalendarPlus,
  ChevronRight,
  HandHeart,
  Repeat2,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, Card, Screen } from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";

export default function QuickActionsScreen() {
  const router = useRouter();
  const data = useVillage();
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  return (
    <Screen style={styles.screen}>
      <AppHeader
        title="What do you need?"
        subtitle="Create a structured care update."
        onBack={() => router.back()}
      />
      <View style={styles.actions}>
        {canManage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask for Help"
            onPress={() => router.replace("/help-request")}
          >
            <Card style={styles.action}>
              <HandHeart size={28} color={colors.forest} />
              <View style={styles.copy}>
                <Text style={styles.title}>Ask for Help</Text>
                <Text style={styles.body} numberOfLines={2}>
                  Send a pickup, dropoff, transportation, or babysitting
                  request.
                </Text>
              </View>
              <ChevronRight size={24} color={colors.muted} />
            </Card>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create Handoff"
          onPress={() => router.replace("/handoff-form")}
        >
          <Card style={styles.action}>
            <Repeat2 size={28} color={colors.forest} />
            <View style={styles.copy}>
              <Text style={styles.title}>Create Handoff</Text>
              <Text style={styles.body} numberOfLines={2}>
                Prepare items and transfer responsibility to another caregiver.
              </Text>
            </View>
            <ChevronRight size={24} color={colors.muted} />
          </Card>
        </Pressable>
        {canManage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Event"
            onPress={() => router.replace("/event-form")}
          >
            <Card style={styles.action}>
              <CalendarPlus size={28} color={colors.forest} />
              <View style={styles.copy}>
                <Text style={styles.title}>Add Event</Text>
                <Text style={styles.body} numberOfLines={2}>
                  Schedule a care responsibility or family activity.
                </Text>
              </View>
              <ChevronRight size={24} color={colors.muted} />
            </Card>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.md },
  actions: { gap: spacing.sm },
  action: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: 12,
  },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
