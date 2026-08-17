import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS, filterAndSortMatches, type MatchFilters } from "../lib/wtn/match-utils.ts";
import type { NormalizedMatch } from "../lib/wtn/types.ts";

const makeMatch = (partial: Partial<NormalizedMatch> & Pick<NormalizedMatch, "id">): NormalizedMatch => ({
  id: partial.id, date: "2026-01-01T00:00:00.000Z", completedAt: null, matchType: "singles", status: "completed",
  playerSide: 1, winningSide: 1, result: "win", opponents: [{ id: "o", tennisId: null, name: "Alex Strong", wtnBeforeMatch: 20 }],
  partners: [], playerWtnBeforeMatch: 25, sets: [{ side1Games: 6, side2Games: 4, side1Tiebreak: null, side2Tiebreak: null, isMatchTiebreak: false }],
  scoreText: "6-4", tournament: "Open A", round: null, ageCategory: null, surface: null, environment: null, ...partial,
});

const matches = [
  makeMatch({ id: "new-win", date: "2026-03-01T00:00:00.000Z" }),
  makeMatch({ id: "double-loss", date: "2026-02-01T00:00:00.000Z", matchType: "doubles", result: "loss", winningSide: 2, tournament: "Open B", opponents: [{ id: "b", tennisId: null, name: "Jamie Weaker", wtnBeforeMatch: 30 }] }),
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
