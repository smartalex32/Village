import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { AppHeader, Button, Card, Field, Screen } from "@/src/components/ui";
import { useAuth } from "@/src/providers/AuthProvider";
import { colors } from "@/src/theme/tokens";

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    const result = await updatePassword(password);
    setSaving(false);
    if (result) setError(result);
    else router.replace("/(tabs)");
  }
  return (
    <Screen>
      <AppHeader
        title="Choose a new password"
        subtitle="Use at least eight characters."
      />
      <Card style={styles.form}>
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Field
          label="Confirm password"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoComplete="new-password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={saving ? "Saving…" : "Update Password"}
          onPress={save}
          disabled={saving || password.length < 8 || confirmation.length < 8}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, marginTop: 24 },
  error: { color: colors.danger, textAlign: "center" },
});
