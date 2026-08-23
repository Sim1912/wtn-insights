import assert from "node:assert/strict";
import test from "node:test";
import { exampleWtnResponse, EXAMPLE_TENNIS_ID, isExampleTennisId } from "../lib/wtn/example-data.ts";
import { DEFAULT_TENNIS_ID, playerIdFromSearchParams } from "../lib/wtn/player-id.ts";

test("uses clear example data instead of a personal player on a fresh visit", () => {
  assert.equal(DEFAULT_TENNIS_ID, EXAMPLE_TENNIS_ID);
  assert.equal(playerIdFromSearchParams(undefined), EXAMPLE_TENNIS_ID);
  assert.equal(exampleWtnResponse.player.name, "Example Player");
  assert.equal(exampleWtnResponse.meta.source, "example");
  assert.ok(exampleWtnResponse.matches.length >= 3);
});

test("recognizes the example player ID without treating real player IDs as examples", () => {
  assert.equal(isExampleTennisId("demo"), true);
  assert.equal(isExampleTennisId("MAU8054205"), false);
});
