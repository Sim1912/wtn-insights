import { useEffect, useId, useRef, useState } from "react";
import type { MatchFilters as MatchFiltersState } from "@/lib/wtn/match-utils";

type Props = {
  filters: MatchFiltersState;
  tournaments: string[];
  visible: number;
  total: number;
  onChange: (next: MatchFiltersState) => void;
  onReset: () => void;
};

type PickerOption<T extends string> = { value: T; label: string };

function FilterPicker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: PickerOption<T>[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: MouseEvent) => { if (!picker.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); } };
    document.addEventListener("mousedown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsidePress); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? label;
  return <div className="filter-picker" ref={picker}>
    <button type="button" className="filter-picker-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId} aria-label={label} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}><span>{selectedLabel}</span><b aria-hidden="true">⌄</b></button>
    {open && <div id={menuId} className="filter-picker-menu" role="listbox" aria-label={label}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "active" : ""} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <b aria-hidden="true">✓</b>}</button>)}</div>}
  </div>;
}

export function MatchFilters({ filters, tournaments, visible, total, onChange, onReset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const set = <Key extends keyof MatchFiltersState>(key: Key, value: MatchFiltersState[Key]) => onChange({ ...filters, [key]: value });
  const activeSecondary = [filters.tournament, filters.strength !== "all", filters.sort !== "newest", filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const hasFilters = filters.result !== "all" || filters.matchType !== "all" || filters.opponent || activeSecondary > 0;
  const tournamentOptions = [{ value: "", label: "All tournaments" }, ...tournaments.map((tournament) => ({ value: tournament, label: tournament }))];
  const strengthOptions: PickerOption<MatchFiltersState["strength"]>[] = [{ value: "all", label: "Any strength" }, { value: "stronger", label: "Stronger opposition" }, { value: "weaker", label: "Weaker opposition" }];
  const sortOptions: PickerOption<MatchFiltersState["sort"]>[] = [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "opponent-wtn", label: "Strongest opposition" }, { value: "closest", label: "Closest match" }];

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
        <div className="filter-field"><span>Tournament</span><FilterPicker key={`tournament-${expanded}`} label="Tournament" value={filters.tournament} options={tournamentOptions} onChange={(value) => set("tournament", value)} /></div>
        <div className="filter-field"><span>Opponent strength</span><FilterPicker key={`strength-${expanded}`} label="Opponent strength" value={filters.strength} options={strengthOptions} onChange={(value) => set("strength", value)} /></div>
        <div className="filter-field"><span>Sort by</span><FilterPicker key={`sort-${expanded}`} label="Sort by" value={filters.sort} options={sortOptions} onChange={(value) => set("sort", value)} /></div>
        <label><span>From</span><input type="date" max={filters.dateTo || undefined} value={filters.dateFrom} onChange={(event) => set("dateFrom", event.target.value)} /></label>
        <label><span>To</span><input type="date" min={filters.dateFrom || undefined} value={filters.dateTo} onChange={(event) => set("dateTo", event.target.value)} /></label>
        <div className="filter-actions">{hasFilters && <button type="button" className="clear-filters" onClick={onReset}>Clear all</button>}<button type="button" className="done-filters" onClick={() => setExpanded(false)}>Done</button></div>
      </div>
    </div>
  </section>;
}
