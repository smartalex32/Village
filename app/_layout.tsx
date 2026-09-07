import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/src/providers/AuthProvider";
import { VillageProvider, useVillage } from "@/src/providers/VillageProvider";
import { colors } from "@/src/theme/tokens";
import { useNotificationRouting } from "@/src/lib/useNotificationRouting";

export { ErrorBoundary } from "expo-router";

function Navigation() {
  const { user, loading } = useAuth();
  const village = useVillage();
  useNotificationRouting();
  if (loading || (user && village.backendState === "syncing")) return null;
  const demo = village.backendState === "demo";
  const hasHousehold = demo || Boolean(village.householdId);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Screen name="accept-invite/[token]" />
      <Stack.Screen name="update-password" />
      <Stack.Protected guard={Boolean(user) && (demo || !hasHousehold)}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(user) && hasHousehold}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="quick-actions"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="help-request" options={{ presentation: "modal" }} />
        <Stack.Screen name="help-sent" />
        <Stack.Screen name="event-form" options={{ presentation: "modal" }} />
        <Stack.Screen name="child-form" options={{ presentation: "modal" }} />
        <Stack.Screen name="handoff-form" options={{ presentation: "modal" }} />
        <Stack.Screen name="invite" options={{ presentation: "modal" }} />
        <Stack.Screen name="account" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="handoff/[id]" />
        <Stack.Screen name="child/[id]" />
        <Stack.Screen name="member/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <VillageProvider>
            <StatusBar style="dark" />
            <Navigation />
          </VillageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
