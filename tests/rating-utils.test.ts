import assert from "node:assert/strict";
import test from "node:test";
import { filterRatingPeriod, ratingDomain, type RatingPeriod } from "../lib/wtn/rating-utils.ts";
import type { RatingPoint } from "../lib/wtn/types.ts";

const point = (date: string, value: number): RatingPoint => ({ date, value, previous: null, change: null, confidence: null, gameZoneLower: null, gameZoneUpper: null, connectedMatches: null });
const points = [
  point("2025-01-01T00:00:00.000Z", 28), point("2025-07-01T00:00:00.000Z", 27),
  point("2025-10-01T00:00:00.000Z", 26.5), point("2025-12-15T00:00:00.000Z", 26),
  point("2026-01-15T00:00:00.000Z", 25.5),
];

test("supports every rating period selector", () => {
  const expected: Record<RatingPeriod, number> = { "1m": 2, "3m": 2, "6m": 3, "1y": 4, all: 5 };
  for (const period of Object.keys(expected) as RatingPeriod[]) assert.equal(filterRatingPeriod(points, period).length, expected[period]);
});

test("uses a padded non-misleading rating domain", () => {
  assert.deepEqual(ratingDomain([point("2026-01-01T00:00:00.000Z", 26.9)]), [26.5, 27.3]);
});
