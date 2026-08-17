import { hasUsableSets, isCompetitiveMatch, normalSets, playerScore, playerWonSet } from "./eligibility.ts";
import type { AnalyticsMatchType, AnalyticsPeriod, TrendPoint } from "./types";
import type { NormalizedMatch } from "../wtn/types";

const PERIOD_MONTHS: Record<Exclude<AnalyticsPeriod, "all" | "custom">, number> = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };

export function filterAnalyticsMatches(matches: NormalizedMatch[], matchType: AnalyticsMatchType, period: AnalyticsPeriod, from = "", to = ""): NormalizedMatch[] {
  const matchingType = matchType === "all" ? matches : matches.filter((match) => match.matchType === matchType);
  let cutoff = "";
  if (period !== "all" && period !== "custom") {
    const latest = [...matchingType].filter((match) => match.date).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0]?.date;
    if (latest) {
      const date = new Date(latest);
      date.setUTCMonth(date.getUTCMonth() - PERIOD_MONTHS[period]);
      cutoff = date.toISOString().slice(0, 10);
    }
  }
  return matchingType.filter((match) => {
    const date = match.date?.slice(0, 10) ?? "";
    if (period === "custom" && from && (!date || date < from)) return false;
    if (period === "custom" && to && (!date || date > to)) return false;
    if (cutoff && (!date || date < cutoff)) return false;
    return true;
  });
}

export function monthlyTrends(matches: NormalizedMatch[]): TrendPoint[] {
  const rows = new Map<string, Omit<TrendPoint, "month" | "winRate" | "setsWonRate" | "gamesWonRate">>();
  for (const match of matches) {
    if (!match.date || !isCompetitiveMatch(match)) continue;
    const month = match.date.slice(0, 7);
    const row = rows.get(month) ?? { wins: 0, losses: 0, matches: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0 };
    row.matches += 1;
    if (match.result === "win") row.wins += 1; else row.losses += 1;
    if (hasUsableSets(match)) for (const set of normalSets(match)) {
      const won = playerWonSet(set, match.playerSide);
      const score = playerScore(set, match.playerSide);
      if (won != null) { if (won) row.setsWon++; else row.setsLost++; }
      if (score) { row.gamesWon += score[0]; row.gamesLost += score[1]; }
    }
    rows.set(month, row);
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, row]) => ({
    month, ...row,
    winRate: row.matches ? row.wins / row.matches : null,
    setsWonRate: row.setsWon + row.setsLost ? row.setsWon / (row.setsWon + row.setsLost) : null,
    gamesWonRate: row.gamesWon + row.gamesLost ? row.gamesWon / (row.gamesWon + row.gamesLost) : null,
  }));
}
