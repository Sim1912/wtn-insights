"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthlyResults, type MonthlyResult } from "@/lib/wtn/match-utils";
import type { NormalizedMatch } from "@/lib/wtn/types";

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
  const data = useMemo(() => monthlyResults(matches), [matches]);
  if (matches.filter((match) => match.date && match.result !== "unknown").length < 3 || data.length < 2) return null;
  return <section className="results-chart-panel" aria-label="Filtered results over time">
    <header><div><p className="eyebrow">FILTERED FORM</p><h3>Wins and losses over time</h3></div><span>{matches.length} matching</span></header>
    <div className="results-chart-frame">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
        <BarChart data={data} accessibilityLayer margin={{ top: 10, right: 6, bottom: 0, left: -24 }} barCategoryGap="32%">
          <CartesianGrid vertical={false} stroke="#e2e6dd" strokeDasharray="3 7" />
          <XAxis dataKey="month" tickFormatter={(value) => shortMonthFormatter.format(monthDate(value))} minTickGap={32} tickLine={false} axisLine={false} tick={{ fill: "#626b5e", fontSize: 10 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#626b5e", fontSize: 10 }} />
          <Tooltip content={(props) => <ResultsTooltip active={props.active} payload={props.payload as Array<{ payload?: MonthlyResult }>} />} isAnimationActive="auto" allowEscapeViewBox={{ x: false, y: false }} cursor={{ fill: "#eef0e9" }} />
          <Bar dataKey="wins" name="Wins" stackId="result" fill="#b7dc22" radius={[4, 4, 0, 0]} isAnimationActive="auto" animationDuration={180} />
          <Bar dataKey="losses" name="Losses" stackId="result" fill="#555d51" radius={[4, 4, 0, 0]} isAnimationActive="auto" animationDuration={180} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </section>;
}
