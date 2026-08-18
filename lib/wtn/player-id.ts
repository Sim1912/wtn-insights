export const DEFAULT_TENNIS_ID = "MAU8054205";
export const PLAYER_ID_STORAGE_KEY = "wtn-insights:selected-tennis-id";

export function normalizeTennisId(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z0-9-]{4,30}$/.test(normalized) ? normalized : null;
}

export function playerIdFromSearchParams(value: string | null | undefined): string {
  return normalizeTennisId(value) ?? DEFAULT_TENNIS_ID;
}
