"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { filterRatingPeriod, ratingDomain, type ChartRatingPoint, type RatingPeriod } from "@/lib/wtn/rating-utils";
import type { RatingPoint } from "@/lib/wtn/types";
import { useReducedMotion } from "@/components/ui/Motion";

type Series = "singles" | "doubles";
type TooltipEntry = { payload?: ChartRatingPoint };

const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const axisDateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short" });
const periodLabels: Array<[RatingPeriod, string]> = [["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"], ["all", "All"]];

function formatChange(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatDirectionalChange(value: number) {
  if (value === 0) return "0.00 · unchanged";
  return `${formatChange(value)} · ${value < 0 ? "stronger" : "weaker"}`;
}

function RatingTooltip({ active, payload, series }: { active?: boolean; payload?: ReadonlyArray<TooltipEntry>; series: Series }) {
  const point = payload?.find((entry) => entry.payload && !entry.payload.isGap)?.payload;
  if (!active || !point || point.value == null) return null;
  const rows = [
    ["Change", point.change == null ? null : formatDirectionalChange(point.change)],
    ["Previous", point.previous == null ? null : point.previous.toFixed(2)],
    ["Confidence", point.confidence == null ? null : `${point.confidence}%`],
    ["Game zone", point.gameZoneLower == null || point.gameZoneUpper == null ? null : [point.gameZoneLower, point.gameZoneUpper].sort((a, b) => a - b).map((value) => value.toFixed(2)).join("–")],
    ["Connected matches", point.connectedMatches == null ? null : String(point.connectedMatches)],
  ].filter((row): row is [string, string] => row[1] != null);
  return <div className="rating-tooltip" role="status">
    <time dateTime={point.date}>{dateFormatter.format(new Date(point.date))}</time>
    <div className="tooltip-primary"><span>{series === "singles" ? "Singles" : "Doubles"} WTN</span><strong>{point.value.toFixed(2)}</strong></div>
    {rows.map(([label, value]) => <div className="tooltip-row" key={label}><span>{label}</span><b>{value}</b></div>)}
  </div>;
}

function RatingDot(props: { cx?: number; cy?: number; payload?: ChartRatingPoint; latestDate: string; color: string }) {
  const { cx, cy, payload, latestDate, color } = props;
  if (cx == null || cy == null || !payload || payload.isGap || payload.value == null) return <g />;
  const latest = payload.date === latestDate;
  return <g className={latest ? "rating-dot latest" : "rating-dot"}>
    {latest && <circle cx={cx} cy={cy} r="8" fill={color} opacity=".18" />}
    <circle cx={cx} cy={cy} r={latest ? 4.5 : 3} fill={color} stroke="var(--chart-dot-ring)" strokeWidth="2" />
  </g>;
}

export function RatingChart({
  history,
  series,
  onSeriesChange,
}: {
  history: { singles: RatingPoint[]; doubles: RatingPoint[] };
  series: Series;
  onSeriesChange: (series: Series) => void;
}) {
  const [period, setPeriod] = useState<RatingPeriod>("1y");
  const reducedMotion = useReducedMotion();
  const seriesPoints = history[series];
  const visiblePoints = useMemo(() => filterRatingPeriod(seriesPoints, period), [seriesPoints, period]);
  const chartPoints = useMemo(
    () => visiblePoints.map((point) => ({ ...point, timestamp: new Date(point.date).getTime() })),
    [visiblePoints],
  );
  const domain = useMemo(() => ratingDomain(visiblePoints), [visiblePoints]);
  const trend = visiblePoints.length > 1 ? visiblePoints.at(-1)!.value - visiblePoints[0].value : null;
  const color = "var(--chart-line-on-court)";
  const latestDate = visiblePoints.at(-1)?.date ?? "";

  return <section className="rating-panel" id="rating-history-chart" aria-label="Interactive rating history">
    <header className="rating-chart-header">
      <div><h2>WTN history</h2><p>Lower WTN is stronger · latest update highlighted</p></div>
      <div className="chart-trend"><span>Period change</span><strong className={trend == null ? "" : trend <= 0 ? "positive" : "negative"}>{trend == null ? "—" : formatDirectionalChange(trend)}</strong></div>
    </header>
    <div className="chart-controls">
      <div className="series-switch" role="group" aria-label="Rating type">
        {(["singles", "doubles"] as const).map((value) => <button type="button" key={value} aria-pressed={series === value} aria-controls="rating-history-chart" className={series === value ? "active" : ""} onClick={() => onSeriesChange(value)}>{value === "singles" ? "Singles" : "Doubles"}</button>)}
      </div>
      <div className="period-switch" role="group" aria-label="Rating period">
        {periodLabels.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{label}</button>)}
      </div>
    </div>
    <div className="chart-frame">
      {visiblePoints.length ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <LineChart data={chartPoints} accessibilityLayer margin={{ top: 20, right: 18, bottom: 3, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rating-chart-grid-on-court)" strokeDasharray="3 7" />
          <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={(value) => axisDateFormatter.format(new Date(value))} tickLine={false} axisLine={false} minTickGap={52} tick={{ fill: "var(--rating-chart-axis-on-court)", fontSize: 11 }} dy={9} />
          <YAxis reversed domain={domain} width={46} tickCount={5} tickFormatter={(value: number) => value.toFixed(1)} tickLine={false} axisLine={false} tick={{ fill: "var(--rating-chart-axis-on-court)", fontSize: 11 }} />
          <Tooltip content={(props) => <RatingTooltip active={props.active} payload={props.payload as ReadonlyArray<TooltipEntry>} series={series} />} isAnimationActive={!reducedMotion} allowEscapeViewBox={{ x: false, y: false }} reverseDirection={{ x: true, y: false }} cursor={{ stroke: "var(--chart-cursor-on-court)", strokeDasharray: "3 4" }} />
          <Line name={`${series} WTN`} dataKey="value" type="linear" stroke={color} strokeWidth={3} connectNulls isAnimationActive={false} dot={(props) => <RatingDot {...props} latestDate={latestDate} color={color} />} activeDot={{ r: 6, stroke: "var(--chart-active-dot-ring)", strokeWidth: 2, fill: color }} />
        </LineChart>
      </ResponsiveContainer> : <div className="chart-empty">No rating updates in this period.</div>}
    </div>
  </section>;
}
