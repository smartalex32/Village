import { useLocalSearchParams } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  Pill,
  Screen,
  SectionHeader,
  uiStyles,
} from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const data = useVillage();
  const member = data.members.find((item) => item.id === id);
  const currentMember = data.members.find(
    (item) => item.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  if (!member)
    return (
      <Screen>
        <AppHeader title="Member unavailable" onBack={() => router.back()} />
      </Screen>
    );
  const remove = () =>
    Alert.alert(
      "Remove caregiver?",
      "Their access will be revoked and future assignments will become coverage gaps.",
      [
        { text: "Keep member", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            data.removeMember(member.id);
            router.back();
          },
        },
      ],
    );
  return (
    <Screen>
      <AppHeader
        title={member.displayName}
        subtitle={member.relationship}
        onBack={() => router.back()}
      />
      <Card style={styles.profile}>
        <Avatar name={member.displayName} uri={member.avatarUrl} size={74} />
        <View style={styles.flex}>
          <Text style={styles.name}>{member.displayName}</Text>
          <Text style={uiStyles.muted}>
            {member.role.toLowerCase().replaceAll("_", " ")}
          </Text>
          {member.availableLabel ? (
            <Pill label={member.availableLabel} />
          ) : null}
        </View>
      </Card>
      <SectionHeader title="Can help with" />
      <View style={styles.pills}>
        {(
          [
            "PICKUP",
            "DROPOFF",
            "TRANSPORTATION",
            "BABYSITTING",
            "EMERGENCY",
            "OTHER",
          ] as const
        ).map((capability) => {
          const enabled = member.capabilities.includes(capability);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: enabled }}
              key={capability}
              disabled={!canManage}
              onPress={() => data.toggleMemberCapability(member.id, capability)}
              style={[styles.option, enabled && styles.optionEnabled]}
            >
              <Text
                style={[styles.optionText, enabled && styles.optionTextEnabled]}
              >
                {capability.charAt(0) + capability.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <SectionHeader title="Child access" />
      <Card>
        {data.children
          .filter((child) => !child.archived)
          .map((child) => {
            const enabled = member.childIds.includes(child.id);
            const permissions = member.childPermissions?.[child.id] ?? {
              profile: enabled,
              schedule: false,
              careNotes: false,
              handoffs: enabled,
            };
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: enabled }}
                key={child.id}
                disabled={!canManage}
                onPress={() =>
                  data.toggleMemberChildAccess(member.id, child.id)
                }
                style={styles.access}
              >
                <View style={styles.accessCopy}>
                  <Text style={uiStyles.strong}>{child.firstName}</Text>
                  <Text style={uiStyles.muted}>
                    {enabled
                      ? "Profile • assigned schedule • handoffs"
                      : "No access"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.accessCheck,
                    !enabled && styles.accessCheckOff,
                  ]}
                >
                  {enabled ? "✓" : "+"}
                </Text>
                {enabled ? (
                  <View style={styles.permissionGrid}>
                    {(
                      [
                        ["profile", "Profile"],
                        ["schedule", "Schedule"],
                        ["careNotes", "Care notes"],
                        ["handoffs", "Handoffs"],
                      ] as const
                    ).map(([scope, label]) => (
                      <Pressable
                        key={scope}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: permissions[scope] }}
                        disabled={!canManage}
                        onPress={(event) => {
                          event.stopPropagation();
                          data.toggleMemberChildPermission(
                            member.id,
                            child.id,
                            scope,
                          );
                        }}
                        style={[
                          styles.permission,
                          permissions[scope] && styles.permissionEnabled,
                        ]}
                      >
                        <Text style={styles.permissionText}>
                          {permissions[scope] ? "✓ " : ""}
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
      </Card>
      <SectionHeader title="Privacy" />
      <Card>
        <Text style={uiStyles.body}>
          This caregiver sees only permitted children and the information needed
          for their assignments.
        </Text>
      </Card>
      {canManage ? (
        <Button label="Remove from Village" variant="danger" onPress={remove} />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 5 },
  name: { color: colors.ink, fontWeight: "900", fontSize: 22 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  access: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 3,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  permissionGrid: {
    flexBasis: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  permission: {
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  permissionEnabled: { backgroundColor: colors.mint },
  permissionText: { color: colors.forestDark, fontSize: 11, fontWeight: "700" },
  accessCopy: { flex: 1 },
  accessCheck: { color: colors.forest, fontSize: 20, fontWeight: "900" },
  accessCheckOff: { color: colors.muted },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  optionEnabled: { backgroundColor: colors.blue, borderColor: "#AFCBE8" },
  optionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  optionTextEnabled: { color: colors.blueText },
});
