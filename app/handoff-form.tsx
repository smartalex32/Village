import { randomUUID } from "expo-crypto";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Button, Field, Screen } from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, radius, spacing } from "@/src/theme/tokens";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function HandoffFormScreen() {
  const router = useAppRouter();
  const data = useVillage();
  const activeChildren = data.children.filter((child) => !child.archived);
  const [childId, setChildId] = useState(activeChildren[0]?.id ?? "");
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  const eligible = data.members.filter(
    (member) =>
      member.id === data.currentMemberId ||
      (member.childPermissions?.[childId]?.handoffs ??
        member.childIds.includes(childId)),
  );
  const [fromMemberId, setFromMemberId] = useState(data.currentMemberId);
  const [toMemberId, setToMemberId] = useState(
    eligible.find((member) => member.id !== data.currentMemberId)?.id ?? "",
  );
  const [location, setLocation] = useState("At home");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState("Backpack, Water bottle");
  const [associatedEventId, setAssociatedEventId] = useState<string>();
  const scheduledAt = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return date.toISOString();
  }, []);
  const upcoming = data.events
    .filter(
      (event) => event.childId === childId && event.status === "SCHEDULED",
    )
    .slice(0, 3);

  function chooseChild(id: string) {
    setChildId(id);
    const members = data.members.filter(
      (member) =>
        member.id === data.currentMemberId ||
        (member.childPermissions?.[id]?.handoffs ??
          member.childIds.includes(id)),
    );
    setFromMemberId(data.currentMemberId);
    setToMemberId(
      members.find((member) => member.id !== data.currentMemberId)?.id ?? "",
    );
    setAssociatedEventId(undefined);
  }

  function save() {
    const handoff = data.createHandoff({
      childId,
      fromMemberId,
      toMemberId,
      scheduledAt,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      associatedEventId,
      items: items
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((label) => ({ id: randomUUID(), label, ready: false })),
    });
    router.replace({ pathname: "/handoff/[id]", params: { id: handoff.id } });
  }

  return (
    <Screen style={styles.screen}>
      <AppHeader
        title="Create Handoff"
        subtitle="Prepare the details the next caregiver needs."
        onBack={() => router.back()}
      />
      <ChoiceRow
        label="Child"
        options={activeChildren.map((child) => ({
          id: child.id,
          label: child.firstName,
        }))}
        value={childId}
        onChange={chooseChild}
      />
      <ChoiceRow
        label="From"
        options={(canManage
          ? eligible
          : eligible.filter((member) => member.id === data.currentMemberId)
        ).map((member) => ({
          id: member.id,
          label: member.displayName,
        }))}
        value={fromMemberId}
        onChange={(id) => {
          setFromMemberId(id);
          if (id === toMemberId)
            setToMemberId(
              eligible.find((member) => member.id !== id)?.id ?? "",
            );
        }}
      />
      <ChoiceRow
        label="To"
        options={eligible
          .filter((member) => member.id !== fromMemberId)
          .map((member) => ({ id: member.id, label: member.displayName }))}
        value={toMemberId}
        onChange={setToMemberId}
      />
      <View style={styles.fieldRow}>
        <View style={styles.halfField}>
          <Field
            label="When"
            value={new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(scheduledAt))}
            editable={false}
          />
        </View>
        <View style={styles.halfField}>
          <Field label="Location" value={location} onChangeText={setLocation} />
        </View>
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.halfField}>
          <Field
            label="Items to bring"
            value={items}
            onChangeText={setItems}
            placeholder="Comma separated"
          />
        </View>
        <View style={styles.halfField}>
          <Field
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </View>
      {upcoming.length ? (
        <ChoiceRow
          label="Related event (optional)"
          options={upcoming.map((event) => ({
            id: event.id,
            label: event.title,
          }))}
          value={associatedEventId}
          onChange={(id) =>
            setAssociatedEventId(id === associatedEventId ? undefined : id)
          }
        />
      ) : null}
      <Button
        label="Create Handoff"
        onPress={save}
        disabled={!childId || !fromMemberId || !toMemberId}
      />
    </Screen>
  );
}

function ChoiceRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value?: string;
  onChange(id: string): void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.id)}
              style={[styles.option, selected && styles.selected]}
            >
              <Text
                style={[styles.optionText, selected && styles.selectedText]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.md },
  group: { gap: spacing.xs },
  label: { color: colors.ink, fontWeight: "800" },
  options: { gap: spacing.sm, paddingRight: spacing.md },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  halfField: { flex: 1, minWidth: 0 },
  option: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
  },
  selected: { backgroundColor: colors.forest, borderColor: colors.forest },
  optionText: { color: colors.ink, fontWeight: "600" },
  selectedText: { color: "#fff" },
});
