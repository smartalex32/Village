import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { AppHeader, Button, Card, Field, Screen } from "@/src/components/ui";
import { useAuth } from "@/src/providers/AuthProvider";
import { colors } from "@/src/theme/tokens";

export default function ResetPasswordScreen() {
  const router = useRouter();
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
        <Button
          label="Back to Sign In"
          variant="ghost"
          onPress={() => router.back()}
        />
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16, marginTop: 24 },
  message: { color: colors.forest, lineHeight: 20, textAlign: "center" },
});
