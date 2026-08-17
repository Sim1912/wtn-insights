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

export function MatchHistory({ matches, player, loading = false }: { matches: NormalizedMatch[]; player: PlayerProfile; loading?: boolean }) {
  const [filters, setFilters] = useState<MatchFiltersState>(DEFAULT_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tournaments = useMemo(() => [...new Set(matches.map((match) => match.tournament).filter((value): value is string => Boolean(value)))].sort(), [matches]);
  const visibleMatches = useMemo(() => filterAndSortMatches(matches, filters), [matches, filters]);
  const resetFilters = () => { setFilters(DEFAULT_FILTERS); setExpandedId(null); };

  if (loading && !matches.length) return <div className="match-history"><div className="match-heading skeleton-heading"><span /><i /></div><MatchSkeleton /><MatchSkeleton /><MatchSkeleton /></div>;
  if (!matches.length) return <div className="match-empty"><strong>No match history returned</strong><p>Rating data may still be available for this player.</p></div>;

  return <div className="match-history">
    <header className="match-heading"><h2>Results</h2></header>
    <MatchFilters filters={filters} tournaments={tournaments} visible={visibleMatches.length} total={matches.length} onChange={(next) => { setFilters(next); setExpandedId(null); }} onReset={resetFilters} />
    <MatchSummary matches={visibleMatches} />
    <MatchResultsChart matches={visibleMatches} />
    <section className="match-list" aria-busy={loading}>
      {visibleMatches.length ? visibleMatches.map((match) => <MatchCard key={match.id} match={match} player={player} expanded={expandedId === match.id} onToggle={() => setExpandedId((current) => current === match.id ? null : match.id)} />)
        : <div className="match-empty"><strong>No matches fit these filters</strong><p>Clear the filters to return to the full record.</p><button type="button" onClick={resetFilters}>Clear filters</button></div>}
    </section>
  </div>;
}
