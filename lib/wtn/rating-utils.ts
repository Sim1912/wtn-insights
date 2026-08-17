import type { RatingPoint } from "./types";

export type RatingPeriod = "1m" | "3m" | "6m" | "1y" | "all";

const PERIOD_MONTHS: Record<Exclude<RatingPeriod, "all">, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1y": 12,
};

export function filterRatingPeriod(points: RatingPoint[], period: RatingPeriod): RatingPoint[] {
  if (period === "all" || !points.length) return points;
  const latest = new Date(points.at(-1)!.date);
  const cutoff = new Date(latest);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - PERIOD_MONTHS[period]);
  return points.filter((point) => new Date(point.date) >= cutoff);
}

export type ChartRatingPoint = Omit<RatingPoint, "value"> & { value: number | null; timestamp: number; isGap?: boolean };

export function ratingDomain(points: RatingPoint[]): [number, number] {
  if (!points.length) return [0, 1];
  const values = points.map((point) => point.value);
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.14, 0.25);
  minimum = Math.floor((minimum - padding) * 10) / 10;
  maximum = Math.ceil((maximum + padding) * 10) / 10;
  if (maximum - minimum < 0.8) {
    const midpoint = (maximum + minimum) / 2;
    minimum = Math.floor((midpoint - 0.4) * 10) / 10;
    maximum = Math.ceil((midpoint + 0.4) * 10) / 10;
  }
  return [minimum, maximum];
}
