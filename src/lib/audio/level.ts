/** Any sample at or above this magnitude counts as clipped. */
export const CLIP_LIMIT = 0.99;

export function dbfsToAmplitude(dbfs: number): number {
  return 10 ** (dbfs / 20);
}

export function amplitudeToDbfs(amplitude: number): number {
  return amplitude <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(amplitude);
}

export function peakAmplitude(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) {
    const magnitude = Math.abs(sample);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

export function peakDbfs(samples: Float32Array): number {
  return amplitudeToDbfs(peakAmplitude(samples));
}

export function isClipped(samples: Float32Array, limit: number = CLIP_LIMIT): boolean {
  return peakAmplitude(samples) >= limit;
}

/** Root mean square of one window. */
export function rms(samples: Float32Array, start: number, end: number): number {
  const length = Math.max(0, Math.min(end, samples.length) - start);
  if (length === 0) return 0;
  let sum = 0;
  for (let i = start; i < start + length; i += 1) {
    const sample = samples[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / length);
}
