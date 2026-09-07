import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  EmptyState,
  Pill,
  Screen,
  uiStyles,
} from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, radius, spacing } from "@/src/theme/tokens";

export default function VillageScreen() {
  const router = useRouter();
  const data = useVillage();
  const [section, setSection] = useState<"members" | "invitations">("members");
  const members = data.members.filter(
    (member) => member.id !== data.currentMemberId,
  );
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  return (
    <Screen scroll={false} style={styles.screen}>
      <AppHeader
        title="Village"
        subtitle="The people who help make it all work."
        right={
          canManage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite caregiver"
              onPress={() => router.push("/invite")}
              style={styles.add}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            </Pressable>
          ) : undefined
        }
      />
      <View style={styles.tabs}>
        {(["members", "invitations"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: section === item }}
            onPress={() => setSection(item)}
            style={[styles.tab, section === item && styles.tabActive]}
          >
            <Text
              style={section === item ? styles.tabTextActive : styles.tabText}
            >
              {item === "members" ? "Members" : "Invitations"}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {section === "members" ? (
          <Card style={styles.list}>
            {members.map((member, index) => (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${member.displayName}`}
                onPress={() =>
                  router.push({
                    pathname: "/member/[id]",
                    params: { id: member.id },
                  })
                }
                style={[
                  styles.member,
                  index < members.length - 1 && styles.border,
                ]}
              >
                <Avatar name={member.displayName} uri={member.avatarUrl} />
                <View style={styles.flex}>
                  <Text style={uiStyles.strong}>{member.displayName}</Text>
                  <Text style={uiStyles.muted}>{member.relationship}</Text>
                  <Text style={styles.capabilities}>
                    {member.capabilities
                      .map(
                        (item) => item.charAt(0) + item.slice(1).toLowerCase(),
                      )
                      .join(" • ")}
                  </Text>
                </View>
                <View style={styles.trailing}>
                  {member.availableLabel ? (
                    <Pill label={member.availableLabel} />
                  ) : null}
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={colors.muted}
                  />
                </View>
              </Pressable>
            ))}
          </Card>
        ) : data.invitations.length ? (
          <View style={styles.invites}>
            {data.invitations.map((invitation) => (
              <Card key={invitation.id} style={styles.invite}>
                <View style={styles.flex}>
                  <Text style={uiStyles.strong}>{invitation.email}</Text>
                  <Text style={uiStyles.muted}>
                    {invitation.relationship} ·{" "}
                    {invitation.status.toLowerCase()}
                  </Text>
                  <Text style={styles.capabilities}>
                    {invitation.status === "PENDING"
                      ? `Expires ${formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}`
                      : invitation.capabilities.join(" • ")}
                  </Text>
                </View>
                {invitation.status === "PENDING" ? (
                  <View style={styles.inviteActions}>
                    <Button
                      label="Resend"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/invite",
                          params: {
                            email: invitation.email,
                            relationship: invitation.relationship,
                            resend: invitation.id,
                          },
                        })
                      }
                    />
                    <Button
                      label="Revoke"
                      variant="danger"
                      onPress={() => data.revokeInvitation(invitation.id)}
                    />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="email-outline"
            title="No invitations yet"
            body="Invite a trusted caregiver when you’re ready."
          />
        )}
      </ScrollView>
      {canManage ? (
        <Button
          label="Invite Someone"
          variant="secondary"
          icon="account-plus"
          onPress={() => router.push("/invite")}
        />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.sm },
  listScroll: { flex: 1 },
  listContent: { paddingBottom: spacing.sm },
  add: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    borderRadius: radius.sm,
    backgroundColor: "#E9F0F0",
    padding: 3,
  },
  tab: { flex: 1, padding: 9, alignItems: "center" },
  tabActive: {
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  tabText: { color: colors.muted },
  tabTextActive: { color: colors.forest, fontWeight: "800" },
  list: { paddingVertical: 0 },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 14,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.line },
  flex: { flex: 1 },
  capabilities: { color: colors.muted, fontSize: 12, marginTop: 4 },
  trailing: { alignItems: "flex-end", gap: spacing.sm },
  invites: { gap: spacing.sm },
  invite: { gap: spacing.sm },
  inviteActions: { flexDirection: "row", gap: spacing.sm },
});
