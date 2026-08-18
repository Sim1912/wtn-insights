"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MatchHistory, MatchHistorySkeleton } from "@/components/matches/MatchHistory";
import { RatingChart } from "@/components/ratings/RatingChart";
import { MainNavigation, PlayerContext, PlayerHeader } from "@/components/shell/AppChrome";
import { AnimatedNumber, ScrollReveal } from "@/components/ui/Motion";
import { requestPlayer } from "@/lib/wtn/client";
import type { WtnApiResponse } from "@/lib/wtn/types";

const DEFAULT_TENNIS_ID = "MAU8054205";
const initialParameter = (key: string) => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(key);

function RatingCard({ title, value, change, confidence, selected, onSelect }: { title: string; value: number | null; change: number | null; confidence: number | null; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`rating-card ${selected ? "selected" : ""}`} aria-pressed={selected} aria-controls="rating-history-chart" onClick={onSelect}>
    <span className="rating-card-title">{title}</span>
    <strong className="rating-number">{value == null ? "—" : <AnimatedNumber value={value} decimals={2} from={change == null ? value + .1 : value - change} />}</strong>
    <span className="rating-card-meta">
      {change != null && <b className={change <= 0 ? "positive" : "negative"}>{change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(2)}</b>}
      {confidence != null && <small>{confidence}% confidence</small>}
    </span>
  </button>;
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
    <MainNavigation current={initialTab} playerId={playerId} loading={status === "loading"} onPlayerIdChange={setPlayerId} onSubmit={submit} />
    {initialTab === "overview"
      ? <PlayerHeader player={player} fallbackId={playerId} updatedAt={ratings?.updatedAt} />
      : <PlayerContext player={player} fallbackId={playerId} updatedAt={ratings?.updatedAt} />}

    {status !== "live" && <div id="load-status" className={`status-banner ${status} shell`} role="status"><span />{message}{status === "error" && data && <small>Previous data remains visible.</small>}</div>}
    {process.env.NODE_ENV === "development" && diagnostic && <details className="diagnostic shell"><summary>Development API diagnostic</summary><code>{diagnostic}</code></details>}

    {!data && status === "error" ? <section className="load-error shell"><strong>Player data could not be loaded.</strong><p>{message}</p><button type="button" onClick={() => void loadPlayer(playerId)}>Try again</button></section>
      : initialTab === "overview" ? <div className="shell content overview-content">
        {data && ratings ? <>
          <ScrollReveal><section className="rating-grid" aria-label="Current ratings">
              <RatingCard title="Singles WTN" value={ratings.singles} change={ratings.singlesChange} confidence={ratings.singlesConfidence} selected={series === "singles"} onSelect={() => setSeries("singles")} />
              <RatingCard title="Doubles WTN" value={ratings.doubles} change={ratings.doublesChange} confidence={ratings.doublesConfidence} selected={series === "doubles"} onSelect={() => setSeries("doubles")} />
          </section></ScrollReveal>
          <ScrollReveal delay={60}><RatingChart history={ratings.history} series={series} onSeriesChange={setSeries} /></ScrollReveal>
        </> : <OverviewSkeleton />}
      </div> : <div className="shell content">{data && player ? <MatchHistory key={player.id} matches={data.matches} player={player} loading={status === "loading"} /> : <MatchHistorySkeleton />}</div>}
  </main>;
}

export default function Home() {
  return <Dashboard initialTab="overview" />;
}
