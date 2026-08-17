import assert from "node:assert/strict";
import test from "node:test";
import { parseScoreText, renderScore, resultFromWinner, statusFromScoreText } from "../lib/wtn/score.ts";

const cases = [
  ["6–4 6–3", "6–4 6–3"],
  ["6–7(5) 7–6(4) 10–7", "6–7(5) 7–6(4) [10–7]"],
  ["6–3 4–6 [10–8]", "6–3 4–6 [10–8]"],
  ["7–5 6–7(6) 7–6(8)", "7–5 6–7(6) 7–6(8)"],
  ["6–2 3–6 6–4 4–6 6–3", "6–2 3–6 6–4 4–6 6–3"],
  ["4–2 4–3(5)", "4–2 4–3(5)"],
] as const;

for (const [raw, expected] of cases) {
  test(`parses and renders ${raw}`, () => {
    assert.equal(renderScore(parseScoreText(raw)), expected);
  });
}

test("renders retirement after the incomplete score", () => {
  const raw = "6–4 2–1 RET";
  assert.equal(statusFromScoreText(raw), "retired");
  assert.equal(renderScore(parseScoreText(raw), 1, "retired"), raw);
});

test("renders a walkover without inventing sets", () => {
  assert.deepEqual(parseScoreText("W/O"), []);
  assert.equal(statusFromScoreText("W/O"), "walkover");
  assert.equal(renderScore([], 1, "walkover"), "W/O");
});

test("handles a completely missing score safely", () => {
  assert.deepEqual(parseScoreText(null), []);
  assert.equal(renderScore([], 1, "completed", null), "Score unavailable");
});

test("official winningSide remains authoritative", () => {
  const sets = parseScoreText("6–4 6–3");
  assert.equal(renderScore(sets), "6–4 6–3");
  assert.equal(resultFromWinner(1, 2), "loss");
  assert.equal(resultFromWinner(1, 1), "win");
  assert.equal(resultFromWinner(1, null), "unknown");
});

test("renders the score from side two's perspective", () => {
  assert.equal(renderScore(parseScoreText("6–4 7–6(3)"), 2), "4–6 6–7(3)");
});
