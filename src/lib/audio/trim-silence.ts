import { amplitudeToDbfs, dbfsToAmplitude, rms } from "./level.ts";

/** Window over which loudness is judged, so a single noise spike cannot stop the trim. */
const WINDOW_MS = 10;

export type TrimOptions = {
  sampleRate: number;
  /** Windows quieter than this are silence. */
  thresholdDbfs: number;
  /** Silence kept on both sides of the speech. */
  paddingMs: number;
};

export type TakeAnalysis = {
  /** Speech with `paddingMs` of silence kept on each side; empty when nothing rose above the threshold. */
  samples: Float32Array<ArrayBuffer>;
  /** RMS of the leading silence before speech started, or null when speech started at once. */
  noiseRms: number | null;
  speechRms: number;
  /** Speech RMS over noise RMS in dB, or null without a noise estimate. */
  snrDb: number | null;
};

/** Trims silence and measures the take's noise floor against its speech level. */
export function analyzeTake(
  samples: Float32Array<ArrayBuffer>,
  options: TrimOptions
): TakeAnalysis {
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
  if (first === -1) {
    return { samples: new Float32Array(0), noiseRms: null, speechRms: 0, snrDb: null };
  }

  let last = first;
  for (let i = windows - 1; i > first; i -= 1) {
    if (rms(samples, i * window, (i + 1) * window) >= threshold) {
      last = i;
      break;
    }
  }

  const speechStart = first * window;
  const speechEnd = Math.min(samples.length, (last + 1) * window);
  const speechRms = rms(samples, speechStart, speechEnd);
  const noiseRms = first > 0 ? rms(samples, 0, speechStart) : null;
  const snrDb =
    noiseRms === null || noiseRms === 0 || speechRms === 0
      ? null
      : amplitudeToDbfs(speechRms) - amplitudeToDbfs(noiseRms);

  const padding = Math.round((options.sampleRate * options.paddingMs) / 1000);
  const start = Math.max(0, speechStart - padding);
  const end = Math.min(samples.length, speechEnd + padding);
  return { samples: samples.slice(start, end), noiseRms, speechRms, snrDb };
}

/** Removes leading and trailing silence, keeping `paddingMs` of it on each side. */
export function trimSilence(
  samples: Float32Array<ArrayBuffer>,
  options: TrimOptions
): Float32Array<ArrayBuffer> {
  return analyzeTake(samples, options).samples;
}
