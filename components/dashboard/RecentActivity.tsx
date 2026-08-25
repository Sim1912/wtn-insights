import { chronologicalMatchOrder, currentSeasonSnapshot } from "@/lib/wtn/match-utils";
import { renderScore } from "@/lib/wtn/score";
import type { NormalizedMatch } from "@/lib/wtn/types";

const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });

function opponentLabel(match: NormalizedMatch) {
  const names = match.opponents
    .map((opponent) => opponent.name.trim())
    .filter((name) => name && !/^unknown(?: unknown)?$/i.test(name));
  return names.length ? names.join(" / ") : "Opponent unavailable";
}

function matchTypeLabel(match: NormalizedMatch) {
  if (match.matchType === "singles") return "Singles";
  if (match.matchType === "doubles") return "Doubles";
  return "Match type unavailable";
}

function resultLabel(match: NormalizedMatch) {
  if (match.result === "win") return { marker: "W", label: "Win" };
  if (match.result === "loss") return { marker: "L", label: "Loss" };
  return { marker: "—", label: "Result unavailable" };
}

export function RecentActivity({ matches, playerId }: { matches: NormalizedMatch[]; playerId: string }) {
  const recentMatches = [...matches].sort((a, b) => chronologicalMatchOrder(b, a)).slice(0, 3);
  const season = currentSeasonSnapshot(matches);
  const decided = season.wins + season.losses;
  const seasonLabel = season.year ? `${season.year} season` : "Current results";
  const matchesHref = `/matches?tennisId=${encodeURIComponent(playerId)}`;

  return <section className="recent-activity" aria-labelledby="recent-activity-title">
    <header className="recent-activity-heading">
      <div><h2 id="recent-activity-title">Recent activity</h2><p>Latest recorded results and season context</p></div>
    </header>
    <div className="recent-activity-grid">
      <section className="recent-matches" aria-labelledby="recent-matches-title">
        <h3 id="recent-matches-title">Recent matches</h3>
        {recentMatches.length ? <div className="recent-match-list">
          {recentMatches.map((match) => {
            const result = resultLabel(match);
            const score = renderScore(match.sets, match.playerSide, match.status, match.scoreText);
            const date = match.completedAt ?? match.date;
            return <a className="recent-match" href={matchesHref} key={match.id} aria-label={`View match history: ${result.label} against ${opponentLabel(match)}, ${score}`}>
              <time dateTime={date ?? undefined}>{date ? dateFormatter.format(new Date(date)) : "Date unavailable"}</time>
              <span className="recent-match-copy"><strong>{opponentLabel(match)}</strong><small>{matchTypeLabel(match)} · {score}</small></span>
              <span className={`recent-match-result ${match.result}`}><b>{result.marker}</b><small>{result.label}</small></span>
            </a>;
          })}
        </div> : <p className="recent-activity-empty">No recent matches were returned for this player.</p>}
      </section>
      <section className="season-snapshot" aria-labelledby="season-snapshot-title">
        <header><h3 id="season-snapshot-title">Season snapshot</h3><span>{seasonLabel}</span></header>
        <dl>
          <div><dt>Matches played</dt><dd>{season.matchesPlayed || "—"}</dd></div>
          <div><dt>Record</dt><dd>{decided ? `${season.wins}–${season.losses}` : "—"}</dd></div>
          <div><dt>Win rate</dt><dd>{decided ? `${Math.round((season.wins / decided) * 100)}%` : "—"}</dd></div>
          <div className="snapshot-strongest"><dt>Strongest opponent beaten</dt><dd>{season.strongestOpponentBeaten ? <><strong>{season.strongestOpponentBeaten.name}</strong><small>WTN {season.strongestOpponentBeaten.wtn.toFixed(2)}</small></> : "—"}</dd></div>
        </dl>
        <p>{decided ? `${decided} completed result${decided === 1 ? "" : "s"} used for record and win rate.` : "No completed results with a known winner."}</p>
      </section>
    </div>
  </section>;
}
