import { describe, expect, it } from "bun:test";

import { amplitudeToDbfs, isClipped, peakDbfs } from "../../src/lib/audio/level.ts";
import { normalizePeak, removeDcOffset } from "../../src/lib/audio/normalize.ts";
import { analyzeTake, trimSilence } from "../../src/lib/audio/trim-silence.ts";

const SAMPLE_RATE = 1000;
const OPTIONS = { sampleRate: SAMPLE_RATE, thresholdDbfs: -40, paddingMs: 20 };

function tone(lengthSamples: number, amplitude: number): Float32Array<ArrayBuffer> {
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

describe("analyzeTake", () => {
  it("measures the noise floor of the leading silence against the speech", () => {
    const noise = tone(300, 0.001);
    const speech = tone(400, 0.5);
    const analysis = analyzeTake(new Float32Array([...noise, ...speech]), OPTIONS);
    expect(analysis.noiseRms).toBeCloseTo(0.001, 4);
    expect(analysis.speechRms).toBeCloseTo(0.5, 2);
    expect(analysis.snrDb).toBeCloseTo(54, 0);
    expect(analysis.samples.length).toBe(400 + 20);
  });

  it("has no noise estimate when speech starts at once", () => {
    const analysis = analyzeTake(tone(400, 0.5), OPTIONS);
    expect(analysis.noiseRms).toBeNull();
    expect(analysis.snrDb).toBeNull();
  });
});

describe("normalize", () => {
  it("removes a DC offset", () => {
    const biased = new Float32Array([0.3, 0.1, 0.3, 0.1]);
    const centred = removeDcOffset(biased);
    const mean = centred.reduce((sum, sample) => sum + sample, 0) / centred.length;
    expect(Math.abs(mean)).toBeLessThan(1e-6);
  });

  it("scales the peak to the target level and leaves silence alone", () => {
    const loud = normalizePeak(tone(10, 0.25), -6);
    expect(Math.max(...loud.map(Math.abs))).toBeCloseTo(0.501, 2);
    expect(normalizePeak(new Float32Array(10), -6)).toEqual(new Float32Array(10));
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
