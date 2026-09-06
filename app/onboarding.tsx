import { useState } from "react";
import { useRouter } from "expo-router";
import { Platform, StyleSheet, Text } from "react-native";
import { AppHeader, Button, Card, Field, Screen } from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors } from "@/src/theme/tokens";
import {
  createRemoteHousehold,
  saveRemotePushToken,
} from "@/src/data/supabaseRepository";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import { registerForPushNotifications } from "@/src/lib/notifications";

export default function OnboardingScreen() {
  const router = useRouter();
  const village = useVillage();
  const { user } = useAuth();
  const [household, setHousehold] = useState("");
  const [child, setChild] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function finish() {
    setSaving(true);
    setError("");
    try {
      if (isSupabaseConfigured) {
        await createRemoteHousehold(
          household.trim(),
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          child.trim(),
        );
        await village.refreshRemote();
        const token = await registerForPushNotifications();
        const platform = Platform.OS;
        if (token && user && (platform === "ios" || platform === "android"))
          await saveRemotePushToken(user.id, token, platform);
      } else {
        village.setHouseholdName(household.trim());
        village.addChild({ firstName: child.trim() });
      }
      router.replace("/(tabs)");
    } catch {
      setError(
        "We could not create your household. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Screen>
      <Text style={styles.step}>STEP 1 OF 1</Text>
      <AppHeader
        title="Who’s in your household?"
        subtitle="Start with your household and one child. You can invite your village later."
      />
      <Card style={styles.form}>
        <Field
          label="Household name"
          placeholder="The Alexander Family"
          value={household}
          onChangeText={setHousehold}
        />
        <Field
          label="Child’s first name"
          placeholder="Emma"
          value={child}
          onChangeText={setChild}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={saving ? "Creating…" : "Create My Village"}
          onPress={finish}
          disabled={saving || !household.trim() || !child.trim()}
        />
      </Card>
      <Text style={styles.private}>
        Only people you explicitly invite can access this household.
      </Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  step: {
    color: colors.forest,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  form: { gap: 16 },
  private: { color: colors.muted, textAlign: "center", fontSize: 13 },
  error: { color: colors.danger, textAlign: "center" },
});
