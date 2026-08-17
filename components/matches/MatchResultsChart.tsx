"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthlyResults, type MonthlyResult } from "@/lib/wtn/match-utils";
import type { NormalizedMatch } from "@/lib/wtn/types";
import { ChartEntrance, useReducedMotion } from "@/components/ui/Motion";

const monthFormatter = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "numeric", timeZone: "UTC" });
const shortMonthFormatter = new Intl.DateTimeFormat("en-NZ", { month: "short", timeZone: "UTC" });
const monthDate = (month: string) => new Date(`${month}-01T00:00:00.000Z`);

function ResultsTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: MonthlyResult }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="rating-tooltip results-tooltip" role="status">
    <strong>{monthFormatter.format(monthDate(point.month))}</strong>
    <div className="tooltip-row"><span>Wins</span><b>{point.wins}</b></div>
    <div className="tooltip-row"><span>Losses</span><b>{point.losses}</b></div>
    <div className="tooltip-row"><span>Win rate</span><b>{Math.round(point.winRate * 100)}%</b></div>
    <div className="tooltip-row"><span>Matches</span><b>{point.total}</b></div>
  </div>;
}

export function MatchResultsChart({ matches }: { matches: NormalizedMatch[] }) {
  const reducedMotion = useReducedMotion();
  const data = useMemo(() => monthlyResults(matches), [matches]);
  if (matches.filter((match) => match.date && match.result !== "unknown").length < 3 || data.length < 2) return null;
  return <section className="results-chart-panel" aria-label="Filtered results over time">
    <header><h3>Wins and losses over time</h3></header>
    <div className="results-chart-frame">
      <ChartEntrance><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
        <BarChart data={data} accessibilityLayer margin={{ top: 10, right: 6, bottom: 0, left: -24 }} barCategoryGap="32%">
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 7" />
          <XAxis dataKey="month" tickFormatter={(value) => shortMonthFormatter.format(monthDate(value))} minTickGap={32} tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
          <Tooltip content={(props) => <ResultsTooltip active={props.active} payload={props.payload as Array<{ payload?: MonthlyResult }>} />} isAnimationActive={!reducedMotion} allowEscapeViewBox={{ x: false, y: false }} cursor={{ fill: "var(--color-surface-subtle)" }} />
          <Bar dataKey="wins" name="Wins" stackId="result" fill="var(--color-chart-primary)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={520} />
          <Bar dataKey="losses" name="Losses" stackId="result" fill="var(--color-chart-neutral)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={520} />
        </BarChart>
      </ResponsiveContainer></ChartEntrance>
    </div>
  </section>;
}
