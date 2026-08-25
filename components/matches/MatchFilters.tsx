import { useEffect, useId, useRef, useState } from "react";
import type { MatchFilters as MatchFiltersState } from "@/lib/wtn/match-utils";

type Props = {
  filters: MatchFiltersState;
  tournaments: string[];
  onChange: (next: MatchFiltersState) => void;
  onReset: () => void;
};

type PickerOption<T extends string> = { value: T; label: string };

function FilterPicker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: PickerOption<T>[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const restoreTriggerFocus = () => window.requestAnimationFrame(() => trigger.current?.focus());
  useEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    optionButtons.current[selectedIndex]?.focus();
    const closeOnOutsidePress = (event: MouseEvent) => { if (!picker.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      restoreTriggerFocus();
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsidePress); document.removeEventListener("keydown", closeOnEscape); };
  }, [open, options, value]);

  function moveOptionFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const available = optionButtons.current.filter((button): button is HTMLButtonElement => Boolean(button));
    if (!available.length) return;
    const currentIndex = Math.max(0, available.indexOf(document.activeElement as HTMLButtonElement));
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? available.length - 1
      : event.key === "ArrowDown" ? (currentIndex + 1) % available.length
      : (currentIndex - 1 + available.length) % available.length;
    available[nextIndex].focus();
  }

  const selectedLabel = options.find((option) => option.value === value)?.label ?? label;
  return <div className="filter-picker" ref={picker} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="filter-picker-trigger" aria-expanded={open} aria-controls={menuId} aria-haspopup="true" aria-label={`${label}: ${selectedLabel}`} onKeyDown={(event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      setOpen(true);
    }} onClick={() => setOpen((current) => !current)}><span>{selectedLabel}</span><b aria-hidden="true">⌄</b></button>
    {open && <div id={menuId} className="filter-picker-menu" role="group" aria-label={label} onKeyDown={moveOptionFocus}>{options.map((option, index) => <button ref={(node) => { optionButtons.current[index] = node; }} key={option.value} type="button" aria-pressed={option.value === value} className={option.value === value ? "active" : ""} onClick={() => { onChange(option.value); setOpen(false); restoreTriggerFocus(); }}><span>{option.label}</span>{option.value === value && <b aria-hidden="true">✓</b>}</button>)}</div>}
  </div>;
}

export function MatchFilters({ filters, tournaments, onChange, onReset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const set = <Key extends keyof MatchFiltersState>(key: Key, value: MatchFiltersState[Key]) => onChange({ ...filters, [key]: value });
  const activeSecondary = [filters.tournament, filters.strength !== "all", filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const hasFilters = filters.result !== "all" || filters.matchType !== "all" || filters.opponent || filters.sort !== "newest" || activeSecondary > 0;
  const tournamentOptions = [{ value: "", label: "All tournaments" }, ...tournaments.map((tournament) => ({ value: tournament, label: tournament }))];
  const strengthOptions: PickerOption<MatchFiltersState["strength"]>[] = [{ value: "all", label: "Any strength" }, { value: "stronger", label: "Stronger opposition" }, { value: "weaker", label: "Weaker opposition" }];
  const sortOptions: PickerOption<MatchFiltersState["sort"]>[] = [{ value: "newest", label: "Most recent first" }, { value: "oldest", label: "Oldest first" }, { value: "opponent-wtn", label: "Strongest opposition" }, { value: "closest", label: "Closest match" }];

  return <section className={`match-filter-bar ${expanded ? "filters-open" : ""}`} aria-label="Match filters">
    <div className="filter-primary">
      <div className="filter-segment" role="group" aria-label="Result">
        {(["all", "win", "loss"] as const).map((value) => <button key={value} type="button" aria-pressed={filters.result === value} className={filters.result === value ? "active" : ""} onClick={() => set("result", value)}>{value === "all" ? "All" : value === "win" ? "Wins" : "Losses"}</button>)}
      </div>
      <div className="filter-segment format-segment" role="group" aria-label="Match type">
        {(["all", "singles", "doubles"] as const).map((value) => <button key={value} type="button" aria-pressed={filters.matchType === value} className={filters.matchType === value ? "active" : ""} onClick={() => set("matchType", value)}>{value === "all" ? "Any" : value === "singles" ? "Singles" : "Doubles"}</button>)}
      </div>
      <label className="opponent-search"><span className="sr-only">Search opponents</span><input type="search" value={filters.opponent} onChange={(event) => set("opponent", event.target.value)} placeholder="Search opponent" /></label>
      <div className="filter-primary-sort"><span className="sr-only">Sort matches</span><FilterPicker label="Sort matches" value={filters.sort} options={sortOptions} onChange={(value) => set("sort", value)} /></div>
      <button className="more-filters" type="button" aria-expanded={expanded} aria-controls="secondary-match-filters" onClick={() => setExpanded((value) => !value)}>Filters{activeSecondary ? <span>{activeSecondary}</span> : null}</button>
    </div>
      <div className="filter-disclosure" id="secondary-match-filters" data-open={expanded} aria-hidden={!expanded} inert={!expanded}>
      <div className="filter-secondary">
        <div className="filter-field"><span>Tournament</span><FilterPicker key={`tournament-${expanded}`} label="Tournament" value={filters.tournament} options={tournamentOptions} onChange={(value) => set("tournament", value)} /></div>
        <div className="filter-field"><span>Opponent strength</span><FilterPicker key={`strength-${expanded}`} label="Opponent strength" value={filters.strength} options={strengthOptions} onChange={(value) => set("strength", value)} /></div>
        <label><span>From</span><input type="date" max={filters.dateTo || undefined} value={filters.dateFrom} onChange={(event) => set("dateFrom", event.target.value)} /></label>
        <label><span>To</span><input type="date" min={filters.dateFrom || undefined} value={filters.dateTo} onChange={(event) => set("dateTo", event.target.value)} /></label>
        <div className="filter-actions">{hasFilters && <button type="button" className="clear-filters" onClick={onReset}>Clear all</button>}<button type="button" className="done-filters" onClick={() => setExpanded(false)}>Done</button></div>
      </div>
    </div>
  </section>;
}
