import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  DateField,
  Field,
  Screen,
} from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";
import { formatDateInput, isValidDateInput } from "@/src/lib/dateInput";

export default function ChildFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const village = useVillage();
  const existing = village.children.find((child) => child.id === id);
  const [firstName, setFirstName] = useState(existing?.firstName ?? "");
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [avatarUri, setAvatarUri] = useState(existing?.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [birthDateError, setBirthDateError] = useState("");

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is required to choose an avatar.");
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

  async function save() {
    setError("");
    const formattedBirthDate = formatDateInput(birthDate);
    setBirthDate(formattedBirthDate);
    if (!isValidDateInput(formattedBirthDate)) {
      setBirthDateError("Enter a real date as YYYY-MM-DD or YYYYMMDD.");
      return;
    }

    setBirthDateError("");
    setSaving(true);
    const input = {
      firstName: firstName.trim(),
      birthDate: formattedBirthDate || undefined,
      notes: notes || undefined,
    };
    try {
      const child = existing
        ? (village.updateChild(existing.id, input), existing)
        : village.addChild(input);
      if (avatarUri && avatarUri !== existing?.avatarUrl)
        await village.uploadChildAvatar(child.id, avatarUri);
      router.back();
    } catch {
      setError("The child profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Screen>
      <AppHeader
        title={existing ? `Edit ${existing.firstName}` : "Add a child"}
        subtitle="Keep the profile lightweight. You can update it later."
      />
      <View style={styles.avatar}>
        <Avatar name={firstName || "Child"} uri={avatarUri} size={76} />
        <Button
          label="Choose Photo"
          variant="secondary"
          onPress={chooseAvatar}
        />
      </View>
      <Field
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
      />
      <DateField
        label="Birth date (optional)"
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
        label="Basic care notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Only what caregivers need to know"
        multiline
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={saving ? "Saving…" : existing ? "Save Changes" : "Add Child"}
        onPress={save}
        disabled={saving || !firstName.trim()}
      />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", gap: spacing.sm },
  error: { color: colors.danger, textAlign: "center" },
});
