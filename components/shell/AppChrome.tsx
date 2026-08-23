"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PlayerProfile } from "@/lib/wtn/types";

type Page = "overview" | "matches" | "analytics";
type CourtTheme = "grass" | "clay";

const THEME_STORAGE_KEY = "wtn-insights-court-theme";
const THEME_SWEEP_MIDPOINT = 250;
const THEME_SWEEP_FALLBACK = 560;

function currentTheme(): CourtTheme {
  return document.documentElement.dataset.theme === "clay" ? "clay" : "grass";
}

function CourtThemeSelector() {
  const [theme, setTheme] = useState<CourtTheme>("grass");
  const [pendingTheme, setPendingTheme] = useState<CourtTheme | null>(null);
  const transitionLocked = useRef(false);
  const cleanupTransition = useRef<(() => void) | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const activeTheme = currentTheme();
      setTheme(activeTheme);
      try { window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme); } catch { /* A private browser may block storage. */ }
      document.cookie = `${THEME_STORAGE_KEY}=${activeTheme}; Path=/; Max-Age=31536000; SameSite=Lax`;
    });
    return () => cleanupTransition.current?.();
  }, []);

  function storeTheme(nextTheme: CourtTheme) {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch { /* A private browser may block storage. */ }
    document.cookie = `${THEME_STORAGE_KEY}=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  function commitTheme(nextTheme: CourtTheme) {
    document.documentElement.setAttribute("data-theme", nextTheme);
    setTheme(nextTheme);
  }

  function selectTheme(nextTheme: CourtTheme) {
    const activeTheme = currentTheme();
    if (nextTheme === activeTheme || transitionLocked.current) return;

    transitionLocked.current = true;
    setPendingTheme(nextTheme);
    storeTheme(nextTheme);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sweepNode = document.getElementById("court-theme-sweep");
    if (reducedMotion || !sweepNode) {
      commitTheme(nextTheme);
      transitionLocked.current = false;
      setPendingTheme(null);
      return;
    }

    sweepNode.dataset.target = nextTheme;
    sweepNode.classList.add("is-active");
    let finished = false;
    let midpointTimer = 0;
    let fallbackTimer = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(midpointTimer);
      window.clearTimeout(fallbackTimer);
      sweepNode.removeEventListener("animationend", finish);
      sweepNode.classList.remove("is-active");
      sweepNode.removeAttribute("data-target");
      if (currentTheme() !== nextTheme) commitTheme(nextTheme);
      transitionLocked.current = false;
      cleanupTransition.current = null;
      setPendingTheme(null);
    };
    midpointTimer = window.setTimeout(() => commitTheme(nextTheme), THEME_SWEEP_MIDPOINT);
    fallbackTimer = window.setTimeout(finish, THEME_SWEEP_FALLBACK);
    sweepNode.addEventListener("animationend", finish, { once: true });
    cleanupTransition.current = () => {
      window.clearTimeout(midpointTimer);
      window.clearTimeout(fallbackTimer);
      sweepNode.removeEventListener("animationend", finish);
      sweepNode.classList.remove("is-active");
      sweepNode.removeAttribute("data-target");
      transitionLocked.current = false;
    };
  }

  const selectedTheme = pendingTheme ?? theme;
  const nextTheme: CourtTheme = selectedTheme === "grass" ? "clay" : "grass";
  return <button
    className="theme-selector"
    data-active={selectedTheme}
    type="button"
    role="switch"
    aria-checked={selectedTheme === "clay"}
    aria-label={`Court theme: ${selectedTheme}. Switch to ${nextTheme}.`}
    aria-busy={pendingTheme ? "true" : undefined}
    disabled={pendingTheme != null}
    onClick={() => selectTheme(nextTheme)}
  >
    <span className="theme-selector-indicator" aria-hidden="true" />
    <span className="theme-selector-label grass" aria-hidden="true">Grass</span>
    <span className="theme-selector-label clay" aria-hidden="true">Clay</span>
  </button>;
}

const updatedDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
  : null;

export function MainNavigation({ current, playerId, loading, onPlayerIdChange, onSubmit }: { current: Page; playerId: string; loading: boolean; onPlayerIdChange: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  const encoded = encodeURIComponent(playerId);
  return <nav className="main-navigation">
    <div className="navigation-inner">
      <a className="brand" href={`/?tennisId=${encoded}`} aria-label="WTN Insights home"><span className="brand-mark" aria-hidden="true">W</span><b className="brand-copy">WTN Insights</b></a>
      <div className="navlinks" aria-label="Dashboard sections">
        <a aria-current={current === "overview" ? "page" : undefined} className={current === "overview" ? "active" : ""} href={`/?tennisId=${encoded}`}>Overview</a>
        <a aria-current={current === "matches" ? "page" : undefined} className={current === "matches" ? "active" : ""} href={`/matches?tennisId=${encoded}`}>Matches</a>
        <a aria-current={current === "analytics" ? "page" : undefined} className={current === "analytics" ? "active" : ""} href={`/analytics?tennisId=${encoded}`}>Analytics</a>
      </div>
      <CourtThemeSelector />
      <form className="nav-player-search" onSubmit={onSubmit} aria-label="Switch player">
        <label className="sr-only" htmlFor={`${current}-player-id`}>Load another Tennis ID</label>
        <span className="player-switcher-label" aria-hidden="true">Player</span>
        <input id={`${current}-player-id`} value={playerId} onChange={(event) => onPlayerIdChange(event.target.value)} placeholder="Tennis ID" autoCapitalize="characters" />
        <button disabled={loading} aria-label={loading ? "Loading player" : "Load player"}>{loading ? "…" : "↗"}</button>
      </form>
    </div>
  </nav>;
}

export function PlayerContext({ player, fallbackId, updatedAt }: { player: PlayerProfile | undefined; fallbackId: string; updatedAt?: string | null }) {
  const updated = updatedDate(updatedAt);
  return <header className="player-context shell" id="top">
    <h1>{player?.name ?? <span className="context-skeleton" />}</h1>
    <p><span>{player?.country ?? "WTN player"}</span><span aria-hidden="true"> · </span><span>Tennis ID {player?.id ?? fallbackId.toUpperCase()}</span>{updated ? <><span aria-hidden="true"> · </span><span>Updated {updated}</span></> : null}</p>
  </header>;
}
