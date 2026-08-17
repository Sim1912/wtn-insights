import { averageOpponentWtn, opponentStrength } from "@/lib/wtn/match-utils";
import type { NormalizedMatch } from "@/lib/wtn/types";

const record = (matches: NormalizedMatch[]) => {
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  return wins + losses ? `${wins}–${losses}` : "Not enough data";
};

export function MatchSummary({ matches }: { matches: NormalizedMatch[] }) {
  const decided = matches.filter((match) => match.result !== "unknown");
  const wins = decided.filter((match) => match.result === "win").length;
  const losses = decided.length - wins;
  const stronger = decided.filter((match) => opponentStrength(match) === "stronger");
  const strongestWin = matches
    .filter((match) => match.result === "win" && averageOpponentWtn(match) != null)
    .sort((a, b) => (averageOpponentWtn(a) ?? 99) - (averageOpponentWtn(b) ?? 99))[0];
  const form = matches
    .filter((match) => match.status === "completed" && match.result !== "unknown")
    .slice(0, 5);

  const items = [
    { label: "Matches", value: matches.length ? String(matches.length) : "No matches", note: "In the loaded WTN period" },
    { label: "Overall record", value: decided.length ? `${wins}–${losses}` : "Not enough data", note: decided.length ? `${Math.round((wins / decided.length) * 100)}% win rate` : "Official results required" },
    { label: "Singles", value: record(matches.filter((match) => match.matchType === "singles")), note: "Singles win–loss" },
    { label: "Doubles", value: record(matches.filter((match) => match.matchType === "doubles")), note: "Doubles win–loss" },
    { label: "Vs stronger", value: record(stronger), note: stronger.length ? "Lower-rated WTN opponents" : "Not enough comparable ratings" },
  ];

  return <section className="match-summary" aria-label="Match history summary">
    {items.map((item) => <article key={item.label} className="summary-stat">
      <p>{item.label}</p><strong>{item.value}</strong><small>{item.note}</small>
    </article>)}
    <article className="summary-stat featured-stat">
      <p>Strongest opponent beaten</p>
      <strong>{strongestWin ? strongestWin.opponents.map((opponent) => opponent.name).join(" / ") : "Not enough data"}</strong>
      <small>{strongestWin ? `WTN ${averageOpponentWtn(strongestWin)?.toFixed(2)}` : "A win and both ratings are required"}</small>
    </article>
    <article className="summary-stat form-stat">
      <p>Current form</p>
      {form.length ? <div className="form-row" aria-label={form.map((match) => match.result).join(", ")}>
        {form.map((match) => <span key={match.id} className={match.result}>{match.result === "win" ? "W" : "L"}</span>)}
      </div> : <strong>Not enough data</strong>}
      <small>Last five completed matches</small>
    </article>
  </section>;
}
