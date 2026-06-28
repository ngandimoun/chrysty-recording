"use client";

import type { RankedItem } from "@/types";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface RankedListProps {
  items: RankedItem[];
  showTrend?: boolean;
}

export function RankedList({ items, showTrend = false }: RankedListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet</p>;
  }

  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{item.label}</span>
            <div className="flex items-center gap-2">
              {showTrend && item.trend && (
                <span className="text-muted-foreground">
                  {item.trend === "up" && <TrendingUp className="size-3.5 text-chart-4" />}
                  {item.trend === "down" && <TrendingDown className="size-3.5 text-chart-5" />}
                  {item.trend === "stable" && <Minus className="size-3.5" />}
                </span>
              )}
              <span className="text-sm tabular-nums text-muted-foreground">{item.count}</span>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent/60 transition-all"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
