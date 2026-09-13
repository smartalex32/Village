import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  Screen,
} from "@/src/components/ui";
import { useVillage } from "@/src/providers/VillageProvider";
import { colors, spacing } from "@/src/theme/tokens";
import { useAuth } from "@/src/providers/AuthProvider";
import { registerForPushNotifications } from "@/src/lib/notifications";
import { saveRemotePushToken } from "@/src/data/supabaseRepository";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function NotificationsScreen() {
  const router = useAppRouter();
  const data = useVillage();
  const { user } = useAuth();
  const [pushStatus, setPushStatus] = useState("");
  useEffect(() => {
    const timer = setTimeout(data.markNotificationsRead, 600);
    return () => clearTimeout(timer);
  }, [data.markNotificationsRead]);
  async function enablePush() {
    try {
      const token = await registerForPushNotifications();
      if (
        token &&
        user &&
        isSupabaseConfigured &&
        (Platform.OS === "ios" || Platform.OS === "android")
      ) {
        await saveRemotePushToken(user.id, token, Platform.OS);
        setPushStatus("Push notifications are enabled on this device.");
        return;
      }
      setPushStatus(
        "Push notifications remain off. In-app updates still work.",
      );
    } catch {
      setPushStatus("Push registration failed. Please try again.");
    }
  }
  return (
    <Screen>
      <AppHeader
        title="Notifications"
        subtitle="Important coordination updates."
        onBack={() => router.back()}
      />
      {data.notifications.length ? (
        data.notifications.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.body}`}
            onPress={() =>
              item.route ? router.push(item.route as never) : undefined
            }
          >
            <Card style={[styles.item, !item.read && styles.unread]}>
              <View style={[styles.dot, item.read && styles.dotRead]} />
              <View style={styles.flex}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(item.createdAt))}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))
      ) : (
        <EmptyState
          icon="bell-outline"
          title="All caught up"
          body="Important requests and handoff updates will appear here."
        />
      )}
      {Platform.OS !== "web" ? (
        <Card style={styles.pushCard}>
          <Text style={styles.title}>Push notifications</Text>
          <Text style={styles.body}>
            Get timely help-request, assignment, and handoff updates.
          </Text>
          {pushStatus ? <Text style={styles.time}>{pushStatus}</Text> : null}
          <Button
            label="Enable Push Notifications"
            variant="secondary"
            onPress={enablePush}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  item: { flexDirection: "row", gap: spacing.sm },
  unread: { borderColor: "#8DC7B9" },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.forest,
    marginTop: 6,
  },
  dotRead: { backgroundColor: colors.line },
  flex: { flex: 1 },
  title: { color: colors.ink, fontWeight: "800", fontSize: 16 },
  body: { color: colors.muted, lineHeight: 20, marginTop: 3 },
  time: { color: "#8A9996", fontSize: 12, marginTop: 8 },
  pushCard: { gap: spacing.sm },
});
