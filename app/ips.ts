const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_TARGET_BYTES = 64 * 1024 * 1024;

export type ApprovedIpsProfile = {
  title: string;
  sourceSize: number;
  sourceSha256: string;
  outputSize: number;
  outputSha256: string;
};

const APPROVED_IPS_PATCHES = new Map<string, ApprovedIpsProfile>([
  [
    "460FB1B657A865CBC0E4CA40C6107B327E836EBCA3DFABFF8057E73CA0BA8747",
    {
      title: "LUNAR 산책하는 학원 public-beta-1",
      sourceSize: 524288,
      sourceSha256:
        "1697FDD6C578E503CD37DFFFBD03AAB96438242AA4DC06FD24F55DC82BB831E5",
      outputSize: 1048576,
      outputSha256:
        "06B186F721DA9476F2DCAF119B06A409B459AA3AF24180C8DE0B404DB9326E95",
    },
  ],
]);

export type IpsPatchResult = {
  output: Uint8Array;
  recordCount: number;
  rleRecordCount: number;
};

type IpsRecord =
  | {
      offset: number;
      size: number;
      kind: "data";
      dataOffset: number;
    }
  | {
      offset: number;
      size: number;
      kind: "rle";
      value: number;
    };

export function resolveApprovedIpsProfile(
  patchSha256: string,
  sourceSize: number,
  sourceSha256: string,
) {
  const profile = APPROVED_IPS_PATCHES.get(patchSha256);
  if (!profile) {
    throw new Error(
      "도트말씨가 공개 승인한 IPS 해시가 아닙니다. 배포 페이지의 해시를 확인해 주세요.",
    );
  }
  if (
    sourceSize !== profile.sourceSize ||
    sourceSha256 !== profile.sourceSha256
  ) {
    throw new Error(
      "지원하는 원본이 아닙니다. 지역판과 원본 SHA-256을 확인해 주세요.",
    );
  }
  return profile;
}

export function assertApprovedIpsOutput(
  profile: ApprovedIpsProfile,
  outputSize: number,
  outputSha256: string,
) {
  if (
    outputSize !== profile.outputSize ||
    outputSha256 !== profile.outputSha256
  ) {
    throw new Error("IPS 적용 결과가 공개 승인된 결과 해시와 다릅니다.");
  }
}

function assertFileSize(label: string, size: number, maximum: number) {
  if (size > maximum) {
    throw new Error(`${label} 파일은 ${maximum / 1024 / 1024} MiB 이하여야 합니다.`);
  }
}

function readUint16BE(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > bytes.length) {
    throw new Error("IPS 데이터가 예상보다 일찍 끝났습니다.");
  }
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24BE(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 3 > bytes.length) {
    throw new Error("IPS 데이터가 예상보다 일찍 끝났습니다.");
  }
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function isEof(bytes: Uint8Array, offset: number) {
  return (
    offset + 3 <= bytes.length &&
    bytes[offset] === 0x45 &&
    bytes[offset + 1] === 0x4f &&
    bytes[offset + 2] === 0x46
  );
}

export function applyIpsPatch(
  source: Uint8Array,
  patch: Uint8Array,
): IpsPatchResult {
  assertFileSize("원본", source.length, MAX_INPUT_BYTES);
  assertFileSize("패치", patch.length, MAX_INPUT_BYTES);

  if (patch.length < 8) {
    throw new Error("IPS 파일이 너무 짧습니다.");
  }
  if (String.fromCharCode(...patch.subarray(0, 5)) !== "PATCH") {
    throw new Error("PATCH 헤더가 있는 IPS 파일이 아닙니다.");
  }

  const records: IpsRecord[] = [];
  let cursor = 5;
  let requiredSize = source.length;
  let rleRecordCount = 0;

  while (!isEof(patch, cursor)) {
    const outputOffset = readUint24BE(patch, cursor);
    cursor += 3;
    const dataSize = readUint16BE(patch, cursor);
    cursor += 2;

    if (dataSize === 0) {
      const runSize = readUint16BE(patch, cursor);
      cursor += 2;
      if (runSize === 0 || cursor >= patch.length) {
        throw new Error("IPS RLE 레코드가 손상되었습니다.");
      }
      const value = patch[cursor++];
      records.push({
        offset: outputOffset,
        size: runSize,
        kind: "rle",
        value,
      });
      requiredSize = Math.max(requiredSize, outputOffset + runSize);
      rleRecordCount += 1;
      continue;
    }

    if (cursor + dataSize > patch.length) {
      throw new Error("IPS 레코드 데이터가 예상보다 일찍 끝났습니다.");
    }
    records.push({
      offset: outputOffset,
      size: dataSize,
      kind: "data",
      dataOffset: cursor,
    });
    requiredSize = Math.max(requiredSize, outputOffset + dataSize);
    cursor += dataSize;
  }

  cursor += 3;
  let targetSize = requiredSize;
  if (patch.length - cursor === 3) {
    targetSize = readUint24BE(patch, cursor);
    cursor += 3;
  }
  if (cursor !== patch.length) {
    throw new Error("IPS EOF 뒤에 알 수 없는 데이터가 있습니다.");
  }
  assertFileSize("결과", targetSize, MAX_TARGET_BYTES);

  const workingSize = Math.max(requiredSize, targetSize);
  assertFileSize("결과", workingSize, MAX_TARGET_BYTES);
  const output = new Uint8Array(workingSize);
  output.set(source.subarray(0, Math.min(source.length, output.length)));

  for (const record of records) {
    if (record.offset + record.size > output.length) {
      throw new Error("IPS 레코드가 결과 파일 범위를 벗어났습니다.");
    }
    if (record.kind === "rle") {
      output.fill(record.value, record.offset, record.offset + record.size);
      continue;
    }
    output.set(
      patch.subarray(record.dataOffset, record.dataOffset + record.size),
      record.offset,
    );
  }

  return {
    output: output.slice(0, targetSize),
    recordCount: records.length,
    rleRecordCount,
  };
}
