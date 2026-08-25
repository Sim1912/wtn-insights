import { useMemo, useState } from "react";
import { DEFAULT_FILTERS, filterAndSortMatches, type MatchFilters as MatchFiltersState } from "@/lib/wtn/match-utils";
import type { NormalizedMatch, PlayerProfile } from "@/lib/wtn/types";
import { MatchCard } from "./MatchCard";
import { MatchFilters } from "./MatchFilters";
import { MatchResultsChart } from "./MatchResultsChart";
import { MatchSummary } from "./MatchSummary";

function MatchSkeleton() {
  return <div className="match-card-skeleton" aria-hidden="true"><span /><div><i /><i /><i /></div></div>;
}

export function MatchHistorySkeleton() {
  return <div className="match-history" role="status" aria-label="Loading match history">
    <div className="match-heading skeleton-heading"><span /><i /></div>
    <div className="match-filter-skeleton" aria-hidden="true" />
    <MatchSkeleton /><MatchSkeleton /><MatchSkeleton />
  </div>;
}

export function MatchHistory({ matches, player, loading = false }: { matches: NormalizedMatch[]; player: PlayerProfile; loading?: boolean }) {
  const [filters, setFilters] = useState<MatchFiltersState>(DEFAULT_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tournaments = useMemo(() => [...new Set(matches.map((match) => match.tournament).filter((value): value is string => Boolean(value)))].sort(), [matches]);
  const visibleMatches = useMemo(() => filterAndSortMatches(matches, filters), [matches, filters]);
  const resetFilters = () => { setFilters(DEFAULT_FILTERS); setExpandedId(null); };
  const countLabel = visibleMatches.length === matches.length
    ? `${visibleMatches.length} ${visibleMatches.length === 1 ? "match" : "matches"}`
    : `${visibleMatches.length} of ${matches.length} ${matches.length === 1 ? "match" : "matches"}`;

  if (loading && !matches.length) return <MatchHistorySkeleton />;
  if (!matches.length) return <div className="match-empty"><strong>No match history available</strong><p>Rating data may still be available for this player.</p></div>;

  return <div className="match-history">
    <section className="match-intro">
      <header className="match-heading"><div><h2>Match history</h2><p aria-live="polite">{countLabel}</p></div></header>
      <MatchFilters filters={filters} tournaments={tournaments} onChange={(next) => { setFilters(next); setExpandedId(null); }} onReset={resetFilters} />
    </section>
    <div><MatchSummary matches={visibleMatches} /></div>
    <MatchResultsChart matches={visibleMatches} />
    <section className="match-list" aria-busy={loading} aria-label={`${visibleMatches.length} filtered ${visibleMatches.length === 1 ? "match" : "matches"}`}>
      {visibleMatches.length ? visibleMatches.map((match) => <div className="match-reveal" key={match.id}><MatchCard match={match} player={player} expanded={expandedId === match.id} onToggle={() => setExpandedId((current) => current === match.id ? null : match.id)} /></div>)
        : <div className="match-empty"><strong>No matches fit these filters</strong><p>Clear the filters to return to the full record.</p><button type="button" onClick={resetFilters}>Clear filters</button></div>}
    </section>
  </div>;
}
