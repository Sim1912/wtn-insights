import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const matchCard = readFileSync(new URL("../components/matches/MatchCard.tsx", import.meta.url), "utf8");
const matchFilters = readFileSync(new URL("../components/matches/MatchFilters.tsx", import.meta.url), "utf8");
const matchSummary = readFileSync(new URL("../components/matches/MatchSummary.tsx", import.meta.url), "utf8");
const matchChart = readFileSync(new URL("../components/matches/MatchResultsChart.tsx", import.meta.url), "utf8");

test("keeps mobile match status and date visible", () => {
  assert.doesNotMatch(styles, /\.status-label\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(styles, /\.match-card-header time\s*\{[^}]*display:\s*none/);
  assert.match(styles, /\.match-result-meta\s*\{[^}]*flex-wrap:\s*wrap/);
});

test("renders doubles WTN values line by line", () => {
  assert.match(matchCard, /className="wtn-values"/);
  assert.match(matchCard, /entries\.map/);
  assert.match(styles, /\.wtn-values\s*\{[^}]*display:\s*grid/);
});

test("keeps narrow match filters contained and touch friendly", () => {
  assert.match(styles, /\.filter-primary \.format-segment\s*\{\s*grid-column:\s*1 \/ -1;\s*grid-row:\s*2;/);
  assert.match(styles, /\.opponent-search input, \.filter-secondary select, \.filter-secondary input\s*\{\s*height:\s*44px;\s*min-height:\s*44px;/);
  assert.match(matchFilters, /className="filter-picker-menu" role="group"/);
  assert.match(matchFilters, /aria-label=\{`\$\{label\}: \$\{selectedLabel\}`\}/);
  assert.match(matchFilters, /aria-pressed=\{option\.value === value\}/);
  assert.match(styles, /\.filter-picker-menu\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /\.filter-disclosure\[data-open="true"\] \.filter-secondary\s*\{\s*overflow:\s*visible;/);
  assert.match(styles, /\.performance-summary\s*\{\s*overflow:\s*visible;/);
});

test("exposes filter and chart groups to assistive technology", () => {
  assert.match(matchFilters, /role="group" aria-label="Result"/);
  assert.match(matchFilters, /role="group" aria-label="Match type"/);
  assert.match(matchChart, /className="results-legend" role="list" aria-label="Chart legend"/);
  assert.match(matchChart, /role="listitem"/);
});

test("uses structured description markup for the strongest opponent beaten", () => {
  assert.match(matchSummary, /<dl className="strongest-win">/);
  assert.doesNotMatch(matchSummary, /<article className="strongest-win">/);
  assert.match(matchSummary, /Strongest opponent beaten/);
});
