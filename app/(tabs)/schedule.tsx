import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  Screen,
} from "@/src/components/ui";
import { EventRow } from "@/src/components/EventRow";
import { useVillage } from "@/src/providers/VillageProvider";
import { formatHouseholdDate, householdDateKey } from "@/src/lib/dateTime";
import { colors, radius, spacing } from "@/src/theme/tokens";

type Range = "Today" | "Tomorrow" | "This Week";
export default function ScheduleScreen() {
  const router = useRouter();
  const data = useVillage();
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  const [range, setRange] = useState<Range>("Today");
  const now = new Date();
  const offsets =
    range === "Today"
      ? [0]
      : range === "Tomorrow"
        ? [1]
        : [0, 1, 2, 3, 4, 5, 6];
  const targetDates = new Set(
    offsets.map((offset) =>
      householdDateKey(
        new Date(now.getTime() + offset * 24 * 60 * 60 * 1000),
        data.householdTimezone,
      ),
    ),
  );
  const events = data.events
    .filter(
      (event) =>
        event.status === "SCHEDULED" &&
        targetDates.has(
          householdDateKey(event.startsAt, data.householdTimezone),
        ),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const groups = Array.from(
    new Set(
      events.map((event) =>
        householdDateKey(event.startsAt, data.householdTimezone),
      ),
    ),
  );
  return (
    <Screen>
      <AppHeader
        title="Schedule"
        subtitle="Care responsibilities at a glance."
        right={
          canManage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add event"
              onPress={() => router.push("/event-form")}
            >
              <Text style={styles.add}>＋</Text>
            </Pressable>
          ) : undefined
        }
      />
      <View style={styles.segment}>
        {(["Today", "Tomorrow", "This Week"] as Range[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: range === item }}
            onPress={() => setRange(item)}
            style={[styles.segmentItem, range === item && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                range === item && styles.segmentTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      {groups.length ? (
        groups.map((group) => (
          <View key={group}>
            <Text style={styles.date}>
              {formatHouseholdDate(
                events.find(
                  (event) =>
                    householdDateKey(event.startsAt, data.householdTimezone) ===
                    group,
                )!.startsAt,
                data.householdTimezone,
                { weekday: "long", month: "long", day: "numeric" },
              )}
            </Text>
            <Card style={styles.eventCard}>
              {events
                .filter(
                  (event) =>
                    householdDateKey(event.startsAt, data.householdTimezone) ===
                    group,
                )
                .map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    child={data.children.find(
                      (child) => child.id === event.childId,
                    )}
                    caregiver={data.members.find(
                      (member) => member.id === event.caregiverId,
                    )}
                    timeZone={data.householdTimezone}
                    onPress={
                      canManage
                        ? () =>
                            router.push({
                              pathname: "/event-form",
                              params: { id: event.id },
                            })
                        : undefined
                    }
                  />
                ))}
            </Card>
          </View>
        ))
      ) : (
        <EmptyState
          icon="calendar-blank-outline"
          title="Nothing scheduled"
          body={`There are no care events for ${range.toLowerCase()}.`}
          action={
            <Button
              label="Add Event"
              onPress={() => router.push("/event-form")}
            />
          }
        />
      )}
      {events.some((event) => event.requiresCaregiver && !event.caregiverId) ? (
        <Card style={styles.warning}>
          <Text style={styles.warningTitle}>Needs attention</Text>
          <Text style={styles.warningBody}>
            One or more responsibilities do not have a caregiver.
          </Text>
          {canManage ? (
            <Button
              label="Find Help"
              variant="secondary"
              onPress={() => router.push("/help-request")}
            />
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  add: { color: colors.forest, fontSize: 32, fontWeight: "500" },
  segment: {
    flexDirection: "row",
    backgroundColor: "#E9F0F0",
    borderRadius: radius.sm,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: colors.forest },
  segmentText: { color: colors.ink, fontWeight: "600", fontSize: 13 },
  segmentTextActive: { color: "#fff" },
  date: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  eventCard: { paddingVertical: 0 },
  warning: {
    backgroundColor: "#FFF9EF",
    borderColor: "#F3C98C",
    gap: spacing.sm,
  },
  warningTitle: { color: colors.amberText, fontWeight: "800", fontSize: 16 },
  warningBody: { color: colors.muted },
});
