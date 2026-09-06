import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
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
    <Screen>
      <AppHeader
        title="What do you need?"
        subtitle="Create a structured care update."
      />
      <View style={styles.actions}>
        {canManage ? (
          <Card style={styles.action}>
            <Text style={styles.icon}>🤝</Text>
            <View style={styles.copy}>
              <Text style={styles.title}>Ask for Help</Text>
              <Text style={styles.body}>
                Send a pickup, dropoff, transportation, or babysitting request.
              </Text>
            </View>
            <Button
              label="Start"
              onPress={() => router.replace("/help-request")}
            />
          </Card>
        ) : null}
        <Card style={styles.action}>
          <Text style={styles.icon}>🔁</Text>
          <View style={styles.copy}>
            <Text style={styles.title}>Create Handoff</Text>
            <Text style={styles.body}>
              Prepare items and transfer responsibility to another caregiver.
            </Text>
          </View>
          <Button
            label="Create"
            variant="secondary"
            onPress={() => router.replace("/handoff-form")}
          />
        </Card>
        {canManage ? (
          <Card style={styles.action}>
            <Text style={styles.icon}>📅</Text>
            <View style={styles.copy}>
              <Text style={styles.title}>Add Event</Text>
              <Text style={styles.body}>
                Schedule a care responsibility or family activity.
              </Text>
            </View>
            <Button
              label="Add"
              variant="secondary"
              onPress={() => router.replace("/event-form")}
            />
          </Card>
        ) : null}
      </View>
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  action: { gap: spacing.sm },
  icon: { fontSize: 30 },
  copy: { gap: 4 },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  body: { color: colors.muted, lineHeight: 20 },
});
