"use client";

import { FormEvent, useEffect, useState } from "react";

type PublicThread = {
  id: string;
  display_name: string;
  body: string;
  created_at: number;
  reply_body: string | null;
};

type DeletionReceipt = {
  id: string;
  deletionToken: string;
  createdAt: number;
};

const receiptStorageKey = "dotmalssi-feedback-receipts-v1";

export default function FeedbackForm({
  signedIn,
  signInPath,
  writeEnabled,
}: {
  signedIn: boolean;
  signInPath: string;
  writeEnabled: boolean;
}) {
  const [threads, setThreads] = useState<PublicThread[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [receipts, setReceipts] = useState<DeletionReceipt[]>([]);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [recoveryReceipt, setRecoveryReceipt] = useState<DeletionReceipt | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(receiptStorageKey) ?? "[]");
        if (!cancelled && Array.isArray(saved)) {
          const cutoff = Date.now() - 91 * 24 * 60 * 60 * 1000;
          setReceipts(
            saved.filter(
              (item): item is DeletionReceipt =>
                item &&
                typeof item.id === "string" &&
                typeof item.deletionToken === "string" &&
                typeof item.createdAt === "number" &&
                item.createdAt > cutoff,
            ),
          );
        }
      } catch {
        localStorage.removeItem(receiptStorageKey);
      }
    });

    fetch("/api/feedback", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("feedback_load_failed");
        const payload = await response.json();
        setThreads(Array.isArray(payload.posts) ? payload.posts : []);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));

    return () => {
      cancelled = true;
    };
  }, []);

  function saveReceipts(next: DeletionReceipt[]) {
    setReceipts(next);
    try {
      localStorage.setItem(receiptStorageKey, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setNotice("");
    const form = new FormData(formElement);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        body: form.get("body"),
        consent: form.get("consent") === "on",
      }),
    }).catch(() => null);

    if (response?.status === 202) {
      const payload = await response.json().catch(() => null);
      if (payload?.id && payload?.deletionToken) {
        const receipt = {
          id: payload.id,
          deletionToken: payload.deletionToken,
          createdAt: Date.now(),
        };
        const persisted = saveReceipts([
          receipt,
          ...receipts.filter((receipt) => receipt.id !== payload.id),
        ]);
        setRecoveryReceipt(persisted ? null : receipt);
        setNotice(
          persisted
            ? "글이 접수되었습니다. 사람의 검토 전에는 답변 작업이나 공개가 시작되지 않습니다."
            : "글은 접수됐지만 이 브라우저가 철회키를 저장하지 못했습니다. 아래 키를 지금 복사하거나 글을 바로 철회해 주세요.",
        );
      }
      formElement.reset();
    } else if (response?.status === 429) {
      setNotice("시간당 접수 한도 3건을 초과했습니다. 다음 시간에 다시 시도해 주세요.");
    } else if (response?.status === 503) {
      setNotice("현재 글 접수가 닫혀 있습니다. 운영 준비가 끝난 뒤 다시 열겠습니다.");
    } else {
      setNotice("접수하지 못했습니다. 개인정보·링크·글자 수를 확인한 뒤 다시 시도해 주세요.");
    }
    setSubmitting(false);
  }

  async function withdraw(receipt: DeletionReceipt) {
    setDeletingId(receipt.id);
    setNotice("");
    const response = await fetch("/api/feedback", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: receipt.id, deletionToken: receipt.deletionToken }),
    }).catch(() => null);

    if (response?.status === 204 || response?.status === 404) {
      saveReceipts(receipts.filter((item) => item.id !== receipt.id));
      if (recoveryReceipt?.id === receipt.id) setRecoveryReceipt(null);
      setNotice("저장된 글을 철회했습니다.");
    } else {
      setNotice("철회하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
    setDeletingId("");
  }

  return (
    <div className="feedback-board">
      {writeEnabled && signedIn ? (
        <div>
          <form className="feedback-form" onSubmit={submit}>
            <label>
              공개 닉네임
              <input
                name="displayName"
                defaultValue="도트말씨 방문자"
                minLength={2}
                maxLength={24}
                required
              />
            </label>
            <label>
              도트말씨에 남길 글
              <textarea name="body" minLength={10} maxLength={1200} rows={6} required />
            </label>
            <label className="feedback-consent">
              <input name="consent" type="checkbox" required />
              <span>
                글과 닉네임을 검토 목적으로 90일 동안 처리·공개 대상으로 두는 데
                동의합니다. 기한이 지나면 즉시 처리 대상에서 제외하고 승인된 정리 작업에서
                삭제합니다. 로그인 이메일 원문은 저장하지 않으며, 도배 방지용 비가역
                식별값은 2시간 뒤 사용을 중단합니다. 이메일·전화번호·ROM 링크는 적지
                않습니다. 이 브라우저에 보관되는 철회키로 글을 삭제할 수 있지만,
                브라우저 데이터나 철회키를 잃으면 서버에서 복구할 수 없습니다.
              </span>
            </label>
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? "접수 중…" : "검토함에 글 넣기"}
            </button>
            <p className="feedback-notice" aria-live="polite">
              {notice}
            </p>
          </form>

          {receipts.length ? (
            <section className="feedback-receipts" aria-labelledby="feedback-receipts-title">
              <h3 id="feedback-receipts-title">이 브라우저에서 최근 접수한 글</h3>
              <p>철회키는 서버에 원문으로 저장되지 않습니다. 브라우저 데이터를 지우면 복구할 수 없습니다.</p>
              <ol>
                {receipts.map((receipt) => (
                  <li key={receipt.id}>
                    <span>{new Date(receipt.createdAt).toLocaleString("ko-KR")}</span>
                    <button
                      className="button feedback-delete"
                      type="button"
                      disabled={deletingId === receipt.id}
                      onClick={() => withdraw(receipt)}
                    >
                      {deletingId === receipt.id ? "철회 중…" : "글 철회"}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {recoveryReceipt ? (
            <section className="feedback-receipts feedback-recovery" role="alert">
              <h3>철회키를 지금 보관해 주세요</h3>
              <p>
                브라우저 저장에 실패했습니다. 아래 키는 서버에서 다시 발급하거나 복구할 수
                없습니다. 직접 복사한 뒤 안전한 곳에 보관하거나 지금 글을 철회해 주세요.
              </p>
              <code>{recoveryReceipt.deletionToken}</code>
              <button
                className="button feedback-delete"
                type="button"
                onClick={() => navigator.clipboard.writeText(recoveryReceipt.deletionToken).catch(() => undefined)}
              >
                철회키 복사
              </button>
              <button
                className="button feedback-delete"
                type="button"
                disabled={deletingId === recoveryReceipt.id}
                onClick={() => withdraw(recoveryReceipt)}
              >
                {deletingId === recoveryReceipt.id ? "철회 중…" : "지금 글 철회"}
              </button>
            </section>
          ) : null}
        </div>
      ) : writeEnabled ? (
        <div className="feedback-signin">
          <h3>글을 남기려면 ChatGPT 로그인이 필요합니다.</h3>
          <p>
            공개된 글은 로그인 없이 읽을 수 있습니다. 글 작성 때 로그인 이메일 원문은 저장하지
            않고, 도배 방지용 비가역 식별값은 2시간 뒤 사용을 중단합니다.
          </p>
          <a className="button button-primary" href={signInPath}>
            로그인하고 글 남기기
          </a>
        </div>
      ) : (
        <div className="feedback-signin">
          <h3>이야기함 접수는 아직 준비 중입니다.</h3>
          <p>
            공개 글 읽기만 준비되어 있습니다. 보존 기한 뒤 물리 삭제와 운영 검증을 통과한
            뒤에만 로그인 글쓰기를 엽니다.
          </p>
        </div>
      )}

      <div className="feedback-threads" aria-live="polite" aria-busy={loadState === "loading"}>
        <h3>공개된 이야기</h3>
        {loadState === "loading" ? (
          <p className="feedback-empty">공개 글을 불러오는 중입니다.</p>
        ) : loadState === "error" ? (
          <p className="feedback-error">공개 글을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.</p>
        ) : threads.length ? (
          <ol>
            {threads.map((thread) => (
              <li key={thread.id}>
                <p className="feedback-author">{thread.display_name}</p>
                <p>{thread.body}</p>
                {thread.reply_body ? (
                  <blockquote>
                    <strong>도트말씨 답변</strong>
                    <p>{thread.reply_body}</p>
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="feedback-empty">아직 공개된 글이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
