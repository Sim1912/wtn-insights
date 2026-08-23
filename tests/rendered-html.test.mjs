import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test, { after, before } from "node:test";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 4317;
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let serverOutput = "";

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Next production server did not start.\n${serverOutput}`);
}

before(async () => {
  const next = join(projectRoot, "node_modules", ".bin", "next");
  server = spawn(next, ["start", "-p", String(port)], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });
  await waitForServer();
});

after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await once(server, "exit");
});

async function getHtml(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

test("renders the Overview route through the Next production server", async () => {
  const html = await getHtml("/?tennisId=MAU8054205");
  assert.match(html, /<title>WTN Insights — Ratings, matches and analytics<\/title>/i);
  assert.match(html, /Load another Tennis ID/i);
  assert.match(html, /Loading player ratings/i);
  assert.match(html, /href="\/\?tennisId=MAU8054205"/i);
});

test("renders Matches and Analytics with their active destinations", async () => {
  const matches = await getHtml("/matches?tennisId=MAU8054205");
  assert.match(matches, /href="\/matches\?tennisId=MAU8054205"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/matches\?tennisId=MAU8054205"/i);
  assert.match(matches, /Loading match history/i);

  const analytics = await getHtml("/analytics?tennisId=MAU8054205");
  assert.match(analytics, /href="\/analytics\?tennisId=MAU8054205"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/analytics\?tennisId=MAU8054205"/i);
  assert.match(analytics, /Loading analytics/i);
});

test("serves the Next.js WTN route handler", async () => {
  const response = await fetch(`${baseUrl}/api/wtn?tennisId=bad!`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Enter a valid Tennis ID." });
});
