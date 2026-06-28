import { resolveLocale, UI_LOCALE } from "@/lib/locale";

function formatDateFallback(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function safeToLocaleDateString(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const resolved = resolveLocale(locale);
  try {
    if (Number.isNaN(date.getTime())) return formatDateFallback(date);
    return date.toLocaleDateString(resolved, options);
  } catch {
    try {
      return date.toLocaleDateString(UI_LOCALE, options);
    } catch {
      return formatDateFallback(date);
    }
  }
}

export function formatRelativeTime(dateString: string, locale?: string | null): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return safeToLocaleDateString(date, locale ?? UI_LOCALE, { month: "short", day: "numeric" });
}

export function formatDueDate(dateString: string, locale?: string | null): string {
  const date = new Date(dateString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (Number.isNaN(date.getTime())) return formatDateFallback(date);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return safeToLocaleDateString(date, locale ?? UI_LOCALE, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
}

function endOfLocalDayIso(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return new Date(`${y}-${m}-${d}T23:59:59.999`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function isDueTodayOrOverdue(dueAt: string | undefined, timezone: string): boolean {
  if (!dueAt) return true;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return true;
  return due.getTime() <= new Date(endOfLocalDayIso(timezone)).getTime();
}
