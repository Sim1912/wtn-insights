"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateAnalytics, SIMILAR_WTN_BAND } from "@/lib/analytics/calculate";
import { filterAnalyticsMatches } from "@/lib/analytics/trends";
import type { AnalyticsMatchType, AnalyticsPeriod, MetricResult, RecordResult, TrendPoint } from "@/lib/analytics/types";
import { requestPlayer } from "@/lib/wtn/client";
import { averageOpponentWtn } from "@/lib/wtn/match-utils";
import { renderScore } from "@/lib/wtn/score";
import type { NormalizedMatch, WtnApiResponse } from "@/lib/wtn/types";

const DEFAULT_TENNIS_ID = "MAU8054205";
const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "2-digit", timeZone: "UTC" });
const periods: Array<[AnalyticsPeriod, string]> = [["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"], ["all", "All"], ["custom", "Custom"]];
const initialTennisId = () => typeof window === "undefined" ? DEFAULT_TENNIS_ID : new URLSearchParams(window.location.search).get("tennisId")?.trim().toUpperCase() || DEFAULT_TENNIS_ID;

type ExplorerState = { title: string; ids: string[]; reason: (match: NormalizedMatch) => string } | null;
type TrendMetric = "winRate" | "setsWonRate" | "gamesWonRate" | "rolling5WinRate" | "rolling10WinRate" | "matches" | "averageOpponentWtn";

const pct = (value: number | null) => value == null ? "—" : `${Math.round(value * 100)}%`;
const decimal = (value: number | null) => value == null ? "—" : value.toFixed(1);
const recordText = (result: RecordResult) => result.denominator ? `${result.wins}–${result.losses}` : "No opportunities";
const opponentNames = (match: NormalizedMatch) => match.opponents.map((opponent) => opponent.name).join(" / ") || "Unknown opponent";

function Metric({ label, display, result, definition, onExplore }: { label: string; display: string; result: MetricResult; definition: string; onExplore: () => void }) {
  return <button type="button" className="analytics-metric" onClick={onExplore} disabled={!result.eligibleMatchIds.length}>
    <span>{label}</span><strong>{display}</strong>
    <small>{result.denominator != null ? `${result.numerator ?? 0} of ${result.denominator}` : `${result.sampleSize} matches`}</small>
    <i role="tooltip">{definition}<b>{result.excludedMatches ? ` · ${result.excludedMatches} excluded` : ""}</b></i>
  </button>;
}

function RecordRow({ label, result, note, onExplore }: { label: string; result: RecordResult; note?: string; onExplore: () => void }) {
  return <button type="button" className="analytics-record-row" onClick={onExplore} disabled={!result.eligibleMatchIds.length}>
    <span><strong>{label}</strong>{note && <small>{note}</small>}</span>
    <b>{recordText(result)}</b><em>{pct(result.value)}</em><i>{result.denominator ?? 0} matches</i>
  </button>;
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
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!state) return;
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [state, onClose]);
  if (!state) return null;
  const selected = state.ids.flatMap((id) => { const match = matches.find((entry) => entry.id === id); return match ? [match] : []; });
  return <div className="analytics-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="analytics-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
      <header><div><small>EVIDENCE</small><h2 id="evidence-title">{state.title}</h2></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Close match explorer">×</button></header>
      <p className="drawer-count">{selected.length} contributing {selected.length === 1 ? "match" : "matches"}</p>
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
  const trendColor: Record<TrendMetric, string> = { winRate: "#b7dc22", setsWonRate: "#6e91d9", gamesWonRate: "#ca765e", rolling5WinRate: "#8aa93a", rolling10WinRate: "#466a9d", matches: "#555d51", averageOpponentWtn: "#7d6b9a" };

  function submit(event: FormEvent) { event.preventDefault(); void load(playerId); }

  return <main className={status === "loading" && data ? "is-refreshing analytics-page" : "analytics-page"} aria-busy={status === "loading"}>
    <nav>
      <a className="brand" href={`/?tennisId=${encodeURIComponent(playerId)}`} aria-label="WTN Insights home"><span>W</span> WTN Insights</a>
      <div className="navlinks" aria-label="Dashboard sections">
        <a href={`/?tennisId=${encodeURIComponent(playerId)}`}>Overview</a>
        <a href={`/matches?tennisId=${encodeURIComponent(playerId)}`}>Matches</a>
        <a className="active" aria-current="page" href={`/analytics?tennisId=${encodeURIComponent(playerId)}`}>Analytics</a>
      </div>
    </nav>

    <section className="player-bar shell" id="top">
      <div className="player-identity"><p>{data?.player.country ?? "WTN player"}</p><h1>{data?.player.name ?? <span className="identity-skeleton" />}</h1><small>{data?.player.id ?? playerId}</small></div>
      <form onSubmit={submit} className="player-search"><label className="sr-only" htmlFor="analytics-pid">Load another Tennis ID</label><input id="analytics-pid" value={playerId} onChange={(event) => setPlayerId(event.target.value)} placeholder="Tennis ID" autoCapitalize="characters" /><button disabled={status === "loading"}>{status === "loading" ? "Loading" : "Load"}</button></form>
    </section>

    {status !== "live" && <div className={`status-banner ${status} shell`} role="status"><span />{message}{status === "error" && data && <small>Previous analytics remain visible.</small>}</div>}
    {!data && status === "error" ? <section className="load-error shell"><strong>Analytics could not be loaded.</strong><p>{message}</p><button type="button" onClick={() => void load(playerId)}>Try again</button></section> : !data ? <div className="analytics-loading shell"><i /><i /><i /></div> : <div className="analytics-shell shell">
      <header className="analytics-title"><div><p className="eyebrow">ANALYTICS</p><h2>Performance, under the score</h2></div><p>Based on {report.matchRecord.sampleSize} completed matches · Complete scores for {report.coverage.completeScore}</p></header>

      <section className="analytics-filterbar" aria-label="Analytics filters">
        <div className="filter-segment" aria-label="Match type">{(["all", "singles", "doubles"] as const).map((type) => <button key={type} type="button" aria-pressed={matchType === type} className={matchType === type ? "active" : ""} onClick={() => { setMatchType(type); setExplorer(null); }}>{type === "all" ? "All" : type[0].toUpperCase() + type.slice(1)}</button>)}</div>
        <div className="analytics-periods" aria-label="Time period">{periods.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} className={period === value ? "active" : ""} onClick={() => { setPeriod(value); setExplorer(null); }}>{label}</button>)}</div>
        <strong>{filtered.length} matches</strong>
        {period === "custom" && <div className="analytics-dates"><label>From<input type="date" max={dateTo || undefined} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label>To<input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></div>}
      </section>

      <section className="analytics-overview" aria-labelledby="performance-title">
        <div className="analytics-section-heading"><span>01</span><div><p>PERFORMANCE OVERVIEW</p><h2 id="performance-title">The competitive picture</h2></div></div>
        <div className="headline-metrics">
          <Metric label="Match record" display={recordText(report.matchRecord)} result={report.matchRecord} definition="Official completed results; walkovers, defaults, retirements and unfinished matches are excluded." onExplore={() => explore("Match record", report.matchRecord, competitiveReason)} />
          <Metric label="Win rate" display={pct(report.matchRecord.value)} result={report.matchRecord} definition="Official wins divided by completed competitive matches." onExplore={() => explore("Win rate", report.matchRecord, competitiveReason)} />
          <Metric label="Sets won" display={pct(report.sets.value)} result={report.sets} definition="Completed normal sets won. Match tiebreaks are reported separately." onExplore={() => explore("Sets analysed", report.sets, () => "Complete normal-set score available")} />
          <Metric label="Games won" display={pct(report.games.value)} result={report.games} definition="Games won across completed normal sets. Tiebreak points and match-tiebreak points are excluded." onExplore={() => explore("Games analysed", report.games, () => "Complete normal-game score available")} />
          <Metric label="Deciding sets" display={recordText(report.deciding)} result={report.deciding} definition="Final set or match tiebreak played with both teams one set from winning." onExplore={() => explore("Deciding-set matches", report.deciding, () => "Both teams were one set from winning before the final set")} />
          <Metric label="Vs stronger" display={recordText(report.strongerOpponents)} result={report.strongerOpponents} definition={`Historical team-average WTN; opponent at least ${SIMILAR_WTN_BAND.toFixed(1)} lower (stronger).`} onExplore={() => explore("Against stronger-rated opponents", report.strongerOpponents, () => "Opponent entered at least 1.0 WTN stronger")} />
          <Metric label="Analysed" display={String(report.matchRecord.sampleSize)} result={report.matchRecord} definition="Completed matches with an official winner and played result." onExplore={() => explore("Completed matches analysed", report.matchRecord, competitiveReason)} />
          <div className="form-metric"><span>Current form</span><div>{report.recentForm.length ? report.recentForm.map((result, index) => <b key={index} className={result}>{result === "win" ? "W" : "L"}</b>) : "—"}</div><small>{report.currentStreak ? `${report.currentStreak.count} ${report.currentStreak.result === "win" ? "wins" : "losses"} in a row` : "No decided matches"}</small></div>
        </div>
        {report.insights.length > 0 && <div className="key-insights"><span>KEY INSIGHTS</span>{report.insights.map((insight) => <p key={insight}>{insight}</p>)}</div>}
      </section>

      <section className="analytics-section" aria-labelledby="comebacks-title">
        <div className="analytics-section-heading"><span>02</span><div><p>COMEBACKS & LEAD PROTECTION</p><h2 id="comebacks-title">What happens after the opening sets</h2></div></div>
        <div className="comeback-layout">
          <article className="comeback-feature"><small>AFTER LOSING SET 1</small><strong>{recordText(report.comebackFirstSet)}</strong><b>{report.comebackFirstSet.denominator ? `${pct(report.comebackFirstSet.value)} comeback rate` : "No opportunities"}</b><button disabled={!report.comebackFirstSet.denominator} onClick={() => explore("After losing Set 1", report.comebackFirstSet, () => "Lost the first completed normal set")}>Explore {report.comebackFirstSet.denominator ?? 0} matches</button></article>
          <div className="record-stack">
            <RecordRow label="After winning Set 1" result={report.afterWinningFirst} note="Lead protection" onExplore={() => explore("After winning Set 1", report.afterWinningFirst, () => "Won the first completed normal set")} />
            <RecordRow label="After splitting Sets 1–2" result={report.afterSplitFirstTwo} note="Won first, lost second" onExplore={() => explore("After splitting the first two sets", report.afterSplitFirstTwo, () => "Won Set 1, then lost Set 2")} />
            <RecordRow label="After trailing by one set" result={report.trailedOneSetWins} note="At any point" onExplore={() => explore("After trailing by one set", report.trailedOneSetWins, () => "Trailed by at least one completed set during the match")} />
            <RecordRow label="After trailing 0–2" result={report.comebackTwoSets} note="Best-of-five only" onExplore={() => explore("After trailing by two sets", report.comebackTwoSets, () => "Trailed 0–2 in a best-of-five match")} />
            <RecordRow label="After leading 2–0" result={report.lostAfterTwoSetLead} note="Best-of-five only" onExplore={() => explore("After leading by two sets", report.lostAfterTwoSetLead, () => "Led 2–0 in a best-of-five match")} />
          </div>
        </div>
        {report.bestComebacks.length > 0 && <div className="best-comebacks"><h3>Best comeback wins</h3>{report.bestComebacks.map(({ match, reason }) => <button key={match.id} onClick={() => setExplorer({ title: "Comeback win", ids: [match.id], reason: () => reason })}><span><b>{opponentNames(match)}</b><small>{match.tournament ?? "Tournament unavailable"}</small></span><strong>{renderScore(match.sets, match.playerSide, match.status, match.scoreText)}</strong></button>)}</div>}
        <details className="analytics-method"><summary>Comeback methodology</summary><p>A first-set comeback requires a lost first completed normal set and an official match win. A two-set comeback requires a best-of-five match and a 0–2 set deficit. Match tiebreaks may decide the match, but final scores cannot prove an in-set comeback.</p></details>
      </section>

      <section className="analytics-section" aria-labelledby="scores-title">
        <div className="analytics-section-heading"><span>03</span><div><p>SETS, GAMES & SCORE PATTERNS</p><h2 id="scores-title">How matches are being won and lost</h2></div></div>
        <div className="score-analysis-grid">
          <div className="score-totals">
            <div><span>Sets</span><strong>{report.sets.wins}<i>–</i>{report.sets.losses}</strong><small>{pct(report.sets.value)} won</small></div>
            <div><span>Games</span><strong>{report.games.wins}<i>–</i>{report.games.losses}</strong><small>{pct(report.games.value)} won</small></div>
          </div>
          <dl className="average-table"><div><dt>Average sets won</dt><dd>{decimal(report.averageSetsWon.value)}</dd></div><div><dt>Average sets lost</dt><dd>{decimal(report.averageSetsLost.value)}</dd></div><div><dt>Average games won</dt><dd>{decimal(report.averageGamesWon.value)}</dd></div><div><dt>Average game difference</dt><dd>{report.averageGameDifference.value != null && report.averageGameDifference.value > 0 ? "+" : ""}{decimal(report.averageGameDifference.value)}</dd></div><div><dt>Average sets played</dt><dd>{decimal(report.averageSetsPlayed.value)}</dd></div><div><dt>Straight-set results</dt><dd>{report.straightSetWins.value ?? 0}W · {report.straightSetLosses.value ?? 0}L</dd></div></dl>
          <div className="pattern-list"><h3>Score patterns</h3>{report.patterns.slice(0, 6).map((pattern) => <button key={pattern.label} onClick={() => setExplorer({ title: pattern.label, ids: pattern.matchIds, reason: () => pattern.label })}><span>{pattern.label}</span><strong>{pattern.count}</strong></button>)}</div>
        </div>
      </section>

      <section className="analytics-section" aria-labelledby="pressure-title">
        <div className="analytics-section-heading"><span>04</span><div><p>PRESSURE PERFORMANCE</p><h2 id="pressure-title">Deciders and tiebreaks</h2></div></div>
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

      <section className="analytics-section" aria-labelledby="opponents-title">
        <div className="analytics-section-heading"><span>05</span><div><p>OPPONENT STRENGTH & TRENDS</p><h2 id="opponents-title">Results in context</h2></div></div>
        <div className="opponent-highlights">
          <div><span>Average opponent WTN</span><strong>{report.averageOpponentWtn.value?.toFixed(2) ?? "—"}</strong><small>{report.averageOpponentWtn.sampleSize} rated matches</small></div>
          <div><span>Strongest opponent beaten</span><strong>{report.strongestOpponentBeaten?.name ?? "—"}</strong><small>{report.strongestOpponentBeaten ? `WTN ${report.strongestOpponentBeaten.wtn.toFixed(2)}` : "Not enough data"}</small></div>
          <div><span>Upset wins</span><strong>{report.upsetWins.value ?? 0}</strong><small>Opponent at least {SIMILAR_WTN_BAND.toFixed(1)} stronger</small></div>
          <div><span>Losses as favourite</span><strong>{report.favouriteLosses.value ?? 0}</strong><small>Player at least {SIMILAR_WTN_BAND.toFixed(1)} stronger</small></div>
        </div>
        <div className="analytics-charts">
          <article className="trend-panel"><header><div><h3>Form over time</h3><p>Discrete monthly results</p></div><select aria-label="Trend metric" value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as TrendMetric)}><option value="winRate">Win rate</option><option value="matches">Matches played</option><option value="setsWonRate">Sets won</option><option value="gamesWonRate">Games won</option><option value="rolling5WinRate">Rolling last 5</option><option value="rolling10WinRate">Rolling last 10</option><option value="averageOpponentWtn">Opponent WTN</option></select></header><div className="analytics-chart-frame">{report.trends.length > 1 ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}><LineChart data={report.trends} accessibilityLayer margin={{ top: 16, right: 14, bottom: 4, left: 0 }}><CartesianGrid vertical={false} stroke="#e2e6dd" strokeDasharray="3 7" /><XAxis dataKey="month" tickFormatter={(value) => monthFormatter.format(new Date(`${value}-01T00:00:00Z`))} tickLine={false} axisLine={false} minTickGap={35} tick={{ fill: "#626b5e", fontSize: 10 }} /><YAxis domain={trendMetric === "matches" ? [0, "dataMax + 1"] : trendMetric === "averageOpponentWtn" ? ["auto", "auto"] : [0, 1]} ticks={trendMetric === "matches" || trendMetric === "averageOpponentWtn" ? undefined : [0, .25, .5, .75, 1]} tickFormatter={(value) => trendMetric === "matches" ? String(value) : trendMetric === "averageOpponentWtn" ? Number(value).toFixed(1) : `${value * 100}%`} width={42} tickLine={false} axisLine={false} tick={{ fill: "#626b5e", fontSize: 10 }} /><Tooltip content={(props) => <TrendTooltip active={props.active} payload={props.payload as Array<{ payload?: TrendPoint }>} metric={trendMetric} />} isAnimationActive="auto" /><Line dataKey={trendMetric} name={trendLabel[trendMetric]} type="linear" connectNulls stroke={trendColor[trendMetric]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }} isAnimationActive="auto" animationDuration={180} /></LineChart></ResponsiveContainer> : <p className="analytics-empty">Not enough dated months.</p>}</div></article>
          <article className="rating-band-panel"><header><h3>Results by rating difference</h3><p>Historical team-average WTN</p></header><div className="analytics-chart-frame"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}><BarChart data={report.ratingBands} layout="vertical" accessibilityLayer margin={{ top: 4, right: 8, bottom: 4, left: 12 }}><CartesianGrid horizontal={false} stroke="#e2e6dd" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#626b5e", fontSize: 10 }} /><YAxis type="category" dataKey="label" width={128} tickLine={false} axisLine={false} tick={{ fill: "#454d42", fontSize: 9 }} /><Tooltip cursor={{ fill: "#eef0e9" }} /><Bar dataKey="wins" name="Wins" stackId="record" fill="#b7dc22" radius={[3, 0, 0, 3]} /><Bar dataKey="losses" name="Losses" stackId="record" fill="#555d51" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></article>
        </div>
        {report.partners.length > 1 && <div className="partner-table"><h3>Doubles partners</h3>{report.partners.slice(0, 6).map((partner) => <button key={partner.name} onClick={() => setExplorer({ title: `With ${partner.name}`, ids: partner.matchIds, reason: () => `Doubles match with ${partner.name}` })}><span>{partner.name}</span><strong>{partner.wins}–{partner.losses}</strong><small>{partner.matchIds.length} matches</small></button>)}</div>}
        <details className="analytics-method"><summary>Data availability and definitions</summary><p>Known winners: {report.coverage.knownWinner}/{report.coverage.total}. Complete scores: {report.coverage.completeScore}. Usable normal-game data: {report.coverage.usableGames}. Historical WTN comparison: {report.coverage.preMatchWtn}. Tournament: {report.coverage.tournament}. Surface: {report.coverage.surface}. Similar opponents are within {SIMILAR_WTN_BAND.toFixed(1)} WTN. Lower WTN means stronger. Doubles comparisons use both team averages and are omitted unless all four ratings exist.</p></details>
      </section>
    </div>}
    <EvidenceExplorer state={explorer} matches={allMatches} onClose={() => setExplorer(null)} />
  </main>;
}
