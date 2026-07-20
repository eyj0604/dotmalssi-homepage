import assert from "node:assert/strict";
import test from "node:test";

import { applyBpsPatch, crc32 } from "../app/bps.ts";

function encodeNumber(value) {
  const bytes = [];
  while (true) {
    const next = value & 0x7f;
    value >>>= 7;
    if (value === 0) {
      bytes.push(next | 0x80);
      return bytes;
    }
    bytes.push(next);
    value -= 1;
  }
}

function uint32LE(value) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function createRawFixture(source, target, actions, metadata = []) {
  const bytes = [
    ...Buffer.from("BPS1"),
    ...encodeNumber(source.length),
    ...encodeNumber(target.length),
    ...encodeNumber(metadata.length),
    ...metadata,
    ...actions,
  ];
  bytes.push(...uint32LE(crc32(source)), ...uint32LE(crc32(target)));
  bytes.push(...uint32LE(crc32(Uint8Array.from(bytes))));
  return Uint8Array.from(bytes);
}

function createFixture(source, target) {
  const changedIndex = target.findIndex((byte, index) => byte !== source[index]);
  assert.ok(changedIndex >= 0);
  assert.equal(source.length, target.length);

  const actions = [];

  if (changedIndex > 0) {
    actions.push(...encodeNumber(((changedIndex - 1) << 2) | 0));
  }
  actions.push(...encodeNumber(1), target[changedIndex]);
  const tailLength = target.length - changedIndex - 1;
  if (tailLength > 0) {
    actions.push(...encodeNumber(((tailLength - 1) << 2) | 0));
  }

  return createRawFixture(source, target, actions);
}

test("applies a checksummed BPS fixture without network or ROM assets", () => {
  const source = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const target = Uint8Array.from([1, 2, 9, 4, 5, 6]);
  const patch = createFixture(source, target);

  const result = applyBpsPatch(source, patch);
  assert.deepEqual(result.output, target);
  assert.equal(result.targetChecksum, crc32(target));
});

test("rejects an unsupported source before producing output", () => {
  const source = Uint8Array.from([1, 2, 3, 4]);
  const target = Uint8Array.from([1, 9, 3, 4]);
  const patch = createFixture(source, target);

  assert.throws(
    () => applyBpsPatch(Uint8Array.from([1, 2, 3, 5]), patch),
    /지원하는 원본이 아닙니다/,
  );
});

test("rejects a damaged patch checksum", () => {
  const source = Uint8Array.from([1, 2, 3, 4]);
  const target = Uint8Array.from([1, 2, 8, 4]);
  const patch = createFixture(source, target);
  patch[patch.length - 1] ^= 0xff;

  assert.throws(() => applyBpsPatch(source, patch), /체크섬/);
});

test("supports SourceCopy relative offsets", () => {
  const source = Uint8Array.from([10, 20, 30, 40, 50]);
  const target = Uint8Array.from([30, 40, 50]);
  const sourceCopy = [
    ...encodeNumber(((target.length - 1) << 2) | 2),
    ...encodeNumber(4),
  ];
  const patch = createRawFixture(source, target, sourceCopy);

  assert.deepEqual(applyBpsPatch(source, patch).output, target);
});

test("supports overlapping TargetCopy runs", () => {
  const source = Uint8Array.from([0]);
  const target = Uint8Array.from([7, 7, 7, 7]);
  const targetCopy = [
    ...encodeNumber(1),
    7,
    ...encodeNumber(((3 - 1) << 2) | 3),
    ...encodeNumber(0),
  ];
  const patch = createRawFixture(source, target, targetCopy);

  assert.deepEqual(applyBpsPatch(source, patch).output, target);
});

test("skips BPS metadata before applying actions", () => {
  const source = Uint8Array.from([1, 2, 3]);
  const target = Uint8Array.from([1, 8, 3]);
  const patch = createRawFixture(
    source,
    target,
    [
      ...encodeNumber(0),
      ...encodeNumber(1),
      8,
      ...encodeNumber(0),
    ],
    [...Buffer.from("fixture metadata")],
  );

  assert.deepEqual(applyBpsPatch(source, patch).output, target);
});

test("supports a negative SourceCopy relative offset", () => {
  const source = Uint8Array.from([1, 2, 3, 4]);
  const target = Uint8Array.from([2, 3, 1]);
  const actions = [
    ...encodeNumber(((2 - 1) << 2) | 2),
    ...encodeNumber(2),
    ...encodeNumber(2),
    ...encodeNumber(7),
  ];
  const patch = createRawFixture(source, target, actions);

  assert.deepEqual(applyBpsPatch(source, patch).output, target);
});

test("rejects a target checksum mismatch even with a valid patch checksum", () => {
  const source = Uint8Array.from([1, 2, 3]);
  const target = Uint8Array.from([1, 9, 3]);
  const patch = createFixture(source, target);
  patch[patch.length - 8] ^= 0xff;
  const repairedPatchChecksum = uint32LE(crc32(patch.subarray(0, -4)));
  patch.set(repairedPatchChecksum, patch.length - 4);

  assert.throws(() => applyBpsPatch(source, patch), /결과 체크섬/);
});

test("rejects a SourceCopy that escapes the source range", () => {
  const source = Uint8Array.from([1]);
  const target = Uint8Array.from([0]);
  const actions = [...encodeNumber(2), ...encodeNumber(4)];
  const patch = createRawFixture(source, target, actions);

  assert.throws(() => applyBpsPatch(source, patch), /원본 범위/);
});
