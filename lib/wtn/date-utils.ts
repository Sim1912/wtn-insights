import type { NormalizedMatch } from "./types";

export function normalizeDateString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const calendarDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!calendarDate || !Number.isFinite(Date.parse(normalized))) return null;
  const [, yearText, monthText, dayText] = calendarDate;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const validated = new Date(Date.UTC(year, month - 1, day));
  return validated.getUTCFullYear() === year
    && validated.getUTCMonth() === month - 1
    && validated.getUTCDate() === day
    ? normalized
    : null;
}

export function matchScopeDate(match: Pick<NormalizedMatch, "completedAt" | "date">): string | null {
  return normalizeDateString(match.completedAt) ?? normalizeDateString(match.date);
}

export function subtractUtcCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDayOfTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}
