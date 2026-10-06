import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { AppHeader, Button, Field, Screen } from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, radius, spacing } from "@/src/theme/tokens";
import { useAppRouter } from "@/src/lib/useAppRouter";
import { HouseholdDateTimeFields } from "@/src/components/HouseholdDateTimeFields";
import {
  householdDateTime,
  resolveHouseholdDateTime,
} from "@/src/lib/dateTime";

export default function EventFormScreen() {
  const router = useAppRouter();
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
  const [when, setWhen] = useState(() =>
    householdDateTime(
      existing?.startsAt ?? new Date(Date.now() + 3600000),
      data.householdTimezone,
    ),
  );
  const [hasEnd, setHasEnd] = useState(Boolean(existing?.endsAt));
  const [end, setEnd] = useState(() =>
    householdDateTime(
      existing?.endsAt ??
        new Date(
          new Date(existing?.startsAt ?? Date.now()).getTime() + 7200000,
        ),
      data.householdTimezone,
    ),
  );
  const startResult = resolveHouseholdDateTime(
    when,
    data.householdTimezone,
    existing?.startsAt,
  );
  const endResult = hasEnd
    ? resolveHouseholdDateTime(end, data.householdTimezone, existing?.endsAt)
    : undefined;
  const endError =
    endResult?.iso &&
    startResult.iso &&
    new Date(endResult.iso) <= new Date(startResult.iso)
      ? "End time must be after the start time."
      : undefined;
  const closed = Boolean(existing && existing.status !== "SCHEDULED");
  const activeRequest = existing
    ? data.helpRequests.find(
        (request) =>
          request.eventId === existing.id &&
          (request.status === "OPEN" || request.status === "ASSIGNED"),
      )
    : undefined;
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  const canSave = Boolean(
    !closed &&
    canManage &&
    title.trim() &&
    childId &&
    startResult.iso &&
    (!hasEnd || (endResult?.iso && !endError)),
  );
  function save() {
    if (!canSave || !startResult.iso) return;
    const input = {
      childId,
      type: existing?.type ?? "OTHER",
      title: title.trim(),
      startsAt: startResult.iso,
      endsAt: hasEnd ? endResult?.iso : undefined,
      location,
      caregiverId,
      requiresCaregiver: existing?.requiresCaregiver ?? true,
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
            disabled={closed || !canManage || Boolean(activeRequest)}
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
      {closed ? (
        <Text style={styles.label}>This event is completed or cancelled.</Text>
      ) : null}
      {activeRequest ? (
        <>
          <Text style={styles.label}>
            Manage the child and caregiver through the active help request.
          </Text>
          <Button
            label="View Help Request"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/help-sent",
                params: { id: activeRequest.id },
              })
            }
          />
        </>
      ) : null}
      <Field
        label="Event title"
        placeholder="School pickup"
        value={title}
        onChangeText={setTitle}
        editable={!closed && canManage}
      />
      <HouseholdDateTimeFields
        label="Starts"
        value={when}
        onChange={setWhen}
        timeZone={data.householdTimezone}
        preferredInstant={existing?.startsAt}
        editable={!closed && canManage}
      />
      {hasEnd ? (
        <>
          <HouseholdDateTimeFields
            label="Ends"
            value={end}
            onChange={setEnd}
            timeZone={data.householdTimezone}
            preferredInstant={existing?.endsAt}
            error={endError}
            editable={!closed && canManage}
          />
          <Button
            label="Remove end time"
            variant="ghost"
            onPress={() => setHasEnd(false)}
            disabled={closed || !canManage}
          />
        </>
      ) : (
        <Button
          label="Add end time (optional)"
          variant="ghost"
          onPress={() => setHasEnd(true)}
          disabled={closed || !canManage}
        />
      )}
      <Field
        label="Location"
        placeholder="Where?"
        value={location}
        onChangeText={setLocation}
        editable={!closed && canManage}
      />
      <Text style={styles.label}>Assigned caregiver</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !caregiverId }}
          disabled={closed || !canManage || Boolean(activeRequest)}
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
              disabled={closed || !canManage || Boolean(activeRequest)}
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
        disabled={!canSave}
      />
      {existing && canManage && !closed ? (
        <Button
          label="Mark Complete"
          variant="secondary"
          onPress={() => {
            data.updateEvent(existing.id, { status: "COMPLETED" });
            router.back();
          }}
        />
      ) : null}
      {existing && canManage && !closed ? (
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
