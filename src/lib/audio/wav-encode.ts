export const WAV_HEADER_BYTES = 44;
const PCM_FORMAT = 1;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Encodes mono float samples in [-1, 1] as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * CHANNELS * BITS_PER_SAMPLE) / 8, true);
  view.setUint16(32, (CHANNELS * BITS_PER_SAMPLE) / 8, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = WAV_HEADER_BYTES;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

export type WavHeader = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
};

export type DecodedWav = { sampleRate: number; samples: Float32Array<ArrayBuffer> };

/** Decodes the 16-bit mono PCM WAV files this app writes back into float samples. */
export function decodeWav(bytes: Uint8Array<ArrayBuffer>): DecodedWav {
  const header = readWavHeader(bytes);
  if (header.channels !== CHANNELS || header.bitsPerSample !== BITS_PER_SAMPLE) {
    throw new Error("only 16-bit mono PCM WAV is supported");
  }
  const count = Math.min(header.dataBytes, bytes.byteLength - WAV_HEADER_BYTES) / 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset + WAV_HEADER_BYTES);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const value = view.getInt16(i * 2, true);
    samples[i] = value < 0 ? value / 0x8000 : value / 0x7fff;
  }
  return { sampleRate: header.sampleRate, samples };
}

/** Reads the header of a canonical 44-byte-header WAV, or throws when the bytes are not one. */
export function readWavHeader(bytes: Uint8Array<ArrayBuffer>): WavHeader {
  if (bytes.byteLength < WAV_HEADER_BYTES) throw new Error("WAV file is shorter than its header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number): string =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || tag(12) !== "fmt " || tag(36) !== "data") {
    throw new Error("not a canonical PCM WAV file");
  }
  return {
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    dataBytes: view.getUint32(40, true),
  };
}
