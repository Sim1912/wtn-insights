import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS, filterAndSortMatches, isCloseMatch, monthlyResults, opponentStrength, type MatchFilters } from "../lib/wtn/match-utils.ts";
import type { NormalizedMatch } from "../lib/wtn/types.ts";

const makeMatch = (partial: Partial<NormalizedMatch> & Pick<NormalizedMatch, "id">): NormalizedMatch => ({
  id: partial.id, providerMatchId: null, date: "2026-01-01T00:00:00.000Z", completedAt: null, matchType: "singles", status: "completed",
  playerSide: 1, winningSide: 1, result: "win", opponents: [{ id: "o", tennisId: null, name: "Alex Strong", wtnBeforeMatch: 20 }],
  partners: [], playerWtnBeforeMatch: 25, sets: [{ side1Games: 6, side2Games: 4, side1Tiebreak: null, side2Tiebreak: null, isMatchTiebreak: false }],
  scoreText: "6-4", matchFormat: null, draw: null, statusCodes: [], tournament: "Open A", tournamentId: null,
  round: null, ageCategory: null, surface: null, environment: null, ...partial,
});

const matches = [
  makeMatch({ id: "new-win", date: "2026-03-01T00:00:00.000Z" }),
  makeMatch({
    id: "double-loss", date: "2026-02-01T00:00:00.000Z", matchType: "doubles", result: "loss", winningSide: 2, tournament: "Open B",
    partners: [{ id: "p2", tennisId: null, name: "Taylor Partner", wtnBeforeMatch: 25 }],
    opponents: [
      { id: "b", tennisId: null, name: "Jamie Weaker", wtnBeforeMatch: 30 },
      { id: "b2", tennisId: null, name: "Riley Weaker", wtnBeforeMatch: 30 },
    ],
  }),
  makeMatch({ id: "old-close", date: "2025-12-01T00:00:00.000Z", tournament: "Open A", opponents: [{ id: "c", tennisId: null, name: "Morgan Equal", wtnBeforeMatch: 25 }], sets: [{ side1Games: 7, side2Games: 6, side1Tiebreak: 7, side2Tiebreak: 5, isMatchTiebreak: false }] }),
];

const run = (partial: Partial<MatchFilters>) => filterAndSortMatches(matches, { ...DEFAULT_FILTERS, ...partial });

test("filters results and formats", () => {
  assert.deepEqual(run({ result: "loss" }).map((match) => match.id), ["double-loss"]);
  assert.deepEqual(run({ matchType: "doubles" }).map((match) => match.id), ["double-loss"]);
});

test("filters dates, tournament and opponent name", () => {
  assert.deepEqual(run({ dateFrom: "2026-01-01", dateTo: "2026-02-28" }).map((match) => match.id), ["double-loss"]);
  assert.deepEqual(run({ tournament: "Open B" }).map((match) => match.id), ["double-loss"]);
  assert.deepEqual(run({ opponent: "morgan" }).map((match) => match.id), ["old-close"]);
});

test("filters stronger and weaker opponents with lower WTN meaning stronger", () => {
  assert.deepEqual(run({ strength: "stronger" }).map((match) => match.id), ["new-win"]);
  assert.deepEqual(run({ strength: "weaker" }).map((match) => match.id), ["double-loss"]);
});

test("sorts newest, oldest, opponent WTN and closest", () => {
  assert.deepEqual(run({ sort: "newest" }).map((match) => match.id), ["new-win", "double-loss", "old-close"]);
  assert.deepEqual(run({ sort: "oldest" }).map((match) => match.id), ["old-close", "double-loss", "new-win"]);
  assert.deepEqual(run({ sort: "opponent-wtn" }).map((match) => match.id), ["new-win", "old-close", "double-loss"]);
  assert.equal(run({ sort: "closest" })[0].id, "old-close");
});

test("requires both doubles team ratings before assigning opponent strength", () => {
  const incompleteDoubles = makeMatch({ id: "incomplete-team", matchType: "doubles", partners: [], opponents: [
    { id: "o1", tennisId: null, name: "One", wtnBeforeMatch: 20 },
    { id: "o2", tennisId: null, name: "Two", wtnBeforeMatch: 21 },
  ] });
  assert.equal(opponentStrength(incompleteDoubles), "unknown");
  const completeDoubles = { ...incompleteDoubles, partners: [{ id: "p", tennisId: null, name: "Partner", wtnBeforeMatch: 26 }] };
  assert.equal(opponentStrength(completeDoubles), "stronger");
});

test("labels close matches consistently and excludes retirements", () => {
  assert.equal(isCloseMatch(matches[2]), false);
  const close = makeMatch({ id: "close", sets: [
    { side1Games: 7, side2Games: 5, side1Tiebreak: null, side2Tiebreak: null, isMatchTiebreak: false },
    { side1Games: 7, side2Games: 6, side1Tiebreak: 8, side2Tiebreak: 6, isMatchTiebreak: false },
  ] });
  assert.equal(isCloseMatch(close), true);
  assert.equal(isCloseMatch({ ...close, status: "retired" }), false);
});

test("uses team averages for doubles strength", () => {
  const doubles = makeMatch({
    id: "team-average",
    matchType: "doubles",
    playerWtnBeforeMatch: 18,
    partners: [{ id: "p", tennisId: "PTN", name: "Partner", wtnBeforeMatch: 30 }],
    opponents: [
      { id: "o1", tennisId: null, name: "Opponent one", wtnBeforeMatch: 22 },
      { id: "o2", tennisId: null, name: "Opponent two", wtnBeforeMatch: 24 },
    ],
  });
  // Player team averages 24; opponent team averages 23, so the opponents are stronger.
  assert.equal(opponentStrength(doubles), "stronger");
});

test("aggregates filtered official results by month", () => {
  assert.deepEqual(monthlyResults(matches), [
    { month: "2025-12", wins: 1, losses: 0, total: 1, winRate: 1 },
    { month: "2026-02", wins: 0, losses: 1, total: 1, winRate: 0 },
    { month: "2026-03", wins: 1, losses: 0, total: 1, winRate: 1 },
  ]);
});
