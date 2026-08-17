import { averageOpponentWtn, opponentStrength } from "@/lib/wtn/match-utils";
import type { NormalizedMatch } from "@/lib/wtn/types";

const record = (matches: NormalizedMatch[]) => {
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  return wins + losses ? `${wins}–${losses}` : "—";
};

export function MatchSummary({ matches }: { matches: NormalizedMatch[] }) {
  const decided = matches.filter((match) => match.result !== "unknown");
  const wins = decided.filter((match) => match.result === "win").length;
  const stronger = decided.filter((match) => opponentStrength(match) === "stronger");
  const strongestWin = matches
    .filter((match) => match.result === "win" && averageOpponentWtn(match) != null)
    .sort((a, b) => (averageOpponentWtn(a) ?? 99) - (averageOpponentWtn(b) ?? 99))[0];
  const form = [...matches]
    .filter((match) => match.status === "completed" && match.result !== "unknown")
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 5);

  return <section className="summary-band" aria-label="Filtered match summary">
    <div><span>Record</span><strong>{record(decided)}</strong></div>
    <div><span>Win rate</span><strong>{decided.length ? `${Math.round((wins / decided.length) * 100)}%` : "—"}</strong></div>
    <div><span>Singles</span><strong>{record(matches.filter((match) => match.matchType === "singles"))}</strong></div>
    <div><span>Doubles</span><strong>{record(matches.filter((match) => match.matchType === "doubles"))}</strong></div>
    <div><span>Vs stronger</span><strong>{record(stronger)}</strong></div>
    <div className="summary-form"><span>Recent form</span><div>{form.length ? form.map((match) => <b key={match.id} className={match.result}>{match.result === "win" ? "W" : "L"}</b>) : <strong>—</strong>}</div></div>
    {strongestWin && <p className="strongest-win"><span>Best rated win</span><strong>{strongestWin.opponents.map((opponent) => opponent.name).join(" / ")}</strong><small>WTN {averageOpponentWtn(strongestWin)?.toFixed(2)}</small></p>}
  </section>;
}
