import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

export async function registerForPushNotifications() {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  const Notifications = await import("expo-notifications");
  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === "granted"
      ? current
      : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("coordination", {
      name: "Coordination",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
