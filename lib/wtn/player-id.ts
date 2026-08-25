export const DEFAULT_TENNIS_ID = "DEMO";

export function normalizeTennisId(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z0-9-]{4,30}$/.test(normalized) ? normalized : null;
}

export function playerIdFromSearchParams(value: string | null | undefined): string {
  if (value == null || !value.trim()) return DEFAULT_TENNIS_ID;
  // Preserve an invalid direct value long enough for the client to show the
  // validation error. Silently replacing it with the example player makes a
  // mistyped ID look like a successful lookup.
  return normalizeTennisId(value) ?? value.trim().toUpperCase();
}
