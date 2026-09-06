import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { AppHeader, Card, Screen, uiStyles } from "@/src/components/ui";
import { AuthForm } from "@/src/components/AuthForm";
import { useAuth } from "@/src/providers/AuthProvider";
import { colors } from "@/src/theme/tokens";

export default function SignInScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { signIn, isDemo } = useAuth();
  return (
    <Screen>
      <AppHeader
        title="Welcome back"
        subtitle="Sign in to see what your village is handling."
      />
      <Card style={styles.form}>
        <AuthForm
          actionLabel="Sign In"
          onSubmit={async (values) => {
            const error = await signIn(values.email, values.password);
            if (!error) router.replace((next || "/(tabs)") as never);
            return error;
          }}
        />
        {isDemo ? (
          <Text style={styles.demo}>
            Demo mode: any valid email and 8-character password will open the
            seeded household.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/reset-password")}
        >
          <Text style={[uiStyles.link, styles.center]}>
            Forgot your password?
          </Text>
        </Pressable>
      </Card>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: "/sign-up", params: next ? { next } : {} })
        }
      >
        <Text style={[uiStyles.link, styles.center]}>
          New to Village? Create an account
        </Text>
      </Pressable>
    </Screen>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16, marginTop: 24 },
  center: { textAlign: "center" },
  demo: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
