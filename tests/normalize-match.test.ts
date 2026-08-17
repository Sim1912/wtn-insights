import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMatch, normalizeWtnResponse } from "../lib/wtn/normalize-match.ts";
import type { PlayerProfile, RawMatch, RawRating } from "../lib/wtn/types.ts";

const player: PlayerProfile = { id: "MAU8054205", personId: "player-person", name: "Simon Manuel", country: "NZL" };

function person(id: string, tennisID: string, given: string, family: string) {
  return { id, tennisID, standardGivenName: given, standardFamilyName: family };
}

const doublesMatch: RawMatch = {
  id: "match-five-sets",
  providerMatchId: "provider-five-sets",
  start: "2026-02-10T09:00:00.000Z",
  end: "2026-02-10T11:20:00.000Z",
  type: "DOUBLES",
  status: "COMPLETED",
  winningSide: "SIDE2",
  matchUpFormat: "SET5-S:6/TB7",
  drawName: "Main draw",
  score: {
    scoreString: "6-4 3-6 7-6(7-5) 4-6 10-8",
    sets: [
      { winnerGamesWon: 6, loserGamesWon: 4 },
      { winnerGamesWon: 3, loserGamesWon: 6 },
      { winnerGamesWon: 7, loserGamesWon: 6, tiebreaker: { winnerPointsWon: 7, loserPointsWon: 5 } },
      { winnerGamesWon: 4, loserGamesWon: 6 },
      { winnerGamesWon: 10, loserGamesWon: 8 },
    ],
  },
  sides: [
    { sideNumber: "SIDE1", players: [
      { person: person("opponent-one", "OPP1", "Ana", "One") },
      { person: person("opponent-two", "OPP2", "Bea", "Two") },
    ] },
    { sideNumber: "SIDE2", players: [
      { person: person("player-person", "MAU8054205", "Simon", "Manuel") },
      { person: person("partner", "PARTNER1", "Casey", "Partner") },
    ] },
  ],
  worldTennisNumbers: [
    { personId: "player-person", type: "SINGLE", tennisNumber: 11 },
    { personId: "player-person", type: "DOUBLE", tennisNumber: 24 },
    { personId: "partner", type: "DOUBLE", tennisNumber: 26 },
    { personId: "opponent-one", type: "DOUBLE", tennisNumber: 22 },
    { personId: "opponent-two", type: "DOUBLE", tennisNumber: 23 },
  ],
  tournament: { id: "tournament-1", name: "Five Set Invitational" },
};

test("normalizes official sides, doubles teams, IDs and every structured set", () => {
  const warnings: string[] = [];
  const match = normalizeMatch(doublesMatch, player, warnings);
  assert.ok(match);
  assert.equal(match.result, "win");
  assert.equal(match.playerSide, 2);
  assert.equal(match.playerWtnBeforeMatch, 24);
  assert.deepEqual(match.partners.map((entry) => entry.name), ["Casey Partner"]);
  assert.deepEqual(match.opponents.map((entry) => entry.name), ["Ana One", "Bea Two"]);
  assert.equal(match.sets.length, 5);
  assert.deepEqual([match.sets[0].side1Games, match.sets[0].side2Games], [4, 6]);
  assert.equal(match.sets[2].side2Tiebreak, 7);
  assert.equal(match.providerMatchId, "provider-five-sets");
  assert.equal(match.tournamentId, "tournament-1");
  assert.equal(match.matchFormat, "SET5-S:6/TB7");
  assert.deepEqual(warnings, []);
});

test("uses neutral raw-score fallback when an unfinished side orientation is unknowable", () => {
  const match = normalizeMatch({
    ...doublesMatch,
    id: "unfinished",
    providerMatchId: null,
    status: "SUSPENDED",
    winningSide: null,
    score: { scoreString: "6-4 2-3", sets: [{ winnerGamesWon: 6, loserGamesWon: 4 }, { winnerGamesWon: 2, loserGamesWon: 3 }] },
  }, player, []);
  assert.ok(match);
  assert.equal(match.status, "unfinished");
  assert.equal(match.result, "unknown");
  assert.deepEqual(match.sets, []);
  assert.equal(match.scoreText, "6-4 2-3");
});

test("sorts and preserves independent rating histories without fabricated values", () => {
  const history: RawRating[] = Array.from({ length: 24 }, (_, index) => ({
    type: "SINGLE",
    ratingDate: new Date(Date.UTC(2024, index, 1)).toISOString(),
    tennisNumber: 30 - index / 10,
    prevTennisNumber: index === 23 ? null : 30.1 - index / 10,
    confidence: 60 + index,
    gameZoneLower: 31 - index / 10,
    gameZoneUpper: 27 - index / 10,
    matchUps: index === 0 ? null : [],
  }));
  history.splice(3, 0, {
    type: "DOUBLE",
    ratingDate: "2026-01-15T00:00:00.000Z",
    tennisNumber: 25.5,
    prevTennisNumber: 25.8,
    confidence: 88,
    gameZoneLower: 29.74,
    gameZoneUpper: 24.19,
    matchUps: [doublesMatch, doublesMatch],
  });

  const response = normalizeWtnResponse("mau8054205", person("player-person", "MAU8054205", "Simon", "Manuel"), history.reverse());
  assert.equal(response.ratings.history.singles.length, 24);
  assert.equal(response.ratings.history.doubles.length, 1);
  assert.equal(response.ratings.history.singles[0].date, "2024-01-01T00:00:00.000Z");
  assert.equal(response.ratings.history.singles.at(-1)?.date, "2025-12-01T00:00:00.000Z");
  assert.equal(response.ratings.singles, 27.7);
  assert.equal(response.ratings.singlesChange, null);
  assert.equal(response.ratings.doubles, 25.5);
  assert.ok(Math.abs((response.ratings.doublesChange ?? 0) + 0.3) < 1e-9);
  assert.equal(response.ratings.history.singles[0].connectedMatches, null);
  assert.equal(response.ratings.history.singles[1].connectedMatches, 0);
  assert.equal(response.ratings.history.doubles[0].connectedMatches, 1);
  assert.equal(response.ratings.history.doubles[0].gameZoneLower, 29.74);
  assert.equal(response.matches.length, 1);
});
