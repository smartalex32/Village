import { AppHeader, Button, EmptyState, Screen } from "@/src/components/ui";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function NotFoundScreen() {
  const router = useAppRouter();
  return (
    <Screen style={{ justifyContent: "center" }}>
      <AppHeader title="Page unavailable" />
      <EmptyState
        icon="map-marker-question-outline"
        title="We couldn’t find that page"
        body="The link may be old, expired, or incomplete."
        action={
          <Button label="Go to Village" onPress={() => router.replace("/")} />
        }
      />
    </Screen>
  );
}
