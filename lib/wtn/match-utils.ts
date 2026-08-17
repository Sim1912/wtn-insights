import type { NormalizedMatch } from "./types";

export type MatchFilters = {
  result: "all" | "win" | "loss";
  matchType: "all" | "singles" | "doubles";
  dateFrom: string;
  dateTo: string;
  tournament: string;
  opponent: string;
  strength: "all" | "stronger" | "weaker";
  sort: "newest" | "oldest" | "opponent-wtn" | "closest";
};

export const DEFAULT_FILTERS: MatchFilters = {
  result: "all", matchType: "all", dateFrom: "", dateTo: "", tournament: "",
  opponent: "", strength: "all", sort: "newest",
};

export function averageOpponentWtn(match: NormalizedMatch): number | null {
  const values = match.opponents.map((opponent) => opponent.wtnBeforeMatch).filter((value): value is number => value != null);
  return values.length === match.opponents.length && values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export function opponentStrength(match: NormalizedMatch): "stronger" | "weaker" | "equal" | "unknown" {
  const opponentWtn = averageOpponentWtn(match);
  if (opponentWtn == null || match.playerWtnBeforeMatch == null) return "unknown";
  if (opponentWtn < match.playerWtnBeforeMatch) return "stronger";
  if (opponentWtn > match.playerWtnBeforeMatch) return "weaker";
  return "equal";
}

export function closeness(match: NormalizedMatch): number {
  if (!match.sets.length) return Number.POSITIVE_INFINITY;
  return match.sets.reduce((total, set) => {
    const side1 = set.isMatchTiebreak ? set.side1Tiebreak ?? set.side1Games : set.side1Games;
    const side2 = set.isMatchTiebreak ? set.side2Tiebreak ?? set.side2Games : set.side2Games;
    return total + (side1 == null || side2 == null ? 12 : Math.abs(side1 - side2));
  }, 0);
}

export function isCloseMatch(match: NormalizedMatch): boolean {
  if (match.sets.length < 2) return false;
  return match.sets.some((set) => set.isMatchTiebreak) || closeness(match) <= match.sets.length * 2;
}

export function filterAndSortMatches(matches: NormalizedMatch[], filters: MatchFilters): NormalizedMatch[] {
  const opponentNeedle = filters.opponent.trim().toLocaleLowerCase();
  const filtered = matches.filter((match) => {
    if (filters.result !== "all" && match.result !== filters.result) return false;
    if (filters.matchType !== "all" && match.matchType !== filters.matchType) return false;
    const date = match.date?.slice(0, 10) ?? "";
    if (filters.dateFrom && (!date || date < filters.dateFrom)) return false;
    if (filters.dateTo && (!date || date > filters.dateTo)) return false;
    if (filters.tournament && match.tournament !== filters.tournament) return false;
    if (opponentNeedle && !match.opponents.some((opponent) => opponent.name.toLocaleLowerCase().includes(opponentNeedle))) return false;
    if (filters.strength !== "all" && opponentStrength(match) !== filters.strength) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === "oldest") return (a.date ?? "9999").localeCompare(b.date ?? "9999");
    if (filters.sort === "opponent-wtn") return (averageOpponentWtn(a) ?? Infinity) - (averageOpponentWtn(b) ?? Infinity);
    if (filters.sort === "closest") return closeness(a) - closeness(b) || (b.date ?? "").localeCompare(a.date ?? "");
    return (b.date ?? "").localeCompare(a.date ?? "");
  });
}
