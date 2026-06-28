"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { RecordButton } from "@/components/home/RecordButton";
import { RecentActivityList } from "@/components/home/RecentActivityList";
import { TodaySection } from "@/components/home/TodaySection";
import { SessionsList } from "@/components/home/SessionsList";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { UserMenu } from "@/components/shared/UserMenu";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuth } from "@/components/providers/AuthProvider";
import { useGreeting } from "@/hooks/use-greeting";
import { fetchHomeData } from "@/lib/data-client";
import { pageTransition } from "@/lib/motion";
import { getFirstName } from "@/lib/user-display";
import { ChevronRight } from "lucide-react";
import type { ActivityOutcome, KnowledgeObject } from "@/types";

export default function HomePage() {
  const { fullName, loading: authLoading } = useAuth();
  const firstName = getFirstName(fullName);
  const greeting = useGreeting(firstName);
  const [todayItems, setTodayItems] = useState<KnowledgeObject[]>([]);
  const [activity, setActivity] = useState<ActivityOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    setLoading(true);
    fetchHomeData()
      .then((data) => {
        setTodayItems(data.todayItems);
        setActivity(data.recentActivity);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [authLoading]);

  return (
    <motion.main {...pageTransition} className="space-y-8 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {greeting || "\u00A0"}
        </h1>
        <div className="flex items-center gap-2">
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>

      <RecordButton />

      <div className="h-px bg-border" />

      <SessionsList />

      {loading ? (
        <LoadingSkeleton className="h-24" />
      ) : error ? (
        <EmptyState title="Could not load data" description={error} />
      ) : todayItems.length === 0 && activity.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Record a voice note to start building your world model."
        />
      ) : (
        <>
          <RecentActivityList items={activity} />
          <div className="h-px bg-border" />
          <TodaySection items={todayItems} />
        </>
      )}

      <Link
        href="/insights"
        className="group flex items-center justify-between rounded-[20px] border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-accent/20 hover:text-foreground"
      >
        <span>Your voice history is growing</span>
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.main>
  );
}
