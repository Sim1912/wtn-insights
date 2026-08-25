import type { AnalyticsReport } from "./types";

export function percentagePointDifference(value: number, baseline: number): number {
  return Math.round(Math.abs(value - baseline) * 100);
}

export function percentagePointComparison(value: number, baselineValue: number, baseline = "overall"): string {
  const difference = percentagePointDifference(value, baselineValue);
  const unit = difference === 1 ? "percentage point" : "percentage points";
  return ` — ${difference} ${unit} ${value > baselineValue ? "above" : "below"} ${baseline}.`;
}

export function currentStreakText(streak: AnalyticsReport["currentStreak"]): string {
  if (!streak) return "No decided matches";
  const noun = streak.result === "win"
    ? streak.count === 1 ? "win" : "wins"
    : streak.count === 1 ? "loss" : "losses";
  return `${streak.count} ${noun} in a row`;
}
