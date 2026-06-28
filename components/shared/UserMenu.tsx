"use client";

import { LogOut } from "lucide-react";

import { useAuth } from "@/components/providers/AuthProvider";

export function UserMenu() {
  const { signOut, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void signOut()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Sign out"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
