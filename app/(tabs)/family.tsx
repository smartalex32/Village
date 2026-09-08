import { ChevronRight, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Avatar, Card, Screen, uiStyles } from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";

function age(birthDate?: string) {
  if (!birthDate) return null;
  return Math.max(
    0,
    new Date().getFullYear() - new Date(birthDate).getFullYear(),
  );
}
export default function FamilyScreen() {
  const router = useRouter();
  const data = useVillage();
  const children = data.children.filter((child) => !child.archived);
  const currentMember = data.members.find(
    (member) => member.id === data.currentMemberId,
  );
  const canManage =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "PARENT_GUARDIAN";
  return (
    <Screen scroll={false} style={styles.screen}>
      <AppHeader
        title="Family"
        subtitle="Our crew."
        right={
          canManage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add child"
              onPress={() => router.push("/child-form")}
              style={styles.add}
            >
              <Plus size={24} color="#fff" />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {children.map((child, index) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${child.firstName}'s profile`}
            onPress={() =>
              router.push({
                pathname: "/child/[id]",
                params: { id: child.id },
              })
            }
          >
            <Card style={styles.child}>
              <Avatar
                name={child.firstName}
                uri={child.avatarUrl}
                size={64}
                color={index % 2 === 0 ? "#F3E5CB" : colors.blue}
              />
              <View style={styles.flex}>
                <Text style={styles.name}>{child.firstName}</Text>
                <Text style={uiStyles.muted}>
                  {age(child.birthDate)
                    ? `${age(child.birthDate)} years old`
                    : "Child profile"}
                </Text>
              </View>
              <ChevronRight size={26} color={colors.muted} />
            </Card>
          </Pressable>
        ))}
        {canManage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add another child"
            onPress={() => router.push("/child-form")}
          >
            <Card style={styles.addChild}>
              <View style={styles.addCircle}>
                <Plus size={24} color={colors.forest} />
              </View>
              <View>
                <Text style={uiStyles.strong}>Add a child</Text>
                <Text style={uiStyles.muted}>Keep everyone in one place.</Text>
              </View>
            </Card>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingBottom: spacing.sm },
  listScroll: { flex: 1 },
  listContent: { gap: spacing.md, paddingBottom: spacing.sm },
  add: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  child: {
    minHeight: 106,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  flex: { flex: 1 },
  name: { color: colors.ink, fontWeight: "800", fontSize: 20 },
  addChild: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#D9E9E6",
    alignItems: "center",
    justifyContent: "center",
  },
});
