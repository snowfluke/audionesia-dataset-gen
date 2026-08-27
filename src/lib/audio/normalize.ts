import { dbfsToAmplitude, peakAmplitude } from "./level.ts";

/** Subtracts the mean so a microphone's DC bias does not ride into the dataset. */
export function removeDcOffset(samples: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  if (samples.length === 0) return samples;
  let sum = 0;
  for (const sample of samples) sum += sample;
  const mean = sum / samples.length;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = (samples[i] ?? 0) - mean;
  return out;
}

/** Scales the take so its peak sits at `targetDbfs`. Silence is returned unchanged. */
export function normalizePeak(
  samples: Float32Array<ArrayBuffer>,
  targetDbfs: number
): Float32Array<ArrayBuffer> {
  const peak = peakAmplitude(samples);
  if (peak === 0) return samples;
  const gain = dbfsToAmplitude(targetDbfs) / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, (samples[i] ?? 0) * gain));
  }
  return out;
}
