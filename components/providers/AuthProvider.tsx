"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getLoginRedirectUrl } from "@/lib/chrysty/constants";
import { configurePlatformForBrowser } from "@/lib/chrysty/platform";
import { mergeAnonymousWorkspace } from "@/lib/data-client";
import { RECORDING_KEY_STORAGE } from "@/lib/recording/constants";
import { getOrCreateRecordingKey } from "@/lib/recording/recording-key";
import { createClient } from "@/lib/supabase/client";

interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  recordingKey?: string | null;
}

interface AuthContextValue {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isBrowserSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(isBrowserSupabaseConfigured());

  const mergeWorkspace = useCallback(async () => {
    getOrCreateRecordingKey();
    try {
      await mergeAnonymousWorkspace();
    } catch {
      /* best-effort */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!isBrowserSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.ok) {
        const data = (await response.json()) as AuthUser;
        if (data.recordingKey) {
          window.localStorage.setItem(RECORDING_KEY_STORAGE, data.recordingKey);
        }
        setUser({
          id: data.id,
          email: data.email,
          fullName: data.fullName ?? null,
          avatarUrl: data.avatarUrl ?? null,
        });
        await mergeWorkspace();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [mergeWorkspace]);

  useEffect(() => {
    configurePlatformForBrowser();
    void refreshUser();
  }, [refreshUser]);

  const signIn = useCallback(() => {
    const returnUrl =
      typeof window !== "undefined" ? window.location.href : undefined;
    window.location.href = getLoginRedirectUrl(returnUrl);
  }, []);

  const signOut = useCallback(async () => {
    if (!isBrowserSupabaseConfigured()) {
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      userId: user?.id ?? null,
      email: user?.email ?? null,
      fullName: user?.fullName ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      loading,
      signIn,
      signOut,
    }),
    [user, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
