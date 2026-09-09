import { MapPinSearch } from "lucide-react-native";
import { useRouter } from "expo-router";
import { AppHeader, Button, EmptyState, Screen } from "@/src/components/ui";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen style={{ justifyContent: "center" }}>
      <AppHeader title="Page unavailable" />
      <EmptyState
        icon={MapPinSearch}
        title="We couldn’t find that page"
        body="The link may be old, expired, or incomplete."
        action={
          <Button label="Go to Village" onPress={() => router.replace("/")} />
        }
      />
    </Screen>
  );
}
