import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { AppHeader, Button, Card, Screen, uiStyles } from "@/src/components/ui";
import { AuthForm } from "@/src/components/AuthForm";
import { useAuth } from "@/src/providers/AuthProvider";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function SignUpScreen() {
  const router = useAppRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { signUp, isDemo } = useAuth();
  const [sent, setSent] = useState(false);
  const redirectTo = next
    ? `village://${next.replace(/^\//, "")}`
    : "village://onboarding";
  return (
    <Screen>
      <AppHeader
        title="Create your Village"
        subtitle="Private, invitation-only childcare coordination."
        onBack={() => router.back()}
      />
      <Card style={styles.form}>
        {sent ? (
          <>
            <Text style={styles.verifyTitle}>Check your email</Text>
            <Text style={styles.terms}>
              Confirm your email address on this device, then return to Village
              to finish setup.
            </Text>
            <Button
              label="Back to Sign In"
              variant="secondary"
              onPress={() =>
                router.replace({
                  pathname: "/sign-in",
                  params: next ? { next } : {},
                })
              }
            />
          </>
        ) : (
          <>
            <AuthForm
              actionLabel="Create Account"
              onSubmit={async (values) => {
                const error = await signUp(
                  values.email,
                  values.password,
                  redirectTo,
                );
                if (!error) {
                  if (isDemo) router.replace((next || "/onboarding") as never);
                  else setSent(true);
                }
                return error;
              }}
            />
            <Text style={styles.terms}>
              By continuing, you agree to keep child information private and
              only invite trusted caregivers.
            </Text>
          </>
        )}
      </Card>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: "/sign-in", params: next ? { next } : {} })
        }
      >
        <Text style={[uiStyles.link, styles.center]}>
          Already have an account? Sign in
        </Text>
      </Pressable>
    </Screen>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16, marginTop: 24 },
  center: { textAlign: "center" },
  terms: {
    color: "#687976",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  verifyTitle: {
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
    color: "#12211F",
  },
});
