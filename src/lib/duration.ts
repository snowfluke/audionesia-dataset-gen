/**
 * Read Indonesian, pauses included. Common Voice ID averages 3.99 s per clip
 * of about 15 syllables with leading and trailing silence, so continuous
 * reading sits a little higher. A calibration knob, not a constant: the app
 * fits the real rate per speaker from approved clips.
 */
export const DEFAULT_SYLLABLES_PER_SECOND = 4.5;

export const MIN_CALIBRATION_CLIPS = 10;

export function estimateSeconds(
  syllables: number,
  syllablesPerSecond: number = DEFAULT_SYLLABLES_PER_SECOND
): number {
  if (syllablesPerSecond <= 0) throw new RangeError("syllablesPerSecond must be positive");
  return syllables / syllablesPerSecond;
}

export type DurationSample = { syllables: number; durationSec: number };

/** Total syllables over total seconds, or `null` when there is nothing to fit. */
export function fitSyllablesPerSecond(samples: readonly DurationSample[]): number | null {
  let syllables = 0;
  let seconds = 0;
  for (const sample of samples) {
    if (sample.durationSec <= 0) continue;
    syllables += sample.syllables;
    seconds += sample.durationSec;
  }
  if (seconds === 0 || syllables === 0) return null;
  return syllables / seconds;
}
