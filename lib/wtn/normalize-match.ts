import { parseScoreText, resultFromWinner, statusFromScoreText } from "./score";
import type {
  MatchParticipant,
  MatchStatus,
  MatchType,
  NormalizedMatch,
  NormalizedSet,
  PlayerProfile,
  RatingPoint,
  RatingSummary,
  RawMatch,
  RawPerson,
  RawRating,
  WtnApiResponse,
} from "./types";

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sideNumber(value: string | null | undefined): 1 | 2 | null {
  if (value === "SIDE1") return 1;
  if (value === "SIDE2") return 2;
  return null;
}

function matchType(value: string | null | undefined): MatchType {
  if (value === "SINGLES") return "singles";
  if (value === "DOUBLES") return "doubles";
  return "unknown";
}

function matchStatus(value: string | null | undefined, scoreText: string | null | undefined): MatchStatus {
  const scoreStatus = statusFromScoreText(scoreText);
  if (scoreStatus) return scoreStatus;
  switch (value) {
    case "COMPLETED": return "completed";
    case "RETIRED": return "retired";
    case "WALKOVER": return "walkover";
    case "DEFAULTED":
    case "DISQUALIFIED": return "defaulted";
    case "ABANDONED":
    case "CANCELLED": return "abandoned";
    case "SUSPENDED": return "unfinished";
    default: return "unknown";
  }
}

function readableEnum(value: string | null | undefined): string | null {
  if (!value || value === "UNKNOWN") return null;
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function personName(person: RawPerson | null | undefined): string {
  const given = person?.standardGivenName || person?.nativeGivenName || "";
  const family = person?.standardFamilyName || person?.nativeFamilyName || "";
  return `${given} ${family}`.trim() || "Unknown player";
}

function ratingForPerson(match: RawMatch, personId: string | null | undefined, type: MatchType): number | null {
  if (!personId) return null;
  const desiredType = type === "doubles" ? "DOUBLE" : type === "singles" ? "SINGLE" : null;
  const ratings = match.worldTennisNumbers?.filter((rating) => rating.personId === personId) ?? [];
  const exact = ratings.find((rating) => !desiredType || rating.type === desiredType) ?? ratings[0];
  return asFinite(exact?.tennisNumber);
}

function participant(match: RawMatch, person: RawPerson | null | undefined, type: MatchType): MatchParticipant {
  return {
    id: person?.id ?? null,
    tennisId: person?.tennisID ?? null,
    name: personName(person),
    wtnBeforeMatch: ratingForPerson(match, person?.id, type),
  };
}

function structuredSets(match: RawMatch, winner: 1 | 2 | null): NormalizedSet[] {
  const rawSets = match.score?.sets ?? [];
  const rawTextSets = parseScoreText(match.score?.scoreString);
  if (!rawSets.length) return winner === 2 ? rawTextSets.map((set) => ({
    side1Games: set.side2Games,
    side2Games: set.side1Games,
    side1Tiebreak: set.side2Tiebreak,
    side2Tiebreak: set.side1Tiebreak,
    isMatchTiebreak: set.isMatchTiebreak,
  })) : rawTextSets;

  const sets = rawSets.map((set, index): NormalizedSet => {
    const winnerGames = asFinite(set.winnerGamesWon);
    const loserGames = asFinite(set.loserGamesWon);
    const winnerTiebreak = asFinite(set.tiebreaker?.winnerPointsWon);
    const loserTiebreak = asFinite(set.tiebreaker?.loserPointsWon);
    const fromText = rawTextSets[index];
    const oneZero = (winnerGames === 1 && loserGames === 0) || (winnerGames === 0 && loserGames === 1);
    const highTiebreak = Math.max(winnerTiebreak ?? 0, loserTiebreak ?? 0) >= 10;
    const isMatchTiebreak = Boolean(fromText?.isMatchTiebreak || (oneZero && highTiebreak));

    if (winner === 2) {
      return {
        side1Games: loserGames,
        side2Games: winnerGames,
        side1Tiebreak: loserTiebreak,
        side2Tiebreak: winnerTiebreak,
        isMatchTiebreak,
      };
    }
    return {
      side1Games: winnerGames,
      side2Games: loserGames,
      side1Tiebreak: winnerTiebreak,
      side2Tiebreak: loserTiebreak,
      isMatchTiebreak,
    };
  });

  const superTiebreak = match.score?.superTiebreak;
  if (superTiebreak && !sets.some((set) => set.isMatchTiebreak)) {
    const winnerPoints = asFinite(superTiebreak.winnerPointsWon);
    const loserPoints = asFinite(superTiebreak.loserPointsWon);
    sets.push(winner === 2
      ? { side1Games: loserPoints, side2Games: winnerPoints, side1Tiebreak: null, side2Tiebreak: null, isMatchTiebreak: true }
      : { side1Games: winnerPoints, side2Games: loserPoints, side1Tiebreak: null, side2Tiebreak: null, isMatchTiebreak: true });
  }
  return sets;
}

export function normalizeMatch(
  match: RawMatch,
  player: PlayerProfile,
  warnings: string[],
): NormalizedMatch | null {
  const id = match.id || match.providerMatchId;
  if (!id) {
    warnings.push("One match was skipped because it had no external match ID.");
    return null;
  }
  const playerSideRecord = match.sides?.find((side) => side.players?.some(({ person }) =>
    (player.personId && person?.id === player.personId) || person?.tennisID?.toUpperCase() === player.id,
  ));
  const playerSide = sideNumber(playerSideRecord?.sideNumber);
  if (!playerSide) {
    warnings.push(`Match ${id} was skipped because the player side could not be identified.`);
    return null;
  }
  const type = matchType(match.type);
  const winner = sideNumber(match.winningSide);
  const opponentSide = match.sides?.find((side) => sideNumber(side.sideNumber) !== playerSide);
  const playerPeople = playerSideRecord?.players?.map(({ person }) => person).filter(Boolean) ?? [];
  const playerPerson = playerPeople.find((person) =>
    (player.personId && person?.id === player.personId) || person?.tennisID?.toUpperCase() === player.id,
  );
  const tournament = match.tournament;
  const surface = readableEnum(match.surfaceType)
    ?? readableEnum(match.surfaceCategory)
    ?? readableEnum(tournament?.surfaceCategory);
  const environmentValue = match.indoorOutdoor !== "UNKNOWN" ? match.indoorOutdoor : tournament?.indoorOutdoor;

  return {
    id,
    date: match.start ?? null,
    completedAt: match.end ?? null,
    matchType: type,
    status: matchStatus(match.status, match.score?.scoreString),
    playerSide,
    winningSide: winner,
    result: resultFromWinner(playerSide, winner),
    opponents: opponentSide?.players?.map(({ person }) => participant(match, person, type)) ?? [],
    partners: playerPeople
      .filter((person) => person !== playerPerson)
      .map((person) => participant(match, person, type)),
    playerWtnBeforeMatch: ratingForPerson(match, playerPerson?.id, type),
    sets: structuredSets(match, winner),
    scoreText: match.score?.scoreString ?? null,
    tournament: tournament?.name || tournament?.promotionalName || tournament?.formalName || match.drawName || null,
    round: match.roundName || (match.roundNumber ? `Round ${match.roundNumber}` : null),
    ageCategory: match.ageCategoryCode ?? null,
    surface,
    environment: environmentValue === "INDOOR" ? "indoor" : environmentValue === "OUTDOOR" ? "outdoor" : null,
  };
}

function normalizedHistory(raw: RawRating[]): RatingPoint[] {
  const byDate = new Map<string, RatingPoint>();
  const sorted = [...raw].sort((a, b) => (a.ratingDate ?? "").localeCompare(b.ratingDate ?? ""));
  let singles: number | null = null;
  let doubles: number | null = null;
  for (const rating of sorted) {
    if (!rating.ratingDate) continue;
    if (rating.type === "SINGLE") singles = asFinite(rating.tennisNumber);
    if (rating.type === "DOUBLE") doubles = asFinite(rating.tennisNumber);
    byDate.set(rating.ratingDate, { date: rating.ratingDate, singles, doubles });
  }
  return [...byDate.values()].slice(-18);
}

function ratingSummary(raw: RawRating[]): RatingSummary {
  const singles = raw.filter((rating) => rating.type === "SINGLE" && asFinite(rating.tennisNumber) != null);
  const doubles = raw.filter((rating) => rating.type === "DOUBLE" && asFinite(rating.tennisNumber) != null);
  const latestSingles = singles[0];
  const latestDoubles = doubles[0];
  const dates = [latestSingles?.ratingDate, latestDoubles?.ratingDate].filter((date): date is string => Boolean(date));
  return {
    singles: asFinite(latestSingles?.tennisNumber),
    doubles: asFinite(latestDoubles?.tennisNumber),
    singlesChange: latestSingles ? (asFinite(latestSingles.tennisNumber) ?? 0) - (asFinite(latestSingles.prevTennisNumber) ?? asFinite(latestSingles.tennisNumber) ?? 0) : null,
    doublesChange: latestDoubles ? (asFinite(latestDoubles.tennisNumber) ?? 0) - (asFinite(latestDoubles.prevTennisNumber) ?? asFinite(latestDoubles.tennisNumber) ?? 0) : null,
    singlesConfidence: asFinite(latestSingles?.confidence),
    doublesConfidence: asFinite(latestDoubles?.confidence),
    updatedAt: dates.sort().at(-1) ?? null,
    history: normalizedHistory(raw),
  };
}

export function normalizeWtnResponse(tennisId: string, rawPerson: RawPerson | null | undefined, rawRatings: RawRating[]): WtnApiResponse {
  const warnings: string[] = [];
  const normalizedId = tennisId.toUpperCase();
  const player: PlayerProfile = {
    id: normalizedId,
    personId: rawPerson?.id ?? null,
    name: personName(rawPerson) === "Unknown player" ? normalizedId : personName(rawPerson),
    country: rawPerson?.nationalityCode ?? null,
  };

  const byId = new Map<string, NormalizedMatch>();
  for (const rawRating of rawRatings) {
    for (const rawMatch of rawRating.matchUps ?? []) {
      try {
        const match = normalizeMatch(rawMatch, player, warnings);
        if (match) byId.set(match.id, match);
      } catch (error) {
        warnings.push(`One malformed match was skipped: ${error instanceof Error ? error.message : "unknown parsing error"}.`);
      }
    }
  }

  const matches = [...byId.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id));
  if (!matches.length) warnings.push("WTN returned rating history but no match records for this period.");
  return {
    player,
    ratings: ratingSummary(rawRatings),
    matches,
    meta: { source: "wtn-live", fetchedAt: new Date().toISOString(), warnings: [...new Set(warnings)] },
  };
}
