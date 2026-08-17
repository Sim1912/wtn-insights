import { useId } from "react";
import { averageOpponentWtn, averagePlayerTeamWtn, isCloseMatch, opponentStrength } from "@/lib/wtn/match-utils";
import { renderScore } from "@/lib/wtn/score";
import type { MatchParticipant, NormalizedMatch, NormalizedSet, PlayerProfile } from "@/lib/wtn/types";

const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const statusLabel: Record<NormalizedMatch["status"], string> = {
  completed: "Completed", retired: "Retirement", walkover: "Walkover", defaulted: "Default",
  abandoned: "Abandoned", unfinished: "Unfinished", unknown: "Status unavailable",
};

function participantRatings(players: MatchParticipant[]) {
  if (!players.length || players.some((player) => player.wtnBeforeMatch == null)) return null;
  return players.map((player) => player.wtnBeforeMatch!.toFixed(2)).join(" / ");
}

function scoreValue(set: NormalizedSet, side: 1 | 2) {
  const games = side === 1 ? set.side1Games : set.side2Games;
  const tiebreak = side === 1 ? set.side1Tiebreak : set.side2Tiebreak;
  return { main: set.isMatchTiebreak ? tiebreak ?? games : games, tiebreak: set.isMatchTiebreak ? null : tiebreak };
}

function didWinSet(set: NormalizedSet, side: 1 | 2) {
  const own = scoreValue(set, side).main;
  const other = scoreValue(set, side === 1 ? 2 : 1).main;
  return own != null && other != null && own > other;
}

function ScoreCell({ set, side }: { set: NormalizedSet; side: 1 | 2 }) {
  const value = scoreValue(set, side);
  return <td className={`set-score ${didWinSet(set, side) ? "set-winner" : ""} ${set.isMatchTiebreak ? "match-tiebreak" : ""}`}>
    <span>{value.main ?? "—"}</span>{value.tiebreak != null && <sup>{value.tiebreak}</sup>}
  </td>;
}

function TeamName({ names, label }: { names: string[]; label: string }) {
  return <div className="team-name"><span className="team-label">{label}</span>{names.map((name) => <strong key={name}>{name}</strong>)}</div>;
}

function ParticipantIds({ label, participants }: { label: string; participants: Array<{ name: string; tennisId?: string | null; id?: string | null }> }) {
  return <div className="detail-group"><dt>{label}</dt>{participants.map((participant) => <dd key={`${participant.name}-${participant.tennisId ?? participant.id}`}><span>{participant.name}</span><code>{participant.tennisId || participant.id || "ID unavailable"}</code></dd>)}</div>;
}

export function MatchCard({
  match,
  player,
  expanded,
  onToggle,
}: {
  match: NormalizedMatch;
  player: PlayerProfile;
  expanded: boolean;
  onToggle: () => void;
}) {
  const reactId = useId();
  const detailsId = `match-details-${reactId.replaceAll(":", "")}`;
  const playerTeam = [player.name, ...match.partners.map((partner) => partner.name)];
  const opponentTeam = match.opponents.map((opponent) => opponent.name);
  const opponentNames = opponentTeam.length ? opponentTeam : ["Opponent unavailable"];
  const strength = opponentStrength(match);
  const upset = match.result === "win" && strength === "stronger";
  const close = isCloseMatch(match);
  const playerRatings = [match.playerWtnBeforeMatch, ...match.partners.map((partner) => partner.wtnBeforeMatch)];
  const opponentRatings = participantRatings(match.opponents);
  const playerRatingText = playerRatings.every((value) => value != null) ? playerRatings.map((value) => value!.toFixed(2)).join(" / ") : null;
  const playerTeamWtn = averagePlayerTeamWtn(match);
  const opponentTeamWtn = averageOpponentWtn(match);
  const difference = playerTeamWtn != null && opponentTeamWtn != null ? Math.abs(playerTeamWtn - opponentTeamWtn) : null;
  const contextBits = [match.matchType === "unknown" ? null : match.matchType, match.surface, match.environment].filter(Boolean);
  const abnormalStatus = match.status !== "completed" && match.status !== "unknown";
  const fallbackScore = renderScore(match.sets, match.playerSide, match.status, match.scoreText);

  return <article className={`match-card ${match.result} ${upset ? "upset" : ""} ${expanded ? "expanded" : ""}`}>
    <header className="match-card-header">
      <div className="match-labels">
        <span className={`result-chip ${match.result}`}>{match.result === "win" ? "Win" : match.result === "loss" ? "Loss" : "Result pending"}</span>
        {upset ? <span className="insight-chip upset-chip">Upset</span> : close ? <span className="insight-chip close-chip">Close match</span> : null}
        {abnormalStatus && <span className="status-chip">{statusLabel[match.status]}</span>}
      </div>
      <time dateTime={match.date ?? undefined}>{match.date ? dateFormatter.format(new Date(match.date)) : "Date unavailable"}</time>
    </header>

    <table className="tennis-score">
      <caption className="sr-only">{`${playerTeam.join(" and ")} versus ${opponentNames.join(" and ")}. ${fallbackScore}`}</caption>
      <colgroup><col />{(match.sets.length ? match.sets : [null]).map((_, index) => <col className="score-column" key={index} />)}</colgroup>
      <thead><tr><th scope="col">Players</th>{match.sets.length ? match.sets.map((set, index) => <th scope="col" aria-label={set.isMatchTiebreak ? "Match tiebreak" : undefined} key={index}>{set.isMatchTiebreak ? "MTB" : `Set ${index + 1}`}</th>) : <th scope="col">Score</th>}</tr></thead>
      <tbody>
        <tr className={match.winningSide === match.playerSide ? "winning-team" : ""}>
          <th scope="row"><TeamName names={playerTeam} label={match.matchType === "doubles" ? "Your team" : "Player"} /></th>
          {match.sets.length ? match.sets.map((set, index) => <ScoreCell key={`player-${index}`} set={set} side={match.playerSide} />) : <td className="score-status">{fallbackScore}</td>}
        </tr>
        <tr className={match.winningSide === (match.playerSide === 1 ? 2 : 1) ? "winning-team" : ""}>
          <th scope="row"><TeamName names={opponentNames} label={match.matchType === "doubles" ? "Opponents" : "Opponent"} /></th>
          {match.sets.length ? match.sets.map((set, index) => <ScoreCell key={`opponent-${index}`} set={set} side={match.playerSide === 1 ? 2 : 1} />) : <td className="score-status muted-status">—</td>}
        </tr>
      </tbody>
    </table>

    {(playerRatingText || opponentRatings) && <div className="wtn-versus"><span>WTN before</span><strong>{playerRatingText ?? "—"}</strong><i>vs</i><strong>{opponentRatings ?? "—"}</strong>{strength !== "unknown" && <small>{strength === "stronger" ? "Stronger opposition" : strength === "weaker" ? "Weaker opposition" : "Evenly rated"}</small>}</div>}

    <div className="match-location">
      <p>{match.tournament ?? "Event unavailable"}{match.round ? <span> · {match.round}</span> : null}</p>
      {contextBits.length > 0 && <small>{contextBits.join(" · ")}</small>}
    </div>

    <button className="details-toggle" type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={onToggle}>
      <span>{expanded ? "Hide match details" : "Match details"}</span><b aria-hidden="true">{expanded ? "−" : "+"}</b>
    </button>
    <div className="details-reveal" data-open={expanded} aria-hidden={!expanded} id={detailsId}>
      <div className="match-details">
        <div className="detail-insight">
          <p>Rating context</p>
          <strong>{difference == null ? "Comparison unavailable" : `${difference.toFixed(2)} WTN ${strength === "stronger" ? "stronger opposition" : strength === "weaker" ? "weaker opposition" : "difference"}`}</strong>
          {match.scoreText && <small>API score: {match.scoreText}</small>}
        </div>
        <dl className="detail-grid">
          <div><dt>Status</dt><dd>{statusLabel[match.status]}</dd></div>
          {match.completedAt && <div><dt>Completed</dt><dd>{dateTimeFormatter.format(new Date(match.completedAt))}</dd></div>}
          {match.ageCategory && <div><dt>Age category</dt><dd>{match.ageCategory}</dd></div>}
          {match.surface && <div><dt>Surface</dt><dd>{match.surface}</dd></div>}
          {match.environment && <div><dt>Environment</dt><dd>{match.environment}</dd></div>}
          {match.matchFormat && <div><dt>Format</dt><dd>{match.matchFormat}</dd></div>}
          {match.draw && <div><dt>Draw</dt><dd>{match.draw}</dd></div>}
          {match.statusCodes.length > 0 && <div><dt>Status codes</dt><dd>{match.statusCodes.join(", ")}</dd></div>}
          <ParticipantIds label="Player IDs" participants={[{ name: player.name, tennisId: player.id, id: player.personId }, ...match.partners]} />
          <ParticipantIds label="Opponent IDs" participants={match.opponents} />
          <div className="match-id-detail"><dt>Match ID</dt><dd><code>{match.providerMatchId || match.id}</code></dd></div>
        </dl>
        {(!match.sets.length || !match.opponents.length) && <p className="data-note">Some optional match details were not supplied by WTN.</p>}
      </div>
    </div>
  </article>;
}
