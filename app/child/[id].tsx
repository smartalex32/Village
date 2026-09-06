import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  Screen,
  SectionHeader,
  uiStyles,
} from "@/src/components/ui";
import { EventRow } from "@/src/components/EventRow";
import { useVillage } from "@/src/providers/VillageProvider";
import { spacing } from "@/src/theme/tokens";

export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const data = useVillage();
  const child = data.children.find((item) => item.id === id);
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  if (!child)
    return (
      <Screen>
        <AppHeader title="Child unavailable" />
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  const events = data.events
    .filter((event) => event.childId === id && event.status === "SCHEDULED")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 4);
  const handoff = data.handoffs.find(
    (item) =>
      item.childId === id &&
      item.status !== "COMPLETED" &&
      item.status !== "CANCELLED",
  );
  return (
    <Screen>
      <AppHeader title={child.firstName} subtitle="Child profile" />
      <Card style={styles.profile}>
        <Avatar name={child.firstName} uri={child.avatarUrl} size={72} />
        <View style={styles.flex}>
          {child.birthDate ? (
            <Text style={uiStyles.body}>
              Born {format(new Date(child.birthDate), "MMMM d, yyyy")}
            </Text>
          ) : null}
          <Text style={uiStyles.muted}>
            Profile information is only visible to permitted caregivers.
          </Text>
        </View>
      </Card>
      <SectionHeader title="Basic care notes" />
      <Card>
        <Text style={child.notes ? uiStyles.body : uiStyles.muted}>
          {child.notes || "No care notes yet."}
        </Text>
      </Card>
      {handoff ? (
        <>
          <SectionHeader title="Next handoff" />
          <Card style={styles.handoff}>
            <Text style={uiStyles.strong}>
              {
                data.members.find((m) => m.id === handoff.fromMemberId)
                  ?.displayName
              }{" "}
              →{" "}
              {
                data.members.find((m) => m.id === handoff.toMemberId)
                  ?.displayName
              }
            </Text>
            <Text style={uiStyles.muted}>
              {format(new Date(handoff.scheduledAt), "EEEE 'at' h:mm a")}
            </Text>
            <Button
              label="View Handoff"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/handoff/[id]",
                  params: { id: handoff.id },
                })
              }
            />
          </Card>
        </>
      ) : null}
      <SectionHeader title="Upcoming schedule" />
      <Card style={styles.events}>
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            child={child}
            caregiver={data.members.find(
              (member) => member.id === event.caregiverId,
            )}
            timeZone={data.householdTimezone}
          />
        ))}
      </Card>
      {canManage ? (
        <>
          <Button
            label="Edit Profile"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: "/child-form", params: { id: child.id } })
            }
          />
          <Button
            label="Archive Child"
            variant="danger"
            onPress={() => {
              data.archiveChild(child.id);
              router.back();
            }}
          />
        </>
      ) : null}
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  profile: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  flex: { flex: 1, gap: 6 },
  handoff: { gap: spacing.sm },
  events: { paddingVertical: 0 },
});
