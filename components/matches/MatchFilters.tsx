import { useState } from "react";
import type { MatchFilters as MatchFiltersState } from "@/lib/wtn/match-utils";

type Props = {
  filters: MatchFiltersState;
  tournaments: string[];
  visible: number;
  total: number;
  onChange: (next: MatchFiltersState) => void;
  onReset: () => void;
};

export function MatchFilters({ filters, tournaments, visible, total, onChange, onReset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const set = <Key extends keyof MatchFiltersState>(key: Key, value: MatchFiltersState[Key]) => onChange({ ...filters, [key]: value });
  const activeSecondary = [filters.tournament, filters.strength !== "all", filters.sort !== "newest", filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const hasFilters = filters.result !== "all" || filters.matchType !== "all" || filters.opponent || activeSecondary > 0;

  return <section className={`match-filter-bar ${expanded ? "filters-open" : ""}`} aria-label="Match filters">
    <div className="filter-primary">
      <div className="filter-segment" role="group" aria-label="Result">
        {(["all", "win", "loss"] as const).map((value) => <button key={value} type="button" aria-pressed={filters.result === value} className={filters.result === value ? "active" : ""} onClick={() => set("result", value)}>{value === "all" ? "All" : value === "win" ? "Wins" : "Losses"}</button>)}
      </div>
      <div className="filter-segment format-segment" role="group" aria-label="Match type">
        {(["all", "singles", "doubles"] as const).map((value) => <button key={value} type="button" aria-pressed={filters.matchType === value} className={filters.matchType === value ? "active" : ""} onClick={() => set("matchType", value)}>{value === "all" ? "Any" : value === "singles" ? "Singles" : "Doubles"}</button>)}
      </div>
      <label className="opponent-search"><span className="sr-only">Search opponents</span><input type="search" value={filters.opponent} onChange={(event) => set("opponent", event.target.value)} placeholder="Search opponent" /></label>
      <button className="more-filters" type="button" aria-expanded={expanded} aria-controls="secondary-match-filters" onClick={() => setExpanded((value) => !value)}>Filters{activeSecondary ? <span>{activeSecondary}</span> : null}</button>
      <p className="filter-count" aria-live="polite"><strong>{visible}</strong><span>{visible === total ? " matches" : ` of ${total}`}</span>{visible !== total ? <small> matches</small> : null}</p>
    </div>
    <div className="filter-disclosure" id="secondary-match-filters" data-open={expanded} aria-hidden={!expanded} inert={!expanded}>
      <div className="filter-secondary">
        <label><span>Tournament</span><select value={filters.tournament} onChange={(event) => set("tournament", event.target.value)}><option value="">All tournaments</option>{tournaments.map((tournament) => <option key={tournament}>{tournament}</option>)}</select></label>
        <label><span>Opponent strength</span><select value={filters.strength} onChange={(event) => set("strength", event.target.value as MatchFiltersState["strength"])}><option value="all">Any strength</option><option value="stronger">Stronger opposition</option><option value="weaker">Weaker opposition</option></select></label>
        <label><span>Sort by</span><select value={filters.sort} onChange={(event) => set("sort", event.target.value as MatchFiltersState["sort"])}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="opponent-wtn">Strongest opposition</option><option value="closest">Closest match</option></select></label>
        <label><span>From</span><input type="date" max={filters.dateTo || undefined} value={filters.dateFrom} onChange={(event) => set("dateFrom", event.target.value)} /></label>
        <label><span>To</span><input type="date" min={filters.dateFrom || undefined} value={filters.dateTo} onChange={(event) => set("dateTo", event.target.value)} /></label>
        <div className="filter-actions">{hasFilters && <button type="button" className="clear-filters" onClick={onReset}>Clear all</button>}<button type="button" className="done-filters" onClick={() => setExpanded(false)}>Done</button></div>
      </div>
    </div>
  </section>;
}
