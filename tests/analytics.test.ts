import assert from "node:assert/strict";
import test from "node:test";
import { calculateAnalytics } from "../lib/analytics/calculate.ts";
import { decidingSetIndex, isCompetitiveMatch } from "../lib/analytics/eligibility.ts";
import { currentStreakText } from "../lib/analytics/format.ts";
import { filterAnalyticsMatches } from "../lib/analytics/trends.ts";
import type { NormalizedMatch, NormalizedSet } from "../lib/wtn/types.ts";

const set = (player: number, opponent: number, options: { matchTiebreak?: boolean; playerTb?: number; opponentTb?: number } = {}): NormalizedSet => ({
  side1Games: player, side2Games: opponent,
  side1Tiebreak: options.playerTb ?? null, side2Tiebreak: options.opponentTb ?? null,
  isMatchTiebreak: options.matchTiebreak ?? false,
});

function match(id: string, result: "win" | "loss" | "unknown", sets: NormalizedSet[], options: Partial<NormalizedMatch> = {}): NormalizedMatch {
  return {
    id, providerMatchId: id, date: `2026-0${(id.length % 8) + 1}-01T00:00:00.000Z`, completedAt: null,
    matchType: "singles", status: "completed", playerSide: 1,
    winningSide: result === "win" ? 1 : result === "loss" ? 2 : null, result,
    opponents: [{ id: `${id}-opp`, tennisId: null, name: `Opponent ${id}`, wtnBeforeMatch: 20 }],
    partners: [], playerWtnBeforeMatch: 22, sets, scoreText: null, matchFormat: "SET3-S:6/TB7",
    draw: null, statusCodes: [], tournament: "Test Open", tournamentId: null, round: "Quarterfinal",
    ageCategory: null, surface: null, environment: null, ...options,
  };
}

const straightWin = match("straight-win", "win", [set(6, 3), set(6, 4)]);
const straightLoss = match("straight-loss", "loss", [set(3, 6), set(4, 6)]);
const comeback = match("comeback", "win", [set(4, 6), set(6, 3), set(6, 4)]);
const lostLead = match("lost-lead", "loss", [set(6, 3), set(4, 6), set(4, 6)]);
const fiveSetComeback = match("five-comeback", "win", [set(4, 6), set(3, 6), set(6, 2), set(6, 3), set(6, 4)], { matchFormat: "SET5-S:6/TB7" });
const fiveSetLostLead = match("five-lost-lead", "loss", [set(6, 2), set(6, 3), set(4, 6), set(3, 6), set(4, 6)], { matchFormat: "SET5-S:6/TB7" });
const thirdSetDecider = match("third-decider", "win", [set(6, 4), set(3, 6), set(7, 5)]);
const fifthSetDecider = match("fifth-decider", "loss", [set(6, 4), set(4, 6), set(6, 3), set(3, 6), set(6, 8)], { matchFormat: "SET5-S:6/TB7" });
const normalTiebreak = match("normal-tb", "win", [set(7, 6, { playerTb: 7, opponentTb: 5 }), set(6, 3)]);
const matchTiebreak = match("match-tb", "win", [set(6, 4), set(4, 6), set(10, 8, { matchTiebreak: true })]);
const retirement = match("retirement", "win", [set(6, 4), set(2, 1)], { status: "retired" });
const walkover = match("walkover", "win", [], { status: "walkover" });
const defaulted = match("default", "win", [], { status: "defaulted" });
const incomplete = match("incomplete", "win", [], { scoreText: "Score unavailable" });
const doubles = match("doubles", "win", [set(6, 4), set(6, 4)], {
  matchType: "doubles", playerWtnBeforeMatch: 20,
  partners: [{ id: "partner", tennisId: null, name: "Partner One", wtnBeforeMatch: 22 }],
  opponents: [
    { id: "d-opp-1", tennisId: null, name: "Opponent One", wtnBeforeMatch: 18 },
    { id: "d-opp-2", tennisId: null, name: "Opponent Two", wtnBeforeMatch: 20 },
  ],
});
const missingWtn = match("missing-wtn", "win", [set(6, 3), set(6, 3)], { playerWtnBeforeMatch: null });
const upset = match("upset", "win", [set(6, 4), set(6, 4)], { playerWtnBeforeMatch: 24, opponents: [{ id: "strong", tennisId: null, name: "Strong", wtnBeforeMatch: 20 }] });
const favouriteLoss = match("favourite-loss", "loss", [set(4, 6), set(4, 6)], { playerWtnBeforeMatch: 18, opponents: [{ id: "weak", tennisId: null, name: "Weak", wtnBeforeMatch: 22 }] });

test("uses official eligibility and excludes unplayed, retired and unfinished results", () => {
  assert.equal(isCompetitiveMatch(straightWin), true);
  for (const excluded of [retirement, walkover, defaulted]) assert.equal(isCompetitiveMatch(excluded), false);
  const report = calculateAnalytics([straightWin, straightLoss, retirement, walkover, defaulted, incomplete]);
  assert.deepEqual([report.matchRecord.wins, report.matchRecord.losses], [2, 1]);
  assert.equal(report.matchRecord.sampleSize, 3);
  assert.equal(report.sets.sampleSize, 2);
  assert.equal(report.matchRecord.excludedMatches, 3);
});

test("counts sets and games without treating match-tiebreak points as games", () => {
  const report = calculateAnalytics([matchTiebreak]);
  assert.deepEqual([report.sets.wins, report.sets.losses], [1, 1]);
  assert.deepEqual([report.games.wins, report.games.losses], [10, 10]);
  assert.deepEqual([report.matchTiebreaks.wins, report.matchTiebreaks.losses], [1, 0]);
  assert.equal(report.games.denominator, 20);
});

test("classifies first-set comebacks and lead protection with zero-opportunity safety", () => {
  const report = calculateAnalytics([comeback, straightLoss, lostLead, straightWin]);
  assert.deepEqual([report.comebackFirstSet.wins, report.comebackFirstSet.losses], [1, 1]);
  assert.equal(report.comebackFirstSet.value, .5);
  assert.deepEqual([report.afterWinningFirst.wins, report.afterWinningFirst.losses], [1, 1]);
  const empty = calculateAnalytics([straightWin]);
  assert.equal(empty.comebackFirstSet.value, null);
  assert.equal(empty.comebackFirstSet.denominator, 0);
});

test("classifies best-of-five two-set deficits and leads", () => {
  const report = calculateAnalytics([fiveSetComeback, fiveSetLostLead]);
  assert.deepEqual([report.comebackTwoSets.wins, report.comebackTwoSets.losses], [1, 0]);
  assert.deepEqual([report.lostAfterTwoSetLead.wins, report.lostAfterTwoSetLead.losses], [0, 1]);
});

test("recognizes true third- and fifth-set deciders", () => {
  assert.equal(decidingSetIndex(thirdSetDecider), 2);
  assert.equal(decidingSetIndex(fifthSetDecider), 4);
  assert.equal(decidingSetIndex(straightWin), null);
  const report = calculateAnalytics([thirdSetDecider, fifthSetDecider]);
  assert.deepEqual([report.deciding.wins, report.deciding.losses], [1, 1]);
});

test("keeps normal tiebreak and match-tiebreak records separate", () => {
  const report = calculateAnalytics([normalTiebreak, matchTiebreak]);
  assert.deepEqual([report.normalTiebreaks.wins, report.normalTiebreaks.losses], [1, 0]);
  assert.deepEqual([report.matchTiebreaks.wins, report.matchTiebreaks.losses], [1, 0]);
  assert.equal(report.normalTiebreaks.denominator, 1);
});

test("uses historical WTN, a similarity band and complete doubles team ratings", () => {
  const report = calculateAnalytics([upset, favouriteLoss, missingWtn, doubles]);
  assert.equal(report.upsetWins.value, 2);
  assert.equal(report.favouriteLosses.value, 1);
  assert.equal(report.coverage.preMatchWtn, 3);
  assert.equal(report.strongerOpponents.eligibleMatchIds.includes(missingWtn.id), false);
  assert.equal(report.partners[0].name, "Partner One");
  assert.equal(report.partners[0].matchIds.length, 1);
});

test("returns explicit empty samples instead of fabricated zero rates", () => {
  const report = calculateAnalytics([]);
  assert.equal(report.matchRecord.value, null);
  assert.equal(report.sets.value, null);
  assert.equal(report.games.value, null);
  assert.equal(report.deciding.value, null);
  assert.equal(report.matchRecord.sampleSize, 0);
});

test("filters analytics by match type, standard periods and custom dates", () => {
  const datedSingles = { ...straightWin, date: "2026-08-01T00:00:00.000Z" };
  const datedDoubles = { ...doubles, date: "2026-07-01T00:00:00.000Z" };
  const oldSingles = { ...straightLoss, date: "2025-01-01T00:00:00.000Z" };
  const matches = [datedSingles, datedDoubles, oldSingles];
  assert.deepEqual(filterAnalyticsMatches(matches, "singles", "all").map((entry) => entry.id), [straightWin.id, straightLoss.id]);
  assert.deepEqual(filterAnalyticsMatches(matches, "all", "1m").map((entry) => entry.id), [straightWin.id, doubles.id]);
  assert.deepEqual(filterAnalyticsMatches(matches, "all", "custom", "2026-07-15", "2026-08-15").map((entry) => entry.id), [straightWin.id]);
});

test("builds monthly, rolling-form and opponent-strength trends", () => {
  const matches = [
    { ...straightWin, date: "2026-01-02T00:00:00.000Z" },
    { ...straightLoss, date: "2026-01-12T00:00:00.000Z" },
    { ...comeback, date: "2026-02-02T00:00:00.000Z" },
  ];
  const trends = calculateAnalytics(matches).trends;
  assert.equal(trends.length, 2);
  assert.equal(trends[0].matches, 2);
  assert.equal(trends[0].rolling5WinRate, .5);
  assert.equal(trends[1].rolling5WinRate, 2 / 3);
  assert.equal(trends[1].rolling10Sample, 3);
  assert.equal(trends[1].averageOpponentWtn, 20);
});

test("orders recent form newest-first and calculates the streak from the newest result", () => {
  const report = calculateAnalytics([
    { ...straightLoss, id: "old-loss", date: "2026-01-01T00:00:00.000Z" },
    { ...straightWin, id: "middle-win", date: "2026-02-01T00:00:00.000Z" },
    { ...straightWin, id: "new-win", date: "2026-03-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(report.recentForm, ["win", "win", "loss"]);
  assert.deepEqual(report.currentStreak, { result: "win", count: 2 });
  assert.equal(currentStreakText(report.currentStreak), "2 wins in a row");
  assert.equal(currentStreakText({ result: "win", count: 1 }), "1 win in a row");
  assert.equal(currentStreakText({ result: "loss", count: 1 }), "1 loss in a row");
  assert.equal(currentStreakText({ result: "loss", count: 3 }), "3 losses in a row");
});

test("uses completion time and a stable ID tie-breaker for form and streak order", () => {
  const sharedStart = "2026-04-01T09:00:00.000Z";
  const completionOrdered = calculateAnalytics([
    { ...straightWin, id: "early-win", date: sharedStart, completedAt: "2026-04-01T10:00:00.000Z" },
    { ...straightLoss, id: "middle-loss", date: sharedStart, completedAt: "2026-04-01T11:00:00.000Z" },
    { ...straightLoss, id: "late-loss", date: sharedStart, completedAt: "2026-04-01T12:00:00.000Z" },
  ]);
  assert.deepEqual(completionOrdered.recentForm, ["loss", "loss", "win"]);
  assert.deepEqual(completionOrdered.currentStreak, { result: "loss", count: 2 });

  const exactTie = calculateAnalytics([
    { ...straightWin, id: "a-win", date: sharedStart, completedAt: null },
    { ...straightLoss, id: "z-loss", date: sharedStart, completedAt: null },
  ]);
  assert.deepEqual(exactTie.recentForm, ["loss", "win"]);
  assert.deepEqual(exactTie.currentStreak, { result: "loss", count: 1 });
});

test("analytics observations retain sample sizes and evidence match IDs", () => {
  const report = calculateAnalytics([comeback, straightLoss, lostLead, fiveSetComeback]);
  const openingSet = report.insights.find((insight) => insight.label === "Opening-set response");
  assert.ok(openingSet);
  assert.equal(openingSet.sampleSize, 3);
  assert.deepEqual(openingSet.matchIds, report.comebackFirstSet.eligibleMatchIds);
  assert.ok(openingSet.evidenceReason.length > 0);
});

test("fixtures cover all required normalized match shapes", () => {
  const fixtures: Array<[string, NormalizedMatch]> = [
    ["straight win", straightWin], ["straight loss", straightLoss], ["first-set comeback", comeback], ["lost first-set lead", lostLead],
    ["0-2 comeback", fiveSetComeback], ["lost 2-0 lead", fiveSetLostLead], ["third-set decider", thirdSetDecider], ["fifth-set decider", fifthSetDecider],
    ["normal tiebreak", normalTiebreak], ["match tiebreak", matchTiebreak], ["retirement", retirement], ["walkover", walkover],
    ["default", defaulted], ["incomplete", incomplete], ["doubles", doubles], ["missing WTN", missingWtn], ["upset", upset], ["favourite loss", favouriteLoss],
  ];
  assert.equal(fixtures.length, 18);
  assert.equal(new Set(fixtures.map(([, fixture]) => fixture.id)).size, 18);
});
