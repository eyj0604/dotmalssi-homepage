import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function callWorker(request, bindings = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    request,
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...bindings,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function render(pathname = "/", origin = "http://localhost") {
  return callWorker(
    new Request(new URL(pathname, origin), {
      headers: { accept: "text/html" },
    }),
  );
}

test("renders the finished Korean homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="ko"/i);
  assert.match(html, /<title>도트말씨 \| 레트로 게임 한글화 공방<\/title>/i);
  assert.match(html, /옛 게임의 말씨를/);
  assert.match(html, /한 칸씩, 근거로 완성한다/);
  assert.match(html, /Lunar Legend GBA/);
  assert.match(html, /공개 RC2/);
  assert.match(html, /매듭/);
  assert.match(html, /독립 교차검수/);
  assert.match(html, /비공식 팬 한글화이며 원작 권리자와 무관합니다/);
  assert.match(html, /본문으로 바로가기/);
  assert.match(html, /남긴 글은 검토하고/);
  assert.match(html, /자동 생성·공개 · OFF/);
  assert.match(html, /이야기함 접수는 아직 준비 중입니다/);
  assert.match(html, /보존 기한 뒤 물리 삭제와 운영 검증/);
  assert.match(html, /application\/ld\+json/);
  assert.match(
    html,
    /https:\/\/github\.com\/eyj0604\/dotmalssi-homepage/,
  );
  assert.doesNotMatch(html, /0회/);

  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
  assert.doesNotMatch(html, /href="[^"]+\.(?:gb|gbc|gba|nes|sfc|smc|sav|state|zip)"/i);
  assert.doesNotMatch(html, /roms?(?:download|\/|\.)/i);
});

test("ships canonical brand assets and accessibility rules", async () => {
  const required = [
    "public/brand/dotmalssi-horizontal.svg",
    "public/brand/dotmalssi-compact.svg",
    "public/brand/dotmalssi-mark.svg",
    "public/brand/dotmalssi-mark-16.svg",
  ];

  await Promise.all(required.map((file) => access(new URL(file, projectRoot))));

  const [css, page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
  ]);

  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*3px solid var\(--ink\)/);
  assert.match(css, /box-shadow:\s*0 0 0 6px var\(--paper\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /filter:\s*brightness\(/);
  assert.match(page, /aria-label="주요 메뉴"/);
  assert.match(page, /status-badge/);
  assert.match(layout, /alternates:/);
  assert.match(layout, /openGraph:/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /drizzle-orm/);
  await assert.rejects(access(new URL("public/og.png", projectRoot)));
});

test("public assets contain no prohibited game or secret files", async () => {
  const publicRoot = new URL("public/", projectRoot);
  const blocked = /\.(?:gb|gbc|gba|nes|sfc|smc|gen|nds|iso|cue|bios|sav|srm|state\d*|pem|p12|pfx|key)$/i;
  const queue = [publicRoot];
  const files = [];

  while (queue.length) {
    const directory = queue.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const next = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      if (entry.isDirectory()) queue.push(next);
      else files.push(path.basename(next.pathname));
    }
  }

  assert.equal(files.filter((file) => blocked.test(file)).length, 0);
});

test("documents a rights-safe public content and artwork roadmap", async () => {
  const roadmap = await readFile(new URL("ROADMAP.md", projectRoot), "utf8");

  assert.match(roadmap, /외부 링크라고 해서 저작권 위험이 사라지지는 않는다/);
  assert.match(roadmap, /2017도19025/);
  assert.match(roadmap, /snap.*marquee.*flyer.*wheel.*fanart/s);
  assert.match(roadmap, /수동 스프린트 세 번/);
  assert.doesNotMatch(
    roadmap,
    /https?:\/\/[^\s)]+\.(?:gb|gbc|gba|nes|sfc|smc|gen|nds|iso|cue|bios|sav|srm|state\d*)/i,
  );
  assert.doesNotMatch(roadmap, /roms?download/i);
});

test("brand manifest binds every public logo to its approved hash", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("public/brand/brand-assets.json", projectRoot), "utf8"),
  );

  assert.equal(manifest.decision, "BRAND-20260714-001@1");
  for (const [file, declared] of Object.entries(manifest.assets)) {
    const bytes = await readFile(new URL(`public/brand/${file}`, projectRoot));
    const actual = `sha256:${createHash("sha256").update(bytes).digest("hex").toUpperCase()}`;
    assert.equal(actual, declared);
  }
});

test("serves host-aware robots and sitemap metadata", async () => {
  const sitemap = await render("/sitemap.xml", "https://example.test");
  const robots = await render("/robots.txt", "https://example.test");

  assert.match(await sitemap.text(), /https:\/\/example\.test\//);
  assert.match(await robots.text(), /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
});

test("fails feedback writes closed before authentication or database access", async () => {
  const response = await callWorker(
    new Request("https://example.test/api/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        displayName: "방문자",
        body: "안전한 테스트 글입니다.",
        consent: true,
      }),
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "sign_in_required" });
});

test("reports feedback database read failures instead of rendering an empty success", async () => {
  const response = await callWorker(
    new Request("https://example.test/api/feedback", {
      headers: { accept: "application/json" },
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "feedback_unavailable" });
});

test("keeps feedback writes behind an explicit disabled-by-default runtime gate", async () => {
  const [route, runtime, example] = await Promise.all([
    readFile(new URL("app/api/feedback/route.ts", projectRoot), "utf8"),
    readFile(new URL("db/runtime.ts", projectRoot), "utf8"),
    readFile(new URL(".env.example", projectRoot), "utf8"),
  ]);

  assert.match(route, /isFeedbackWriteEnabled/);
  assert.match(route, /feedback_write_disabled/);
  assert.match(runtime, /FEEDBACK_WRITE_ENABLED === "true"/);
  assert.match(runtime, /byteLength < 32/);
  assert.match(example, /FEEDBACK_WRITE_ENABLED=false/);
});

test("fails authenticated feedback writes closed before database bindings when disabled", async () => {
  const response = await callWorker(
    new Request("https://example.test/api/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
        "oai-authenticated-user-email": ["visitor", "@", "example.test"].join(""),
      },
      body: JSON.stringify({
        displayName: "방문자",
        body: "접수 스위치 차단을 확인하는 안전한 글입니다.",
        consent: true,
      }),
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "feedback_write_disabled" });
});
