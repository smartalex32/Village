import type { User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { isSupabaseConfigured, supabase } from "@/src/lib/supabase";

type AuthContextValue = {
  user: Pick<User, "id" | "email"> | null;
  loading: boolean;
  isDemo: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signUp(
    email: string,
    password: string,
    redirectTo?: string,
  ): Promise<string | null>;
  resetPassword(email: string): Promise<string | null>;
  updatePassword(password: string): Promise<string | null>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const consumeAuthLink = useCallback(async (url: string | null) => {
    if (!supabase || !url) return false;
    const fragment = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
    const params = new URLSearchParams(fragment ?? "");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const code = params.get("code");
    if (accessToken && refreshToken) {
      const { data } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      setUser(data.user);
      return true;
    }
    if (code) {
      const { data } = await supabase.auth.exchangeCodeForSession(code);
      setUser(data.user);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    void (async () => {
      const consumed = await consumeAuthLink(await Linking.getInitialURL());
      if (!consumed) {
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      }
      setLoading(false);
    })();
    return () => data.subscription.unsubscribe();
  }, [consumeAuthLink]);

  useEffect(() => {
    if (!supabase) return;
    const listener = Linking.addEventListener(
      "url",
      ({ url }) => void consumeAuthLink(url),
    );
    return () => listener.remove();
  }, [consumeAuthLink]);

  useEffect(() => {
    if (!supabase || Platform.OS === "web") return;
    const authClient = supabase;
    const updateRefresh = (state: string) => {
      if (state === "active") authClient.auth.startAutoRefresh();
      else authClient.auth.stopAutoRefresh();
    };
    updateRefresh(AppState.currentState);
    const subscription = AppState.addEventListener("change", updateRefresh);
    return () => {
      subscription.remove();
      authClient.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setUser({ id: "demo-user", email });
      return null;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      redirectTo = "village://onboarding",
    ) => {
      if (!supabase) {
        setUser({ id: "demo-user", email });
        return null;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      return error?.message ?? null;
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return null;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "village://update-password",
    });
    return error?.message ?? null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return null;
    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase && user)
      await supabase
        .from("device_push_tokens")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    await supabase?.auth.signOut();
    setUser(null);
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isDemo: !isSupabaseConfigured,
      signIn,
      signUp,
      resetPassword,
      updatePassword,
      signOut,
    }),
    [loading, resetPassword, signIn, signOut, signUp, updatePassword, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
