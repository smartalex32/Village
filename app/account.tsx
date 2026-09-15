import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  Screen,
  uiStyles,
} from "@/src/components/ui";
import { useAuth } from "@/src/providers/AuthProvider";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";
import { useAppRouter } from "@/src/lib/useAppRouter";

function roleLabel(role?: string) {
  if (!role) return "Household member";
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AccountScreen() {
  const router = useAppRouter();
  const { bottom } = useSafeAreaInsets();
  const auth = useAuth();
  const data = useVillage();
  const member = data.members.find((item) => item.id === data.currentMemberId);

  return (
    <Screen
      scroll={false}
      style={[styles.screen, { paddingBottom: spacing.md + bottom }]}
    >
      <AppHeader
        title="Account"
        subtitle="Your Village profile and session."
        onBack={() => router.back()}
      />
      <Card style={styles.profile}>
        <Avatar
          name={member?.displayName ?? auth.user?.email ?? "Account"}
          uri={member?.avatarUrl}
          size={64}
        />
        <View style={styles.profileText}>
          <Text style={styles.name}>
            {member?.displayName ?? "Village member"}
          </Text>
          <Text style={uiStyles.muted}>{roleLabel(member?.role)}</Text>
          <Text style={styles.email}>{auth.user?.email ?? "Demo account"}</Text>
        </View>
      </Card>
      <Card style={styles.household}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Household</Text>
          <Text style={styles.detailValue}>{data.householdName}</Text>
        </View>
        <View style={uiStyles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Timezone</Text>
          <Text style={styles.detailValue}>{data.householdTimezone}</Text>
        </View>
      </Card>
      <View style={styles.spacer} />
      <Button
        label="Sign Out"
        variant="danger"
        onPress={async () => {
          await auth.signOut();
          router.replace("/");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md, paddingBottom: spacing.md },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  profileText: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  email: { color: colors.forest, fontSize: 14, marginTop: 2 },
  household: { gap: spacing.md },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  detailLabel: { color: colors.muted, fontSize: 14 },
  detailValue: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  spacer: { flex: 1 },
});
