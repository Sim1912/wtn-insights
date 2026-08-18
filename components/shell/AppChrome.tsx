"use client";

import type { FormEvent } from "react";
import type { PlayerProfile } from "@/lib/wtn/types";

type Page = "overview" | "matches" | "analytics";

const updatedDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
  : null;

export function MainNavigation({ current, playerId, loading, onPlayerIdChange, onSubmit }: { current: Page; playerId: string; loading: boolean; onPlayerIdChange: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  const encoded = encodeURIComponent(playerId);
  return <nav className="main-navigation">
    <div className="navigation-inner">
      <a className="brand" href={`/?tennisId=${encoded}`} aria-label="WTN Insights home"><span>W</span><b>WTN Insights</b><small>Grass Court Edition</small></a>
      <div className="navlinks" aria-label="Dashboard sections">
        <a aria-current={current === "overview" ? "page" : undefined} className={current === "overview" ? "active" : ""} href={`/?tennisId=${encoded}`}>Overview</a>
        <a aria-current={current === "matches" ? "page" : undefined} className={current === "matches" ? "active" : ""} href={`/matches?tennisId=${encoded}`}>Matches</a>
        <a aria-current={current === "analytics" ? "page" : undefined} className={current === "analytics" ? "active" : ""} href={`/analytics?tennisId=${encoded}`}>Analytics</a>
      </div>
      <form className="nav-player-search" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={`${current}-player-id`}>Load another Tennis ID</label>
        <input id={`${current}-player-id`} value={playerId} onChange={(event) => onPlayerIdChange(event.target.value)} placeholder="Tennis ID" autoCapitalize="characters" />
        <button disabled={loading} aria-label={loading ? "Loading player" : "Load player"}>{loading ? "…" : "↗"}</button>
      </form>
    </div>
  </nav>;
}

export function PlayerHeader({ player, fallbackId, updatedAt }: { player: PlayerProfile | undefined; fallbackId: string; updatedAt?: string | null }) {
  const updated = updatedDate(updatedAt);
  return <header className="player-bar shell" id="top">
    <div className="player-identity">
      <p>{player?.country ?? "WTN player"}</p>
      <h1>{player?.name ?? <span className="identity-skeleton" />}</h1>
      <small>{player?.id ?? fallbackId.toUpperCase()}{updated ? <> · Updated {updated}</> : null}</small>
    </div>
  </header>;
}

export function PlayerContext({ player, fallbackId, updatedAt }: { player: PlayerProfile | undefined; fallbackId: string; updatedAt?: string | null }) {
  const updated = updatedDate(updatedAt);
  return <header className="player-context shell" id="top">
    <h1>{player?.name ?? <span className="context-skeleton" />}</h1>
    <p>{player?.id ?? fallbackId.toUpperCase()}{updated ? <> · Updated {updated}</> : null}</p>
  </header>;
}
