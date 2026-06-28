export function buildGreeting(firstName?: string | null, hour = new Date().getHours()): string {
  const period =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (firstName) {
    return `${period}, ${firstName}.`;
  }

  return `${period}.`;
}

export function greetingPlaceholder(firstName?: string | null): string {
  if (firstName) {
    return `Good evening, ${firstName}.`;
  }

  return "Good evening.";
}
