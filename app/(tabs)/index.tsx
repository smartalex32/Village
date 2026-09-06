import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  EmptyState,
  Pill,
  Screen,
  SectionHeader,
  uiStyles,
} from "@/src/components/ui";
import { EventRow } from "@/src/components/EventRow";
import { useVillage } from "@/src/providers/VillageProvider";
import { formatHouseholdDate, householdDateKey } from "@/src/lib/dateTime";
import { colors, radius, spacing } from "@/src/theme/tokens";

export default function TodayScreen() {
  const router = useRouter();
  const data = useVillage();
  const activeChildren = data.children.filter((child) => !child.archived);
  const today = data.events
    .filter(
      (event) =>
        householdDateKey(event.startsAt, data.householdTimezone) ===
          householdDateKey(new Date(), data.householdTimezone) &&
        event.status === "SCHEDULED",
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const unread = data.notifications.filter((item) => !item.read).length;
  const activeRequests = data.helpRequests.filter(
    (request) => request.status === "OPEN" || request.status === "ASSIGNED",
  );
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  return (
    <Screen
      refreshing={data.backendState === "syncing"}
      onRefresh={() => void data.refreshRemote()}
    >
      {data.backendState === "syncing" ? (
        <Text style={styles.sync}>Refreshing your village…</Text>
      ) : data.backendState === "error" ? (
        <Pressable accessibilityRole="button" onPress={data.refreshRemote}>
          <Text style={styles.syncError}>Offline — tap to retry</Text>
        </Pressable>
      ) : null}
      <AppHeader
        title="Today"
        subtitle={`Good morning, ${currentMember?.displayName ?? "there"}. You’ve got this.`}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${unread} unread notifications`}
            onPress={() => router.push("/notifications")}
            style={styles.bell}
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={24}
              color={colors.ink}
            />
            {unread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            ) : null}
          </Pressable>
        }
      />
      {activeChildren.map((child, index) => {
        const latestReceipt = data.handoffs
          .filter(
            (handoff) =>
              handoff.childId === child.id &&
              handoff.status === "COMPLETED" &&
              handoff.acceptedAt,
          )
          .sort((a, b) =>
            (b.acceptedAt ?? "").localeCompare(a.acceptedAt ?? ""),
          )[0];
        const caregiver = data.members.find(
          (member) => member.id === latestReceipt?.toMemberId,
        );
        const handoff = data.handoffs.find(
          (item) =>
            item.childId === child.id &&
            item.status !== "COMPLETED" &&
            item.status !== "CANCELLED",
        );
        return (
          <Card key={child.id}>
            <View style={[uiStyles.row, styles.childTop]}>
              <Avatar
                name={child.firstName}
                uri={child.avatarUrl}
                size={58}
                color={index % 2 === 0 ? "#F3E5CB" : colors.blue}
              />
              <View style={styles.flex}>
                <Text style={styles.childName}>{child.firstName}</Text>
                <Text style={uiStyles.muted}>Currently with</Text>
                <Text style={uiStyles.strong}>
                  {caregiver?.displayName ?? "Not yet acknowledged"}
                </Text>
              </View>
              <Pill
                label={
                  caregiver?.id === data.currentMemberId
                    ? "With you"
                    : caregiver
                      ? "Coordinated"
                      : "No receipt"
                }
                tone={caregiver?.id === data.currentMemberId ? "blue" : "green"}
              />
            </View>
            {handoff ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${child.firstName}'s next handoff`}
                onPress={() =>
                  router.push({
                    pathname: "/handoff/[id]",
                    params: { id: handoff.id },
                  })
                }
                style={styles.next}
              >
                <MaterialCommunityIcons
                  name="account-switch-outline"
                  size={22}
                  color={colors.forest}
                />
                <View>
                  <Text style={styles.nextLabel}>Next handoff</Text>
                  <Text style={styles.nextText}>
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
                  <Text style={styles.nextLabel}>
                    {householdDateKey(
                      handoff.scheduledAt,
                      data.householdTimezone,
                    ) === householdDateKey(new Date(), data.householdTimezone)
                      ? `Today at ${formatHouseholdDate(
                          handoff.scheduledAt,
                          data.householdTimezone,
                          { hour: "numeric", minute: "2-digit" },
                        )}`
                      : formatHouseholdDate(
                          handoff.scheduledAt,
                          data.householdTimezone,
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </Card>
        );
      })}
      <SectionHeader
        title="Today"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See all scheduled care"
            onPress={() => router.push("/schedule")}
          >
            <Text style={uiStyles.link}>See all</Text>
          </Pressable>
        }
      />
      {today.length ? (
        <Card style={styles.eventCard}>
          {today.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              child={data.children.find((child) => child.id === event.childId)}
              caregiver={data.members.find(
                (member) => member.id === event.caregiverId,
              )}
              timeZone={data.householdTimezone}
            />
          ))}
        </Card>
      ) : (
        <EmptyState
          icon="calendar-check-outline"
          title="A clear day"
          body="No care responsibilities are scheduled for today."
        />
      )}
      {activeRequests.length ? (
        <>
          <SectionHeader title="Help requests" />
          {activeRequests.map((request) => (
            <Card key={request.id} style={styles.request}>
              <View style={styles.flex}>
                <Text style={uiStyles.strong}>
                  {
                    data.children.find((child) => child.id === request.childId)
                      ?.firstName
                  }{" "}
                  · {request.type.toLowerCase()}
                </Text>
                <Text style={uiStyles.muted}>
                  {formatHouseholdDate(
                    request.startsAt,
                    data.householdTimezone,
                    {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  )}{" "}
                  ·{" "}
                  {request.status === "ASSIGNED"
                    ? "Covered"
                    : "Awaiting response"}
                </Text>
              </View>
              <Button
                label="View"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/help-sent",
                    params: { id: request.id },
                  })
                }
              />
            </Card>
          ))}
        </>
      ) : null}
      {data.gaps.length ? (
        <>
          <SectionHeader title="Needs attention" />
          <Card style={styles.alert}>
            <View style={styles.alertTitle}>
              <MaterialCommunityIcons
                name="alert-outline"
                size={24}
                color={colors.danger}
              />
              <View style={styles.flex}>
                <Text style={styles.alertHeading}>
                  {formatHouseholdDate(
                    data.gaps[0].startsAt,
                    data.householdTimezone,
                    { weekday: "long", month: "long", day: "numeric" },
                  )}
                </Text>
                <Text style={styles.alertBody}>
                  {
                    data.children.find(
                      (child) => child.id === data.gaps[0].childId,
                    )?.firstName
                  }{" "}
                  — {data.gaps[0].title}
                </Text>
                <Text style={styles.alertMissing}>No caregiver assigned</Text>
              </View>
            </View>
            {canManage ? (
              <Button
                label="Find Help"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/help-request",
                    params: { eventId: data.gaps[0].id },
                  })
                }
              />
            ) : null}
          </Card>
        </>
      ) : null}
      <SectionHeader title="Quick actions" />
      <View style={styles.quick}>
        {canManage ? (
          <Button
            label="Ask for Help"
            icon="hand-heart"
            onPress={() => router.push("/help-request")}
          />
        ) : null}
        <Button
          label="Create Handoff"
          variant="secondary"
          icon="account-switch"
          onPress={() => router.push("/quick-actions")}
        />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  sync: { textAlign: "center", color: colors.muted, fontSize: 12 },
  syncError: {
    textAlign: "center",
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  flex: { flex: 1 },
  bell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 1,
    top: 1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  childTop: { gap: spacing.md },
  childName: { fontSize: 20, fontWeight: "800", color: colors.ink },
  next: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  nextLabel: { color: colors.muted, fontSize: 12 },
  nextText: { color: colors.ink, fontWeight: "700", marginVertical: 2 },
  eventCard: { paddingVertical: 0 },
  request: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  alert: {
    backgroundColor: "#FFF9EF",
    borderColor: "#F3C98C",
    gap: spacing.md,
  },
  alertTitle: { flexDirection: "row", gap: spacing.sm },
  alertHeading: { color: colors.ink, fontWeight: "800" },
  alertBody: { color: colors.muted, marginTop: 3 },
  alertMissing: { color: colors.danger, fontWeight: "700", marginTop: 2 },
  quick: { gap: spacing.sm },
});
