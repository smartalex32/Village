import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Avatar, Button, Field, Screen } from "@/src/components/ui";
import type { Capability } from "@/src/domain/types";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, radius, spacing } from "@/src/theme/tokens";

const types: { value: Capability; label: string }[] = [
  { value: "PICKUP", label: "Pickup" },
  { value: "DROPOFF", label: "Dropoff" },
  { value: "BABYSITTING", label: "Babysitting" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "OTHER", label: "Other" },
];
export default function HelpRequestScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const data = useVillage();
  const linked = data.events.find((event) => event.id === eventId);
  const activeChildren = data.children.filter((child) => !child.archived);
  const [type, setType] = useState<Capability>(
    (linked?.type as Capability) ?? "PICKUP",
  );
  const [childId, setChildId] = useState(
    linked?.childId ?? activeChildren[0]?.id ?? "",
  );
  const [location, setLocation] = useState(
    linked?.location ?? "Westside Elementary",
  );
  const [notes, setNotes] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const startsAt = useMemo(() => {
    if (linked) return linked.startsAt;
    const date = new Date();
    date.setHours(15, 15, 0, 0);
    if (date < new Date()) date.setDate(date.getDate() + 1);
    return date.toISOString();
  }, [linked]);
  const recipients = data.members.filter(
    (member) =>
      member.id !== data.currentMemberId &&
      member.childIds.includes(childId) &&
      member.capabilities.includes(type),
  );
  function toggle(id: string) {
    setRecipientIds((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  }
  function submit() {
    const request = data.createHelpRequest({
      childId,
      type,
      startsAt,
      location,
      notes,
      recipientIds,
      eventId,
    });
    router.replace({ pathname: "/help-sent", params: { id: request.id } });
  }
  return (
    <Screen style={styles.screen}>
      <AppHeader
        title="Ask for Help"
        subtitle="Send a request to your village."
      />
      <Text style={styles.label}>What type of help is needed?</Text>
      <View style={styles.helpTypes}>
        {types.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected: type === item.value }}
            onPress={() => {
              setType(item.value);
              setRecipientIds([]);
            }}
            style={[styles.chip, type === item.value && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                type === item.value && styles.chipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Which child?</Text>
      <View style={styles.chips}>
        {activeChildren.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            accessibilityState={{ selected: childId === child.id }}
            onPress={() => {
              setChildId(child.id);
              setRecipientIds([]);
            }}
            style={[
              styles.personChip,
              childId === child.id && styles.personChipActive,
            ]}
          >
            <Avatar name={child.firstName} uri={child.avatarUrl} size={28} />
            <Text style={styles.chipText}>{child.firstName}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.halfField}>
          <Field
            label="When?"
            value={new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(startsAt))}
            editable={false}
          />
        </View>
        <View style={styles.halfField}>
          <Field
            label="From where?"
            value={location}
            onChangeText={setLocation}
            placeholder="Location"
          />
        </View>
      </View>
      <Text style={styles.label}>Who should receive the request?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalOptions}
      >
        {recipients.map((member) => (
          <Pressable
            key={member.id}
            accessibilityRole="button"
            accessibilityLabel={`Ask ${member.displayName}`}
            accessibilityState={{ selected: recipientIds.includes(member.id) }}
            onPress={() => toggle(member.id)}
            style={[
              styles.recipient,
              recipientIds.includes(member.id) && styles.recipientSelected,
            ]}
          >
            <Avatar
              name={member.displayName}
              uri={member.avatarUrl}
              size={28}
            />
            <Text style={styles.recipientName}>{member.displayName}</Text>
            <Text style={styles.check}>
              {recipientIds.includes(member.id) ? "✓" : "+"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {!recipients.length ? (
        <Text style={styles.empty}>
          No eligible caregivers have this capability and child access.
        </Text>
      ) : null}
      <Field
        label="Add a note (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Anything they need to know?"
        style={styles.notes}
      />
      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <Button
            label="Ask My Village"
            onPress={submit}
            disabled={!childId || !location.trim() || !recipientIds.length}
          />
        </View>
        <View style={styles.actionButton}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.md },
  label: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  helpTypes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  horizontalOptions: { gap: spacing.sm, paddingRight: spacing.md },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  halfField: { flex: 1, minWidth: 0 },
  chip: {
    minHeight: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipText: { color: colors.ink, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  personChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 5,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  personChipActive: {
    borderColor: colors.forest,
    backgroundColor: colors.mint,
  },
  recipient: {
    minHeight: 46,
    minWidth: 112,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  recipientSelected: { borderColor: colors.forest, backgroundColor: "#F2FAF7" },
  recipientName: { flex: 1, color: colors.ink, fontWeight: "700" },
  check: { color: colors.forest, fontWeight: "900", fontSize: 18 },
  empty: { color: colors.muted, fontStyle: "italic" },
  notes: { minHeight: 62 },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1 },
});
