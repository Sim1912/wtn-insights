import assert from "node:assert/strict";
import test from "node:test";

test("renders WTN Insights metadata and the loading dashboard shell", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>WTN Insights — Every match, the full story<\/title>/i);
  assert.match(html, /<meta(?=[^>]*property=["']og:image["'])[^>]*>/i);
  assert.match(html, /Load another Tennis ID/i);
  assert.match(html, /Loading player ratings/i);
});

test("renders the analytics route directly", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("analytics-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/analytics?tennisId=MAU8054205", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Loading analytics/i);
  assert.match(html, /Analytics/i);
});

test("renders the matches route with Matches as the active destination", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("matches-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/matches?tennisId=MAU8054205", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<a(?=[^>]*href=["']\/matches\?tennisId=MAU8054205["'])(?=[^>]*aria-current=["']page["'])[^>]*>/i);
  assert.doesNotMatch(html, /<a(?=[^>]*href=["']\/\?tennisId=MAU8054205["'])(?=[^>]*aria-current=["']page["'])[^>]*>/i);
});
