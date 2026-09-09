import {
  CalendarDays,
  ContactRound,
  House,
  Plus,
  type LucideIcon,
  UsersRound,
} from "lucide-react-native";
import { Tabs, useRouter } from "expo-router";
import { ColorValue, Pressable, StyleSheet, View } from "react-native";
import { colors, shadow } from "@/src/theme/tokens";

function icon(Icon: LucideIcon) {
  function TabBarIcon({ color }: { color: ColorValue }) {
    return <Icon size={23} color={color} />;
  }
  return TabBarIcon;
}

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: "#687976",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", paddingBottom: 4 },
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarIcon: icon(House) }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: icon(CalendarDays),
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: "",
          tabBarButton: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open quick actions"
              onPress={() => router.push("/quick-actions")}
              style={styles.fabWrap}
            >
              <View style={styles.fab}>
                <Plus size={30} color="#fff" />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="village"
        options={{
          title: "Village",
          tabBarIcon: icon(UsersRound),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "Family",
          tabBarIcon: icon(ContactRound),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 72,
    paddingTop: 7,
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
  },
  fabWrap: { flex: 1, alignItems: "center" },
  fab: {
    width: 56,
    height: 56,
    marginTop: -18,
    borderRadius: 28,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.canvas,
    ...shadow,
  },
});
