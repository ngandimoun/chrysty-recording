"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export interface ChartTheme {
  colors: string[];
  muted: string;
  foreground: string;
  border: string;
  card: string;
}

const EMPTY_THEME: ChartTheme = {
  colors: ["", "", "", "", ""],
  muted: "",
  foreground: "",
  border: "",
  card: "",
};

function readCssVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readChartTheme(): ChartTheme {
  return {
    colors: [
      readCssVar("--chart-1"),
      readCssVar("--chart-2"),
      readCssVar("--chart-3"),
      readCssVar("--chart-4"),
      readCssVar("--chart-5"),
    ],
    muted: readCssVar("--muted-foreground"),
    foreground: readCssVar("--foreground"),
    border: readCssVar("--border"),
    card: readCssVar("--card"),
  };
}

/** Resolves design tokens to computed color strings for Recharts SVG. */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>(() =>
    typeof window !== "undefined" ? readChartTheme() : EMPTY_THEME
  );

  useEffect(() => {
    const update = () => setTheme(readChartTheme());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => observer.disconnect();
  }, [resolvedTheme]);

  return theme;
}

export function chartTooltipProps(theme: ChartTheme) {
  return {
    contentStyle: {
      background: theme.card,
      border: `1px solid ${theme.border}`,
      borderRadius: "12px",
      color: theme.foreground,
    },
    labelStyle: { color: theme.muted },
    itemStyle: { color: theme.foreground },
  };
}

export function chartAxisProps(theme: ChartTheme) {
  return {
    tick: { fontSize: 12, fill: theme.muted },
    stroke: theme.border,
    axisLine: { stroke: theme.border },
    tickLine: { stroke: theme.border },
  };
}
