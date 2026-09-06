import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "@/src/theme/tokens";
import { initials } from "@/src/domain/rules";

export function Screen({
  children,
  scroll = true,
  style,
  refreshing,
  onRefresh,
}: PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenBody, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.forest}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenBody, styles.flex, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {body}
    </SafeAreaView>
  );
}

export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={
            variant === "primary"
              ? "#fff"
              : variant === "danger"
                ? colors.danger
                : colors.forest
          }
        />
      ) : null}
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Avatar({
  name,
  size = 48,
  color = colors.mint,
  uri,
}: {
  name: string;
  size?: number;
  color?: string;
  uri?: string;
}) {
  return (
    <View
      accessibilityLabel={`${name} avatar`}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel={`${name} avatar photo`}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#8A9996"
        {...props}
        style={[styles.input, props.multiline && styles.textarea, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Pill({
  label,
  tone = "green",
}: {
  label: string;
  tone?: "green" | "blue" | "amber" | "red";
}) {
  const map = {
    green: [colors.mint, colors.forest],
    blue: [colors.blue, colors.blueText],
    amber: [colors.amber, colors.amberText],
    red: [colors.dangerSoft, colors.danger],
  } as const;
  return (
    <View style={[styles.pill, { backgroundColor: map[tone][0] }]}>
      <Text style={[styles.pillText, { color: map[tone][1] }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={28} color={colors.forest} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  strong: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  link: { color: colors.forest, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.line },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  screenBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 112,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    ...shadow,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  button: {
    minHeight: 50,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
  },
  button_primary: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  button_secondary: { backgroundColor: colors.surface, borderColor: "#9DB4AF" },
  button_danger: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
  },
  button_ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  buttonText: { fontSize: 16, fontWeight: "800" },
  buttonText_primary: { color: "#fff" },
  buttonText_secondary: { color: colors.forestDark },
  buttonText_danger: { color: colors.danger },
  buttonText_ghost: { color: colors.forest },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { color: colors.forestDark, fontWeight: "800" },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#C7D5D2",
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 16,
  },
  textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: 13 },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", padding: spacing.lg, gap: spacing.sm },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
});
