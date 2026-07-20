import assert from "node:assert/strict";
import test from "node:test";

import {
  applyIpsPatch,
  assertApprovedIpsOutput,
  resolveApprovedIpsProfile,
} from "../app/ips.ts";

const approvedPatchSha256 =
  "460FB1B657A865CBC0E4CA40C6107B327E836EBCA3DFABFF8057E73CA0BA8747";
const approvedSourceSha256 =
  "1697FDD6C578E503CD37DFFFBD03AAB96438242AA4DC06FD24F55DC82BB831E5";
const approvedOutputSha256 =
  "06B186F721DA9476F2DCAF119B06A409B459AA3AF24180C8DE0B404DB9326E95";

function uint16BE(value) {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function uint24BE(value) {
  return [(value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function fixture(records, truncateSize) {
  const bytes = [...Buffer.from("PATCH")];
  for (const record of records) {
    bytes.push(...uint24BE(record.offset));
    if ("data" in record) {
      bytes.push(...uint16BE(record.data.length), ...record.data);
    } else {
      bytes.push(...uint16BE(0), ...uint16BE(record.size), record.value);
    }
  }
  bytes.push(...Buffer.from("EOF"));
  if (truncateSize !== undefined) bytes.push(...uint24BE(truncateSize));
  return Uint8Array.from(bytes);
}

test("applies ordinary IPS records and preserves untouched source bytes", () => {
  const source = Uint8Array.from([1, 2, 3, 4]);
  const patch = fixture([{ offset: 1, data: [9, 8] }]);
  const result = applyIpsPatch(source, patch);

  assert.deepEqual(result.output, Uint8Array.from([1, 9, 8, 4]));
  assert.equal(result.recordCount, 1);
  assert.equal(result.rleRecordCount, 0);
});

test("supports IPS RLE records and output expansion", () => {
  const source = Uint8Array.from([1, 2]);
  const patch = fixture([{ offset: 4, size: 3, value: 7 }]);
  const result = applyIpsPatch(source, patch);

  assert.deepEqual(result.output, Uint8Array.from([1, 2, 0, 0, 7, 7, 7]));
  assert.equal(result.rleRecordCount, 1);
});

test("supports the optional IPS truncate size", () => {
  const source = Uint8Array.from([1, 2, 3, 4]);
  const patch = fixture([{ offset: 0, data: [9] }], 2);

  assert.deepEqual(applyIpsPatch(source, patch).output, Uint8Array.from([9, 2]));
});

test("rejects malformed headers and trailing data", () => {
  assert.throws(
    () => applyIpsPatch(Uint8Array.from([1]), Uint8Array.from(Buffer.from("NOPE"))),
    /너무 짧습니다/,
  );

  const patch = fixture([{ offset: 0, data: [9] }]);
  const damaged = Uint8Array.from([...patch, 0]);
  assert.throws(
    () => applyIpsPatch(Uint8Array.from([1]), damaged),
    /알 수 없는 데이터/,
  );
});

test("accepts only the exact approved IPS and source binding", () => {
  const profile = resolveApprovedIpsProfile(
    approvedPatchSha256,
    524288,
    approvedSourceSha256,
  );
  assert.equal(profile.title, "LUNAR 산책하는 학원 public-beta-1");

  assert.throws(
    () =>
      resolveApprovedIpsProfile(
        "00".repeat(32),
        524288,
        approvedSourceSha256,
      ),
    /공개 승인한 IPS 해시가 아닙니다/,
  );
  assert.throws(
    () => resolveApprovedIpsProfile(approvedPatchSha256, 524287, approvedSourceSha256),
    /지원하는 원본이 아닙니다/,
  );
  assert.throws(
    () => resolveApprovedIpsProfile(approvedPatchSha256, 524288, "11".repeat(32)),
    /지원하는 원본이 아닙니다/,
  );
});

test("accepts only the exact approved IPS output binding", () => {
  const profile = resolveApprovedIpsProfile(
    approvedPatchSha256,
    524288,
    approvedSourceSha256,
  );
  assert.doesNotThrow(() =>
    assertApprovedIpsOutput(profile, 1048576, approvedOutputSha256),
  );
  assert.throws(
    () => assertApprovedIpsOutput(profile, 1048575, approvedOutputSha256),
    /결과가 공개 승인된 결과 해시와 다릅니다/,
  );
  assert.throws(
    () => assertApprovedIpsOutput(profile, 1048576, "22".repeat(32)),
    /결과가 공개 승인된 결과 해시와 다릅니다/,
  );
});
