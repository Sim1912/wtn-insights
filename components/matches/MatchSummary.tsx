import { averageOpponentWtn, opponentStrength } from "@/lib/wtn/match-utils";
import type { NormalizedMatch } from "@/lib/wtn/types";

const dateFormatter = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });

const record = (matches: NormalizedMatch[]) => {
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  return wins + losses ? `${wins}–${losses}` : "—";
};

export function MatchSummary({ matches }: { matches: NormalizedMatch[] }) {
  const decided = matches.filter((match) => match.result !== "unknown");
  const wins = decided.filter((match) => match.result === "win").length;
  const singles = matches.filter((match) => match.matchType === "singles");
  const doubles = matches.filter((match) => match.matchType === "doubles");
  const stronger = decided.filter((match) => opponentStrength(match) === "stronger");
  const strongestWin = matches
    .filter((match) => match.result === "win" && averageOpponentWtn(match) != null)
    .sort((a, b) => (averageOpponentWtn(a) ?? 99) - (averageOpponentWtn(b) ?? 99))[0];
  const form = [...matches]
    .filter((match) => match.status === "completed" && match.result !== "unknown")
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 5);

  return <section className="summary-band" aria-label="Filtered match summary">
    <div className="summary-primary">
      <div className="summary-record"><span>Match record</span><strong>{record(decided)}</strong></div>
      <div className="summary-win-rate"><span>Win rate</span><strong>{decided.length ? `${Math.round((wins / decided.length) * 100)}%` : "—"}</strong><small>{decided.length ? `${wins} of ${decided.length} matches` : "No decided matches"}</small></div>
    </div>
    <div className="summary-secondary" aria-label="Record by match context">
      <div><span>Singles</span><strong>{record(singles)}</strong><small>{singles.length} matches</small></div>
      <div><span>Doubles</span><strong>{record(doubles)}</strong><small>{doubles.length} matches</small></div>
      <div><span>Against stronger</span><strong>{record(stronger)}</strong><small>{stronger.length} matches</small></div>
    </div>
    <div className="summary-form">
      <div className="summary-form-heading"><span>Current form</span><small>Newest first</small></div>
      <div className="form-sequence" role="list" aria-label="Current form, newest match first">{form.length ? form.map((match) => {
        const result = match.result === "win" ? "Win" : "Loss";
        const date = match.date ? dateFormatter.format(new Date(match.date)) : "date unavailable";
        return <b key={match.id} role="listitem" className={match.result} aria-label={`${result}, ${date}`} title={`${result} · ${date}`}>{match.result === "win" ? "W" : "L"}</b>;
      }) : <strong>—</strong>}</div>
    </div>
    {strongestWin && <dl className="strongest-win">
      <div className="strongest-win-opponent"><dt>Best rated win</dt><dd><strong>{strongestWin.opponents.map((opponent) => opponent.name).join(" / ")}</strong></dd></div>
      <div className="strongest-win-context"><dt className="sr-only">Match context</dt><dd><b>WTN {averageOpponentWtn(strongestWin)?.toFixed(2)}</b>{strongestWin.tournament ? <span>{strongestWin.tournament}</span> : null}{strongestWin.date ? <time dateTime={strongestWin.date}>{dateFormatter.format(new Date(strongestWin.date))}</time> : null}</dd></div>
    </dl>}
  </section>;
}
