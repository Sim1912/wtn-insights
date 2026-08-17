export type MatchType = "singles" | "doubles" | "unknown";

export type MatchStatus =
  | "completed"
  | "retired"
  | "walkover"
  | "defaulted"
  | "abandoned"
  | "unfinished"
  | "unknown";

export type NormalizedSet = {
  side1Games: number | null;
  side2Games: number | null;
  side1Tiebreak: number | null;
  side2Tiebreak: number | null;
  isMatchTiebreak: boolean;
};

export type MatchParticipant = {
  id: string | null;
  tennisId: string | null;
  name: string;
  wtnBeforeMatch: number | null;
};

export type NormalizedMatch = {
  id: string;
  date: string | null;
  completedAt: string | null;
  matchType: MatchType;
  status: MatchStatus;
  playerSide: 1 | 2;
  winningSide: 1 | 2 | null;
  result: "win" | "loss" | "unknown";
  opponents: MatchParticipant[];
  partners: MatchParticipant[];
  playerWtnBeforeMatch: number | null;
  sets: NormalizedSet[];
  scoreText: string | null;
  tournament: string | null;
  round: string | null;
  ageCategory: string | null;
  surface: string | null;
  environment: "indoor" | "outdoor" | null;
};

export type RatingPoint = {
  date: string;
  singles: number | null;
  doubles: number | null;
};

export type PlayerProfile = {
  id: string;
  personId: string | null;
  name: string;
  country: string | null;
};

export type RatingSummary = {
  singles: number | null;
  doubles: number | null;
  singlesChange: number | null;
  doublesChange: number | null;
  singlesConfidence: number | null;
  doublesConfidence: number | null;
  updatedAt: string | null;
  history: RatingPoint[];
};

export type WtnApiResponse = {
  player: PlayerProfile;
  ratings: RatingSummary;
  matches: NormalizedMatch[];
  meta: {
    source: "wtn-live";
    fetchedAt: string;
    warnings: string[];
  };
};

export type RawPerson = {
  id?: string | null;
  tennisID?: string | null;
  standardGivenName?: string | null;
  standardFamilyName?: string | null;
  nativeGivenName?: string | null;
  nativeFamilyName?: string | null;
  nationalityCode?: string | null;
};

export type RawMatchWtn = {
  personId?: string | null;
  tennisNumber?: number | null;
  type?: string | null;
  ratingDate?: string | null;
  confidence?: number | null;
};

export type RawSet = {
  winnerGamesWon?: number | null;
  loserGamesWon?: number | null;
  tiebreaker?: {
    winnerPointsWon?: number | null;
    loserPointsWon?: number | null;
  } | null;
};

export type RawMatch = {
  id?: string | null;
  providerMatchId?: string | null;
  start?: string | null;
  end?: string | null;
  type?: string | null;
  status?: string | null;
  statusCodes?: string[] | null;
  winningSide?: string | null;
  matchUpFormat?: string | null;
  ageCategoryCode?: string | null;
  surfaceCategory?: string | null;
  surfaceType?: string | null;
  indoorOutdoor?: string | null;
  roundName?: string | null;
  roundNumber?: number | null;
  drawName?: string | null;
  score?: {
    scoreString?: string | null;
    sets?: RawSet[] | null;
    superTiebreak?: {
      winnerPointsWon?: number | null;
      loserPointsWon?: number | null;
    } | null;
  } | null;
  sides?: Array<{
    sideNumber?: string | null;
    players?: Array<{
      playerNumber?: number | null;
      person?: RawPerson | null;
    }> | null;
  }> | null;
  worldTennisNumbers?: RawMatchWtn[] | null;
  tournament?: {
    id?: string | null;
    name?: string | null;
    formalName?: string | null;
    promotionalName?: string | null;
    surfaceCategory?: string | null;
    indoorOutdoor?: string | null;
  } | null;
};

export type RawRating = {
  ratingDate?: string | null;
  tennisNumber?: number | null;
  prevTennisNumber?: number | null;
  type?: string | null;
  confidence?: number | null;
  matchUps?: RawMatch[] | null;
};

export type RawWtnPayload = {
  player?: RawPerson | null;
  ratings?: RawRating[] | null;
};
