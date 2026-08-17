import type { NormalizedMatch, NormalizedSet } from "../wtn/types";

export function isCompetitiveMatch(match: NormalizedMatch): boolean {
  return match.status === "completed" && match.winningSide != null && match.result !== "unknown";
}

export function hasUsableSets(match: NormalizedMatch): boolean {
  return match.sets.length > 0 && match.sets.every((set) => set.side1Games != null && set.side2Games != null);
}

export function normalSets(match: NormalizedMatch): NormalizedSet[] {
  return match.sets.filter((set) => !set.isMatchTiebreak && set.side1Games != null && set.side2Games != null);
}

export function matchTiebreakSets(match: NormalizedMatch): NormalizedSet[] {
  return match.sets.filter((set) => set.isMatchTiebreak && set.side1Games != null && set.side2Games != null);
}

export function playerScore(set: NormalizedSet, playerSide: 1 | 2): [number, number] | null {
  const player = playerSide === 1 ? set.side1Games : set.side2Games;
  const opponent = playerSide === 1 ? set.side2Games : set.side1Games;
  return player == null || opponent == null ? null : [player, opponent];
}

export function playerWonSet(set: NormalizedSet, playerSide: 1 | 2): boolean | null {
  const score = playerScore(set, playerSide);
  return score == null || score[0] === score[1] ? null : score[0] > score[1];
}

export function setSequence(match: NormalizedMatch): Array<"win" | "loss"> {
  if (!hasUsableSets(match)) return [];
  return match.sets.flatMap((set) => {
    const won = playerWonSet(set, match.playerSide);
    return won == null ? [] : [won ? "win" : "loss"];
  });
}

export function isBestOfFive(match: NormalizedMatch): boolean {
  if (/SET5|BEST.?OF.?5|BO5/i.test(match.matchFormat ?? "")) return true;
  const sequence = setSequence(match);
  const wins = sequence.filter((result) => result === "win").length;
  const losses = sequence.length - wins;
  return Math.max(wins, losses) >= 3;
}

export function decidingSetIndex(match: NormalizedMatch): number | null {
  const sequence = setSequence(match);
  if (!isCompetitiveMatch(match) || sequence.length < 3) return null;
  const finalWinner = sequence.at(-1);
  const winnerTotal = sequence.filter((result) => result === finalWinner).length;
  const target = isBestOfFive(match) ? 3 : winnerTotal;
  if (target < 2) return null;
  const before = sequence.slice(0, -1);
  const playerBefore = before.filter((result) => result === "win").length;
  const opponentBefore = before.length - playerBefore;
  return playerBefore === target - 1 && opponentBefore === target - 1 ? sequence.length - 1 : null;
}
