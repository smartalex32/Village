import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  DateField,
  Field,
  Screen,
  SectionHeader,
  uiStyles,
} from "@/src/components/ui";
import { EventRow } from "@/src/components/EventRow";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";
import { useAppRouter } from "@/src/lib/useAppRouter";
import { formatDateInput, isValidDateInput } from "@/src/lib/dateInput";

export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const data = useVillage();
  const child = data.children.find((item) => item.id === id);
  const [firstName, setFirstName] = useState(child?.firstName ?? "");
  const [birthDate, setBirthDate] = useState(child?.birthDate ?? "");
  const [notes, setNotes] = useState(child?.notes ?? "");
  const [avatarUri, setAvatarUri] = useState(child?.avatarUrl);
  const [birthDateError, setBirthDateError] = useState("");
  const [saving, setSaving] = useState(false);
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";

  if (!child)
    return (
      <Screen>
        <AppHeader title="Child unavailable" onBack={() => router.back()} />
      </Screen>
    );
  const childId = child.id;
  const originalAvatarUrl = child.avatarUrl;

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo permission needed",
        "Allow photo library access to choose a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  async function saveProfile() {
    const formattedBirthDate = formatDateInput(birthDate);
    const trimmedNotes = notes.trim();
    const trimmedFirstName = firstName.trim();
    setBirthDate(formattedBirthDate);
    if (!isValidDateInput(formattedBirthDate)) {
      setBirthDateError("Enter a real date as YYYY-MM-DD or YYYYMMDD.");
      return;
    }

    setBirthDateError("");
    setNotes(trimmedNotes);
    setFirstName(trimmedFirstName);
    setSaving(true);
    try {
      data.updateChild(childId, {
        firstName: trimmedFirstName,
        birthDate: formattedBirthDate || null,
        notes: trimmedNotes,
      });
      if (avatarUri && avatarUri !== originalAvatarUrl)
        await data.uploadChildAvatar(childId, avatarUri);
    } catch {
      Alert.alert(
        "Profile not saved",
        "The profile picture could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

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
  const isDirty =
    firstName !== child.firstName ||
    birthDate !== (child.birthDate ?? "") ||
    notes !== (child.notes ?? "") ||
    avatarUri !== child.avatarUrl;
  return (
    <Screen scroll={false} style={styles.screen}>
      <AppHeader
        title={child.firstName}
        subtitle="Child profile"
        onBack={() => router.back()}
      />
      {canManage ? (
        <View style={styles.profile}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose profile picture"
            onPress={chooseAvatar}
            style={styles.avatarButton}
          >
            <Avatar name={firstName || "Child"} uri={avatarUri} size={56} />
            <View style={styles.cameraBadge}>
              <MaterialCommunityIcons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.flex}>
            <Field
              label="Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Child's name"
            />
          </View>
        </View>
      ) : (
        <View style={styles.profile}>
          <Avatar name={child.firstName} uri={child.avatarUrl} size={56} />
          {child.birthDate ? (
            <Text style={[uiStyles.body, styles.flex]}>
              Born {format(new Date(child.birthDate), "MMMM d, yyyy")}
            </Text>
          ) : null}
        </View>
      )}
      {canManage ? (
        <>
          <DateField
            label="Birthday"
            value={birthDate}
            onChangeText={(value) => {
              setBirthDate(value);
              if (birthDateError) setBirthDateError("");
            }}
            onBlur={() => {
              const formatted = formatDateInput(birthDate);
              setBirthDateError(
                isValidDateInput(formatted)
                  ? ""
                  : "Enter a real date as YYYY-MM-DD or YYYYMMDD.",
              );
            }}
            placeholder="YYYYMMDD"
            error={birthDateError}
          />
          <Field
            label="Basic care notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Only what caregivers need to know"
            multiline
            style={styles.notesInput}
          />
          <Button
            label={saving ? "Saving…" : "Save Profile"}
            onPress={saveProfile}
            disabled={saving || !firstName.trim() || !isDirty}
          />
        </>
      ) : (
        <Card>
          <Text style={child.notes ? uiStyles.body : uiStyles.muted}>
            {child.notes || "No care notes yet."}
          </Text>
        </Card>
      )}
      {handoff ? (
        <>
          <SectionHeader title="Next handoff" />
          <Card style={styles.handoff}>
            <View style={styles.flex}>
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
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View handoff"
              onPress={() =>
                router.push({
                  pathname: "/handoff/[id]",
                  params: { id: handoff.id },
                })
              }
              style={styles.handoffLink}
            >
              <Text style={styles.handoffLinkText}>View</Text>
            </Pressable>
          </Card>
        </>
      ) : null}
      <View style={styles.schedule}>
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
              compact
            />
          ))}
        </Card>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.md, gap: spacing.sm },
  profile: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  flex: { flex: 1, gap: 6 },
  avatarButton: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.forest,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  notesInput: { minHeight: 68, height: 68 },
  handoff: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  handoffLink: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  handoffLinkText: { color: colors.forest, fontWeight: "700" },
  schedule: { flex: 1, minHeight: 0, gap: spacing.xs },
  events: { flex: 1, minHeight: 0, paddingVertical: 0 },
});
