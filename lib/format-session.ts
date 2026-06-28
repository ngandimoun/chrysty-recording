export function formatSessionSummaryLine(
  durationSeconds: number | null,
  attachmentCount: number
): string {
  const duration = durationSeconds ?? 0;
  let timePart: string;

  if (duration >= 3600) {
    const hours = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    timePart = `${hours} hr${hours !== 1 ? "s" : ""} ${mins} min recording`;
  } else if (duration >= 60) {
    timePart = `${Math.floor(duration / 60)} min recording`;
  } else if (duration > 0) {
    timePart = `${duration}s recording`;
  } else {
    timePart = "Recording";
  }

  if (attachmentCount === 0) return timePart;

  const itemsPart = `${attachmentCount} context item${attachmentCount === 1 ? "" : "s"}`;
  return `${timePart} · ${itemsPart}`;
}
