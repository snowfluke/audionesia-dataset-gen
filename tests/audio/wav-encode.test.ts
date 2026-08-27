import { describe, expect, it } from "bun:test";

import {
  WAV_HEADER_BYTES,
  decodeWav,
  encodeWav,
  readWavHeader,
} from "../../src/lib/audio/wav-encode.ts";

describe("encodeWav", () => {
  it("writes a canonical 44-byte header followed by little-endian 16-bit samples", () => {
    const bytes = encodeWav(new Float32Array([0, 1, -1, 0.5]), 24000);
    expect(bytes.byteLength).toBe(WAV_HEADER_BYTES + 4 * 2);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe("WAVE");
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(4, true)).toBe(36 + 8);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(28, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(view.getInt16(50, true)).toBe(16384);
  });

  it("clamps samples outside [-1, 1]", () => {
    const bytes = encodeWav(new Float32Array([2, -2]), 48000);
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});

describe("decodeWav", () => {
  it("round-trips samples through encodeWav within 16-bit precision", () => {
    const original = new Float32Array([0, 0.5, -0.5, 1, -1, 0.123]);
    const decoded = decodeWav(encodeWav(original, 24000));
    expect(decoded.sampleRate).toBe(24000);
    expect(decoded.samples.length).toBe(original.length);
    for (let i = 0; i < original.length; i += 1) {
      expect(Math.abs((decoded.samples[i] ?? 0) - (original[i] ?? 0))).toBeLessThan(1 / 0x7fff);
    }
  });
});

describe("readWavHeader", () => {
  it("round-trips the header written by encodeWav", () => {
    const header = readWavHeader(encodeWav(new Float32Array(10), 44100));
    expect(header).toEqual({ channels: 1, sampleRate: 44100, bitsPerSample: 16, dataBytes: 20 });
  });

  it("rejects bytes that are not a WAV file", () => {
    expect(() => readWavHeader(new Uint8Array(10))).toThrow();
    expect(() => readWavHeader(new Uint8Array(60))).toThrow("not a canonical PCM WAV file");
  });
});
