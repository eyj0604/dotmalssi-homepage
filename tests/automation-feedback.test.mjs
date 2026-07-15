import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  handleFeedbackDelete,
  handleFeedbackGet,
  handleFeedbackPost,
  queueApprovedReply,
} from "../app/api/feedback/service.mjs";

const root = new URL("../", import.meta.url);
const now = Date.UTC(2026, 6, 15, 12, 0, 0);
const exampleEmail = ["visitor", "@", "example.test"].join("");
const privateEmail = ["private-person", "@", "example.test"].join("");
const strongPepper = "p".repeat(32);

class SQLiteStatement {
  constructor(statement) {
    this.statement = statement;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    return this.statement.get(...this.values) ?? null;
  }

  async all() {
    return { success: true, results: this.statement.all(...this.values) };
  }

  async run() {
    const result = this.statement.run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SQLiteD1 {
  constructor(database) {
    this.database = database;
  }

  prepare(query) {
    return new SQLiteStatement(this.database.prepare(query));
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

async function readMigration() {
  const files = (await readdir(new URL("drizzle/", root))).filter((name) => name.endsWith(".sql"));
  assert.equal(files.length, 1, `expected one baseline migration, got ${files.join(", ")}`);
  return readFile(new URL(`drizzle/${files[0]}`, root), "utf8");
}

async function createDatabase() {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  raw.exec((await readMigration()).replaceAll("--> statement-breakpoint", ""));
  return { raw, db: new SQLiteD1(raw) };
}

function postRequest(body, email = exampleEmail) {
  return new Request("https://dotmalssi.example/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://dotmalssi.example",
      "oai-authenticated-user-email": email,
    },
    body: JSON.stringify(body),
  });
}

function validPost(body = "도트말씨의 다음 소식이 정말 기대됩니다.") {
  return { displayName: "도트 방문자", body, consent: true };
}

test("keeps the weekly automation read-only until manual release gates pass", async () => {
  const [plan, workflow] = await Promise.all([
    readFile(new URL("automation/release-plan.json", root), "utf8").then(JSON.parse),
    readFile(new URL(".github/workflows/weekly-readiness.yml", root), "utf8"),
  ]);

  assert.equal(plan.mode, "read_only_readiness");
  assert.equal(plan.public_write_enabled, false);
  assert.equal(plan.manual_release_sprints_required, 3);
  assert.equal(plan.manual_release_sprints_completed, 0);
  assert.equal(plan.kill_switch, true);
  assert.equal(plan.max_retries, 2);
  assert.match(workflow, /timezone:\s*"Asia\/Seoul"/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(workflow, /contents:\s*write|releases:\s*write|issues:\s*write/);
  assert.doesNotMatch(workflow, /uses:\s*[^\s]+@v\d+/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);

  const result = spawnSync(process.execPath, ["scripts/weekly-readiness.mjs"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.ready_for_write_automation, false);
});

test("stores a pending post without raw identity or an automatic reply job", async () => {
  const { raw, db } = await createDatabase();
  try {
    const response = await handleFeedbackPost(
      postRequest(validPost(), privateEmail),
      { db, pepper: strongPepper },
      now,
    );
    assert.equal(response.status, 202);
    const receipt = await response.json();
    assert.equal(receipt.status, "pending");
    assert.match(receipt.deletionToken, /^[A-Za-z0-9_-]{32}$/);

    const post = raw.prepare("SELECT * FROM visitor_posts").get();
    assert.equal(post.status, "pending");
    assert.equal(post.body, validPost().body);
    assert.equal(post.retention_until, now + 90 * 24 * 60 * 60 * 1000);
    assert.notEqual(post.deletion_token_hash, receipt.deletionToken);
    assert.equal(JSON.stringify(post).includes(privateEmail), false);
    assert.equal(raw.prepare("SELECT count(*) AS count FROM reply_jobs").get().count, 0);

    const rate = raw.prepare("SELECT * FROM feedback_rate_limits").get();
    assert.equal(rate.author_ref.includes(privateEmail), false);
    assert.equal(rate.expires_at, now + 2 * 60 * 60 * 1000);
  } finally {
    raw.close();
  }
});

test("rejects personal contact data and even one direct ROM link", async () => {
  const { raw, db } = await createDatabase();
  try {
    const personalContact = ["visitor", "@", "example.com"].join("");
    const personal = await handleFeedbackPost(
      postRequest(validPost(`연락처는 ${personalContact} 으로 부탁드립니다.`)),
      { db, pepper: strongPepper },
      now,
    );
    assert.equal(personal.status, 422);
    assert.deepEqual(await personal.json(), { error: "personal_information_detected" });

    const blockedUrl = ["https://example.test/game", ".gba"].join("");
    const rom = await handleFeedbackPost(
      postRequest(validPost(`자료는 ${blockedUrl} 에 있습니다.`)),
      { db, pepper: strongPepper },
      now,
    );
    assert.equal(rom.status, 422);
    assert.deepEqual(await rom.json(), { error: "blocked_download_link" });
    assert.equal(raw.prepare("SELECT count(*) AS count FROM visitor_posts").get().count, 0);
  } finally {
    raw.close();
  }
});

test("enforces the three-per-hour limit with an atomic database counter", async () => {
  const { raw, db } = await createDatabase();
  try {
    const statuses = [];
    for (let index = 1; index <= 4; index += 1) {
      const response = await handleFeedbackPost(
        postRequest(validPost(`도트말씨의 ${index}번째 안전한 테스트 글입니다.`)),
        { db, pepper: strongPepper },
        now,
      );
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [202, 202, 202, 429]);
    assert.equal(raw.prepare("SELECT request_count FROM feedback_rate_limits").get().request_count, 4);
    assert.equal(raw.prepare("SELECT count(*) AS count FROM visitor_posts").get().count, 3);
  } finally {
    raw.close();
  }
});

test("queues a reply only after the post has been approved", async () => {
  const { raw, db } = await createDatabase();
  try {
    const response = await handleFeedbackPost(
      postRequest(validPost()),
      { db, pepper: strongPepper },
      now,
    );
    const receipt = await response.json();
    assert.equal(await queueApprovedReply(db, receipt.id, now), null);

    raw.prepare("UPDATE visitor_posts SET status = 'approved' WHERE id = ?").run(receipt.id);
    const queued = await queueApprovedReply(db, receipt.id, now);
    assert.match(queued.id, /^[0-9a-f-]{36}$/i);
    assert.equal(raw.prepare("SELECT status FROM reply_jobs").get().status, "queued");
    assert.equal(await queueApprovedReply(db, receipt.id, now), null);
  } finally {
    raw.close();
  }
});

test("returns only published, unexpired posts and their published replies", async () => {
  const { raw, db } = await createDatabase();
  try {
    const response = await handleFeedbackPost(
      postRequest(validPost()),
      { db, pepper: strongPepper },
      now,
    );
    const receipt = await response.json();
    raw.prepare("UPDATE visitor_posts SET status = 'published', published_at = ? WHERE id = ?")
      .run(now, receipt.id);
    raw.prepare(
      `INSERT INTO feedback_replies
       (id, post_id, body, status, generated_by, created_at, reviewed_at, published_at)
       VALUES ('reply-1', ?, '확인한 뒤 답변드렸습니다.', 'published', 'human', ?, ?, ?)`,
    ).run(receipt.id, now, now, now);

    const result = await handleFeedbackGet({ db }, now);
    assert.equal(result.status, 200);
    const payload = await result.json();
    assert.equal(payload.posts.length, 1);
    assert.equal(payload.posts[0].id, receipt.id);
    assert.equal(payload.posts[0].reply_body, "확인한 뒤 답변드렸습니다.");

    raw.prepare("UPDATE visitor_posts SET retention_until = ? WHERE id = ?").run(now, receipt.id);
    assert.deepEqual(await (await handleFeedbackGet({ db }, now)).json(), { posts: [] });
  } finally {
    raw.close();
  }
});

test("deletes a post only with its browser-held withdrawal token", async () => {
  const { raw, db } = await createDatabase();
  try {
    const response = await handleFeedbackPost(
      postRequest(validPost()),
      { db, pepper: strongPepper },
      now,
    );
    const receipt = await response.json();

    const wrong = await handleFeedbackDelete(
      new Request("https://dotmalssi.example/api/feedback", {
        method: "DELETE",
        headers: { "content-type": "application/json", origin: "https://dotmalssi.example" },
        body: JSON.stringify({ id: receipt.id, deletionToken: "wrong-token" }),
      }),
      { db },
    );
    assert.equal(wrong.status, 404);

    const deleted = await handleFeedbackDelete(
      new Request("https://dotmalssi.example/api/feedback", {
        method: "DELETE",
        headers: { "content-type": "application/json", origin: "https://dotmalssi.example" },
        body: JSON.stringify(receipt),
      }),
      { db },
    );
    assert.equal(deleted.status, 204);
    assert.equal(raw.prepare("SELECT count(*) AS count FROM visitor_posts").get().count, 0);
  } finally {
    raw.close();
  }
});

test("rejects a feedback identity pepper shorter than 32 bytes", async () => {
  const { raw, db } = await createDatabase();
  try {
    const response = await handleFeedbackPost(
      postRequest(validPost()),
      { db, pepper: "too-short" },
      now,
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "feedback_configuration_error" });
    assert.equal(raw.prepare("SELECT count(*) AS count FROM visitor_posts").get().count, 0);
  } finally {
    raw.close();
  }
});

test("defines the six-table moderated feedback schema without raw email storage", async () => {
  const [schema, migration, hosting] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readMigration(),
    readFile(new URL(".openai/hosting.json", root), "utf8").then(JSON.parse),
  ]);

  assert.equal(hosting.d1, "DB");
  assert.match(migration, /CREATE TABLE `visitor_posts`/);
  assert.match(migration, /CREATE TABLE `feedback_rate_limits`/);
  assert.match(migration, /CREATE TABLE `reply_jobs`/);
  assert.match(migration, /deletion_token_hash/);
  assert.match(migration, /retention_until/);
  assert.match(schema, /visitor_posts/);
  assert.match(schema, /feedback_rate_limits/);
  assert.match(schema, /reply_jobs/);
  assert.doesNotMatch(schema, /authorEmail|author_email|email_address/i);
});

test("applies the generated D1 migration cleanly to SQLite", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec((await readMigration()).replaceAll("--> statement-breakpoint", ""));
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    assert.deepEqual(tables, [
      "automation_runs",
      "feedback_rate_limits",
      "feedback_replies",
      "moderation_events",
      "reply_jobs",
      "visitor_posts",
    ]);
  } finally {
    db.close();
  }
});
