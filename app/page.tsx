"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MatchHistory } from "@/components/matches/MatchHistory";
import { RatingChart } from "@/components/ratings/RatingChart";
import { requestPlayer } from "@/lib/wtn/client";
import type { WtnApiResponse } from "@/lib/wtn/types";

const DEFAULT_TENNIS_ID = "MAU8054205";
const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const initialParameter = (key: string) => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(key);

function displayDate(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : null;
}

function RatingCard({ title, value, change, confidence, primary = false }: { title: string; value: number | null; change: number | null; confidence: number | null; primary?: boolean }) {
  return <article className={`rating-card ${primary ? "primary" : ""}`}>
    <p>{title}</p>
    <div className="rating-value-row"><strong>{value == null ? "—" : value.toFixed(2)}</strong>{confidence != null && <span>{confidence}% confidence</span>}</div>
    {change != null && <div className={`rating-change ${change <= 0 ? "positive" : "negative"}`}><b>{change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(2)}</b><span>latest update</span></div>}
  </article>;
}

function OverviewSkeleton() {
  return <div className="overview-skeleton" aria-label="Loading player ratings">
    <div className="rating-skeleton"><i /><span /><span /></div><div className="rating-skeleton"><i /><span /><span /></div>
    <div className="chart-skeleton"><i /><span /></div>
  </div>;
}

export function Dashboard({ initialTab }: { initialTab: "overview" | "matches" }) {
  const [data, setData] = useState<WtnApiResponse | null>(null);
  const dataRef = useRef<WtnApiResponse | null>(null);
  const [playerId, setPlayerId] = useState(() => initialParameter("tennisId")?.trim().toUpperCase() || DEFAULT_TENNIS_ID);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [message, setMessage] = useState("Loading player…");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [series, setSeries] = useState<"singles" | "doubles">("singles");

  const loadPlayer = useCallback(async (tennisId: string) => {
    setStatus("loading");
    setMessage(dataRef.current ? "Refreshing player…" : "Loading player…");
    setDiagnostic(null);
    try {
      const body = await requestPlayer(tennisId);
      dataRef.current = body;
      setData(body);
      setPlayerId(body.player.id);
      setStatus("live");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to load WTN data right now.");
      setDiagnostic(typeof error === "object" && error && "diagnostic" in error ? String(error.diagnostic) : null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams(window.location.search);
    const requestedId = parameters.get("tennisId")?.trim().toUpperCase() || DEFAULT_TENNIS_ID;
    void (async () => {
      try {
        const body = await requestPlayer(requestedId, controller.signal);
        dataRef.current = body;
        setData(body);
        setPlayerId(body.player.id);
        setStatus("live");
        setMessage("");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to load WTN data right now.");
        setDiagnostic(typeof error === "object" && error && "diagnostic" in error ? String(error.diagnostic) : null);
      }
    })();
    return () => controller.abort();
  }, []);

  function submit(event: FormEvent) { event.preventDefault(); void loadPlayer(playerId); }

  const player = data?.player;
  const ratings = data?.ratings;

  return <main className={status === "loading" && data ? "is-refreshing" : ""} aria-busy={status === "loading"}>
    <nav>
      <a className="brand" href={`/?tennisId=${encodeURIComponent(playerId)}`} aria-label="WTN Insights home"><span>W</span> WTN Insights</a>
      <div className="navlinks" aria-label="Dashboard sections">
        <a aria-current={initialTab === "overview" ? "page" : undefined} className={initialTab === "overview" ? "active" : ""} href={`/?tennisId=${encodeURIComponent(playerId)}`}>Overview</a>
        <a aria-current={initialTab === "matches" ? "page" : undefined} className={initialTab === "matches" ? "active" : ""} href={`/matches?tennisId=${encodeURIComponent(playerId)}`}>Matches</a>
        <a href={`/analytics?tennisId=${encodeURIComponent(playerId)}`}>Analytics</a>
      </div>
    </nav>

    <section className="player-bar shell" id="top">
      <div className="player-identity">
        <p>{player?.country ?? "WTN player"}</p>
        <h1>{player?.name ?? <span className="identity-skeleton" />}</h1>
        <small>{player?.id ?? playerId.toUpperCase()}{displayDate(ratings?.updatedAt) ? <> · Updated {displayDate(ratings?.updatedAt)}</> : null}</small>
      </div>
      <form onSubmit={submit} className="player-search">
        <label className="sr-only" htmlFor="pid">Load another Tennis ID</label>
        <input id="pid" value={playerId} onChange={(event) => setPlayerId(event.target.value)} placeholder="Tennis ID" autoCapitalize="characters" aria-describedby={status !== "live" ? "load-status" : undefined} />
        <button disabled={status === "loading"}>{status === "loading" ? "Loading" : "Load"}</button>
      </form>
    </section>

    {status !== "live" && <div id="load-status" className={`status-banner ${status} shell`} role="status"><span />{message}{status === "error" && data && <small>Previous data remains visible.</small>}</div>}
    {process.env.NODE_ENV === "development" && diagnostic && <details className="diagnostic shell"><summary>Development API diagnostic</summary><code>{diagnostic}</code></details>}

    {!data && status === "error" ? <section className="load-error shell"><strong>Player data could not be loaded.</strong><p>{message}</p><button type="button" onClick={() => void loadPlayer(playerId)}>Try again</button></section>
      : initialTab === "overview" ? <div className="shell content overview-content">
        {data && ratings ? <>
          <section className="rating-grid">
            <RatingCard title="Singles WTN" value={ratings.singles} change={ratings.singlesChange} confidence={ratings.singlesConfidence} primary />
            <RatingCard title="Doubles WTN" value={ratings.doubles} change={ratings.doublesChange} confidence={ratings.doublesConfidence} />
          </section>
          <RatingChart history={ratings.history} series={series} onSeriesChange={setSeries} />
        </> : <OverviewSkeleton />}
      </div> : <div className="shell content">{data && player ? <MatchHistory key={player.id} matches={data.matches} player={player} loading={status === "loading"} /> : <OverviewSkeleton />}</div>}
  </main>;
}

export default function Home() {
  return <Dashboard initialTab="overview" />;
}
