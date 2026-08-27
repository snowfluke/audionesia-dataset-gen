import type { PoolSentence } from "../corpus/schema.ts";
import { TRAINER_PRESETS } from "../settings.ts";
import type { ExportRow, TrainValSplit } from "./manifest.ts";
import { oodLine, partition, pocketTtsLine, styleTts2Line } from "./manifest.ts";
import {
  STYLETTS2_MAX_PHONEME_CHARS,
  mapForStyleTts2,
  unknownStyleTts2Symbols,
} from "./styletts2-symbols.ts";

const MIN_STYLETTS2_CLIPS_PER_SPEAKER = 2;
const MAX_OOD_LINES = 20000;
const POCKET_TTS_MAX_SEC = 30;

export function jsonl(lines: readonly string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

type StyleRow = { row: ExportRow; mapped: string; split: ExportRow["split"] };

/** StyleTTS2 train and validation lists, after symbol mapping and the trainer's limits. */
export function styleTts2Lists(
  rows: readonly ExportRow[],
  warnings: string[]
): TrainValSplit<string> {
  const kept: StyleRow[] = [];
  for (const row of rows) {
    const mapped = mapForStyleTts2(row.phonemes);
    const unknown = unknownStyleTts2Symbols(mapped);
    if (unknown.length > 0) {
      warnings.push(
        `StyleTTS2: ${row.relativePath} memuat simbol ${unknown.join(" ")} yang tidak dikenal, dilewati`
      );
      continue;
    }
    if (mapped.length > STYLETTS2_MAX_PHONEME_CHARS) {
      warnings.push(
        `StyleTTS2: ${row.relativePath} melebihi ${STYLETTS2_MAX_PHONEME_CHARS} karakter fonem, dilewati`
      );
      continue;
    }
    if (row.durationSec > TRAINER_PRESETS.styletts2.maxSec) {
      warnings.push(
        `StyleTTS2: ${row.relativePath} lebih dari ${TRAINER_PRESETS.styletts2.maxSec} s`
      );
    }
    kept.push({ row, mapped, split: row.split });
  }
  const perSpeaker = new Map<string, number>();
  for (const entry of kept) {
    perSpeaker.set(entry.row.speakerId, (perSpeaker.get(entry.row.speakerId) ?? 0) + 1);
  }
  const eligible = kept.filter((entry) => {
    const count = perSpeaker.get(entry.row.speakerId) ?? 0;
    if (count >= MIN_STYLETTS2_CLIPS_PER_SPEAKER) return true;
    warnings.push(
      `StyleTTS2: pembicara ${entry.row.speakerId} punya kurang dari ${MIN_STYLETTS2_CLIPS_PER_SPEAKER} klip yang lolos, dilewati`
    );
    return false;
  });
  const split = partition(eligible);
  return {
    train: split.train.map((entry) => styleTts2Line(entry.row, entry.mapped)),
    val: split.val.map((entry) => styleTts2Line(entry.row, entry.mapped)),
  };
}

/** Out-of-distribution text for StyleTTS2: single pool sentences nobody has read, symbol-mapped. */
export function oodLines(
  sentences: readonly PoolSentence[],
  recordedSentenceIds: ReadonlySet<string>
): string[] {
  const lines: string[] = [];
  for (const sentence of sentences) {
    if (recordedSentenceIds.has(sentence.id)) continue;
    const mapped = mapForStyleTts2(sentence.phonemes);
    if (mapped.length > STYLETTS2_MAX_PHONEME_CHARS || unknownStyleTts2Symbols(mapped).length > 0)
      continue;
    lines.push(oodLine(mapped));
    if (lines.length >= MAX_OOD_LINES) break;
  }
  return lines;
}

/** PocketTTS train and validation manifests. */
export function pocketTtsLists(
  rows: readonly ExportRow[],
  warnings: string[]
): TrainValSplit<string> {
  for (const row of rows) {
    if (row.durationSec > POCKET_TTS_MAX_SEC) {
      warnings.push(`PocketTTS: ${row.relativePath} lebih dari ${POCKET_TTS_MAX_SEC} s`);
    }
  }
  const split = partition(rows);
  return { train: split.train.map(pocketTtsLine), val: split.val.map(pocketTtsLine) };
}
