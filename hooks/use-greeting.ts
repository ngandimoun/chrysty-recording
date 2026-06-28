"use client";

import { useEffect, useState } from "react";

import { buildGreeting, greetingPlaceholder } from "@/lib/greeting-text";

export function useGreeting(firstName?: string | null): string {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(buildGreeting(firstName));
  }, [firstName]);

  return greeting ?? greetingPlaceholder(firstName);
}
