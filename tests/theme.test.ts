import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const appChrome = readFileSync(new URL("../components/shell/AppChrome.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const mountSensitiveSources = [
  "../components/dashboard/Dashboard.tsx",
  "../components/analytics/AnalyticsPage.tsx",
  "../components/ratings/RatingChart.tsx",
  "../components/matches/MatchHistory.tsx",
  "../components/matches/MatchResultsChart.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

const STORAGE_KEY = "wtn-insights-court-theme";

function matchingBlocks(source: string, header: RegExp): string[] {
  const flags = header.flags.includes("g") ? header.flags : `${header.flags}g`;
  const pattern = new RegExp(header.source, flags);
  const blocks: string[] = [];
  for (const match of source.matchAll(pattern)) {
    const openingBrace = source.indexOf("{", match.index + match[0].length);
    if (openingBrace < 0) continue;
    let depth = 0;
    for (let index = openingBrace; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(openingBrace + 1, index));
          break;
        }
      }
    }
  }
  return blocks;
}

test("boots with a hydration-safe, validated court theme", () => {
  assert.match(
    layout,
    /<html\b(?=[^>]*\bdata-theme\s*=\s*\{initialTheme\})(?=[^>]*\bsuppressHydrationWarning(?:\s*=\s*\{true\})?)[^>]*>/s,
  );
  assert.match(layout, new RegExp(`["']${STORAGE_KEY}["']`));
  assert.match(layout, /localStorage\.getItem\s*\(/);
  assert.match(`${layout}\n${appChrome}`, /localStorage\.setItem\s*\(/);
  assert.match(layout, /cookies\s*\(/);
  assert.match(appChrome, /document\.cookie\s*=/);

  const validatesKnownThemes =
    /(?:includes|has)\s*\([^)]*(?:theme|stored)/i.test(layout)
    || (/===\s*["']grass["']/.test(layout) && /===\s*["']clay["']/.test(layout))
    || /(?:theme|stored)[^?;\n]*===\s*["']clay["'][^?;\n]*\?[^:;\n]*:[^;\n]*["']grass["']/i.test(layout);
  assert.ok(
    /["']grass["']/.test(layout) && /["']clay["']/.test(layout) && validatesKnownThemes,
    "the pre-hydration bootstrap must accept only the grass and clay themes",
  );
  assert.match(appChrome, /queueMicrotask\s*\(/);
});

test("exposes semantic Grass and Clay controls without remounting pages or charts", () => {
  assert.match(appChrome, /["']Grass["']/i);
  assert.match(appChrome, /["']Clay["']/i);
  assert.match(appChrome, /type\s*=\s*["']button["']/);
  assert.match(appChrome, /role\s*=\s*["']switch["']/);
  assert.match(appChrome, /aria-checked\s*=/);
  assert.match(appChrome, /useRef\s*\(/);
  assert.match(appChrome, /(?:transition|sweep)/i);
  assert.match(appChrome, /matchMedia\s*\(\s*["']\(prefers-reduced-motion:\s*reduce\)["']\s*\)/);

  const sweepElements = `${layout}\n${appChrome}`.match(/className\s*=\s*["']court-theme-sweep["']/g) ?? [];
  assert.equal(sweepElements.length, 1, "render exactly one non-interactive court theme sweep element");
  assert.doesNotMatch(
    mountSensitiveSources,
    /\bkey\s*=\s*\{[^}]*\b(?:courtTheme|theme)\b[^}]*\}/i,
    "theme changes must not force page or chart remounts",
  );
});

test("keeps theme switching focusable while a transition is locked", () => {
  assert.match(appChrome, /aria-disabled=\{pendingTheme \? "true" : undefined\}/);
  assert.doesNotMatch(appChrome, /disabled=\{pendingTheme != null\}/);
  assert.match(styles, /\.theme-selector\[aria-disabled=["']true["']\]/);
});

test("renders the independent-prototype disclosure in the shared layout", () => {
  assert.match(layout, /<footer\s+className="product-footer">/);
  assert.match(layout, /Independent prototype\. Not affiliated with or endorsed by the ITF or World Tennis Number\./);
  assert.match(styles, /\.product-footer-inner\s*\{[^}]*border-top:\s*1px solid var\(--canvas-border\)/s);
});

test("player context has explicit missing-data fallbacks", () => {
  assert.match(appChrome, /Player unavailable/);
  assert.match(appChrome, /Country unavailable/);
  assert.match(appChrome, /Tennis ID unavailable/);
  assert.match(appChrome, /Last update unavailable/);
  assert.match(appChrome, /Number\.isNaN\(date\.getTime\(\)\)/);
});

test("shared mobile controls retain touch targets without hover translation", () => {
  assert.match(styles, /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.theme-selector\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.nav-player-search button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  assert.doesNotMatch(styles, /:hover[^{}]*\{[^}]*transform:\s*translate(?:3d|X|Y)?\(/s);
});

test("provides Clay styling, a visible selector focus state and a short sweep", () => {
  assert.match(styles, /html\s*\[\s*data-theme\s*=\s*["']?clay["']?\s*\]/);
  const hasSelectorFocusRule = [...styles.matchAll(/([^{}]+)\{/g)].some((match) =>
    match[1].includes(".theme-selector") && match[1].includes(":focus-visible"),
  );
  assert.ok(hasSelectorFocusRule, "the theme selector needs an explicit focus-visible rule");
  assert.match(styles, /\.theme-selector-indicator\s*\{[^}]*transition\s*:[^;}]*transform/s);
  assert.match(styles, /\.theme-selector\[data-active=["']clay["']\]\s+\.theme-selector-indicator\s*\{[^}]*translateX\(/s);
  assert.match(styles, /@keyframes\s+[\w-]*court[\w-]*sweep[\w-]*\s*\{/i);

  const sweepRules = [...styles.matchAll(/[^{}]*\.court-theme-sweep[^{}]*\{([^{}]*)\}/g)].map((match) => match[1]);
  const animatedSweep = sweepRules.find((body) => /\banimation(?:-duration)?\s*:/.test(body));
  assert.ok(animatedSweep, "the court theme sweep needs an animation rule");
  const durations = [...(animatedSweep ?? "").matchAll(/(\d+(?:\.\d+)?)\s*(ms|s)\b/g)].map((match) =>
    Number(match[1]) * (match[2] === "s" ? 1000 : 1),
  );
  assert.ok(
    durations.some((duration) => duration >= 400 && duration <= 700),
    "the theme sweep should finish in roughly half a second",
  );

  const reducedMotionBlocks = matchingBlocks(styles, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  assert.ok(reducedMotionBlocks.length, "provide a reduced-motion media query");
  assert.ok(
    reducedMotionBlocks.some((body) =>
      /\.court-theme-sweep[\s\S]*(?:animation|transition)\s*:\s*none\b/.test(body)
      || /\*\s*\{[^}]*animation\s*:\s*none\s*!important[^}]*transition\s*:\s*none\s*!important/s.test(body),
    ),
    "the sweep must be disabled by a targeted or universal reduced-motion rule",
  );
});
