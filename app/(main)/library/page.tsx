"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SearchBar } from "@/components/library/SearchBar";
import { TimelineGroup } from "@/components/library/TimelineGroup";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import {
  fetchTimelineGroups,
  searchKnowledgeObjectsApi,
} from "@/lib/data-client";
import { useAuth } from "@/components/providers/AuthProvider";
import { pageTransition } from "@/lib/motion";
import { Mic } from "lucide-react";
import type { KnowledgeObject } from "@/types";

const RECENT_SEARCHES_KEY = "chrysty_recent_searches";

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const existing = loadRecentSearches().filter((q) => q !== trimmed);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify([trimmed, ...existing].slice(0, 8))
  );
}

export default function LibraryPage() {
  const { loading: authLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Array<{ label: string; objects: KnowledgeObject[] }>>(
    []
  );
  const [searchResults, setSearchResults] = useState<KnowledgeObject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    if (authLoading) return;

    setLoading(true);
    fetchTimelineGroups()
      .then((data) => {
        setGroups(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load library");
      })
      .finally(() => setLoading(false));
  }, [authLoading]);

  useEffect(() => {
    if (authLoading || !query.trim()) {
      if (!query.trim()) setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      searchKnowledgeObjectsApi(query)
        .then((results) => {
          setSearchResults(results);
          saveRecentSearch(query);
          setRecentSearches(loadRecentSearches());
        })
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [authLoading, query]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        objects: g.objects.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            o.subtitle?.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.objects.length > 0);
  }, [groups, query]);

  const showEmpty =
    !loading && !error && filteredGroups.length === 0 && searchResults?.length === 0;

  return (
    <motion.main {...pageTransition} className="space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything Chrysty has learned</p>
      </div>

      <SearchBar value={query} onChange={setQuery} />

      {!query && recentSearches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recentSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQuery(term)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground"
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton className="h-48" />
      ) : error ? (
        <EmptyState title="Could not load library" description={error} />
      ) : searchResults ? (
        searchResults.length === 0 ? (
          <EmptyState title="No results" description={`Nothing matched "${query}"`} />
        ) : (
          <TimelineGroup label="Search results" objects={searchResults} />
        )
      ) : showEmpty ? (
        <EmptyState
          icon={Mic}
          title="Your library is empty"
          description="Finish a recording — observations and updates appear here."
        />
      ) : (
        filteredGroups.map((group) => (
          <TimelineGroup key={group.label} label={group.label} objects={group.objects} />
        ))
      )}
    </motion.main>
  );
}
