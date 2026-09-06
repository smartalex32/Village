import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { Button, Field } from "@/src/components/ui";
import { colors } from "@/src/theme/tokens";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});
type Values = z.infer<typeof schema>;

export function AuthForm({
  actionLabel,
  onSubmit,
}: {
  actionLabel: string;
  onSubmit(values: Values): Promise<string | null>;
}) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const submit = handleSubmit(async (values) => {
    const error = await onSubmit(values);
    if (error) setError("root", { message: error });
  });
  return (
    <>
      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <Field
            label="Email"
            placeholder="you@example.com"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { value, onChange, onBlur } }) => (
          <Field
            label="Password"
            placeholder="At least 8 characters"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message}
            secureTextEntry
            autoComplete="password"
          />
        )}
      />
      {errors.root?.message ? (
        <Text style={styles.error}>{errors.root.message}</Text>
      ) : null}
      <Button
        label={isSubmitting ? "Please wait…" : actionLabel}
        disabled={isSubmitting}
        onPress={submit}
      />
    </>
  );
}
const styles = StyleSheet.create({
  error: { color: colors.danger, textAlign: "center" },
});
