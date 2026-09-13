import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { AppHeader, Button, Card, Field, Screen } from "@/src/components/ui";
import { useAuth } from "@/src/providers/AuthProvider";
import { colors } from "@/src/theme/tokens";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function ResetPasswordScreen() {
  const router = useAppRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  async function submit() {
    const error = await resetPassword(email);
    setMessage(error ?? "Check your email for a secure reset link.");
  }
  return (
    <Screen>
      <AppHeader
        title="Reset password"
        subtitle="We’ll send a secure link to your email."
        onBack={() => router.back()}
      />
      <Card style={styles.form}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Button
          label="Send Reset Link"
          onPress={submit}
          disabled={!email.includes("@")}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16, marginTop: 24 },
  message: { color: colors.forest, lineHeight: 20, textAlign: "center" },
});
