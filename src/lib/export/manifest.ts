/** One exported clip, after resampling and hashing. */
export type ExportRow = {
  hash: string;
  /** `dataset/audio/<speaker>/clip_0001.wav`, as in speakers.jsonl. */
  path: string;
  /** `audio/<speaker>/clip_0001.wav`, relative to the dataset root. */
  relativePath: string;
  text: string;
  phonemes: string;
  /** Text after number normalization, for trainers that tokenize text themselves. */
  transcript: string;
  durationSec: number;
  speakerId: string;
  /** Integer id in speaker creation order, for StyleTTS2. */
  speakerIndex: number;
};

export const DATASET_ROOT = "dataset";

export function clipFileName(seq: number): string {
  return `clip_${String(seq).padStart(4, "0")}.wav`;
}

export function relativeClipPath(speakerId: string, seq: number): string {
  return `audio/${speakerId}/${clipFileName(seq)}`;
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** The user's target line: `{"hash","path","text","phonemes","duration","speaker"}`. */
export function speakersJsonlLine(row: ExportRow): string {
  return JSON.stringify({
    hash: row.hash,
    path: row.path,
    text: row.text,
    phonemes: row.phonemes,
    duration: round(row.durationSec),
    speaker: row.speakerId,
  });
}

/** Hugging Face audiofolder: `file_name` relative to the directory that holds metadata.jsonl. */
export function hfMetadataLine(row: ExportRow): string {
  return JSON.stringify({
    file_name: row.relativePath,
    text: row.text,
    phonemes: row.phonemes,
    speaker: row.speakerId,
    duration: round(row.durationSec),
  });
}

/** StyleTTS2 `path|phonemes|speaker_id`, path relative to `data_params.root_path` = dataset/. */
export function styleTts2Line(row: ExportRow, mappedPhonemes: string): string {
  return `${row.relativePath}|${mappedPhonemes}|${row.speakerIndex}`;
}

/** StyleTTS2 `OOD_texts.txt`: `text|anything`. */
export function oodLine(phonemes: string): string {
  return `${phonemes}|ood`;
}

/** PocketTTS training manifest line; `phonemes` is an extra key its loader ignores. */
export function pocketTtsLine(row: ExportRow): string {
  return JSON.stringify({
    path: row.relativePath,
    duration: round(row.durationSec),
    transcript: row.transcript,
    phonemes: row.phonemes,
  });
}

export type TrainValSplit<T> = { train: T[]; val: T[] };

/** Deterministic train/validation split: every `everyNth` row (1-based) goes to validation. */
export function splitTrainVal<T>(rows: readonly T[], everyNth = 20): TrainValSplit<T> {
  const train: T[] = [];
  const val: T[] = [];
  rows.forEach((row, index) => {
    if ((index + 1) % everyNth === 0) val.push(row);
    else train.push(row);
  });
  if (val.length === 0 && train.length > 1) {
    const last = train.pop();
    if (last !== undefined) val.push(last);
  }
  return { train, val };
}
