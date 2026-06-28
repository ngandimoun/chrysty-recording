import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[20px] border border-border bg-muted/50",
        className
      )}
    />
  );
}
