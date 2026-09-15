import { useAppRouter } from "@/src/lib/useAppRouter";
import { colors, shadow } from "@/src/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { ColorValue, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabBarContentHeight = 56;

function icon(name: ComponentProps<typeof MaterialCommunityIcons>["name"]) {
  function TabBarIcon({ color }: { color: ColorValue }) {
    return <MaterialCommunityIcons name={name} size={23} color={color} />;
  }
  return TabBarIcon;
}

export default function TabLayout() {
  const router = useAppRouter();
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: "#687976",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", paddingBottom: 4 },
        tabBarStyle: [styles.bar, { height: tabBarContentHeight + bottom }],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarIcon: icon("home-variant") }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: icon("calendar-blank-outline"),
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
                <MaterialCommunityIcons name="plus" size={30} color="#fff" />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="village"
        options={{
          title: "Village",
          tabBarIcon: icon("account-group-outline"),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "Family",
          tabBarIcon: icon("account-multiple-outline"),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: tabBarContentHeight,
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
