import type { NormalizedMatch } from "../wtn/types";

export type AnalyticsMatchType = "all" | "singles" | "doubles";
export type AnalyticsPeriod = "1m" | "3m" | "6m" | "1y" | "all" | "custom";

export type MetricResult = {
  value: number | null;
  numerator?: number;
  denominator?: number;
  sampleSize: number;
  eligibleMatchIds: string[];
  excludedMatches: number;
};

export type RecordResult = MetricResult & { wins: number; losses: number };

export type DataCoverage = {
  total: number;
  knownWinner: number;
  completeScore: number;
  usableSets: number;
  usableGames: number;
  preMatchWtn: number;
  tournament: number;
  surface: number;
};

export type PatternRow = { label: string; count: number; matchIds: string[] };
export type RatingBandRow = { label: string; wins: number; losses: number; matchIds: string[] };
export type TrendPoint = {
  month: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number | null;
  setsWon: number;
  setsLost: number;
  setsWonRate: number | null;
  gamesWon: number;
  gamesLost: number;
  gamesWonRate: number | null;
};

export type PartnerRow = { name: string; wins: number; losses: number; matchIds: string[] };

export type AnalyticsReport = {
  coverage: DataCoverage;
  competitiveMatches: NormalizedMatch[];
  matchRecord: RecordResult;
  sets: RecordResult;
  games: RecordResult;
  deciding: RecordResult;
  decidingNormal: RecordResult;
  matchTiebreaks: RecordResult;
  normalTiebreaks: RecordResult;
  finalSetTiebreaks: RecordResult;
  closeMatches: RecordResult;
  comebackFirstSet: RecordResult;
  comebackTwoSets: RecordResult;
  trailedOneSetWins: RecordResult;
  lostSecondThenWon: RecordResult;
  afterWinningFirst: RecordResult;
  lostAfterTwoSetLead: RecordResult;
  afterSplitFirstTwo: RecordResult;
  straightSetWins: MetricResult;
  straightSetLosses: MetricResult;
  averageSetsWon: MetricResult;
  averageSetsLost: MetricResult;
  averageGamesWon: MetricResult;
  averageGameDifference: MetricResult;
  averageSetsPlayed: MetricResult;
  strongerOpponents: RecordResult;
  similarOpponents: RecordResult;
  weakerOpponents: RecordResult;
  upsetWins: MetricResult;
  favouriteLosses: MetricResult;
  averageOpponentWtn: MetricResult;
  averageWtnDifferenceWins: MetricResult;
  averageWtnDifferenceLosses: MetricResult;
  strongestOpponentBeaten: { name: string; wtn: number; matchId: string } | null;
  weakestRatedLoss: { name: string; wtn: number; matchId: string } | null;
  patterns: PatternRow[];
  ratingBands: RatingBandRow[];
  trends: TrendPoint[];
  recentForm: Array<"win" | "loss">;
  currentStreak: { result: "win" | "loss"; count: number } | null;
  longestWinStreak: number;
  longestLossStreak: number;
  partners: PartnerRow[];
  bestComebacks: Array<{ match: NormalizedMatch; setsBehind: number; reason: string }>;
  insights: string[];
};
