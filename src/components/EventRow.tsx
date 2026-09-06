import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CareEvent, Child, VillageMember } from "@/src/domain/types";
import { colors, spacing } from "@/src/theme/tokens";
import { formatHouseholdDate } from "@/src/lib/dateTime";

const eventIcons: Record<
  string,
  React.ComponentProps<typeof MaterialCommunityIcons>["name"]
> = {
  PICKUP: "car",
  DROPOFF: "car-arrow-right",
  APPOINTMENT: "medical-bag",
  ACTIVITY: "soccer",
  SCHOOL: "school",
  OTHER: "book-open-page-variant",
};

export function EventRow({
  event,
  child,
  caregiver,
  onPress,
  timeZone = "UTC",
}: {
  event: CareEvent;
  child?: Child;
  caregiver?: VillageMember;
  onPress?: () => void;
  timeZone?: string;
}) {
  const missing = event.requiresCaregiver && !caregiver;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        onPress
          ? `Edit ${child?.firstName ?? "child"} ${event.title}`
          : undefined
      }
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}
    >
      <Text style={styles.time}>
        {formatHouseholdDate(event.startsAt, timeZone, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </Text>
      <View style={[styles.icon, missing && styles.iconAlert]}>
        <MaterialCommunityIcons
          name={eventIcons[event.type] ?? "calendar"}
          size={19}
          color={missing ? colors.danger : colors.forestDark}
        />
      </View>
      <View style={styles.details}>
        <Text style={styles.title}>
          {child?.firstName} — {event.title}
        </Text>
        {event.location ? (
          <Text style={styles.meta}>{event.location}</Text>
        ) : null}
        <Text style={[styles.meta, missing && styles.missing]}>
          {missing ? "No caregiver assigned" : (caregiver?.displayName ?? "")}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  time: { width: 72, color: "#40514E", fontWeight: "600", fontSize: 13 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    marginRight: spacing.sm,
  },
  iconAlert: { backgroundColor: colors.dangerSoft },
  details: { flex: 1 },
  title: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 1 },
  missing: { color: colors.danger, fontWeight: "700" },
});
