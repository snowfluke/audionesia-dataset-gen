import { dbfsToAmplitude, rms } from "./level.ts";

/** Window over which loudness is judged, so a single noise spike cannot stop the trim. */
const WINDOW_MS = 10;

export type TrimOptions = {
  sampleRate: number;
  /** Windows quieter than this are silence. */
  thresholdDbfs: number;
  /** Silence kept on both sides of the speech. */
  paddingMs: number;
};

/**
 * Removes leading and trailing silence, keeping `paddingMs` of it on each
 * side. Returns an empty array when nothing rises above the threshold.
 */
export function trimSilence(samples: Float32Array, options: TrimOptions): Float32Array {
  const window = Math.max(1, Math.round((options.sampleRate * WINDOW_MS) / 1000));
  const threshold = dbfsToAmplitude(options.thresholdDbfs);
  const windows = Math.ceil(samples.length / window);

  let first = -1;
  for (let i = 0; i < windows; i += 1) {
    if (rms(samples, i * window, (i + 1) * window) >= threshold) {
      first = i;
      break;
    }
  }
  if (first === -1) return new Float32Array(0);

  let last = first;
  for (let i = windows - 1; i > first; i -= 1) {
    if (rms(samples, i * window, (i + 1) * window) >= threshold) {
      last = i;
      break;
    }
  }

  const padding = Math.round((options.sampleRate * options.paddingMs) / 1000);
  const start = Math.max(0, first * window - padding);
  const end = Math.min(samples.length, (last + 1) * window + padding);
  return samples.slice(start, end);
}
