import { useRouter } from "expo-router";
import type { NotificationResponse } from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

export function useNotificationRouting() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === "web") return;
    let remove: (() => void) | undefined;
    let disposed = false;
    void import("expo-notifications").then((Notifications) => {
      if (disposed) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      const open = (response: NotificationResponse) => {
        const route = response.notification.request.content.data?.route;
        if (typeof route === "string") router.push(route as never);
      };
      const subscription =
        Notifications.addNotificationResponseReceivedListener(open);
      remove = () => subscription.remove();
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) open(response);
      });
    });
    return () => {
      disposed = true;
      remove?.();
    };
  }, [router]);
}
