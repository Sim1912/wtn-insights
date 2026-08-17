"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MatchHistory } from "@/components/matches/MatchHistory";
import type { RatingPoint, WtnApiResponse } from "@/lib/wtn/types";

const DEFAULT_TENNIS_ID = "MAU8054205";
const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short" });

function displayDate(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "not available";
}

function Chart({ data, series }: { data: RatingPoint[]; series: "singles" | "doubles" }) {
  const points = data.filter((point) => point[series] != null).slice(-12);
  if (points.length < 2) return <div className="chart-empty">Not enough rating points to draw this series.</div>;
  const width = 680, height = 210;
  const values = points.map((point) => point[series] as number);
  const minimum = Math.min(...values) - 0.2, maximum = Math.max(...values) + 0.2;
  const coords = values.map((value, index) => `${18 + index / Math.max(values.length - 1, 1) * (width - 36)},${18 + (value - minimum) / Math.max(maximum - minimum, 0.1) * (height - 48)}`);
  const color = series === "singles" ? "#d8ff48" : "#8cb4ff";
  return <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series} rating history`}>
    {[45, 95, 145].map((y) => <line key={y} x1="18" x2={width - 18} y1={y} y2={y} className="gridline" />)}
    <polyline points={coords.join(" ")} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    {coords.map((point, index) => { const [x, y] = point.split(","); return <circle key={`${point}-${index}`} cx={x} cy={y} r="5" fill={color} />; })}
    {points.map((point, index) => <text key={`${point.date}-${index}`} x={18 + index / Math.max(points.length - 1, 1) * (width - 36)} y="202" textAnchor="middle">{shortDateFormatter.format(new Date(point.date))}</text>)}
  </svg>;
}

function RatingCard({ title, value, change, primary = false }: { title: string; value: number | null; change: number | null; primary?: boolean }) {
  return <article className={`rating-card ${primary ? "primary" : ""}`}>
    <div className="card-top"><p>{title}</p><span>Official</span></div>
    <strong>{value == null ? "—" : value.toFixed(2)}</strong>
    {change == null ? <div className="change neutral">Change unavailable</div> : <div className={`change ${change <= 0 ? "good" : "bad"}`}>{change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(2)} <small>since last update</small></div>}
  </article>;
}

export default function Home() {
  const [data, setData] = useState<WtnApiResponse | null>(null);
  const dataRef = useRef<WtnApiResponse | null>(null);
  const [playerId, setPlayerId] = useState(DEFAULT_TENNIS_ID);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [message, setMessage] = useState("Loading live WTN data…");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "matches">("matches");
  const [series, setSeries] = useState<"singles" | "doubles">("singles");

  const loadPlayer = useCallback(async (tennisId: string) => {
    setStatus("loading");
    setMessage(dataRef.current ? "Refreshing live WTN data…" : "Loading live WTN data…");
    setDiagnostic(null);
    try {
      const response = await fetch(`/api/wtn?tennisId=${encodeURIComponent(tennisId.trim())}`);
      const body = await response.json() as WtnApiResponse & { error?: string; diagnostic?: string };
      if (!response.ok) throw Object.assign(new Error(body.error || "WTN request failed."), { diagnostic: body.diagnostic });
      dataRef.current = body;
      setData(body);
      setPlayerId(body.player.id);
      setStatus("live");
      setMessage(`${body.matches.length} live matches loaded from WTN`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to load WTN data right now.");
      setDiagnostic(typeof error === "object" && error && "diagnostic" in error ? String(error.diagnostic) : null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/wtn?tennisId=${DEFAULT_TENNIS_ID}`, { signal: controller.signal });
        const body = await response.json() as WtnApiResponse & { error?: string; diagnostic?: string };
        if (!response.ok) throw Object.assign(new Error(body.error || "WTN request failed."), { diagnostic: body.diagnostic });
        dataRef.current = body;
        setData(body);
        setPlayerId(body.player.id);
        setStatus("live");
        setMessage(`${body.matches.length} live matches loaded from WTN`);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to load WTN data right now.");
        setDiagnostic(typeof error === "object" && error && "diagnostic" in error ? String(error.diagnostic) : null);
      }
    })();
    return () => controller.abort();
  }, []);

  const history = data?.ratings.history ?? [];
  const trendValues = history.map((point) => point[series]).filter((value): value is number => value != null);
  const trend = trendValues.length > 1 ? trendValues.at(-1)! - trendValues[0] : null;

  function submit(event: FormEvent) { event.preventDefault(); void loadPlayer(playerId); }

  const player = data?.player, ratings = data?.ratings;
  const confidence = series === "singles" ? ratings?.singlesConfidence : ratings?.doublesConfidence;

  return <main>
    <nav>
      <a className="brand" href="#top" aria-label="WTN Insights home"><span>W</span> WTN Insights</a>
      <div className="navlinks" aria-label="Dashboard sections">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
        <button className={tab === "matches" ? "active" : ""} onClick={() => setTab("matches")}>Match history</button>
      </div>
      <div className="live-source"><i />WTN live</div>
    </nav>

    <section className="hero shell" id="top">
      <div><p className="eyebrow">PLAYER DASHBOARD · {player?.country ?? "WTN"}</p><h1>{player?.name ?? "Match intelligence"}</h1><p className="subline">Tennis ID {player?.id ?? playerId.toUpperCase()} <span>•</span> Updated {displayDate(ratings?.updatedAt)}</p></div>
      <form onSubmit={submit} className="search"><label htmlFor="pid">Load another Tennis ID</label><div><input id="pid" value={playerId} onChange={(event) => setPlayerId(event.target.value)} placeholder="e.g. MAU8054205" autoCapitalize="characters" aria-describedby="load-status" /><button disabled={status === "loading"}>{status === "loading" ? "Loading…" : "Load player"}</button></div></form>
    </section>

    <div id="load-status" className={`notice ${status}`} role="status"><span />{message}{status === "error" && data && <small>Your last loaded data is still shown.</small>}</div>
    {process.env.NODE_ENV === "development" && diagnostic && <details className="diagnostic shell"><summary>Development API diagnostic</summary><code>{diagnostic}</code></details>}

    {tab === "overview" ? <div className="shell content overview-content">
      <section className="rating-grid">
        <RatingCard title="Singles WTN" value={ratings?.singles ?? null} change={ratings?.singlesChange ?? null} primary />
        <RatingCard title="Doubles WTN" value={ratings?.doubles ?? null} change={ratings?.doublesChange ?? null} />
        <article className="mini-card"><p>{series === "singles" ? "Singles" : "Doubles"} confidence</p><strong>{confidence == null ? "—" : `${confidence}%`}</strong><div className="meter"><i style={{ width: `${confidence ?? 0}%` }} /></div><small>WTN data confidence</small></article>
        <article className="mini-card"><p>Matches loaded</p><strong>{data?.matches.length ?? "—"}</strong><small>Official records in this rating period</small></article>
      </section>
      <section className="panel history">
        <header><div><p className="eyebrow">RATING DEVELOPMENT</p><h2>Your WTN over time</h2></div><div className="switch"><button className={series === "singles" ? "active" : ""} onClick={() => setSeries("singles")}>Singles</button><button className={series === "doubles" ? "active" : ""} onClick={() => setSeries("doubles")}>Doubles</button></div></header>
        <Chart data={history} series={series} />
        <div className="chart-summary"><span>Period change</span><strong className={trend == null ? "" : trend <= 0 ? "green" : "red"}>{trend == null ? "—" : `${trend > 0 ? "+" : ""}${trend.toFixed(2)}`}</strong><small>Lower WTN means stronger</small></div>
      </section>
      <section className="insights">
        <article><span>01</span><div><h3>Rating direction</h3><p>{trend == null ? "More rating points are needed to calculate a trend." : `Your ${series} WTN has ${trend <= 0 ? "improved" : "moved higher"} by ${Math.abs(trend).toFixed(2)}.`}</p></div></article>
        <article><span>02</span><div><h3>Official match context</h3><p>{data?.matches.length ? `${data.matches.length} matches include verified opponent, score and result context where supplied by WTN.` : "No matches were returned for the loaded rating period."}</p></div></article>
        <article><span>03</span><div><h3>Read ratings correctly</h3><p>A lower World Tennis Number represents a stronger player. Pre-match ratings make upset wins easy to spot.</p></div></article>
      </section>
    </div> : <div className="shell content"><MatchHistory matches={data?.matches ?? []} loading={status === "loading"} /></div>}

    <footer className="shell"><span>WTN Insights</span><p>Independent analytics using live World Tennis Number data. Not affiliated with the ITF.</p></footer>
  </main>;
}
