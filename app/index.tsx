import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button, Screen } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme/tokens";
import { useAuth } from "@/src/providers/AuthProvider";
import { useVillage } from "@/src/providers/VillageProvider";
import { useAppRouter } from "@/src/lib/useAppRouter";

export default function WelcomeScreen() {
  const router = useAppRouter();
  const { user } = useAuth();
  const village = useVillage();
  if (user)
    return (
      <Redirect
        href={
          village.backendState === "demo" || village.householdId
            ? "/(tabs)"
            : "/onboarding"
        }
      />
    );
  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <MaterialCommunityIcons
            name="home-heart"
            size={80}
            color={colors.forest}
          />
        </View>
        <Text style={styles.logo}>Village</Text>
        <Text style={styles.tagline}>
          A calmer way to coordinate care for the people you care about most.
        </Text>
      </View>
      <View style={styles.hills}>
        <View style={styles.sun} />
        <View style={styles.hillOne} />
        <View style={styles.hillTwo} />
        <MaterialCommunityIcons
          name="home"
          size={74}
          color="#F4E4D1"
          style={styles.home}
        />
      </View>
      <View style={styles.actions}>
        <Button label="Get Started" onPress={() => router.push("/sign-up")} />
        <Button
          label="Sign In"
          variant="secondary"
          onPress={() => router.push("/sign-in")}
        />
        <Text style={styles.foot}>Your family. Your people. Your village.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingBottom: spacing.md },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  mark: { marginBottom: 8 },
  logo: {
    color: colors.forestDark,
    fontWeight: "900",
    fontSize: 48,
    letterSpacing: -2,
  },
  tagline: {
    color: "#315E57",
    textAlign: "center",
    fontSize: 18,
    lineHeight: 28,
    marginTop: 20,
    maxWidth: 310,
  },
  hills: {
    height: 180,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#E6F5F2",
  },
  sun: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFD399",
    left: "40%",
    top: 28,
  },
  hillOne: {
    position: "absolute",
    width: 440,
    height: 190,
    borderRadius: 220,
    backgroundColor: "#A9D6CC",
    left: -130,
    top: 75,
    transform: [{ rotate: "-8deg" }],
  },
  hillTwo: {
    position: "absolute",
    width: 440,
    height: 170,
    borderRadius: 220,
    backgroundColor: "#70AE81",
    right: -190,
    top: 100,
  },
  home: { position: "absolute", alignSelf: "center", bottom: 12, left: "43%" },
  actions: { gap: 10, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  foot: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
});
