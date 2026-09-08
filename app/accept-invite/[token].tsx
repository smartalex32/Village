import { HouseHeart } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppHeader, Button, Card, Screen } from "@/src/components/ui";
import { useAuth } from "@/src/providers/AuthProvider";
import { useVillage } from "@/src/providers/VillageProvider";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing } from "@/src/theme/tokens";

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, isDemo } = useAuth();
  const village = useVillage();
  const [status, setStatus] = useState<
    "idle" | "working" | "accepted" | "declined" | "error"
  >("idle");
  const next = `/accept-invite/${token}`;
  async function respond(accept: boolean) {
    setStatus("working");
    try {
      if (supabase) {
        const { error } = await supabase.rpc(
          accept
            ? "accept_household_invitation"
            : "decline_household_invitation",
          { p_token: token },
        );
        if (error) throw error;
        await village.refreshRemote();
      }
      setStatus(accept ? "accepted" : "declined");
    } catch {
      setStatus("error");
    }
  }
  return (
    <Screen style={styles.screen}>
      <AppHeader
        title="Join their Village"
        subtitle="Review this private household invitation."
        onBack={() => router.replace(user ? "/(tabs)" : "/")}
      />
      <View style={styles.hero}>
        <HouseHeart size={62} color={colors.forest} />
        <Text style={styles.invitationNote}>
          This private invitation grants only the child and assignment access
          selected by the household owner.
        </Text>
      </View>
      <Card style={styles.card}>
        {status === "accepted" ? (
          <>
            <Text style={styles.title}>Welcome to the Village</Text>
            <Text style={styles.body}>
              The household is ready. Your caregiver view includes only relevant
              responsibilities and child information.
            </Text>
            <Button
              label="Open Village"
              onPress={() => router.replace("/(tabs)")}
            />
          </>
        ) : status === "declined" ? (
          <>
            <Text style={styles.title}>Invitation declined</Text>
            <Text style={styles.body}>No household access was added.</Text>
            <Button
              label="Done"
              variant="secondary"
              onPress={() => router.replace("/")}
            />
          </>
        ) : !user ? (
          <>
            <Text style={styles.title}>Sign in to respond</Text>
            <Text style={styles.body}>
              Use the same email address that received this invitation.
            </Text>
            <Button
              label="Sign In"
              onPress={() =>
                router.push({ pathname: "/sign-in", params: { next } })
              }
            />
            <Button
              label="Create Account"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: "/sign-up", params: { next } })
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {isDemo ? "Demo invitation" : "Invitation ready"}
            </Text>
            <Text style={styles.body}>
              Accepting adds you as a caregiver. Village is a coordination tool
              and does not establish legal custody.
            </Text>
            {status === "error" ? (
              <Text style={styles.error}>
                This invitation is expired, already used, or belongs to another
                email address.
              </Text>
            ) : null}
            <Button
              label={status === "working" ? "Accepting…" : "Accept Invitation"}
              onPress={() => respond(true)}
              disabled={status === "working"}
            />
            <Button
              label="Decline"
              variant="ghost"
              onPress={() => respond(false)}
              disabled={status === "working"}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  hero: { alignItems: "center", gap: spacing.md },
  invitationNote: {
    color: colors.muted,
    lineHeight: 20,
    textAlign: "center",
  },
  card: { gap: spacing.md },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  body: { color: colors.muted, lineHeight: 21, textAlign: "center" },
  error: { color: colors.danger, textAlign: "center" },
});
