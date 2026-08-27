import { describe, expect, it } from "bun:test";

import { amplitudeToDbfs, isClipped, peakDbfs } from "../../src/lib/audio/level.ts";
import { trimSilence } from "../../src/lib/audio/trim-silence.ts";

const SAMPLE_RATE = 1000;
const OPTIONS = { sampleRate: SAMPLE_RATE, thresholdDbfs: -40, paddingMs: 20 };

function tone(lengthSamples: number, amplitude: number): Float32Array {
  const samples = new Float32Array(lengthSamples);
  for (let i = 0; i < lengthSamples; i += 1) samples[i] = amplitude * (i % 2 === 0 ? 1 : -1);
  return samples;
}

describe("trimSilence", () => {
  it("removes leading and trailing silence but keeps the padding", () => {
    const silence = new Float32Array(200);
    const speech = tone(300, 0.5);
    const input = new Float32Array([...silence, ...speech, ...silence]);
    const trimmed = trimSilence(input, OPTIONS);
    expect(trimmed.length).toBe(300 + 2 * 20);
    expect(trimmed[20]).toBeCloseTo(0.5);
  });

  it("returns an empty array when everything is silent", () => {
    expect(trimSilence(new Float32Array(500), OPTIONS).length).toBe(0);
    expect(trimSilence(tone(500, 0.001), OPTIONS).length).toBe(0);
  });

  it("leaves audio with no silence unchanged", () => {
    const speech = tone(250, 0.3);
    expect(trimSilence(speech, OPTIONS)).toEqual(speech);
  });

  it("handles input shorter than one window", () => {
    expect(trimSilence(tone(3, 0.3), OPTIONS).length).toBe(3);
    expect(trimSilence(new Float32Array(0), OPTIONS).length).toBe(0);
  });
});

describe("level helpers", () => {
  it("measures peaks in dBFS and detects clipping", () => {
    expect(peakDbfs(tone(10, 0.5))).toBeCloseTo(-6.02, 1);
    expect(amplitudeToDbfs(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(isClipped(tone(10, 0.995))).toBe(true);
    expect(isClipped(tone(10, 0.9))).toBe(false);
  });
});
