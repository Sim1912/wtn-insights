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
  const set = <Key extends keyof MatchFiltersState>(key: Key, value: MatchFiltersState[Key]) => onChange({ ...filters, [key]: value });
  const hasFilters = filters.result !== "all" || filters.matchType !== "all" || filters.dateFrom || filters.dateTo
    || filters.tournament || filters.opponent || filters.strength !== "all" || filters.sort !== "newest";

  return <section className="filters-panel" aria-label="Match filters">
    <div className="filter-heading">
      <div><p className="eyebrow">FIND A MATCH</p><h2>Filter the record</h2></div>
      <p><strong>{visible}</strong> of {total} matches</p>
    </div>
    <div className="segmented-row">
      <div className="segmented" aria-label="Filter by result">
        {(["all", "win", "loss"] as const).map((value) => <button key={value} type="button" className={filters.result === value ? "active" : ""} onClick={() => set("result", value)}>{value === "all" ? "All results" : value === "win" ? "Wins" : "Losses"}</button>)}
      </div>
      <div className="segmented" aria-label="Filter by match type">
        {(["all", "singles", "doubles"] as const).map((value) => <button key={value} type="button" className={filters.matchType === value ? "active" : ""} onClick={() => set("matchType", value)}>{value === "all" ? "All formats" : value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
    </div>
    <div className="filter-grid">
      <label className="search-field"><span>Opponent</span><input type="search" value={filters.opponent} onChange={(event) => set("opponent", event.target.value)} placeholder="Search a player" /></label>
      <label><span>Tournament</span><select value={filters.tournament} onChange={(event) => set("tournament", event.target.value)}><option value="">All tournaments</option>{tournaments.map((tournament) => <option key={tournament}>{tournament}</option>)}</select></label>
      <label><span>Opponent strength</span><select value={filters.strength} onChange={(event) => set("strength", event.target.value as MatchFiltersState["strength"])}><option value="all">Any strength</option><option value="stronger">Stronger than player</option><option value="weaker">Weaker than player</option></select></label>
      <label><span>Sort by</span><select value={filters.sort} onChange={(event) => set("sort", event.target.value as MatchFiltersState["sort"])}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="opponent-wtn">Strongest opponent WTN</option><option value="closest">Closest match</option></select></label>
      <label><span>From</span><input type="date" value={filters.dateFrom} onChange={(event) => set("dateFrom", event.target.value)} /></label>
      <label><span>To</span><input type="date" value={filters.dateTo} onChange={(event) => set("dateTo", event.target.value)} /></label>
    </div>
    {hasFilters && <button className="reset-filters" type="button" onClick={onReset}>Clear all filters</button>}
  </section>;
}
