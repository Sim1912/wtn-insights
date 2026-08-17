"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MatchHistory } from "@/components/matches/MatchHistory";
import { RatingChart } from "@/components/ratings/RatingChart";
import { fetchPublicWtnDashboard } from "@/lib/wtn/graphql";
import { normalizeWtnResponse } from "@/lib/wtn/normalize-match";
import type { WtnApiResponse } from "@/lib/wtn/types";

const DEFAULT_TENNIS_ID = "MAU8054205";
const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });

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

async function requestPlayer(tennisId: string, signal?: AbortSignal): Promise<WtnApiResponse> {
  const normalizedId = tennisId.trim().toUpperCase();
  const response = await fetch(`/api/wtn?tennisId=${encodeURIComponent(normalizedId)}`, { signal });
  const body = await response.json() as WtnApiResponse & { error?: string; diagnostic?: string };
  if (response.ok) return body;

  const serverError = Object.assign(new Error(body.error || "WTN request failed."), { diagnostic: body.diagnostic });
  if (response.status !== 502) throw serverError;

  try {
    const payload = await fetchPublicWtnDashboard(normalizedId, signal);
    const ratings = payload.ratings ?? [];
    if (!payload.player && !ratings.length) throw new Error("No WTN player was found for that Tennis ID.");
    return normalizeWtnResponse(normalizedId, payload.player, ratings);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw serverError;
  }
}

export default function Home() {
  const [data, setData] = useState<WtnApiResponse | null>(null);
  const dataRef = useRef<WtnApiResponse | null>(null);
  const [playerId, setPlayerId] = useState(DEFAULT_TENNIS_ID);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [message, setMessage] = useState("Loading player…");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "matches">("overview");
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
    void (async () => {
      try {
        const body = await requestPlayer(DEFAULT_TENNIS_ID, controller.signal);
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
      <a className="brand" href="#top" aria-label="WTN Insights home"><span>W</span> WTN Insights</a>
      <div className="navlinks" aria-label="Dashboard sections">
        <button aria-pressed={tab === "overview"} className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
        <button aria-pressed={tab === "matches"} className={tab === "matches" ? "active" : ""} onClick={() => setTab("matches")}>Matches</button>
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
      : tab === "overview" ? <div className="shell content overview-content">
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
