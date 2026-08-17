import { useState } from "react";
import { isCloseMatch, opponentStrength } from "@/lib/wtn/match-utils";
import { renderScore } from "@/lib/wtn/score";
import type { MatchParticipant, NormalizedMatch } from "@/lib/wtn/types";

const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const statusLabel: Record<NormalizedMatch["status"], string> = {
  completed: "Completed", retired: "Retired", walkover: "Walkover", defaulted: "Defaulted",
  abandoned: "Abandoned", unfinished: "Unfinished", unknown: "Status unavailable",
};

function RatingLine({ label, players }: { label: string; players: MatchParticipant[] }) {
  return <div className="rating-line"><span>{label}</span><strong>{players.length && players.every((player) => player.wtnBeforeMatch != null)
    ? players.map((player) => player.wtnBeforeMatch?.toFixed(2)).join(" / ") : "Not available"}</strong></div>;
}

export function MatchCard({ match }: { match: NormalizedMatch }) {
  const [expanded, setExpanded] = useState(false);
  const opponentNames = match.opponents.map((opponent) => opponent.name).join(" / ") || "Opponent unavailable";
  const score = renderScore(match.sets, match.playerSide, match.status, match.scoreText);
  const strength = opponentStrength(match);
  const upset = match.result === "win" && strength === "stronger";
  const close = isCloseMatch(match);
  const hasIncompleteData = !match.scoreText || !match.opponents.length || match.playerWtnBeforeMatch == null;

  return <article className={`match-card ${match.result} ${upset ? "upset" : ""}`}>
    <div className="result-rail"><span>{match.result === "win" ? "W" : match.result === "loss" ? "L" : "—"}</span></div>
    <div className="match-main">
      <div className="match-meta-row">
        <time dateTime={match.date ?? undefined}>{match.date ? dateFormatter.format(new Date(match.date)) : "Date unavailable"}</time>
        <span>{match.matchType}</span>
        <span>{statusLabel[match.status]}</span>
        {upset && <span className="accent-chip">Upset win</span>}
        {close && <span className="close-chip">Close match</span>}
      </div>
      <div className="match-score-row">
        <div className="opponent-block"><small>{match.matchType === "doubles" ? "Opponents" : "Opponent"}</small><h3>{opponentNames}</h3>{match.partners.length > 0 && <p>with {match.partners.map((partner) => partner.name).join(" / ")}</p>}</div>
        <div className="score-block"><small>Player score first</small><strong>{score}</strong></div>
      </div>
      <div className="match-context">
        <p>{match.tournament ?? "Tournament unavailable"}</p>
        {match.round && <span>{match.round}</span>}
      </div>
      <button className="details-toggle" type="button" aria-expanded={expanded} aria-controls={`details-${match.id}`} onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Hide details" : "Match details"}<span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && <div className="match-details" id={`details-${match.id}`}>
        <div className="rating-comparison">
          <div className="rating-line"><span>Player WTN before match</span><strong>{match.playerWtnBeforeMatch?.toFixed(2) ?? "Not available"}</strong></div>
          <RatingLine label={match.matchType === "doubles" ? "Opponent WTNs before match" : "Opponent WTN before match"} players={match.opponents} />
          {match.partners.length > 0 && <RatingLine label="Partner WTN before match" players={match.partners} />}
        </div>
        <dl>
          <div><dt>Surface</dt><dd>{match.surface ?? "Not available"}</dd></div>
          <div><dt>Environment</dt><dd>{match.environment ? match.environment[0].toUpperCase() + match.environment.slice(1) : "Not available"}</dd></div>
          <div><dt>Age category</dt><dd>{match.ageCategory ?? "Not available"}</dd></div>
          <div><dt>Match ID</dt><dd className="match-id">{match.id}</dd></div>
        </dl>
        {hasIncompleteData && <p className="data-note">Some optional details were not supplied by WTN for this match.</p>}
      </div>}
    </div>
  </article>;
}
