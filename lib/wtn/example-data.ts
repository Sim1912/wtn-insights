import type { NormalizedMatch, NormalizedSet, WtnApiResponse } from "./types";

export const EXAMPLE_TENNIS_ID = "DEMO";

const sets = (scores: Array<[number, number]>): NormalizedSet[] => scores.map(([side1Games, side2Games]) => ({
  side1Games,
  side2Games,
  side1Tiebreak: null,
  side2Tiebreak: null,
  isMatchTiebreak: false,
}));

function exampleMatch({
  id,
  date,
  result,
  opponent,
  opponentWtn,
  score,
}: {
  id: string;
  date: string;
  result: "win" | "loss";
  opponent: string;
  opponentWtn: number;
  score: Array<[number, number]>;
}): NormalizedMatch {
  const playerWon = result === "win";
  return {
    id,
    providerMatchId: null,
    date,
    completedAt: date,
    matchType: "singles",
    status: "completed",
    playerSide: 1,
    winningSide: playerWon ? 1 : 2,
    result,
    opponents: [{ id: null, tennisId: null, name: opponent, wtnBeforeMatch: opponentWtn }],
    partners: [],
    playerWtnBeforeMatch: 24.6,
    sets: sets(score),
    scoreText: score.map(([first, second]) => `${first}-${second}`).join(" "),
    matchFormat: "SET3-S:6/TB7",
    draw: "Example season",
    statusCodes: [],
    tournament: "Example Open",
    tournamentId: null,
    round: "Main draw",
    ageCategory: null,
    surface: "Hard",
    environment: "outdoor",
  };
}

export const exampleWtnResponse: WtnApiResponse = {
  player: {
    id: EXAMPLE_TENNIS_ID,
    personId: null,
    name: "Example Player",
    country: "Demo data",
  },
  ratings: {
    singles: 24.6,
    doubles: 23.9,
    singlesChange: -0.15,
    doublesChange: 0.08,
    singlesConfidence: 88,
    doublesConfidence: 82,
    updatedAt: "2026-01-18T00:00:00.000Z",
    history: {
      singles: [
        { date: "2025-04-12", value: 26.1, previous: 26.4, change: -0.3, confidence: 71, gameZoneLower: 25.7, gameZoneUpper: 26.5, connectedMatches: 4 },
        { date: "2025-07-18", value: 25.5, previous: 26.1, change: -0.6, confidence: 77, gameZoneLower: 25.2, gameZoneUpper: 25.8, connectedMatches: 5 },
        { date: "2025-10-20", value: 24.9, previous: 25.5, change: -0.6, confidence: 83, gameZoneLower: 24.6, gameZoneUpper: 25.2, connectedMatches: 6 },
        { date: "2026-01-18", value: 24.6, previous: 24.75, change: -0.15, confidence: 88, gameZoneLower: 24.3, gameZoneUpper: 24.9, connectedMatches: 7 },
      ],
      doubles: [
        { date: "2025-04-12", value: 24.4, previous: 24.7, change: -0.3, confidence: 69, gameZoneLower: 24.0, gameZoneUpper: 24.8, connectedMatches: 3 },
        { date: "2025-07-18", value: 24.1, previous: 24.4, change: -0.3, confidence: 75, gameZoneLower: 23.8, gameZoneUpper: 24.4, connectedMatches: 4 },
        { date: "2025-10-20", value: 23.82, previous: 24.1, change: -0.28, confidence: 80, gameZoneLower: 23.5, gameZoneUpper: 24.1, connectedMatches: 6 },
        { date: "2026-01-18", value: 23.9, previous: 23.82, change: 0.08, confidence: 82, gameZoneLower: 23.6, gameZoneUpper: 24.2, connectedMatches: 6 },
      ],
    },
  },
  matches: [
    exampleMatch({ id: "example-8", date: "2026-01-18T10:00:00.000Z", result: "win", opponent: "Taylor Reed", opponentWtn: 25.1, score: [[6, 4], [6, 3]] }),
    exampleMatch({ id: "example-7", date: "2026-01-10T10:00:00.000Z", result: "loss", opponent: "Jordan Lee", opponentWtn: 23.8, score: [[4, 6], [6, 3], [3, 6]] }),
    exampleMatch({ id: "example-6", date: "2025-12-14T10:00:00.000Z", result: "win", opponent: "Casey Morgan", opponentWtn: 25.7, score: [[6, 2], [7, 5]] }),
    exampleMatch({ id: "example-5", date: "2025-11-22T10:00:00.000Z", result: "win", opponent: "Riley Chen", opponentWtn: 24.8, score: [[7, 5], [6, 4]] }),
    exampleMatch({ id: "example-4", date: "2025-10-05T10:00:00.000Z", result: "loss", opponent: "Avery Patel", opponentWtn: 23.4, score: [[3, 6], [4, 6]] }),
    exampleMatch({ id: "example-3", date: "2025-08-17T10:00:00.000Z", result: "win", opponent: "Morgan Davis", opponentWtn: 26.0, score: [[6, 1], [6, 4]] }),
    exampleMatch({ id: "example-2", date: "2025-06-28T10:00:00.000Z", result: "loss", opponent: "Quinn Parker", opponentWtn: 24.2, score: [[6, 7], [2, 6]] }),
    exampleMatch({ id: "example-1", date: "2025-04-19T10:00:00.000Z", result: "win", opponent: "Jamie Wilson", opponentWtn: 26.4, score: [[6, 3], [6, 2]] }),
  ],
  meta: {
    source: "example",
    fetchedAt: "2026-01-18T00:00:00.000Z",
    warnings: ["Example data is shown until a Tennis ID is loaded."],
  },
};

export function isExampleTennisId(tennisId: string): boolean {
  return tennisId.trim().toUpperCase() === EXAMPLE_TENNIS_ID;
}
