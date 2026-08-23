"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MatchHistory, MatchHistorySkeleton } from "@/components/matches/MatchHistory";
import { RatingChart } from "@/components/ratings/RatingChart";
import { MainNavigation, PlayerContext } from "@/components/shell/AppChrome";
import { AnimatedNumber, ScrollReveal } from "@/components/ui/Motion";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { requestPlayer } from "@/lib/wtn/client";
import { DEFAULT_TENNIS_ID, PLAYER_ID_STORAGE_KEY, normalizeTennisId } from "@/lib/wtn/player-id";
import type { WtnApiResponse } from "@/lib/wtn/types";

function RatingCard({ title, value, change, confidence, selected, onSelect }: { title: string; value: number | null; change: number | null; confidence: number | null; selected: boolean; onSelect: () => void }) {
  const changeText = change == null ? null : change < 0 ? `${Math.abs(change).toFixed(2)} stronger` : change > 0 ? `${change.toFixed(2)} weaker` : "unchanged";
  const accessibleLabel = `${title}: ${value == null ? "unavailable" : value.toFixed(2)}.${changeText ? ` Latest change ${changeText}.` : ""}${confidence == null ? "" : ` ${confidence}% confidence.`} Show ${title} history.`;
  return <button type="button" className={`rating-card ${selected ? "selected" : ""}`} aria-label={accessibleLabel} aria-pressed={selected} aria-controls="rating-history-chart" onClick={onSelect}>
    <span className="rating-card-title">{title}</span>
    <strong className="rating-number">{value == null ? "—" : <AnimatedNumber value={value} decimals={2} from={change == null ? value + .1 : value - change} />}</strong>
    <span className="rating-card-meta">
      {change != null && <b className={change <= 0 ? "positive" : "negative"}>{change > 0 ? "↑" : change < 0 ? "↓" : "→"} {changeText}</b>}
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

function replacePlayerQuery(tennisId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tennisId", tennisId);
  window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
}

export function Dashboard({ initialTab, initialPlayerId = DEFAULT_TENNIS_ID }: { initialTab: "overview" | "matches"; initialPlayerId?: string }) {
  const [data, setData] = useState<WtnApiResponse | null>(null);
  const dataRef = useRef<WtnApiResponse | null>(null);
  // This value is supplied by the server route, so the first client render matches SSR.
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [message, setMessage] = useState("Loading player…");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [series, setSeries] = useState<"singles" | "doubles">("singles");

  const loadPlayer = useCallback(async (tennisId: string) => {
    const normalizedId = normalizeTennisId(tennisId) ?? DEFAULT_TENNIS_ID;
    setStatus("loading");
    setMessage(dataRef.current ? "Refreshing player…" : "Loading player…");
    setDiagnostic(null);
    try {
      const body = await requestPlayer(normalizedId);
      dataRef.current = body;
      setData(body);
      setPlayerId(body.player.id);
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, body.player.id);
      replacePlayerQuery(body.player.id);
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
    const urlId = normalizeTennisId(new URLSearchParams(window.location.search).get("tennisId"));
    // URL state always wins. Storage is intentionally read only in this effect.
    const storedId = urlId ? null : normalizeTennisId(window.localStorage.getItem(PLAYER_ID_STORAGE_KEY));
    const requestedId = urlId ?? storedId ?? initialPlayerId;
    void (async () => {
      setPlayerId(requestedId);
      try {
        const body = await requestPlayer(requestedId, controller.signal);
        dataRef.current = body;
        setData(body);
        setPlayerId(body.player.id);
        window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, body.player.id);
        replacePlayerQuery(body.player.id);
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
  }, [initialPlayerId]);

  function submit(event: FormEvent) { event.preventDefault(); void loadPlayer(playerId); }

  const player = data?.player;
  const ratings = data?.ratings;

  return <main className={status === "loading" && data ? "is-refreshing" : ""} aria-busy={status === "loading"}>
    <MainNavigation current={initialTab} playerId={playerId} loading={status === "loading"} onPlayerIdChange={setPlayerId} onSubmit={submit} />
    <PlayerContext player={player} fallbackId={playerId} updatedAt={ratings?.updatedAt} />

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
          <ScrollReveal delay={120}><RecentActivity matches={data.matches} playerId={player.id} /></ScrollReveal>
        </> : <OverviewSkeleton />}
      </div> : <div className="shell content">{data && player ? <MatchHistory key={player.id} matches={data.matches} player={player} loading={status === "loading"} /> : <MatchHistorySkeleton />}</div>}
  </main>;
}
