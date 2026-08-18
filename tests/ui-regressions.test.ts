import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const overview = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../components/ratings/RatingChart.tsx", import.meta.url), "utf8");
const analytics = readFileSync(new URL("../components/analytics/AnalyticsPage.tsx", import.meta.url), "utf8");

test("homepage WTN values retain their dedicated large-number treatment", () => {
  assert.match(overview, /className="rating-number"/);
  assert.match(styles, /\.rating-number\s*\{[^}]*font-size:\s*clamp\(/s);
  assert.match(styles, /\.rating-card-meta\s*\{/);
});

test("rating history connects sparse periods and explains direction", () => {
  assert.match(chart, /connectNulls/);
  assert.match(chart, /Lower WTN is stronger/);
  assert.doesNotMatch(chart, /stronger-label/);
});

test("analytics uses honest rating and chart empty states", () => {
  assert.match(analytics, /report\.trends\.length > 1 && hasTrendValues/);
  assert.match(analytics, /ratingBandSample \?/);
  assert.match(analytics, /No completed matches with full pre-match ratings/);
  assert.match(analytics, /report\.strongerOpponents\.denominator \? report\.upsetWins/);
  assert.match(analytics, /report\.weakerOpponents\.denominator \? report\.favouriteLosses/);
});

test("analytics evidence interactions retain keyboard context without hover tooltips", () => {
  assert.doesNotMatch(analytics, /role="tooltip"/);
  assert.doesNotMatch(analytics, /aria-describedby=\{definitionId\}/);
  assert.match(analytics, /sibling\.inert = true/);
  assert.match(analytics, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(analytics, /returnFocus\.current\?\.focus\(\)/);
  assert.match(styles, /\.record-stack \.analytics-record-row:focus-visible[^}]*outline-offset:\s*-3px/s);
  assert.match(styles, /\.analytics-dates input[^}]*\.trend-panel select[^}]*\.pattern-list button[^}]*\.partner-table button[^}]*min-height:\s*44px/s);
});
