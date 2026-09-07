import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, Button, Card, Screen } from "@/src/components/ui";
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
      />
      <View style={styles.actions}>
        {canManage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask for Help"
            onPress={() => router.replace("/help-request")}
          >
            <Card style={styles.action}>
              <Text style={styles.icon}>🤝</Text>
              <View style={styles.copy}>
                <Text style={styles.title}>Ask for Help</Text>
                <Text style={styles.body} numberOfLines={2}>
                  Send a pickup, dropoff, transportation, or babysitting
                  request.
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.muted}
              />
            </Card>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create Handoff"
          onPress={() => router.replace("/handoff-form")}
        >
          <Card style={styles.action}>
            <Text style={styles.icon}>🔁</Text>
            <View style={styles.copy}>
              <Text style={styles.title}>Create Handoff</Text>
              <Text style={styles.body} numberOfLines={2}>
                Prepare items and transfer responsibility to another caregiver.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.muted}
            />
          </Card>
        </Pressable>
        {canManage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Event"
            onPress={() => router.replace("/event-form")}
          >
            <Card style={styles.action}>
              <Text style={styles.icon}>📅</Text>
              <View style={styles.copy}>
                <Text style={styles.title}>Add Event</Text>
                <Text style={styles.body} numberOfLines={2}>
                  Schedule a care responsibility or family activity.
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.muted}
              />
            </Card>
          </Pressable>
        ) : null}
      </View>
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
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
  icon: { fontSize: 28 },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
