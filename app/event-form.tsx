import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Button, Field, Screen } from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, radius, spacing } from "@/src/theme/tokens";

export default function EventFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const data = useVillage();
  const existing = data.events.find((event) => event.id === id);
  const children = data.children.filter((item) => !item.archived);
  const [childId, setChildId] = useState(
    existing?.childId ?? children[0]?.id ?? "",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [caregiverId, setCaregiverId] = useState<string | undefined>(
    existing?.caregiverId,
  );
  const startsAt = useMemo(() => {
    if (existing) return existing.startsAt;
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return date.toISOString();
  }, [existing]);
  function save() {
    const input = {
      childId,
      type: existing?.type ?? "OTHER",
      title,
      startsAt,
      location,
      caregiverId,
      requiresCaregiver: true,
    };
    if (existing) data.updateEvent(existing.id, input);
    else data.addEvent(input);
    router.back();
  }
  return (
    <Screen style={styles.screen}>
      <AppHeader
        title={existing ? "Edit Event" : "Add Event"}
        subtitle={
          existing
            ? "Update this care responsibility."
            : "Schedule a childcare responsibility."
        }
        onBack={() => router.back()}
      />
      <Text style={styles.label}>Child</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {children.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            accessibilityState={{ selected: childId === child.id }}
            onPress={() => setChildId(child.id)}
            style={[styles.chip, childId === child.id && styles.selected]}
          >
            <Text
              style={[
                styles.chipText,
                childId === child.id && styles.selectedText,
              ]}
            >
              {child.firstName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Field
        label="Event title"
        placeholder="School pickup"
        value={title}
        onChangeText={setTitle}
      />
      <View style={styles.fieldRow}>
        <View style={styles.halfField}>
          <Field
            label="When"
            value={new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(startsAt))}
            editable={false}
          />
        </View>
        <View style={styles.halfField}>
          <Field
            label="Location"
            placeholder="Where?"
            value={location}
            onChangeText={setLocation}
          />
        </View>
      </View>
      <Text style={styles.label}>Assigned caregiver</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !caregiverId }}
          onPress={() => setCaregiverId(undefined)}
          style={[styles.chip, !caregiverId && styles.selected]}
        >
          <Text style={[styles.chipText, !caregiverId && styles.selectedText]}>
            Unassigned
          </Text>
        </Pressable>
        {data.members
          .filter((member) => member.childIds.includes(childId))
          .map((member) => (
            <Pressable
              key={member.id}
              accessibilityRole="button"
              accessibilityState={{ selected: caregiverId === member.id }}
              onPress={() => setCaregiverId(member.id)}
              style={[
                styles.chip,
                caregiverId === member.id && styles.selected,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  caregiverId === member.id && styles.selectedText,
                ]}
              >
                {member.displayName}
              </Text>
            </Pressable>
          ))}
      </ScrollView>
      <Button
        label={existing ? "Save Changes" : "Save Event"}
        onPress={save}
        disabled={!title.trim() || !childId}
      />
      {existing ? (
        <Button
          label="Cancel Event"
          variant="danger"
          onPress={() => {
            data.cancelEvent(existing.id);
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.md },
  label: { color: colors.ink, fontWeight: "800" },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  halfField: { flex: 1, minWidth: 0 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  selected: { borderColor: colors.forest, backgroundColor: colors.forest },
  chipText: { color: colors.ink, fontWeight: "600" },
  selectedText: { color: "#fff" },
});
