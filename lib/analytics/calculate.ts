import { averageOpponentWtn, averagePlayerTeamWtn, chronologicalMatchOrder, SIMILAR_WTN_BAND } from "../wtn/match-utils.ts";
import type { NormalizedMatch, NormalizedSet } from "../wtn/types";
import { decidingSetIndex, hasUsableSets, isBestOfFive, isCompetitiveMatch, matchTiebreakSets, normalSets, playerScore, playerWonSet, setSequence } from "./eligibility.ts";
import { monthlyTrends } from "./trends.ts";
import type { AnalyticsInsight, AnalyticsReport, DataCoverage, MetricResult, PatternRow, RatingBandRow, RecordResult } from "./types";
import { percentagePointComparison, percentagePointDifference } from "./format.ts";

export { SIMILAR_WTN_BAND } from "../wtn/match-utils.ts";
const MINIMUM_INSIGHT_SAMPLE = 5;
const MEANINGFUL_WIN_RATE_DIFFERENCE = .1;

function metric(value: number | null, ids: string[], total: number, numerator?: number, denominator?: number): MetricResult {
  return { value, numerator, denominator, sampleSize: ids.length, eligibleMatchIds: ids, excludedMatches: Math.max(0, total - ids.length) };
}

function record(matches: NormalizedMatch[], total: number): RecordResult {
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  return { ...metric(matches.length ? wins / matches.length : null, matches.map((match) => match.id), total, wins, matches.length), wins, losses };
}

function insightRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isUsefulInsight(result: RecordResult, overallValue: number | null): result is RecordResult & { value: number } {
  return result.sampleSize >= MINIMUM_INSIGHT_SAMPLE
    && result.value != null
    && overallValue != null
    && percentagePointDifference(result.value, overallValue) >= MEANINGFUL_WIN_RATE_DIFFERENCE * 100;
}

function setSideValues(set: NormalizedSet, playerSide: 1 | 2): [number, number] | null {
  if (!set.isMatchTiebreak) return playerScore(set, playerSide);
  const player = playerSide === 1 ? set.side1Tiebreak ?? set.side1Games : set.side2Tiebreak ?? set.side2Games;
  const opponent = playerSide === 1 ? set.side2Tiebreak ?? set.side2Games : set.side1Tiebreak ?? set.side1Games;
  return player == null || opponent == null ? null : [player, opponent];
}

function coverage(matches: NormalizedMatch[]): DataCoverage {
  return {
    total: matches.length,
    knownWinner: matches.filter((match) => match.winningSide != null).length,
    completeScore: matches.filter((match) => isCompetitiveMatch(match) && hasUsableSets(match)).length,
    usableSets: matches.filter(hasUsableSets).length,
    usableGames: matches.filter((match) => normalSets(match).length > 0).length,
    preMatchWtn: matches.filter((match) => averagePlayerTeamWtn(match) != null && averageOpponentWtn(match) != null).length,
    tournament: matches.filter((match) => match.tournament).length,
    surface: matches.filter((match) => match.surface).length,
  };
}

function scorePattern(match: NormalizedMatch): string {
  if (match.status === "retired") return "Retirement result";
  if (!isCompetitiveMatch(match) || !hasUsableSets(match)) return "Incomplete result";
  const sequence = setSequence(match);
  const decider = decidingSetIndex(match) != null;
  const hasMatchTiebreak = matchTiebreakSets(match).length > 0;
  if (hasMatchTiebreak) return match.result === "win" ? "Won by match tiebreak" : "Lost by match tiebreak";
  if (decider) return match.result === "win" ? "Won in deciding set" : "Lost in deciding set";
  const lostSets = sequence.filter((result) => result === (match.result === "win" ? "loss" : "win")).length;
  if (lostSets === 0) return match.result === "win" ? "Won in straight sets" : "Lost in straight sets";
  return match.result === "win" ? "Won after split sets" : "Lost after split sets";
}

function closeDecider(match: NormalizedMatch): boolean {
  const index = decidingSetIndex(match);
  if (index == null) return false;
  const set = match.sets[index];
  const score = setSideValues(set, match.playerSide);
  if (!score) return false;
  const difference = Math.abs(score[0] - score[1]);
  if (set.isMatchTiebreak) return difference <= 2;
  const hasTiebreak = set.side1Tiebreak != null || set.side2Tiebreak != null;
  return hasTiebreak || (Math.max(...score) >= 4 && difference <= 2);
}

function streaks(matches: NormalizedMatch[]) {
  const chronological = [...matches].sort(chronologicalMatchOrder);
  let longestWin = 0; let longestLoss = 0; let currentResult: "win" | "loss" | null = null; let currentCount = 0;
  for (const match of chronological) {
    if (match.result !== "win" && match.result !== "loss") continue;
    if (match.result === currentResult) currentCount += 1; else { currentResult = match.result; currentCount = 1; }
    if (currentResult === "win") longestWin = Math.max(longestWin, currentCount); else longestLoss = Math.max(longestLoss, currentCount);
  }
  return { longestWin, longestLoss, current: currentResult ? { result: currentResult, count: currentCount } : null };
}

export function calculateAnalytics(matches: NormalizedMatch[]): AnalyticsReport {
  const total = matches.length;
  const competitive = matches.filter(isCompetitiveMatch);
  const scored = competitive.filter(hasUsableSets);
  const normalScored = scored.filter((match) => normalSets(match).length > 0);
  const firstNormal = (match: NormalizedMatch) => normalSets(match)[0];
  const lostFirst = scored.filter((match) => firstNormal(match) && playerWonSet(firstNormal(match), match.playerSide) === false);
  const wonFirst = scored.filter((match) => firstNormal(match) && playerWonSet(firstNormal(match), match.playerSide) === true);
  const bestFive = scored.filter(isBestOfFive);
  const trailedTwo = bestFive.filter((match) => setSequence(match).slice(0, 2).every((result) => result === "loss"));
  const ledTwo = bestFive.filter((match) => setSequence(match).slice(0, 2).every((result) => result === "win"));
  const splitFirstTwo = scored.filter((match) => {
    const sequence = setSequence(match);
    return sequence[0] === "win" && sequence[1] === "loss";
  });
  const trailedOne = scored.filter((match) => {
    let wins = 0; let losses = 0;
    return setSequence(match).some((result) => { if (result === "win") wins++; else losses++; return losses > wins; });
  });

  let setsWon = 0; let setsLost = 0; let gamesWon = 0; let gamesLost = 0;
  for (const match of normalScored) for (const set of normalSets(match)) {
    const won = playerWonSet(set, match.playerSide);
    const score = playerScore(set, match.playerSide);
    if (won != null) { if (won) setsWon++; else setsLost++; }
    if (score) { gamesWon += score[0]; gamesLost += score[1]; }
  }
  const scoredIds = normalScored.map((match) => match.id);
  const setsTotal = setsWon + setsLost;
  const gamesTotal = gamesWon + gamesLost;
  const decidingMatches = scored.filter((match) => decidingSetIndex(match) != null);
  const decidingNormal = decidingMatches.filter((match) => !match.sets[decidingSetIndex(match)!].isMatchTiebreak);
  const decidingBestOfFive = decidingMatches.filter(isBestOfFive);
  const decidingBestOfThree = decidingMatches.filter((match) => !isBestOfFive(match));
  const mtbMatches = scored.filter((match) => matchTiebreakSets(match).length > 0);
  const mtbDifferences = mtbMatches.flatMap((match) => matchTiebreakSets(match).flatMap((set) => { const score = setSideValues(set, match.playerSide); return score ? [score[0] - score[1]] : []; }));
  const normalTbMatches = scored.filter((match) => normalSets(match).some((set) => set.side1Tiebreak != null || set.side2Tiebreak != null));
  const normalTbOutcomes = normalTbMatches.flatMap((match) => normalSets(match).filter((set) => set.side1Tiebreak != null || set.side2Tiebreak != null).map((set) => ({ match, won: playerWonSet(set, match.playerSide) })));
  const normalTbWins = normalTbOutcomes.filter((entry) => entry.won).length;
  const finalTbMatches = decidingNormal.filter((match) => {
    const set = match.sets[decidingSetIndex(match)!]; return set.side1Tiebreak != null || set.side2Tiebreak != null;
  });
  const close = decidingMatches.filter(closeDecider);

  const opponentRated = competitive.flatMap((match) => {
    const opponent = averageOpponentWtn(match);
    return opponent == null ? [] : [{ match, opponent }];
  });
  const ratingEligible = opponentRated.flatMap(({ match, opponent }) => {
    const player = averagePlayerTeamWtn(match);
    return player == null ? [] : [{ match, player, opponent, difference: opponent - player }];
  });
  const stronger = ratingEligible.filter((row) => row.difference <= -SIMILAR_WTN_BAND).map((row) => row.match);
  const similar = ratingEligible.filter((row) => Math.abs(row.difference) < SIMILAR_WTN_BAND).map((row) => row.match);
  const weaker = ratingEligible.filter((row) => row.difference >= SIMILAR_WTN_BAND).map((row) => row.match);
  const ratingBands: RatingBandRow[] = [
    ["Player stronger by 3+", (d: number) => d >= 3],
    ["Player stronger by 1–3", (d: number) => d >= 1 && d < 3],
    ["Within 1 WTN", (d: number) => Math.abs(d) < 1],
    ["Opponent stronger by 1–3", (d: number) => d <= -1 && d > -3],
    ["Opponent stronger by 3+", (d: number) => d <= -3],
  ].map(([label, predicate]) => {
    const rows = ratingEligible.filter((row) => (predicate as (difference: number) => boolean)(row.difference));
    return { label: label as string, wins: rows.filter((row) => row.match.result === "win").length, losses: rows.filter((row) => row.match.result === "loss").length, matchIds: rows.map((row) => row.match.id) };
  });

  const patternsByLabel = new Map<string, NormalizedMatch[]>();
  for (const match of matches) { const label = scorePattern(match); patternsByLabel.set(label, [...(patternsByLabel.get(label) ?? []), match]); }
  const patterns: PatternRow[] = [...patternsByLabel.entries()].map(([label, rows]) => ({ label, count: rows.length, matchIds: rows.map((match) => match.id) })).sort((a, b) => b.count - a.count);

  const partnerMap = new Map<string, { name: string; matches: NormalizedMatch[] }>();
  for (const match of competitive.filter((entry) => entry.matchType === "doubles")) {
    const partnerEntries = match.partners.length ? match.partners : [{ id: null, tennisId: null, name: "Partner unavailable", wtnBeforeMatch: null }];
    for (const partner of partnerEntries) {
      const missing = partner.name === "Partner unavailable";
      const key = partner.tennisId || partner.id || (missing ? "missing-partner" : `name:${partner.name.toLocaleLowerCase()}`);
      const group = partnerMap.get(key) ?? { name: partner.name, matches: [] };
      if (!group.matches.some((entry) => entry.id === match.id)) group.matches.push(match);
      partnerMap.set(key, group);
    }
  }
  const partners = [...partnerMap.values()].map(({ name, matches: rows }) => ({ name, wins: rows.filter((match) => match.result === "win").length, losses: rows.filter((match) => match.result === "loss").length, matchIds: rows.map((match) => match.id) })).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

  const straightWins = normalScored.filter((match) => matchTiebreakSets(match).length === 0 && match.result === "win" && setSequence(match).every((result) => result === "win"));
  const straightLosses = normalScored.filter((match) => matchTiebreakSets(match).length === 0 && match.result === "loss" && setSequence(match).every((result) => result === "loss"));
  const comebackWinners = lostFirst.filter((match) => match.result === "win");
  const streak = streaks(competitive);
  const sortedRecent = [...competitive].sort((a, b) => chronologicalMatchOrder(b, a));
  const opponentWins = ratingEligible.filter((row) => row.match.result === "win").sort((a, b) => a.opponent - b.opponent);
  const opponentLosses = ratingEligible.filter((row) => row.match.result === "loss").sort((a, b) => b.opponent - a.opponent);
  const ratedOpponentWins = opponentRated.filter((row) => row.match.result === "win").sort((a, b) => a.opponent - b.opponent);
  const ratedOpponentLosses = opponentRated.filter((row) => row.match.result === "loss").sort((a, b) => b.opponent - a.opponent);
  const bestComebacks = comebackWinners.map((match) => {
    const sequence = setSequence(match); let wins = 0; let losses = 0; let maxBehind = 0;
    for (const result of sequence) { if (result === "win") wins++; else losses++; maxBehind = Math.max(maxBehind, losses - wins); }
    return { match, setsBehind: maxBehind, reason: `Lost Set 1 · won ${sequence.filter((result) => result === "win").length}–${sequence.filter((result) => result === "loss").length} in sets` };
  }).sort((a, b) => b.setsBehind - a.setsBehind || (averageOpponentWtn(a.match) ?? 99) - (averageOpponentWtn(b.match) ?? 99) || chronologicalMatchOrder(a.match, b.match)).slice(0, 5);

  const report: AnalyticsReport = {
    coverage: coverage(matches), competitiveMatches: competitive,
    matchRecord: record(competitive, total),
    sets: { ...metric(setsTotal ? setsWon / setsTotal : null, scoredIds, total, setsWon, setsTotal), wins: setsWon, losses: setsLost },
    games: { ...metric(gamesTotal ? gamesWon / gamesTotal : null, scoredIds, total, gamesWon, gamesTotal), wins: gamesWon, losses: gamesLost },
    deciding: record(decidingMatches, total), decidingNormal: record(decidingNormal, total), decidingBestOfThree: record(decidingBestOfThree, total), decidingBestOfFive: record(decidingBestOfFive, total), matchTiebreaks: record(mtbMatches, total),
    averageMatchTiebreakDifference: metric(mtbDifferences.length ? mtbDifferences.reduce((sum, value) => sum + value, 0) / mtbDifferences.length : null, mtbMatches.map((match) => match.id), total, mtbDifferences.reduce((sum, value) => sum + value, 0), mtbDifferences.length),
    normalTiebreaks: { ...metric(normalTbOutcomes.length ? normalTbWins / normalTbOutcomes.length : null, normalTbMatches.map((match) => match.id), total, normalTbWins, normalTbOutcomes.length), wins: normalTbWins, losses: normalTbOutcomes.length - normalTbWins },
    finalSetTiebreaks: record(finalTbMatches, total), closeMatches: record(close, total),
    comebackFirstSet: record(lostFirst, total), comebackTwoSets: record(trailedTwo, total), trailedOneSetWins: record(trailedOne, total), lostSecondThenWon: record(splitFirstTwo, total),
    afterWinningFirst: record(wonFirst, total), lostAfterTwoSetLead: record(ledTwo, total), afterSplitFirstTwo: record(splitFirstTwo, total),
    straightSetWins: metric(normalScored.length ? straightWins.length : null, straightWins.map((match) => match.id), total, straightWins.length, normalScored.length),
    straightSetLosses: metric(normalScored.length ? straightLosses.length : null, straightLosses.map((match) => match.id), total, straightLosses.length, normalScored.length),
    averageSetsWon: metric(normalScored.length ? setsWon / normalScored.length : null, scoredIds, total, setsWon, normalScored.length),
    averageSetsLost: metric(normalScored.length ? setsLost / normalScored.length : null, scoredIds, total, setsLost, normalScored.length),
    averageGamesWon: metric(normalScored.length ? gamesWon / normalScored.length : null, scoredIds, total, gamesWon, normalScored.length),
    averageGameDifference: metric(normalScored.length ? (gamesWon - gamesLost) / normalScored.length : null, scoredIds, total, gamesWon - gamesLost, normalScored.length),
    averageSetsPlayed: metric(normalScored.length ? setsTotal / normalScored.length : null, scoredIds, total, setsTotal, normalScored.length),
    strongerOpponents: record(stronger, total), similarOpponents: record(similar, total), weakerOpponents: record(weaker, total),
    upsetWins: metric(stronger.filter((match) => match.result === "win").length, stronger.filter((match) => match.result === "win").map((match) => match.id), total),
    favouriteLosses: metric(weaker.filter((match) => match.result === "loss").length, weaker.filter((match) => match.result === "loss").map((match) => match.id), total),
    averageOpponentWtn: metric(opponentRated.length ? opponentRated.reduce((sum, row) => sum + row.opponent, 0) / opponentRated.length : null, opponentRated.map((row) => row.match.id), total),
    averageWtnDifferenceWins: metric(opponentWins.length ? opponentWins.reduce((sum, row) => sum + row.difference, 0) / opponentWins.length : null, opponentWins.map((row) => row.match.id), total),
    averageWtnDifferenceLosses: metric(opponentLosses.length ? opponentLosses.reduce((sum, row) => sum + row.difference, 0) / opponentLosses.length : null, opponentLosses.map((row) => row.match.id), total),
    strongestOpponentBeaten: ratedOpponentWins[0] ? { name: ratedOpponentWins[0].match.opponents.map((opponent) => opponent.name).join(" / "), wtn: ratedOpponentWins[0].opponent, matchId: ratedOpponentWins[0].match.id } : null,
    weakestRatedLoss: ratedOpponentLosses[0] ? { name: ratedOpponentLosses[0].match.opponents.map((opponent) => opponent.name).join(" / "), wtn: ratedOpponentLosses[0].opponent, matchId: ratedOpponentLosses[0].match.id } : null,
    patterns, ratingBands, trends: monthlyTrends(matches), recentForm: sortedRecent.slice(0, 5).map((match) => match.result as "win" | "loss"),
    currentStreak: streak.current, longestWinStreak: streak.longestWin, longestLossStreak: streak.longestLoss, partners, bestComebacks, insights: [],
  };

  const insights: AnalyticsInsight[] = [];
  const overallWinRate = report.matchRecord.value;
  if (overallWinRate != null && isUsefulInsight(report.comebackFirstSet, overallWinRate)) insights.push({
    label: "Opening-set response",
    text: `Won ${insightRate(report.comebackFirstSet.value)} of matches after dropping the opening set${percentagePointComparison(report.comebackFirstSet.value, overallWinRate)}`,
    sampleSize: report.comebackFirstSet.eligibleMatchIds.length,
    matchIds: report.comebackFirstSet.eligibleMatchIds,
    evidenceReason: "Lost the first completed normal set",
  });
  if (overallWinRate != null && isUsefulInsight(report.deciding, overallWinRate)) insights.push({
    label: "Deciding matches",
    text: `Won ${insightRate(report.deciding.value)} of deciding-set matches${percentagePointComparison(report.deciding.value, overallWinRate)}`,
    sampleSize: report.deciding.eligibleMatchIds.length,
    matchIds: report.deciding.eligibleMatchIds,
    evidenceReason: "Both teams were one set from winning before the final set",
  });
  if (overallWinRate != null && isUsefulInsight(report.strongerOpponents, overallWinRate)) insights.push({
    label: "Opponent challenge",
    text: `Won ${insightRate(report.strongerOpponents.value)} of matches against stronger-rated opponents${percentagePointComparison(report.strongerOpponents.value, overallWinRate)}`,
    sampleSize: report.strongerOpponents.eligibleMatchIds.length,
    matchIds: report.strongerOpponents.eligibleMatchIds,
    evidenceReason: `Opponent entered at least ${SIMILAR_WTN_BAND.toFixed(1)} WTN stronger`,
  });
  const overallSetWinRate = report.sets.value;
  if (insights.length < 3 && overallSetWinRate != null && isUsefulInsight(report.normalTiebreaks, overallSetWinRate)) insights.push({
    label: "Tiebreak execution",
    text: `Won ${insightRate(report.normalTiebreaks.value)} of normal-set tiebreaks${percentagePointComparison(report.normalTiebreaks.value, overallSetWinRate, "the overall set win rate")}`,
    sampleSize: report.normalTiebreaks.eligibleMatchIds.length,
    matchIds: report.normalTiebreaks.eligibleMatchIds,
    evidenceReason: "Match included at least one normal-set tiebreak",
  });
  report.insights = insights.slice(0, 3);
  return report;
}
