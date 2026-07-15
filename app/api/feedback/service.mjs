const CONSENT_VERSION = "2026-07-15";
const MAX_POSTS_PER_HOUR = 3;
const MAX_BODY_LENGTH = 1200;
const HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 2 * HOUR_MS;
const POST_RETENTION_MS = 90 * 24 * HOUR_MS;
const blockedDownload = /\.(?:3ds|7z|bin|bios|chd|cia|cso|cue|gb|gba|gbc|gen|gg|gz|iso|n64|nds|nes|pce|rar|rom|sav|sfc|smc|sms|srm|state[^/?#&=\s]*|v64|wad|wbfs|ws|wsc|z64|zip)(?:$|[/?#&=])/i;

export async function handleFeedbackGet({ db }, now = Date.now()) {
  const rows = await db
    .prepare(
      `SELECT
        p.id,
        p.display_name,
        p.body,
        p.created_at,
        (
          SELECT r.body
          FROM feedback_replies r
          WHERE r.post_id = p.id AND r.status = 'published'
          ORDER BY r.published_at DESC
          LIMIT 1
        ) AS reply_body,
        (
          SELECT r.published_at
          FROM feedback_replies r
          WHERE r.post_id = p.id AND r.status = 'published'
          ORDER BY r.published_at DESC
          LIMIT 1
        ) AS reply_published_at
      FROM visitor_posts p
      WHERE p.status = 'published' AND p.retention_until > ?1
      ORDER BY p.published_at DESC
      LIMIT 30`,
    )
    .bind(now)
    .all();

  return Response.json(
    { posts: rows.results ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function handleFeedbackPost(request, { db, pepper }, now = Date.now()) {
  const requestError = validateRequestEnvelope(request);
  if (requestError) return requestError;

  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) {
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  }
  if (typeof pepper !== "string" || new TextEncoder().encode(pepper).byteLength < 32) {
    return Response.json({ error: "feedback_configuration_error" }, { status: 503 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validatePostPayload(payload);
  if (validation.error) {
    return Response.json({ error: validation.error }, { status: 422 });
  }

  const authorRef = await hashValue(`${pepper}\u0000${email.trim().toLowerCase()}`);
  const windowStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  await db.batch([
    db
      .prepare("DELETE FROM feedback_rate_limits WHERE expires_at <= ?1")
      .bind(now),
    db
      .prepare("DELETE FROM visitor_posts WHERE retention_until <= ?1")
      .bind(now),
  ]);

  const rate = await db
    .prepare(
      `INSERT INTO feedback_rate_limits
        (author_ref, window_start, request_count, expires_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(author_ref, window_start)
       DO UPDATE SET
         request_count = request_count + 1,
         expires_at = excluded.expires_at
       RETURNING request_count`,
    )
    .bind(authorRef, windowStart, windowStart + RATE_LIMIT_RETENTION_MS)
    .first();

  if (Number(rate?.request_count ?? 0) > MAX_POSTS_PER_HOUR) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const postId = crypto.randomUUID();
  const deletionToken = randomToken();
  const deletionTokenHash = await hashValue(deletionToken);
  await db
    .prepare(
      `INSERT INTO visitor_posts
        (id, display_name, body, deletion_token_hash, status, consent_version,
         created_at, retention_until)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7)`,
    )
    .bind(
      postId,
      validation.displayName,
      validation.body,
      deletionTokenHash,
      CONSENT_VERSION,
      now,
      now + POST_RETENTION_MS,
    )
    .run();

  return Response.json(
    {
      id: postId,
      deletionToken,
      status: "pending",
      message: "글이 접수되었습니다. 검토 후 공개됩니다.",
    },
    { status: 202 },
  );
}

export async function handleFeedbackDelete(request, { db }) {
  const requestError = validateRequestEnvelope(request);
  if (requestError) return requestError;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !payload ||
    typeof payload.id !== "string" ||
    typeof payload.deletionToken !== "string" ||
    payload.id.length > 64 ||
    payload.deletionToken.length > 128
  ) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const tokenHash = await hashValue(payload.deletionToken);
  const result = await db
    .prepare(
      `DELETE FROM visitor_posts
       WHERE id = ?1 AND deletion_token_hash = ?2`,
    )
    .bind(payload.id, tokenHash)
    .run();

  if (Number(result.meta?.changes ?? 0) < 1) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}

export async function queueApprovedReply(db, postId, now = Date.now()) {
  return db
    .prepare(
      `INSERT INTO reply_jobs
        (id, post_id, status, attempts, not_before, created_at, updated_at)
       SELECT ?1, p.id, 'queued', 0, ?2, ?2, ?2
       FROM visitor_posts p
       WHERE p.id = ?3
         AND p.status = 'approved'
         AND p.retention_until > ?2
       ON CONFLICT(post_id) DO NOTHING
       RETURNING id`,
    )
    .bind(crypto.randomUUID(), now, postId)
    .first();
}

function validateRequestEnvelope(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 5000) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }
  return null;
}

function validatePostPayload(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_payload" };
  if (
    typeof payload.displayName !== "string" ||
    typeof payload.body !== "string" ||
    payload.displayName.length > 24 ||
    payload.body.length > MAX_BODY_LENGTH
  ) {
    return { error: "invalid_length" };
  }
  const displayName = normalizeText(payload.displayName);
  const body = normalizeText(payload.body);
  if (displayName.length < 2 || body.length < 10) return { error: "invalid_length" };
  if (payload.consent !== true) return { error: "consent_required" };
  if (containsPersonalContact(displayName) || containsPersonalContact(body)) {
    return { error: "personal_information_detected" };
  }
  if ((body.match(/https?:\/\//gi) ?? []).length > 1) {
    return { error: "too_many_links" };
  }
  if (containsBlockedDownloadUrl(body)) {
    return { error: "blocked_download_link" };
  }
  return { displayName, body };
}

function normalizeText(value) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPersonalContact(value) {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /(?:^|\D)(?:01[016789]|0\d{1,2})[- .]?\d{3,4}[- .]?\d{4}(?:\D|$)/;
  return email.test(value) || phone.test(value);
}

function containsBlockedDownloadUrl(value) {
  for (const raw of value.match(/https?:\/\/[^\s<>()"']+/gi) ?? []) {
    try {
      const parsed = new URL(raw.replace(/[.,;:!?]+$/, ""));
      const payload = decodeURIComponent(`${parsed.pathname}${parsed.search}&`);
      if (blockedDownload.test(payload)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

async function hashValue(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
