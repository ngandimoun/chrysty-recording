"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const BAR_HEIGHTS = [
  30, 47, 40, 36, 49, 47, 25, 19, 27, 19, 6, 18, 36, 32, 30, 48, 54, 36, 29, 37, 27, 8,
  12, 27, 22, 19, 38, 51, 40, 36, 46, 40,
];

export function RecordingWaveform({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("flex h-24 items-center justify-center gap-1", className)} aria-hidden>
      {BAR_HEIGHTS.map((height, i) => (
        <div
          key={i}
          className={cn(
            "w-1 origin-center rounded-full bg-accent/60",
            mounted && !reducedMotion && "animate-waveform"
          )}
          style={
            mounted
              ? { height: `${height}%`, animationDelay: `${i * 50}ms` }
              : { height: "40%" }
          }
        />
      ))}
    </div>
  );
}
