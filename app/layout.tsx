import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { RecordingAppShell } from "@/components/auth/RecordingAppShell";
import { SessionBootstrap } from "@/components/auth/SessionBootstrap";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chrysty Recording",
  description: "The user records. Chrysty learns.",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <body
        className={`notranslate ${GeistSans.variable} ${GeistMono.variable} antialiased`}
        translate="no"
      >
        <ThemeProvider>
          <SessionBootstrap>
            <RecordingAppShell>
              <AuthProvider>{children}</AuthProvider>
            </RecordingAppShell>
          </SessionBootstrap>
          <Toaster position="bottom-center" richColors closeButton theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
