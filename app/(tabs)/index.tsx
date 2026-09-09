import {
  ArrowRightLeft,
  Bell,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  CircleUserRound,
  HandHeart,
  TriangleAlert,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  AppHeader,
  Avatar,
  Card,
  Pill,
  Screen,
  SectionHeader,
  uiStyles,
} from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { formatHouseholdDate, householdDateKey } from "@/src/lib/dateTime";
import { todaySummaryLimits } from "@/src/lib/todayLayout";
import { colors, radius, spacing } from "@/src/theme/tokens";

export default function TodayScreen() {
  const router = useRouter();
  const data = useVillage();
  const { height } = useWindowDimensions();
  const activeChildren = data.children.filter((child) => !child.archived);
  const now = new Date();
  const today = data.events
    .filter(
      (event) =>
        householdDateKey(event.startsAt, data.householdTimezone) ===
          householdDateKey(now, data.householdTimezone) &&
        event.status === "SCHEDULED",
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const summaryLimits = todaySummaryLimits(height, activeChildren.length);
  const visibleSchedule = today
    .filter((event) => new Date(event.startsAt).getTime() >= now.getTime())
    .slice(0, summaryLimits.schedule);
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
  const visibleAttention = [
    ...data.gaps.map((gap) => ({ kind: "gap" as const, gap })),
    ...activeRequests.map((request) => ({
      kind: "request" as const,
      request,
    })),
  ].slice(0, summaryLimits.attention);

  return (
    <Screen
      style={styles.screen}
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
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open account"
              onPress={() => router.push("/account")}
              style={styles.headerButton}
            >
              <CircleUserRound size={25} color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${unread} unread notifications`}
              onPress={() => router.push("/notifications")}
              style={styles.headerButton}
            >
              <Bell size={24} color={colors.ink} />
              {unread ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        }
      />

      <SectionHeader title="Children" />
      {activeChildren.length ? (
        <View style={styles.childrenGrid}>
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
            const fromName = data.members.find(
              (member) => member.id === handoff?.fromMemberId,
            )?.displayName;
            const toName = data.members.find(
              (member) => member.id === handoff?.toMemberId,
            )?.displayName;

            return (
              <Card key={child.id} style={styles.childCard}>
                <View style={styles.childSummary}>
                  <Avatar
                    name={child.firstName}
                    uri={child.avatarUrl}
                    size={40}
                    color={index % 2 === 0 ? "#F3E5CB" : colors.blue}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.childName} numberOfLines={1}>
                      {child.firstName}
                    </Text>
                    <Text style={styles.currentLabel}>Currently with</Text>
                    <Text style={styles.caregiver} numberOfLines={1}>
                      {caregiver?.displayName ?? "Not acknowledged"}
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
                    tone={
                      caregiver?.id === data.currentMemberId ? "blue" : "green"
                    }
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
                    style={styles.nextHandoff}
                  >
                    <ArrowRightLeft size={17} color={colors.forest} />
                    <View style={styles.flex}>
                      <Text style={styles.nextHandoffTime} numberOfLines={1}>
                        Next ·{" "}
                        {formatHouseholdDate(
                          handoff.scheduledAt,
                          data.householdTimezone,
                          { hour: "numeric", minute: "2-digit" },
                        )}
                      </Text>
                      <Text style={styles.nextHandoffPeople} numberOfLines={1}>
                        {fromName} → {toName}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active children</Text>
          <Text style={uiStyles.muted}>Add a child from the Family tab.</Text>
        </Card>
      )}

      <SectionHeader
        title="Today’s schedule"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See all scheduled care"
            onPress={() => router.navigate("/schedule")}
            hitSlop={8}
          >
            <Text style={uiStyles.link}>See all</Text>
          </Pressable>
        }
      />
      {visibleSchedule.length ? (
        <Card style={styles.scheduleList}>
          {visibleSchedule.map((event, index) => (
            <View
              key={event.id}
              style={[styles.scheduleCard, index > 0 && styles.scheduleDivider]}
            >
              <View style={styles.scheduleIcon}>
                <CalendarClock size={20} color={colors.forestDark} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.scheduleEyebrow}>
                  {index === 0 ? "Up next · " : ""}
                  {formatHouseholdDate(event.startsAt, data.householdTimezone, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={styles.scheduleTitle} numberOfLines={1}>
                  {
                    data.children.find((child) => child.id === event.childId)
                      ?.firstName
                  }{" "}
                  — {event.title}
                </Text>
                <Text style={styles.scheduleMeta} numberOfLines={1}>
                  {event.location ?? "No location"}
                  {event.caregiverId
                    ? ` · ${
                        data.members.find(
                          (member) => member.id === event.caregiverId,
                        )?.displayName ?? "Unassigned"
                      }`
                    : ""}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Card style={styles.allClearCard}>
          <CalendarCheck size={22} color={colors.forest} />
          <View style={styles.flex}>
            <Text style={styles.emptyTitle}>Today is wrapped up</Text>
            <Text style={uiStyles.muted}>No more scheduled care today.</Text>
          </View>
        </Card>
      )}

      <SectionHeader title="Needs attention" />
      {visibleAttention.length ? (
        <View style={styles.attentionList}>
          {visibleAttention.map((item) =>
            item.kind === "gap" ? (
              <Card key={`gap-${item.gap.id}`} style={styles.alert}>
                <View style={styles.attentionRow}>
                  <TriangleAlert size={22} color={colors.danger} />
                  <View style={styles.flex}>
                    <Text style={styles.alertHeading} numberOfLines={1}>
                      {formatHouseholdDate(
                        item.gap.startsAt,
                        data.householdTimezone,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </Text>
                    <Text style={styles.alertBody} numberOfLines={1}>
                      {
                        data.children.find(
                          (child) => child.id === item.gap.childId,
                        )?.firstName
                      }{" "}
                      — {item.gap.title}
                    </Text>
                    <Text style={styles.alertMissing}>
                      No caregiver assigned
                    </Text>
                  </View>
                  {canManage ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Find Help"
                      onPress={() =>
                        router.push({
                          pathname: "/help-request",
                          params: { eventId: item.gap.id },
                        })
                      }
                      style={styles.compactAction}
                    >
                      <Text style={styles.compactActionText}>Find help</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            ) : (
              <Pressable
                key={`request-${item.request.id}`}
                accessibilityRole="button"
                accessibilityLabel="View active help request"
                onPress={() =>
                  router.push({
                    pathname: "/help-sent",
                    params: { id: item.request.id },
                  })
                }
              >
                <Card style={styles.requestCard}>
                  <HandHeart size={22} color={colors.forest} />
                  <View style={styles.flex}>
                    <Text style={styles.emptyTitle} numberOfLines={1}>
                      {
                        data.children.find(
                          (child) => child.id === item.request.childId,
                        )?.firstName
                      }{" "}
                      · {item.request.type.toLowerCase()}
                    </Text>
                    <Text style={uiStyles.muted} numberOfLines={1}>
                      {item.request.status === "ASSIGNED"
                        ? "Care is covered. Tap for details."
                        : "Waiting for a response. Tap for details."}
                    </Text>
                  </View>
                  <ChevronRight size={22} color={colors.muted} />
                </Card>
              </Pressable>
            ),
          )}
        </View>
      ) : (
        <Card style={styles.allClearCard}>
          <CircleCheck size={22} color={colors.forest} />
          <View style={styles.flex}>
            <Text style={styles.emptyTitle}>Everything is covered</Text>
            <Text style={uiStyles.muted}>
              No open requests or coverage gaps.
            </Text>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.md },
  sync: { textAlign: "center", color: colors.muted, fontSize: 12 },
  syncError: {
    textAlign: "center",
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  flex: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerButton: {
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
  childrenGrid: { gap: spacing.sm },
  childCard: { padding: 12, gap: 8 },
  childSummary: { flexDirection: "row", alignItems: "center", gap: 10 },
  childName: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  currentLabel: { color: colors.muted, fontSize: 11 },
  caregiver: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  nextHandoff: {
    minHeight: 44,
    marginTop: 2,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceMuted,
  },
  nextHandoffTime: {
    color: colors.forestDark,
    fontSize: 11,
    fontWeight: "700",
  },
  nextHandoffPeople: { color: colors.muted, fontSize: 10, marginTop: 1 },
  scheduleList: { paddingVertical: 0 },
  scheduleCard: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  scheduleDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  scheduleEyebrow: { color: colors.forest, fontSize: 11, fontWeight: "700" },
  scheduleTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  scheduleMeta: { color: colors.muted, fontSize: 11, marginTop: 1 },
  emptyCard: { padding: 12 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  allClearCard: {
    padding: 12,
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  alert: {
    padding: 12,
    backgroundColor: "#FFF9EF",
    borderColor: "#F3C98C",
    gap: spacing.sm,
  },
  attentionList: { gap: spacing.sm },
  attentionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertHeading: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  alertBody: { color: colors.muted, fontSize: 11, marginTop: 1 },
  alertMissing: { color: colors.danger, fontSize: 11, fontWeight: "700" },
  compactAction: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.forest,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  compactActionText: { color: colors.forest, fontSize: 12, fontWeight: "800" },
  requestCard: {
    minHeight: 68,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
