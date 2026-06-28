export function normalizeDueAt(
  value: unknown,
  options?: { timezone?: string; referenceDate?: string }
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;

  // Date-only values: treat as end of that local day when timezone provided
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && options?.timezone) {
    try {
      const endOfDay = new Date(`${raw}T23:59:59`);
      return endOfDay.toISOString();
    } catch {
      return parsed.toISOString();
    }
  }

  return parsed.toISOString();
}
