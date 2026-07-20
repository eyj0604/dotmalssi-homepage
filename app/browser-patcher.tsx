"use client";

import { useEffect, useMemo, useState } from "react";
import { applyBpsPatch } from "./bps";
import {
  applyIpsPatch,
  assertApprovedIpsOutput,
  resolveApprovedIpsProfile,
  type ApprovedIpsProfile,
} from "./ips";

type PatchFormat = "BPS" | "IPS";

const MAX_LOCAL_FILE_BYTES = 64 * 1024 * 1024;

type PatchResult = {
  url: string;
  fileName: string;
  format: PatchFormat;
  profileTitle?: string;
  sourceSha256: string;
  patchSha256: string;
  outputSha256: string;
  outputSize: number;
};

function formatBytes(bytes: number) {
  return new Intl.NumberFormat("ko-KR").format(bytes);
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
}

function outputName(sourceName: string) {
  const stem = sourceName.replace(/\.[^.]+$/, "");
  const extension = sourceName.match(/\.[^.]+$/)?.[0].toLowerCase();
  const safeExtension =
    extension && [".gba", ".gg", ".sms", ".bin", ".rom"].includes(extension)
      ? extension
      : ".bin";
  return `${stem || "patched"}-ko${safeExtension}`;
}

function patchFormat(bytes: Uint8Array): PatchFormat {
  const signature = String.fromCharCode(...bytes.subarray(0, 5));
  if (signature.startsWith("BPS1")) return "BPS";
  if (signature === "PATCH") return "IPS";
  throw new Error("지원하는 BPS 또는 IPS 패치 파일이 아닙니다.");
}

export default function BrowserPatcher() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [patchFile, setPatchFile] = useState<File | null>(null);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(
    "원본과 BPS·IPS 파일은 사용자의 기기 안에서만 처리됩니다.",
  );
  const [error, setError] = useState("");
  const [result, setResult] = useState<PatchResult | null>(null);

  useEffect(
    () => () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const ready = useMemo(
    () => Boolean(sourceFile && patchFile && ownershipConfirmed && !working),
    [sourceFile, patchFile, ownershipConfirmed, working],
  );

  async function patch() {
    if (!sourceFile || !patchFile || !ownershipConfirmed) return;

    setWorking(true);
    setError("");
    setMessage("파일 형식과 체크섬을 확인하고 있습니다…");
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);

    try {
      if (
        sourceFile.size > MAX_LOCAL_FILE_BYTES ||
        patchFile.size > MAX_LOCAL_FILE_BYTES
      ) {
        throw new Error("원본과 패치 파일은 각각 64 MiB 이하여야 합니다.");
      }
      const [sourceBuffer, patchBuffer] = await Promise.all([
        sourceFile.arrayBuffer(),
        patchFile.arrayBuffer(),
      ]);
      const source = new Uint8Array(sourceBuffer);
      const patchBytes = new Uint8Array(patchBuffer);
      const format = patchFormat(patchBytes);
      const [sourceSha256, patchSha256] = await Promise.all([
        sha256(source),
        sha256(patchBytes),
      ]);

      let profileTitle: string | undefined;
      let expectedOutput: ApprovedIpsProfile | undefined;

      if (format === "IPS") {
        const profile = resolveApprovedIpsProfile(
          patchSha256,
          source.length,
          sourceSha256,
        );
        profileTitle = profile.title;
        expectedOutput = profile;
      }

      const applied =
        format === "BPS"
          ? applyBpsPatch(source, patchBytes)
          : applyIpsPatch(source, patchBytes);

      setMessage("적용 결과를 검증하고 내려받기 파일을 준비하고 있습니다…");
      const outputSha256 = await sha256(applied.output);
      if (expectedOutput) {
        assertApprovedIpsOutput(
          expectedOutput,
          applied.output.length,
          outputSha256,
        );
      }
      const blob = new Blob([toArrayBuffer(applied.output)], {
        type: "application/octet-stream",
      });
      setResult({
        url: URL.createObjectURL(blob),
        fileName: outputName(sourceFile.name),
        format,
        profileTitle,
        sourceSha256,
        patchSha256,
        outputSha256,
        outputSize: applied.output.length,
      });
      setMessage(`${format} 적용과 결과 체크섬 검증이 끝났습니다.`);
    } catch (cause) {
      setMessage("패치를 만들지 못했습니다.");
      setError(
        cause instanceof Error
          ? cause.message
          : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="browser-patcher">
      <div className="patcher-grid">
        <label className="patcher-file">
          <span>1. 본인 소유 원본 선택</span>
          <input
            type="file"
            accept=".gba,.gg,.sms,.bin,.rom,application/octet-stream"
            onChange={(event) => {
              setSourceFile(event.target.files?.[0] ?? null);
              setResult(null);
              setError("");
            }}
          />
          <small>
            {sourceFile
              ? `${sourceFile.name} · ${formatBytes(sourceFile.size)} bytes`
              : "파일은 서버로 전송되지 않습니다."}
          </small>
        </label>

        <label className="patcher-file">
          <span>2. BPS 또는 공개 승인된 IPS 선택</span>
          <input
            type="file"
            accept=".bps,.ips,application/octet-stream"
            onChange={(event) => {
              setPatchFile(event.target.files?.[0] ?? null);
              setResult(null);
              setError("");
            }}
          />
          <small>
            {patchFile
              ? `${patchFile.name} · ${formatBytes(patchFile.size)} bytes`
              : "BPS는 자체 체크섬, IPS는 도트말씨 공개 승인 해시를 확인합니다."}
          </small>
        </label>
      </div>

      <label className="patcher-confirm">
        <input
          type="checkbox"
          checked={ownershipConfirmed}
          onChange={(event) => setOwnershipConfirmed(event.target.checked)}
        />
        <span>
          합법적으로 보유한 원본을 사용하며, 선택한 패치의 지원 원본 정보를
          확인했습니다.
        </span>
      </label>

      <div className="patcher-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={!ready}
          onClick={patch}
        >
          {working ? "검증 중…" : "이 기기에서 패치 적용"}
        </button>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </div>

      {error ? (
        <p className="patcher-error" role="alert">
          {error} 문제가 계속되면{" "}
          <a href="mailto:eyj79@naver.com">eyj79@naver.com</a>으로 원본을
          첨부하지 말고 오류 문구와 화면 사진만 보내 주세요.
        </p>
      ) : null}

      {result ? (
        <section className="patcher-result" aria-labelledby="patch-result-title">
          <div>
            <p className="section-kicker">LOCAL RESULT</p>
            <h3 id="patch-result-title">검증된 결과가 준비됐습니다.</h3>
            <p>
              {result.profileTitle ? `${result.profileTitle} · ` : ""}
              {result.format} · {formatBytes(result.outputSize)} bytes · 브라우저
              임시 파일
            </p>
          </div>
          <a className="button button-gold" href={result.url} download={result.fileName}>
            결과 파일 내려받기
          </a>
          <dl>
            <div>
              <dt>원본 SHA-256</dt>
              <dd>{result.sourceSha256}</dd>
            </div>
            <div>
              <dt>패치 SHA-256</dt>
              <dd>{result.patchSha256}</dd>
            </div>
            <div>
              <dt>결과 SHA-256</dt>
              <dd>{result.outputSha256}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
