import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("confidence styles do not shrink the animated WTN value", () => {
  assert.doesNotMatch(styles, /\.rating-value-row\s+span\s*\{/);
  assert.match(styles, /\.rating-value-row\s*>\s*span\s*\{/);
});
