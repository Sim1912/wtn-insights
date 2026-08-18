"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateAnalytics, SIMILAR_WTN_BAND } from "@/lib/analytics/calculate";
import { currentStreakText } from "@/lib/analytics/format";
import { filterAnalyticsMatches } from "@/lib/analytics/trends";
import type { AnalyticsMatchType, AnalyticsPeriod, MetricResult, RecordResult, TrendPoint } from "@/lib/analytics/types";
import { requestPlayer } from "@/lib/wtn/client";
import { averageOpponentWtn } from "@/lib/wtn/match-utils";
import { renderScore } from "@/lib/wtn/score";
import type { NormalizedMatch, WtnApiResponse } from "@/lib/wtn/types";
import { MainNavigation, PlayerContext } from "@/components/shell/AppChrome";
import { AnimatedNumber, ChartEntrance, RevealScope, useReducedMotion } from "@/components/ui/Motion";

const DEFAULT_TENNIS_ID = "MAU8054205";
const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "2-digit", timeZone: "UTC" });
const periods: Array<[AnalyticsPeriod, string]> = [["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"], ["all", "All"], ["custom", "Custom"]];
const initialTennisId = () => typeof window === "undefined" ? DEFAULT_TENNIS_ID : new URLSearchParams(window.location.search).get("tennisId")?.trim().toUpperCase() || DEFAULT_TENNIS_ID;

type ExplorerState = { title: string; ids: string[]; reason: (match: NormalizedMatch) => string } | null;
type TrendMetric = "winRate" | "setsWonRate" | "gamesWonRate" | "rolling5WinRate" | "rolling10WinRate" | "matches" | "averageOpponentWtn";

const pct = (value: number | null) => value == null ? "—" : `${Math.round(value * 100)}%`;
const decimal = (value: number | null) => value == null ? "—" : value.toFixed(1);
const recordText = (result: RecordResult) => result.denominator ? `${result.wins}–${result.losses}` : "No eligible matches";
const opponentNames = (match: NormalizedMatch) => match.opponents.map((opponent) => opponent.name).join(" / ") || "Unknown opponent";
const matchCount = (count: number) => `${count} ${count === 1 ? "match" : "matches"}`;

function Metric({ label, display, result, supporting, className = "", animate = false, onExplore }: { label: string; display: string; result: MetricResult; definition: string; supporting?: string; className?: string; animate?: boolean; onExplore: () => void }) {
  const hasEvidence = result.eligibleMatchIds.length > 0;
  return <button type="button" className={`analytics-metric ${className}`.trim()} onClick={hasEvidence ? onExplore : undefined} aria-disabled={!hasEvidence}>
    <span>{label}</span><strong>{animate && display.endsWith("%") && result.value != null ? <AnimatedNumber value={result.value * 100} decimals={0} suffix="%" /> : display}</strong>
    <small>{supporting ?? (result.denominator != null ? `${result.numerator ?? 0} of ${result.denominator}` : matchCount(result.sampleSize))}</small>
  </button>;
}

function RecordRow({ label, result, note, onExplore }: { label: string; result: RecordResult; note?: string; onExplore: () => void }) {
  return <button type="button" className="analytics-record-row" onClick={onExplore} disabled={!result.eligibleMatchIds.length}>
    <span><strong>{label}</strong>{note && <small>{note}</small>}</span>
    {result.denominator ? <><b>{recordText(result)}</b><em>{pct(result.value)}</em><i>{matchCount(result.denominator)}</i></> : <b className="record-empty">No eligible matches</b>}
  </button>;
}

function AnalyticsSectionHeading({ id, children }: { id: string; children: string }) {
  return <div className="analytics-section-heading"><h2 id={id}>{children}</h2></div>;
}

function TrendTooltip({ active, payload, metric }: { active?: boolean; payload?: Array<{ payload?: TrendPoint }>; metric: TrendMetric }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const labels: Record<TrendMetric, string> = { winRate: "Win rate", setsWonRate: "Sets won", gamesWonRate: "Games won", rolling5WinRate: "Rolling last 5", rolling10WinRate: "Rolling last 10", matches: "Matches played", averageOpponentWtn: "Average opponent WTN" };
  const numerator = metric === "winRate" ? point.wins : metric === "setsWonRate" ? point.setsWon : metric === "gamesWonRate" ? point.gamesWon : metric === "rolling5WinRate" ? point.rolling5Wins : metric === "rolling10WinRate" ? point.rolling10Wins : null;
  const denominator = metric === "winRate" ? point.matches : metric === "setsWonRate" ? point.setsWon + point.setsLost : metric === "gamesWonRate" ? point.gamesWon + point.gamesLost : metric === "rolling5WinRate" ? point.rolling5Sample : metric === "rolling10WinRate" ? point.rolling10Sample : null;
  const displayed = metric === "matches" ? String(point.matches) : metric === "averageOpponentWtn" ? point.averageOpponentWtn?.toFixed(2) ?? "—" : pct(point[metric]);
  return <div className="rating-tooltip analytics-tooltip" role="status"><strong>{monthFormatter.format(new Date(`${point.month}-01T00:00:00Z`))}</strong><div className="tooltip-primary"><span>{labels[metric]}</span><strong>{displayed}</strong></div>{numerator != null && denominator != null && <div className="tooltip-row"><span>Record</span><b>{numerator} of {denominator}</b></div>}<div className="tooltip-row"><span>Matches this month</span><b>{point.matches}</b></div></div>;
}

function EvidenceExplorer({ state, matches, onClose }: { state: ExplorerState; matches: NormalizedMatch[]; onClose: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!state) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layerNode = layer.current;
    const siblings = layerNode?.parentElement
      ? [...layerNode.parentElement.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== layerNode)
      : [];
    const siblingState = siblings.map((node) => ({ node, inert: node.inert, ariaHidden: node.getAttribute("aria-hidden") }));
    for (const sibling of siblings) { sibling.inert = true; sibling.setAttribute("aria-hidden", "true"); }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) { event.preventDefault(); closeButton.current?.focus(); return; }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || !drawer.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !drawer.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const previous of siblingState) {
        previous.node.inert = previous.inert;
        if (previous.ariaHidden == null) previous.node.removeAttribute("aria-hidden"); else previous.node.setAttribute("aria-hidden", previous.ariaHidden);
      }
      returnFocus.current?.focus();
      returnFocus.current = null;
    };
  }, [state, onClose]);
  if (!state) return null;
  const selected = state.ids.flatMap((id) => { const match = matches.find((entry) => entry.id === id); return match ? [match] : []; });
  return <div ref={layer} className="analytics-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside ref={drawer} className="analytics-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title" aria-describedby="evidence-count">
      <header><div><small>EVIDENCE</small><h2 id="evidence-title">{state.title}</h2></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Close match explorer">×</button></header>
      <p className="drawer-count" id="evidence-count">{selected.length} contributing {selected.length === 1 ? "match" : "matches"}</p>
      <div className="evidence-list">{selected.map((match) => <article key={match.id}>
        <div><span className={`evidence-result ${match.result}`}>{match.result === "win" ? "Win" : "Loss"}</span><time>{match.date ? dateFormatter.format(new Date(match.date)) : "Date unavailable"}</time></div>
        <h3>{opponentNames(match)}</h3>
        <strong className="evidence-score">{renderScore(match.sets, match.playerSide, match.status, match.scoreText)}</strong>
        <p>{match.tournament ?? "Tournament unavailable"}{averageOpponentWtn(match) != null ? ` · Opponent WTN ${averageOpponentWtn(match)!.toFixed(2)}` : ""}</p>
        <small>{state.reason(match)}</small>
      </article>)}</div>
    </aside>
  </div>;
}

export function AnalyticsPage() {
  const [data, setData] = useState<WtnApiResponse | null>(null);
  const [playerId, setPlayerId] = useState(initialTennisId);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [message, setMessage] = useState("Loading analytics…");
  const [matchType, setMatchType] = useState<AnalyticsMatchType>("all");
  const [period, setPeriod] = useState<AnalyticsPeriod>("1y");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("winRate");
  const [explorer, setExplorer] = useState<ExplorerState>(null);
  const reducedMotion = useReducedMotion();
  const closeExplorer = useCallback(() => setExplorer(null), []);

  async function load(tennisId: string, signal?: AbortSignal) {
    setStatus("loading"); setMessage(data ? "Refreshing analytics…" : "Loading analytics…");
    try {
      const response = await requestPlayer(tennisId, signal);
      setData(response); setPlayerId(response.player.id); setStatus("live"); setMessage("");
      window.history.replaceState(null, "", `/analytics?tennisId=${encodeURIComponent(response.player.id)}`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatus("error"); setMessage(error instanceof Error ? error.message : "Unable to load analytics.");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const requestedId = new URLSearchParams(window.location.search).get("tennisId")?.trim().toUpperCase() || DEFAULT_TENNIS_ID;
    void (async () => {
      try {
        const response = await requestPlayer(requestedId, controller.signal);
        setData(response); setPlayerId(response.player.id); setStatus("live"); setMessage("");
        window.history.replaceState(null, "", `/analytics?tennisId=${encodeURIComponent(response.player.id)}`);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("error"); setMessage(error instanceof Error ? error.message : "Unable to load analytics.");
      }
    })();
    return () => controller.abort();
  // Initial direct-route load only.
  }, []);

  const filtered = useMemo(() => filterAnalyticsMatches(data?.matches ?? [], matchType, period, dateFrom, dateTo), [data, matchType, period, dateFrom, dateTo]);
  const report = useMemo(() => calculateAnalytics(filtered), [filtered]);
  const allMatches = data?.matches ?? [];
  const explore = (title: string, result: MetricResult, reason: (match: NormalizedMatch) => string) => setExplorer({ title, ids: result.eligibleMatchIds, reason });
  const competitiveReason = (match: NormalizedMatch) => `Official ${match.result} · completed match with a known winner`;
  const trendLabel: Record<TrendMetric, string> = { winRate: "Win rate", setsWonRate: "Sets won", gamesWonRate: "Games won", rolling5WinRate: "Rolling last 5", rolling10WinRate: "Rolling last 10", matches: "Matches played", averageOpponentWtn: "Opponent WTN" };
  const trendColor: Record<TrendMetric, string> = { winRate: "var(--color-chart-primary)", setsWonRate: "var(--color-chart-secondary)", gamesWonRate: "var(--color-warning)", rolling5WinRate: "var(--color-positive)", rolling10WinRate: "var(--color-chart-secondary)", matches: "var(--color-chart-neutral)", averageOpponentWtn: "var(--color-text-secondary)" };
  const hasTrendValues = report.trends.some((point) => trendMetric === "matches" || point[trendMetric] != null);
  const ratingBandSample = report.ratingBands.reduce((total, band) => total + band.wins + band.losses, 0);

  function submit(event: FormEvent) { event.preventDefault(); void load(playerId); }

  return <main className={status === "loading" && data ? "is-refreshing analytics-page" : "analytics-page"} aria-busy={status === "loading"}>
    <MainNavigation current="analytics" playerId={playerId} loading={status === "loading"} onPlayerIdChange={setPlayerId} onSubmit={submit} />
    <PlayerContext player={data?.player} fallbackId={playerId} updatedAt={data?.ratings.updatedAt} />

    {status !== "live" && <div className={`status-banner ${status} shell`} role="status"><span />{message}{status === "error" && data && <small>Previous analytics remain visible.</small>}</div>}
    {!data && status === "error" ? <section className="load-error shell"><strong>Analytics could not be loaded.</strong><p>{message}</p><button type="button" onClick={() => void load(playerId)}>Try again</button></section> : !data ? <div className="analytics-loading shell"><i /><i /><i /></div> : <RevealScope className="analytics-shell shell">
      <header className="analytics-title" data-reveal>
        <div><h2>Analytics</h2><p className="analytics-context-line">{filtered.length} selected · {report.matchRecord.sampleSize} eligible completed · {report.coverage.completeScore} score-complete</p></div>
      </header>

      <section className="analytics-filterbar" aria-label="Analytics filters">
        <div className="filter-segment" aria-label="Match type">{(["all", "singles", "doubles"] as const).map((type) => <button key={type} type="button" aria-pressed={matchType === type} className={matchType === type ? "active" : ""} onClick={() => { setMatchType(type); setExplorer(null); }}>{type === "all" ? "All" : type[0].toUpperCase() + type.slice(1)}</button>)}</div>
        <div className="analytics-periods" aria-label="Time period">{periods.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} className={period === value ? "active" : ""} onClick={() => { setPeriod(value); setExplorer(null); }}>{label}</button>)}</div>
        <strong>{filtered.length} selected</strong>
        {period === "custom" && <div className="analytics-dates"><label>From<input type="date" max={dateTo || undefined} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label>To<input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></div>}
      </section>

      <section className="analytics-overview" aria-labelledby="performance-title" data-reveal>
        <AnalyticsSectionHeading id="performance-title">Performance summary</AnalyticsSectionHeading>
        <div className="performance-summary">
          <div className="performance-primary">
            <Metric className="metric-record" label="Match record" display={recordText(report.matchRecord)} result={report.matchRecord} supporting={`${report.matchRecord.wins} wins from ${matchCount(report.matchRecord.sampleSize)}`} definition="Official completed results; walkovers, defaults, retirements and unfinished matches are excluded." onExplore={() => explore("Match record", report.matchRecord, competitiveReason)} />
            <Metric className="metric-win-rate" label="Win rate" display={pct(report.matchRecord.value)} result={report.matchRecord} supporting={`${report.matchRecord.sampleSize} eligible completed · ${filtered.length - report.matchRecord.sampleSize} excluded`} definition="Official wins divided by completed competitive matches." animate onExplore={() => explore("Win rate", report.matchRecord, competitiveReason)} />
          </div>
          <div className="performance-scoring" aria-label="Scoring comparison">
            <Metric label="Sets won" display={pct(report.sets.value)} result={report.sets} supporting={`${report.sets.wins} of ${report.sets.denominator ?? 0} sets · ${matchCount(report.sets.sampleSize)}`} definition="Completed normal sets won. Match tiebreaks are reported separately." onExplore={() => explore("Sets analysed", report.sets, () => "Complete normal-set score available")} />
            <Metric label="Games won" display={pct(report.games.value)} result={report.games} supporting={`${report.games.wins} of ${report.games.denominator ?? 0} games · ${matchCount(report.games.sampleSize)}`} definition="Games won across completed normal sets. Tiebreak points and match-tiebreak points are excluded." onExplore={() => explore("Games analysed", report.games, () => "Complete normal-game score available")} />
          </div>
          <article className="performance-trend">
            <header><div><h3>Form over time</h3><p>Discrete monthly results</p></div><select aria-label="Trend metric" value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as TrendMetric)}><option value="winRate">Win rate</option><option value="matches">Matches played</option><option value="setsWonRate">Sets won</option><option value="gamesWonRate">Games won</option><option value="rolling5WinRate">Rolling last 5</option><option value="rolling10WinRate">Rolling last 10</option><option value="averageOpponentWtn">Opponent WTN</option></select></header>
            <div className="performance-trend-frame">{report.trends.length > 1 && hasTrendValues ? <ChartEntrance><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={190}><LineChart data={report.trends} accessibilityLayer margin={{ top: 12, right: 14, bottom: 2, left: 0 }}><CartesianGrid vertical={false} stroke="rgba(251,249,241,.15)" strokeDasharray="3 7" /><XAxis dataKey="month" tickFormatter={(value) => monthFormatter.format(new Date(`${value}-01T00:00:00Z`))} tickLine={false} axisLine={false} minTickGap={35} tick={{ fill: "rgba(251,249,241,.65)", fontSize: 10 }} /><YAxis domain={trendMetric === "matches" ? [0, "dataMax + 1"] : trendMetric === "averageOpponentWtn" ? ["auto", "auto"] : [0, 1]} ticks={trendMetric === "matches" || trendMetric === "averageOpponentWtn" ? undefined : [0, .25, .5, .75, 1]} tickFormatter={(value) => trendMetric === "matches" ? String(value) : trendMetric === "averageOpponentWtn" ? Number(value).toFixed(1) : `${value * 100}%`} width={42} tickLine={false} axisLine={false} tick={{ fill: "rgba(251,249,241,.65)", fontSize: 10 }} /><Tooltip content={(props) => <TrendTooltip active={props.active} payload={props.payload as Array<{ payload?: TrendPoint }>} metric={trendMetric} />} isAnimationActive={!reducedMotion} /><Line dataKey={trendMetric} name={trendLabel[trendMetric]} type="linear" connectNulls stroke={trendColor[trendMetric]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--grass-800)" }} activeDot={{ r: 6 }} isAnimationActive={!reducedMotion} animationDuration={620} /></LineChart></ResponsiveContainer></ChartEntrance> : <p className="analytics-empty">{report.trends.length <= 1 ? "Not enough dated months." : `No eligible ${trendLabel[trendMetric].toLowerCase()} data.`}</p>}</div>
          </article>
          <div className="performance-secondary">
            <Metric label="Deciding sets" display={recordText(report.deciding)} result={report.deciding} supporting={`${matchCount(report.deciding.denominator ?? 0)} reached a decider`} definition="Final set or match tiebreak played with both teams one set from winning." onExplore={() => explore("Deciding-set matches", report.deciding, () => "Both teams were one set from winning before the final set")} />
            <Metric label="Against stronger opponents" display={recordText(report.strongerOpponents)} result={report.strongerOpponents} supporting={`${matchCount(report.strongerOpponents.denominator ?? 0)} with complete ratings`} definition={`Historical team-average WTN; opponent at least ${SIMILAR_WTN_BAND.toFixed(1)} lower (stronger).`} onExplore={() => explore("Against stronger-rated opponents", report.strongerOpponents, () => "Opponent entered at least 1.0 WTN stronger")} />
          </div>
          <div className="form-metric form-summary">
            <header><span>Current form</span><small>Most recent first</small></header>
            <div aria-label="Recent form, newest match first">{report.recentForm.length ? report.recentForm.map((result, index) => <b key={index} className={result} aria-label={result === "win" ? "Win" : "Loss"}>{result === "win" ? "W" : "L"}</b>) : "—"}</div>
            <p>{currentStreakText(report.currentStreak)}</p>
          </div>
          <div className="form-metric form-streak">
            <span>Current streak</span>
            <strong>{report.currentStreak ? `${report.currentStreak.count}${report.currentStreak.result === "win" ? "W" : "L"}` : "—"}</strong>
            <small>{report.currentStreak ? `${report.currentStreak.result === "win" ? "Winning" : "Losing"} sequence` : "No decided matches"}</small>
          </div>
        </div>
        {report.insights.length > 0 && <aside className="editorial-observations" aria-labelledby="observations-title">
          <header><h3 id="observations-title">Observations</h3><p>From the current selection</p></header>
          <div>{report.insights.map((insight, index) => <button type="button" className={index === 0 ? "observation-primary" : "observation-secondary"} key={insight.label} onClick={() => setExplorer({ title: insight.label, ids: insight.matchIds, reason: () => insight.evidenceReason })}>
            <span>{insight.label}</span><strong>{insight.text}</strong><small>{matchCount(insight.sampleSize)} in the sample <i>View evidence</i></small>
          </button>)}</div>
        </aside>}
      </section>

      <section className="analytics-section analytics-comebacks" aria-labelledby="comebacks-title" data-reveal>
        <AnalyticsSectionHeading id="comebacks-title">What happens after the opening sets</AnalyticsSectionHeading>
        <div className="comeback-layout">
          <article className="comeback-feature comeback-summary">
            <header><span>After losing Set 1</span>{report.comebackFirstSet.denominator ? <small>{matchCount(report.comebackFirstSet.denominator)}</small> : null}</header>
            {report.comebackFirstSet.denominator ? <>
              <div className="comeback-result"><strong>{recordText(report.comebackFirstSet)}</strong><div><b><AnimatedNumber value={(report.comebackFirstSet.value ?? 0) * 100} suffix="%" /> comeback rate</b><small>{report.comebackFirstSet.wins} comeback {report.comebackFirstSet.wins === 1 ? "win" : "wins"}</small></div></div>
              <div className="comeback-meter" role="img" aria-label={`${pct(report.comebackFirstSet.value)} comeback rate`}><i style={{ width: pct(report.comebackFirstSet.value) }} /></div>
              <button onClick={() => explore("After losing Set 1", report.comebackFirstSet, () => "Lost the first completed normal set")}>View {matchCount(report.comebackFirstSet.denominator)}</button>
            </> : <div className="comeback-empty"><strong>No eligible matches</strong><p>A completed first-set loss is required.</p></div>}
          </article>
          <div className="record-stack">
            <RecordRow label="After winning Set 1" result={report.afterWinningFirst} note="Lead protection" onExplore={() => explore("After winning Set 1", report.afterWinningFirst, () => "Won the first completed normal set")} />
            <RecordRow label="After splitting Sets 1–2" result={report.afterSplitFirstTwo} note="Won first, lost second" onExplore={() => explore("After splitting the first two sets", report.afterSplitFirstTwo, () => "Won Set 1, then lost Set 2")} />
            <RecordRow label="After trailing by one set" result={report.trailedOneSetWins} note="At any point" onExplore={() => explore("After trailing by one set", report.trailedOneSetWins, () => "Trailed by at least one completed set during the match")} />
            {report.comebackTwoSets.denominator || report.lostAfterTwoSetLead.denominator ? <>
              {report.comebackTwoSets.denominator ? <RecordRow label="After trailing 0–2" result={report.comebackTwoSets} note="Best-of-five only" onExplore={() => explore("After trailing by two sets", report.comebackTwoSets, () => "Trailed 0–2 in a best-of-five match")} /> : null}
              {report.lostAfterTwoSetLead.denominator ? <RecordRow label="After leading 2–0" result={report.lostAfterTwoSetLead} note="Best-of-five only" onExplore={() => explore("After leading by two sets", report.lostAfterTwoSetLead, () => "Led 2–0 in a best-of-five match")} /> : null}
            </> : <p className="bo5-empty-note"><strong>Best-of-five</strong><span>No eligible matches in this selection</span></p>}
          </div>
        </div>
        {report.bestComebacks.length > 0 && <div className="best-comebacks"><h3>Best comeback wins</h3>{report.bestComebacks.map(({ match, reason }) => <button key={match.id} onClick={() => setExplorer({ title: "Comeback win", ids: [match.id], reason: () => reason })}><span><b>{opponentNames(match)}</b><small>{match.tournament ?? "Tournament unavailable"}</small></span><strong>{renderScore(match.sets, match.playerSide, match.status, match.scoreText)}</strong></button>)}</div>}
        <details className="analytics-method"><summary>Comeback methodology</summary><p>A first-set comeback requires a lost first completed normal set and an official match win. A two-set comeback requires a best-of-five match and a 0–2 set deficit. Match tiebreaks may decide the match, but final scores cannot prove an in-set comeback.</p></details>
      </section>

      <section className="analytics-section analytics-scoring" aria-labelledby="scores-title" data-reveal>
        <AnalyticsSectionHeading id="scores-title">How matches are being won and lost</AnalyticsSectionHeading>
        <div className="score-analysis-grid">
          <div className="score-totals">
            <div><span>Sets</span><strong>{report.sets.wins}<i>–</i>{report.sets.losses}</strong><small>{pct(report.sets.value)} won</small></div>
            <div><span>Games</span><strong>{report.games.wins}<i>–</i>{report.games.losses}</strong><small>{pct(report.games.value)} won</small></div>
          </div>
          <dl className="average-table"><div><dt>Average sets won</dt><dd>{decimal(report.averageSetsWon.value)}</dd></div><div><dt>Average sets lost</dt><dd>{decimal(report.averageSetsLost.value)}</dd></div><div><dt>Average games won</dt><dd>{decimal(report.averageGamesWon.value)}</dd></div><div><dt>Average game difference</dt><dd>{report.averageGameDifference.value != null && report.averageGameDifference.value > 0 ? "+" : ""}{decimal(report.averageGameDifference.value)}</dd></div><div><dt>Average sets played</dt><dd>{decimal(report.averageSetsPlayed.value)}</dd></div><div><dt>Straight-set results</dt><dd>{report.straightSetWins.value ?? 0}W · {report.straightSetLosses.value ?? 0}L</dd></div></dl>
          <div className="pattern-list"><h3>Score patterns</h3>{report.patterns.slice(0, 6).map((pattern) => <button key={pattern.label} onClick={() => setExplorer({ title: pattern.label, ids: pattern.matchIds, reason: () => pattern.label })}><span>{pattern.label}</span><strong>{pattern.count}</strong></button>)}</div>
        </div>
      </section>

      <section className="analytics-section analytics-pressure" aria-labelledby="pressure-title" data-reveal>
        <AnalyticsSectionHeading id="pressure-title">Deciders and tiebreaks</AnalyticsSectionHeading>
        <div className="pressure-grid">
          <RecordRow label="Deciding normal sets" result={report.decidingNormal} onExplore={() => explore("Deciding normal sets", report.decidingNormal, () => "Final normal set with both teams one set from winning")} />
          <RecordRow label="Best-of-three deciders" result={report.decidingBestOfThree} onExplore={() => explore("Best-of-three deciding sets", report.decidingBestOfThree, () => "Third-set decider or equivalent short format")} />
          <RecordRow label="Best-of-five deciders" result={report.decidingBestOfFive} onExplore={() => explore("Best-of-five deciding sets", report.decidingBestOfFive, () => "Fifth-set decider in a best-of-five match")} />
          <RecordRow label="Match tiebreaks" result={report.matchTiebreaks} onExplore={() => explore("Match tiebreaks", report.matchTiebreaks, () => "Match included a match tiebreak; points excluded from game totals")} />
          <RecordRow label="Normal-set tiebreaks" result={report.normalTiebreaks} note="Set-level record" onExplore={() => explore("Normal-set tiebreaks", report.normalTiebreaks, () => "Match included at least one normal-set tiebreak")} />
          <RecordRow label="Final-set tiebreaks" result={report.finalSetTiebreaks} onExplore={() => explore("Final-set tiebreaks", report.finalSetTiebreaks, () => "Deciding normal set ended in a tiebreak")} />
          <RecordRow label="Close deciding matches" result={report.closeMatches} note="Transparent score rule" onExplore={() => explore("Close deciding matches", report.closeMatches, () => "Decider ended by tiebreak or with a two-game margin at 4 games or higher")} />
        </div>
        {report.averageMatchTiebreakDifference.value != null && <p className="pressure-note">Average match-tiebreak point difference <strong>{report.averageMatchTiebreakDifference.value > 0 ? "+" : ""}{report.averageMatchTiebreakDifference.value.toFixed(1)}</strong> across {report.averageMatchTiebreakDifference.denominator} match tiebreaks.</p>}
        <details className="analytics-method"><summary>Close-match definition</summary><p>A close match must reach a true deciding set. It qualifies when that decider is a normal tiebreak, a match tiebreak won by two points or fewer, or a normal set ending with a two-game margin at four games or higher (for example 6–4, 7–5 or 8–6).</p></details>
      </section>

      <section className="analytics-section analytics-context" aria-labelledby="opponents-title" data-reveal>
        <AnalyticsSectionHeading id="opponents-title">Results in context</AnalyticsSectionHeading>
        <div className="opponent-highlights">
          <div><span>Average opponent WTN</span><strong>{report.averageOpponentWtn.value?.toFixed(2) ?? "—"}</strong><small>{report.averageOpponentWtn.sampleSize ? `${matchCount(report.averageOpponentWtn.sampleSize)} with full ratings` : "No eligible rated matches"}</small></div>
          <div><span>Strongest opponent beaten</span><strong>{report.strongestOpponentBeaten?.name ?? "—"}</strong><small>{report.strongestOpponentBeaten ? `WTN ${report.strongestOpponentBeaten.wtn.toFixed(2)}` : report.averageOpponentWtn.sampleSize ? "No rated win in this selection" : "No eligible rated matches"}</small></div>
          <div><span>Upset wins</span><strong>{report.strongerOpponents.denominator ? report.upsetWins.value ?? 0 : "—"}</strong><small>{report.strongerOpponents.denominator ? `${report.upsetWins.value ?? 0} of ${report.strongerOpponents.denominator} vs stronger opponents` : "No stronger-opponent matches"}</small></div>
          <div><span>Losses as favourite</span><strong>{report.weakerOpponents.denominator ? report.favouriteLosses.value ?? 0 : "—"}</strong><small>{report.weakerOpponents.denominator ? `${report.favouriteLosses.value ?? 0} of ${report.weakerOpponents.denominator} as stronger player` : "No weaker-opponent matches"}</small></div>
        </div>
        <div className="analytics-charts contextual-chart">
          <article className="rating-band-panel"><header><h3>Results by rating difference</h3><p>Historical team-average WTN</p></header><div className="analytics-chart-frame">{ratingBandSample ? <ChartEntrance><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}><BarChart data={report.ratingBands} layout="vertical" accessibilityLayer margin={{ top: 4, right: 8, bottom: 4, left: 12 }}><CartesianGrid horizontal={false} stroke="var(--line-soft)" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} /><YAxis type="category" dataKey="label" width={128} tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-primary)", fontSize: 9 }} /><Tooltip cursor={{ fill: "var(--color-surface-subtle)" }} /><Bar dataKey="wins" name="Wins" stackId="record" fill="var(--color-chart-primary)" radius={[3, 0, 0, 3]} isAnimationActive={!reducedMotion} animationDuration={520} /><Bar dataKey="losses" name="Losses" stackId="record" fill="var(--color-chart-neutral)" radius={[0, 3, 3, 0]} isAnimationActive={!reducedMotion} animationDuration={520} /></BarChart></ResponsiveContainer></ChartEntrance> : <p className="analytics-empty">No completed matches with full pre-match ratings.</p>}</div></article>
        </div>
        {report.partners.length > 1 && <div className="partner-table"><h3>Doubles partners</h3>{report.partners.slice(0, 6).map((partner) => <button key={partner.name} onClick={() => setExplorer({ title: `With ${partner.name}`, ids: partner.matchIds, reason: () => `Doubles match with ${partner.name}` })}><span>{partner.name}</span><strong>{partner.wins}–{partner.losses}</strong><small>{partner.matchIds.length} matches</small></button>)}</div>}
        <details className="analytics-method"><summary>Data availability and definitions</summary><p>Known winners: {report.coverage.knownWinner}/{report.coverage.total}. Complete scores: {report.coverage.completeScore}. Usable normal-game data: {report.coverage.usableGames}. Historical WTN comparison: {report.coverage.preMatchWtn}. Tournament: {report.coverage.tournament}. Surface: {report.coverage.surface}. Similar opponents are within {SIMILAR_WTN_BAND.toFixed(1)} WTN. Lower WTN means stronger. Doubles comparisons use both team averages and are omitted unless all four ratings exist.</p></details>
      </section>
    </RevealScope>}
    <EvidenceExplorer state={explorer} matches={allMatches} onClose={closeExplorer} />
  </main>;
}
