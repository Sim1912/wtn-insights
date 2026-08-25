import { parseScoreText, resultFromWinner, statusFromScoreText } from "./score.ts";
import { matchScopeDate, normalizeDateString } from "./date-utils.ts";
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

function cleanNamePart(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return !normalized || /^(?:unknown|n\/?a|null|undefined)$/i.test(normalized) ? null : normalized;
}

function composedName(givenValue: string | null | undefined, familyValue: string | null | undefined): string | null {
  const rawName = [givenValue, familyValue].map((part) => part?.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
  if (/^unknown(?: unknown| player)?$/i.test(rawName)) return null;
  const name = [cleanNamePart(givenValue), cleanNamePart(familyValue)].filter(Boolean).join(" ");
  return name || null;
}

function personName(person: RawPerson | null | undefined, fallback: string): string {
  return composedName(person?.standardGivenName, person?.standardFamilyName)
    ?? composedName(person?.nativeGivenName, person?.nativeFamilyName)
    ?? fallback;
}

function ratingForPerson(match: RawMatch, personId: string | null | undefined, type: MatchType): number | null {
  if (!personId) return null;
  const desiredType = type === "doubles" ? "DOUBLE" : type === "singles" ? "SINGLE" : null;
  if (!desiredType) return null;
  const exact = match.worldTennisNumbers?.find((rating) => rating.personId === personId && rating.type === desiredType);
  return asFinite(exact?.tennisNumber);
}

function participant(match: RawMatch, person: RawPerson | null | undefined, type: MatchType, fallback: string): MatchParticipant {
  return {
    id: person?.id ?? null,
    tennisId: person?.tennisID ?? null,
    name: personName(person, fallback),
    wtnBeforeMatch: ratingForPerson(match, person?.id, type),
  };
}

function structuredSets(match: RawMatch, winner: 1 | 2 | null): NormalizedSet[] {
  const rawSets = match.score?.sets ?? [];
  const rawTextSets = parseScoreText(match.score?.scoreString);
  // Structured set fields are winner/loser oriented. Without an official
  // winning side we cannot safely assign them to the two teams.
  if (!winner) return [];
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

  const opponents = opponentSide?.players?.map(({ person }) => participant(match, person, type, "Opponent unavailable")) ?? [];
  const partners = playerPeople
    .filter((person) => person !== playerPerson)
    .map((person) => participant(match, person, type, "Partner unavailable"));
  const expectedOpponents = type === "doubles" ? 2 : type === "singles" ? 1 : opponents.length;
  const expectedPartners = type === "doubles" ? 1 : 0;
  while (opponents.length < expectedOpponents) opponents.push(participant(match, null, type, "Opponent unavailable"));
  while (partners.length < expectedPartners) partners.push(participant(match, null, type, "Partner unavailable"));

  return {
    id,
    providerMatchId: match.providerMatchId ?? null,
    date: normalizeDateString(match.start),
    completedAt: normalizeDateString(match.end),
    matchType: type,
    status: matchStatus(match.status, match.score?.scoreString),
    playerSide,
    winningSide: winner,
    result: resultFromWinner(playerSide, winner),
    opponents,
    partners,
    playerWtnBeforeMatch: ratingForPerson(match, playerPerson?.id, type),
    sets: structuredSets(match, winner),
    scoreText: match.score?.scoreString ?? null,
    matchFormat: match.matchUpFormat ?? null,
    draw: match.drawName ?? null,
    statusCodes: match.statusCodes ?? [],
    tournament: tournament?.name || tournament?.promotionalName || tournament?.formalName || match.drawName || null,
    tournamentId: tournament?.id ?? null,
    round: match.roundName || (match.roundNumber ? `Round ${match.roundNumber}` : null),
    ageCategory: match.ageCategoryCode ?? null,
    surface,
    environment: environmentValue === "INDOOR" ? "indoor" : environmentValue === "OUTDOOR" ? "outdoor" : null,
  };
}

function normalizedHistory(raw: RawRating[], type: "SINGLE" | "DOUBLE"): RatingPoint[] {
  return raw.flatMap((rating) => {
      const date = normalizeDateString(rating.ratingDate);
      if (rating.type !== type || !date || asFinite(rating.tennisNumber) == null) return [];
      const value = asFinite(rating.tennisNumber)!;
      const previous = asFinite(rating.prevTennisNumber);
      return [{
        date,
        value,
        previous,
        change: previous == null ? null : value - previous,
        confidence: asFinite(rating.confidence),
        gameZoneLower: asFinite(rating.gameZoneLower),
        gameZoneUpper: asFinite(rating.gameZoneUpper),
        connectedMatches: Array.isArray(rating.matchUps)
          ? new Set(rating.matchUps.map((match) => match.id || match.providerMatchId).filter(Boolean)).size
          : null,
      }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function ratingSummary(raw: RawRating[]): RatingSummary {
  const byMostRecent = (a: RawRating, b: RawRating) => (b.ratingDate ?? "").localeCompare(a.ratingDate ?? "");
  const singles = raw
    .filter((rating) => rating.type === "SINGLE" && normalizeDateString(rating.ratingDate) && asFinite(rating.tennisNumber) != null)
    .sort(byMostRecent);
  const doubles = raw
    .filter((rating) => rating.type === "DOUBLE" && normalizeDateString(rating.ratingDate) && asFinite(rating.tennisNumber) != null)
    .sort(byMostRecent);
  const latestSingles = singles[0];
  const latestDoubles = doubles[0];
  const dates = [latestSingles?.ratingDate, latestDoubles?.ratingDate]
    .map(normalizeDateString)
    .filter((date): date is string => date != null);
  return {
    singles: asFinite(latestSingles?.tennisNumber),
    doubles: asFinite(latestDoubles?.tennisNumber),
    singlesChange: latestSingles && asFinite(latestSingles.prevTennisNumber) != null
      ? (asFinite(latestSingles.tennisNumber) ?? 0) - asFinite(latestSingles.prevTennisNumber)!
      : null,
    doublesChange: latestDoubles && asFinite(latestDoubles.prevTennisNumber) != null
      ? (asFinite(latestDoubles.tennisNumber) ?? 0) - asFinite(latestDoubles.prevTennisNumber)!
      : null,
    singlesConfidence: asFinite(latestSingles?.confidence),
    doublesConfidence: asFinite(latestDoubles?.confidence),
    updatedAt: dates.sort().at(-1) ?? null,
    history: {
      singles: normalizedHistory(raw, "SINGLE"),
      doubles: normalizedHistory(raw, "DOUBLE"),
    },
  };
}

export function normalizeWtnResponse(tennisId: string, rawPerson: RawPerson | null | undefined, rawRatings: RawRating[]): WtnApiResponse {
  const warnings: string[] = [];
  const normalizedId = tennisId.toUpperCase();
  const player: PlayerProfile = {
    id: normalizedId,
    personId: rawPerson?.id ?? null,
    name: personName(rawPerson, normalizedId),
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

  const matches = [...byId.values()].sort((a, b) => (matchScopeDate(b) ?? "").localeCompare(matchScopeDate(a) ?? "") || a.id.localeCompare(b.id));
  if (!matches.length) warnings.push("WTN returned rating history but no match records for this period.");
  return {
    player,
    ratings: ratingSummary(rawRatings),
    matches,
    meta: { source: "wtn-live", fetchedAt: new Date().toISOString(), warnings: [...new Set(warnings)] },
  };
}
