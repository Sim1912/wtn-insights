"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthlyResults, type MonthlyResult } from "@/lib/wtn/match-utils";
import type { NormalizedMatch } from "@/lib/wtn/types";
import { useReducedMotion } from "@/components/ui/Motion";

const monthFormatter = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "numeric", timeZone: "UTC" });
const shortMonthFormatter = new Intl.DateTimeFormat("en-NZ", { month: "short", timeZone: "UTC" });
const shortMonthYearFormatter = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "2-digit", timeZone: "UTC" });
const monthDate = (month: string) => new Date(`${month}-01T00:00:00.000Z`);

function ResultsTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: MonthlyResult }> }) {
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
  const spansYears = new Set(data.map((point) => point.month.slice(0, 4))).size > 1;
  const range = `${monthFormatter.format(monthDate(data[0].month))}–${monthFormatter.format(monthDate(data[data.length - 1].month))}`;

  return <details className="match-trends">
    <summary className="match-trends-toggle">
      <span><strong>Results over time</strong><small>{range}</small></span>
      <span className="match-trends-action">Recorded wins and losses <b aria-hidden="true">▾</b></span>
    </summary>
    <section className="results-chart-panel" aria-label={`Filtered wins and losses from ${range}`}>
      <header>
        <div><h3>Wins and losses over time</h3><p>Oldest to newest</p></div>
        <div className="results-legend" role="list" aria-label="Chart legend">
          <span role="listitem"><i className="wins" aria-hidden="true" />Wins</span>
          <span role="listitem"><i className="losses" aria-hidden="true" />Losses</span>
        </div>
      </header>
      <div className="results-chart-frame">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={148}>
          <BarChart data={data} accessibilityLayer margin={{ top: 8, right: 6, bottom: 0, left: -24 }} barCategoryGap="38%" barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--line-soft)" strokeDasharray="3 7" />
            <XAxis dataKey="month" tickFormatter={(value) => (spansYears ? shortMonthYearFormatter : shortMonthFormatter).format(monthDate(value))} minTickGap={28} tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
            <Tooltip content={(props) => <ResultsTooltip active={props.active} payload={props.payload as unknown as ReadonlyArray<{ payload?: MonthlyResult }>} />} isAnimationActive={!reducedMotion} allowEscapeViewBox={{ x: false, y: false }} cursor={{ fill: "var(--color-surface-subtle)" }} />
            <Bar dataKey="wins" name="Wins" fill="var(--color-chart-primary)" radius={[3, 3, 0, 0]} maxBarSize={13} isAnimationActive={false} />
            <Bar dataKey="losses" name="Losses" fill="var(--color-chart-loss)" radius={[3, 3, 0, 0]} maxBarSize={13} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  </details>;
}
