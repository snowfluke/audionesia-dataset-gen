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

/**
 * The level the dataset ships at: DC offset removed, then the peak moved to `peakDbfs`
 * (`null` keeps the master level). Playback uses it too, so a reviewer hears the exported clip.
 */
export function toExportLevel(
  samples: Float32Array<ArrayBuffer>,
  peakDbfs: number | null
): Float32Array<ArrayBuffer> {
  const centered = removeDcOffset(samples);
  return peakDbfs === null ? centered : normalizePeak(centered, peakDbfs);
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
