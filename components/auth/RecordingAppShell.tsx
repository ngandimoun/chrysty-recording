"use client";

import { usePathname } from "next/navigation";

import { AuthGuard } from "@/components/auth/AuthGuard";

type RecordingAppShellProps = {
  children: React.ReactNode;
};

export function RecordingAppShell({ children }: RecordingAppShellProps) {
  const pathname = usePathname();

  if (pathname?.startsWith("/auth/")) {
    return <>{children}</>;
  }

  return <AuthGuard>{children}</AuthGuard>;
}
