import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppHeader, Button, Card, Field, Screen } from "@/src/components/ui";
import type { Capability, MemberRole } from "@/src/domain/types";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, radius, spacing } from "@/src/theme/tokens";
import { sendRemoteInvitation } from "@/src/data/supabaseRepository";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function InviteScreen() {
  const router = useAppRouter();
  const params = useLocalSearchParams<{
    email?: string;
    relationship?: string;
    resend?: string;
  }>();
  const data = useVillage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.email ?? "");
  const [relationship, setRelationship] = useState(params.relationship ?? "");
  const [role, setRole] =
    useState<Exclude<MemberRole, "OWNER">>("TRUSTED_CAREGIVER");
  const [capabilities, setCapabilities] = useState<Capability[]>([
    "PICKUP",
    "DROPOFF",
    "TRANSPORTATION",
  ]);
  const [childIds, setChildIds] = useState(
    data.children.filter((child) => !child.archived).map((child) => child.id),
  );
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  function chooseRole(value: Exclude<MemberRole, "OWNER">) {
    setRole(value);
    setCapabilities(
      value === "PARENT_GUARDIAN"
        ? [
            "PICKUP",
            "DROPOFF",
            "TRANSPORTATION",
            "BABYSITTING",
            "EMERGENCY",
            "OTHER",
          ]
        : value === "TRUSTED_CAREGIVER"
          ? ["PICKUP", "DROPOFF", "TRANSPORTATION"]
          : ["PICKUP"],
    );
  }
  async function invite() {
    setError("");
    try {
      let inviteUrl: string;
      if (isSupabaseConfigured && data.householdId) {
        const result = await sendRemoteInvitation({
          householdId: data.householdId,
          email,
          name:
            data.members.find((member) => member.id === data.currentMemberId)
              ?.displayName ?? "A parent",
          relationshipLabel: relationship.trim() || "Caregiver",
          role,
          childIds,
          capabilities,
          householdName: data.householdName,
        });
        inviteUrl = result.inviteUrl;
      } else {
        const member = data.inviteMember(
          name.trim() || email.split("@")[0],
          relationship.trim() || "Caregiver",
          capabilities,
        );
        const base =
          process.env.EXPO_PUBLIC_LINK_BASE_URL ?? "https://links.village.app";
        inviteUrl = `${base}/invite/demo-${member.id}`;
      }
      await Share.share({
        title: "Join my Village",
        message: `${name || "You"} can join ${data.householdName} in Village: ${inviteUrl}`,
      });
      setSent(true);
    } catch {
      setError(
        "The invitation could not be sent. Check your connection and try again.",
      );
    }
  }
  return (
    <Screen style={styles.screen}>
      <AppHeader
        title={params.resend ? "Resend Invitation" : "Invite Someone"}
        subtitle="Only invite people you trust with your child’s care."
        onBack={() => router.back()}
      />
      <Card style={styles.form}>
        <View style={styles.fieldRow}>
          <View style={styles.halfField}>
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Grandma"
            />
          </View>
          <View style={styles.halfField}>
            <Field
              label="Relationship"
              value={relationship}
              onChangeText={setRelationship}
              placeholder="Grandmother"
            />
          </View>
        </View>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="caregiver@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>Access preset</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.options}
        >
          {(
            [
              ["PARENT_GUARDIAN", "Parent / guardian"],
              ["TRUSTED_CAREGIVER", "Trusted caregiver"],
              ["LIMITED_CAREGIVER", "Limited caregiver"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: role === value }}
              onPress={() => chooseRole(value)}
              style={[styles.option, role === value && styles.selected]}
            >
              <Text
                style={[
                  styles.optionText,
                  role === value && styles.selectedText,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>Children</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.options}
        >
          {data.children
            .filter((child) => !child.archived)
            .map((child) => {
              const selected = childIds.includes(child.id);
              return (
                <Pressable
                  key={child.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() =>
                    setChildIds((items) =>
                      selected
                        ? items.filter((id) => id !== child.id)
                        : [...items, child.id],
                    )
                  }
                  style={[styles.option, selected && styles.selected]}
                >
                  <Text
                    style={[styles.optionText, selected && styles.selectedText]}
                  >
                    {selected ? "✓ " : ""}
                    {child.firstName}
                  </Text>
                </Pressable>
              );
            })}
        </ScrollView>
        <Text style={styles.label}>Can help with</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.options}
        >
          {(
            [
              "PICKUP",
              "DROPOFF",
              "TRANSPORTATION",
              "BABYSITTING",
              "EMERGENCY",
              "OTHER",
            ] as Capability[]
          ).map((capability) => {
            const selected = capabilities.includes(capability);
            return (
              <Pressable
                key={capability}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() =>
                  setCapabilities((items) =>
                    selected
                      ? items.filter((item) => item !== capability)
                      : [...items, capability],
                  )
                }
                style={[styles.option, selected && styles.selected]}
              >
                <Text
                  style={[styles.optionText, selected && styles.selectedText]}
                >
                  {capability.charAt(0) + capability.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.permission}>
          Initial access: assigned children, schedule details for their
          responsibilities, and handoff participation. Owners can refine
          permissions from the member profile.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={sent ? "Invitation Shared" : "Send & Share Invitation"}
          onPress={invite}
          disabled={
            sent ||
            !email.includes("@") ||
            !childIds.length ||
            !capabilities.length
          }
        />
      </Card>
      {sent ? (
        <Button
          label="Done"
          variant="secondary"
          onPress={() => router.back()}
        />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.md },
  form: { gap: spacing.sm, padding: 12 },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  halfField: { flex: 1, minWidth: 0 },
  label: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  options: { gap: spacing.sm, paddingRight: spacing.md },
  option: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.forest, borderColor: colors.forest },
  optionText: { color: colors.ink, fontWeight: "600" },
  selectedText: { color: "#fff" },
  permission: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 13 },
});
