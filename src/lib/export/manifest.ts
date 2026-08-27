import { sha256Hex } from "../hash.ts";

export type Split = "train" | "validation";

/** One exported clip, after resampling and hashing. */
export type ExportRow = {
  clipId: string;
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
  split: Split;
};

export const DATASET_ROOT = "dataset";
/** One clip in this many goes to validation. */
export const VALIDATION_EVERY = 20;

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

/**
 * Train or validation, decided by a hash of the clip id, so a clip keeps its
 * split across exports no matter which clips are added or removed around it.
 */
export async function splitFor(clipId: string, everyNth = VALIDATION_EVERY): Promise<Split> {
  const hex = await sha256Hex(new TextEncoder().encode(clipId));
  return Number.parseInt(hex.slice(0, 8), 16) % everyNth === 0 ? "validation" : "train";
}

export type TrainValSplit<T> = { train: T[]; val: T[] };

export function partition<T extends { split: Split }>(rows: readonly T[]): TrainValSplit<T> {
  return {
    train: rows.filter((row) => row.split === "train"),
    val: rows.filter((row) => row.split === "validation"),
  };
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
    split: row.split,
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
