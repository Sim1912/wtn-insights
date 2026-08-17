import { useMemo, useState } from "react";
import { DEFAULT_FILTERS, filterAndSortMatches, type MatchFilters as MatchFiltersState } from "@/lib/wtn/match-utils";
import type { NormalizedMatch } from "@/lib/wtn/types";
import { MatchCard } from "./MatchCard";
import { MatchFilters } from "./MatchFilters";
import { MatchSummary } from "./MatchSummary";

export function MatchHistory({ matches, loading = false }: { matches: NormalizedMatch[]; loading?: boolean }) {
  const [filters, setFilters] = useState<MatchFiltersState>(DEFAULT_FILTERS);
  const tournaments = useMemo(() => [...new Set(matches.map((match) => match.tournament).filter((value): value is string => Boolean(value)))].sort(), [matches]);
  const visibleMatches = useMemo(() => filterAndSortMatches(matches, filters), [matches, filters]);

  return <div className="match-history">
    <section className="match-intro">
      <div><p className="eyebrow">MATCH HISTORY</p><h2>Every match tells a story.</h2></div>
      <p>Official results, scoring detail and pre-match rating context—straight from the live WTN record.</p>
    </section>
    <MatchSummary matches={matches} />
    <MatchFilters filters={filters} tournaments={tournaments} visible={visibleMatches.length} total={matches.length} onChange={setFilters} onReset={() => setFilters(DEFAULT_FILTERS)} />
    <section className="match-list" aria-live="polite" aria-busy={loading}>
      {loading && !matches.length ? <div className="match-empty"><span className="loading-mark" />Loading live match history…</div>
        : visibleMatches.length ? visibleMatches.map((match) => <MatchCard key={match.id} match={match} />)
          : <div className="match-empty"><strong>{matches.length ? "No matches fit these filters." : "No match history was returned."}</strong><p>{matches.length ? "Clear or adjust the filters to widen the result." : "WTN may still have rating history available for this player."}</p></div>}
    </section>
  </div>;
}
