import type { AnalyticsReport } from "./types";

export function currentStreakText(streak: AnalyticsReport["currentStreak"]): string {
  if (!streak) return "No decided matches";
  const noun = streak.result === "win"
    ? streak.count === 1 ? "win" : "wins"
    : streak.count === 1 ? "loss" : "losses";
  return `${streak.count} ${noun} in a row`;
}
