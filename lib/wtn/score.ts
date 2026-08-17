import type { MatchStatus, NormalizedSet } from "./types.ts";

const STATUS_TOKEN: Record<MatchStatus, string> = {
  completed: "",
  retired: "RET",
  walkover: "W/O",
  defaulted: "DEF",
  abandoned: "ABD",
  unfinished: "UNFINISHED",
  unknown: "",
};

const numberOrNull = (value: string | undefined) =>
  value == null || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export function statusFromScoreText(scoreText: string | null | undefined): MatchStatus | null {
  const value = scoreText?.trim().toUpperCase();
  if (!value) return null;
  if (/^(W\/O|WO|WALKOVER)$/.test(value)) return "walkover";
  if (/\b(RET|RETIRED)\b/.test(value)) return "retired";
  if (/\b(DEF|DEFAULTED|DISQUALIFIED)\b/.test(value)) return "defaulted";
  if (/\b(ABD|ABANDONED|CANCELLED)\b/.test(value)) return "abandoned";
  if (/\b(SUSP|SUSPENDED|UNFINISHED|INCOMPLETE)\b/.test(value)) return "unfinished";
  return null;
}

export function parseScoreText(scoreText: string | null | undefined): NormalizedSet[] {
  if (!scoreText) return [];
  const cleaned = scoreText
    .replace(/[–—]/g, "-")
    .replace(/\b(?:RET(?:IRED)?|W\/?O|WALKOVER|DEF(?:AULTED)?|DISQUALIFIED|ABD|ABANDONED|CANCELLED|SUSP(?:ENDED)?|UNFINISHED|INCOMPLETE)\b/gi, " ")
    .trim();
  if (!cleaned) return [];

  const tokens = cleaned.match(/\[\s*\d+\s*[-/]\s*\d+\s*\]|\d+\s*[-/]\s*\d+(?:\s*\(\s*\d+(?:\s*-\s*\d+)?\s*\))?/g) ?? [];
  return tokens.flatMap((token, index) => {
    const bracketed = token.trim().startsWith("[");
    const match = token.match(/\[?\s*(\d+)\s*[-/]\s*(\d+)\s*\]?(?:\s*\(\s*(\d+)(?:\s*-\s*(\d+))?\s*\))?/);
    if (!match) return [];
    const first = numberOrNull(match[1]);
    const second = numberOrNull(match[2]);
    const firstParen = numberOrNull(match[3]);
    const secondParen = numberOrNull(match[4]);
    const lastToken = index === tokens.length - 1;
    const oneZeroMatchTiebreak = (first === 1 && second === 0) || (first === 0 && second === 1);
    const highPlainDecider = lastToken && tokens.length > 1 && firstParen == null && Math.max(first ?? 0, second ?? 0) >= 10;
    const slashDecider = lastToken && tokens.length > 1 && token.includes("/");
    const isMatchTiebreak = bracketed || oneZeroMatchTiebreak || highPlainDecider || slashDecider;

    let side1Tiebreak: number | null = null;
    let side2Tiebreak: number | null = null;
    if (firstParen != null && secondParen != null) {
      side1Tiebreak = firstParen;
      side2Tiebreak = secondParen;
    } else if (firstParen != null) {
      if ((first ?? 0) < (second ?? 0)) side1Tiebreak = firstParen;
      else side2Tiebreak = firstParen;
    }

    return [{
      side1Games: first,
      side2Games: second,
      side1Tiebreak,
      side2Tiebreak,
      isMatchTiebreak,
    }];
  });
}

function renderSet(set: NormalizedSet, playerSide: 1 | 2): string | null {
  const playerGames = playerSide === 1 ? set.side1Games : set.side2Games;
  const opponentGames = playerSide === 1 ? set.side2Games : set.side1Games;
  const playerTiebreak = playerSide === 1 ? set.side1Tiebreak : set.side2Tiebreak;
  const opponentTiebreak = playerSide === 1 ? set.side2Tiebreak : set.side1Tiebreak;
  if (playerGames == null || opponentGames == null) return null;

  if (set.isMatchTiebreak) {
    const playerPoints = playerTiebreak ?? playerGames;
    const opponentPoints = opponentTiebreak ?? opponentGames;
    return `[${playerPoints}–${opponentPoints}]`;
  }

  const tiebreakPoints = playerTiebreak != null || opponentTiebreak != null
    ? Math.min(...[playerTiebreak, opponentTiebreak].filter((value): value is number => value != null))
    : null;
  return `${playerGames}–${opponentGames}${tiebreakPoints == null ? "" : `(${tiebreakPoints})`}`;
}

export function renderScore(
  sets: NormalizedSet[],
  playerSide: 1 | 2 = 1,
  status: MatchStatus = "completed",
  fallbackText: string | null = null,
): string {
  const renderedSets = sets.map((set) => renderSet(set, playerSide)).filter(Boolean).join(" ");
  const marker = STATUS_TOKEN[status];
  if (renderedSets) return `${renderedSets}${marker ? ` ${marker}` : ""}`;
  if (marker) return marker;
  return fallbackText?.trim() || "Score unavailable";
}

export function resultFromWinner(
  playerSide: 1 | 2,
  winningSide: 1 | 2 | null,
): "win" | "loss" | "unknown" {
  if (winningSide == null) return "unknown";
  return playerSide === winningSide ? "win" : "loss";
}
