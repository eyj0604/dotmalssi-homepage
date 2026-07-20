const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_TARGET_BYTES = 64 * 1024 * 1024;

export type BpsPatchResult = {
  output: Uint8Array;
  sourceChecksum: number;
  targetChecksum: number;
  patchChecksum: number;
};

function crc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = crc32Table();

export function crc32(bytes: Uint8Array) {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum = CRC32_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error("BPS 체크섬 영역이 손상되었습니다.");
  }
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function reader(bytes: Uint8Array, end = bytes.length) {
  let offset = 0;

  const readByte = () => {
    if (offset >= end) {
      throw new Error("BPS 데이터가 예상보다 일찍 끝났습니다.");
    }
    return bytes[offset++];
  };

  const readNumber = () => {
    let value = 0;
    let shift = 1;

    while (true) {
      const next = readByte();
      value += (next & 0x7f) * shift;
      if (!Number.isSafeInteger(value)) {
        throw new Error("BPS 숫자 범위가 너무 큽니다.");
      }
      if ((next & 0x80) !== 0) return value;
      shift *= 128;
      value += shift;
      if (!Number.isSafeInteger(shift)) {
        throw new Error("BPS 숫자 인코딩이 잘못되었습니다.");
      }
    }
  };

  const skip = (length: number) => {
    if (!Number.isSafeInteger(length) || length < 0 || offset + length > end) {
      throw new Error("BPS 메타데이터 길이가 잘못되었습니다.");
    }
    offset += length;
  };

  return {
    readByte,
    readNumber,
    skip,
    get offset() {
      return offset;
    },
  };
}

function assertFileSize(label: string, size: number, maximum: number) {
  if (size > maximum) {
    throw new Error(`${label} 파일은 ${maximum / 1024 / 1024} MiB 이하여야 합니다.`);
  }
}

export function applyBpsPatch(
  source: Uint8Array,
  patch: Uint8Array,
): BpsPatchResult {
  assertFileSize("원본", source.length, MAX_INPUT_BYTES);
  assertFileSize("패치", patch.length, MAX_INPUT_BYTES);

  if (patch.length < 19) {
    throw new Error("BPS 파일이 너무 짧습니다.");
  }

  const footerOffset = patch.length - 12;
  const input = reader(patch, footerOffset);
  const magic = String.fromCharCode(
    input.readByte(),
    input.readByte(),
    input.readByte(),
    input.readByte(),
  );
  if (magic !== "BPS1") {
    throw new Error("BPS1 형식의 패치 파일이 아닙니다.");
  }

  const sourceSize = input.readNumber();
  const targetSize = input.readNumber();
  const metadataSize = input.readNumber();
  assertFileSize("결과", targetSize, MAX_TARGET_BYTES);

  if (sourceSize !== source.length) {
    throw new Error(
      `원본 크기가 맞지 않습니다. 필요 ${sourceSize.toLocaleString()} bytes / 선택 ${source.length.toLocaleString()} bytes`,
    );
  }
  input.skip(metadataSize);

  const sourceChecksum = readUint32LE(patch, footerOffset);
  const targetChecksum = readUint32LE(patch, footerOffset + 4);
  const patchChecksum = readUint32LE(patch, footerOffset + 8);

  if (crc32(patch.subarray(0, patch.length - 4)) !== patchChecksum) {
    throw new Error("BPS 파일 체크섬이 맞지 않습니다. 다시 내려받아 주세요.");
  }
  if (crc32(source) !== sourceChecksum) {
    throw new Error("지원하는 원본이 아닙니다. 지역판과 원본 해시를 확인해 주세요.");
  }

  const output = new Uint8Array(targetSize);
  let outputOffset = 0;
  let sourceCopyOffset = 0;
  let targetCopyOffset = 0;

  const ensureOutput = (length: number) => {
    if (length < 1 || outputOffset + length > output.length) {
      throw new Error("BPS 명령이 결과 파일 범위를 벗어났습니다.");
    }
  };

  while (input.offset < footerOffset) {
    const instruction = input.readNumber();
    const action = instruction % 4;
    const length = Math.floor(instruction / 4) + 1;
    ensureOutput(length);

    if (action === 0) {
      if (outputOffset + length > source.length) {
        throw new Error("BPS SourceRead가 원본 범위를 벗어났습니다.");
      }
      output.set(source.subarray(outputOffset, outputOffset + length), outputOffset);
      outputOffset += length;
      continue;
    }

    if (action === 1) {
      for (let index = 0; index < length; index += 1) {
        output[outputOffset++] = input.readByte();
      }
      continue;
    }

    const encodedOffset = input.readNumber();
    const distance = Math.floor(encodedOffset / 2);
    const direction = encodedOffset % 2 === 0 ? 1 : -1;

    if (action === 2) {
      sourceCopyOffset += direction * distance;
      if (
        sourceCopyOffset < 0 ||
        sourceCopyOffset + length > source.length
      ) {
        throw new Error("BPS SourceCopy가 원본 범위를 벗어났습니다.");
      }
      for (let index = 0; index < length; index += 1) {
        output[outputOffset++] = source[sourceCopyOffset++];
      }
      continue;
    }

    targetCopyOffset += direction * distance;
    if (targetCopyOffset < 0 || targetCopyOffset >= outputOffset) {
      throw new Error("BPS TargetCopy가 생성된 결과 범위를 벗어났습니다.");
    }
    for (let index = 0; index < length; index += 1) {
      if (targetCopyOffset < 0 || targetCopyOffset >= outputOffset) {
        throw new Error("BPS TargetCopy 참조가 아직 생성되지 않은 영역입니다.");
      }
      output[outputOffset++] = output[targetCopyOffset++];
    }
  }

  if (outputOffset !== targetSize) {
    throw new Error("BPS 적용 결과의 크기가 선언값과 다릅니다.");
  }
  if (crc32(output) !== targetChecksum) {
    throw new Error("패치 적용 결과 체크섬이 맞지 않습니다.");
  }

  return { output, sourceChecksum, targetChecksum, patchChecksum };
}
