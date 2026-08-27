import { normalizeText } from "indo-g2p/core";

import { resample } from "../audio/resample.ts";
import { decodeWav, encodeWav } from "../audio/wav-encode.ts";
import { attributionMarkdown } from "../corpus/attribution.ts";
import type { CorpusSource } from "../corpus/schema.ts";
import { getClipAudio, listClipsByStatus } from "../db/clip.repository.ts";
import type { Clip, ScriptRow, Speaker } from "../db/schema.ts";
import { getScript, listScripts } from "../db/script.repository.ts";
import { getSentences } from "../db/sentence.repository.ts";
import { listSpeakers } from "../db/speaker.repository.ts";
import { shortHash } from "../hash.ts";
import type { ExportRow } from "./manifest.ts";
import {
  DATASET_ROOT,
  hfMetadataLine,
  oodLine,
  pocketTtsLine,
  relativeClipPath,
  speakersJsonlLine,
  splitTrainVal,
  styleTts2Line,
} from "./manifest.ts";
import {
  STYLETTS2_MAX_PHONEME_CHARS,
  mapForStyleTts2,
  unknownStyleTts2Symbols,
} from "./styletts2-symbols.ts";
import type { DatasetWriter } from "./writer.ts";

export const EXPORT_FORMATS = ["hf", "styletts2", "pocket-tts"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportOptions = {
  writer: DatasetWriter;
  formats: ReadonlySet<ExportFormat>;
  sampleRate: number;
  appVersion: string;
  onProgress: (done: number, total: number) => void;
};

export type ExportReport = { clips: number; warnings: string[] };

const MIN_STYLETTS2_CLIPS_PER_SPEAKER = 2;

function jsonl(lines: readonly string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

async function exportClip(
  clip: Clip,
  speakerIndex: number,
  options: ExportOptions
): Promise<ExportRow | null> {
  const blob = await getClipAudio(clip.id);
  if (blob === undefined) return null;
  const master = decodeWav(new Uint8Array(await blob.arrayBuffer()));
  const samples = await resample(master.samples, master.sampleRate, options.sampleRate);
  const wav = encodeWav(samples, options.sampleRate);
  const relativePath = relativeClipPath(clip.speakerId, clip.seq);
  await options.writer.file(`${DATASET_ROOT}/${relativePath}`, wav);
  return {
    hash: await shortHash(wav),
    path: `${DATASET_ROOT}/${relativePath}`,
    relativePath,
    text: clip.text,
    phonemes: clip.phonemes,
    transcript: normalizeText(clip.text),
    durationSec: samples.length / options.sampleRate,
    speakerId: clip.speakerId,
    speakerIndex,
  };
}

function styleTts2Files(rows: readonly ExportRow[], warnings: string[]): Map<string, string> {
  const perSpeaker = new Map<string, number>();
  for (const row of rows) perSpeaker.set(row.speakerId, (perSpeaker.get(row.speakerId) ?? 0) + 1);
  const lines: string[] = [];
  for (const row of rows) {
    if ((perSpeaker.get(row.speakerId) ?? 0) < MIN_STYLETTS2_CLIPS_PER_SPEAKER) {
      warnings.push(`StyleTTS2: pembicara ${row.speakerId} punya kurang dari 2 klip, dilewati`);
      continue;
    }
    const mapped = mapForStyleTts2(row.phonemes);
    const unknown = unknownStyleTts2Symbols(mapped);
    if (unknown.length > 0)
      warnings.push(`StyleTTS2: simbol ${unknown.join(" ")} di ${row.relativePath}`);
    if (mapped.length > STYLETTS2_MAX_PHONEME_CHARS) {
      warnings.push(
        `StyleTTS2: ${row.relativePath} melebihi ${STYLETTS2_MAX_PHONEME_CHARS} karakter fonem, dilewati`
      );
      continue;
    }
    if (row.durationSec > 10) warnings.push(`StyleTTS2: ${row.relativePath} lebih dari 10 s`);
    lines.push(styleTts2Line(row, mapped));
  }
  const split = splitTrainVal(lines);
  return new Map([
    [`${DATASET_ROOT}/styletts2/train_list.txt`, jsonl(split.train)],
    [`${DATASET_ROOT}/styletts2/val_list.txt`, jsonl(split.val)],
  ]);
}

async function attributionFor(clips: readonly Clip[]): Promise<string> {
  const scriptIds = new Set(clips.map((clip) => clip.scriptId));
  const scripts = (await Promise.all([...scriptIds].map((id) => getScript(id)))).filter(
    (script): script is ScriptRow => script !== undefined
  );
  const sentenceIds = new Set(scripts.flatMap((script) => script.sentenceIds));
  const sentences = await getSentences([...sentenceIds]);
  const bySource = new Map<
    CorpusSource,
    { license: string; count: number; attributions: Set<string> }
  >();
  for (const sentence of sentences) {
    const entry = bySource.get(sentence.source) ?? {
      license: sentence.license,
      count: 0,
      attributions: new Set(),
    };
    entry.count += 1;
    if (sentence.attribution !== undefined) entry.attributions.add(sentence.attribution);
    bySource.set(sentence.source, entry);
  }
  const summary = [...bySource].map(([source, entry]) => ({
    source,
    license: entry.license,
    count: entry.count,
  }));
  const details = [...bySource]
    .filter(([, entry]) => entry.attributions.size > 0)
    .map(
      ([source, entry]) =>
        `\n### ${source}: per-entry attribution\n\n${[...entry.attributions].map((line) => `- ${line}`).join("\n")}\n`
    )
    .join("");
  return `${attributionMarkdown(summary)}${details}`;
}

/** Writes every approved clip and the manifests the chosen formats need. */
export async function exportDataset(options: ExportOptions): Promise<ExportReport> {
  const [clips, speakers] = await Promise.all([listClipsByStatus("approved"), listSpeakers()]);
  clips.sort((a, b) => a.speakerId.localeCompare(b.speakerId) || a.seq - b.seq);
  const speakerIndex = new Map(speakers.map((speaker: Speaker, index) => [speaker.id, index]));
  const warnings: string[] = [];
  const rows: ExportRow[] = [];
  for (const [done, clip] of clips.entries()) {
    const row = await exportClip(clip, speakerIndex.get(clip.speakerId) ?? 0, options);
    if (row === null) warnings.push(`Audio klip ${clip.id} tidak ditemukan`);
    else rows.push(row);
    options.onProgress(done + 1, clips.length);
  }

  await options.writer.file(`${DATASET_ROOT}/speakers.jsonl`, jsonl(rows.map(speakersJsonlLine)));
  if (options.formats.has("hf")) {
    await options.writer.file(`${DATASET_ROOT}/metadata.jsonl`, jsonl(rows.map(hfMetadataLine)));
  }
  if (options.formats.has("styletts2")) {
    for (const [path, content] of styleTts2Files(rows, warnings))
      await options.writer.file(path, content);
    const recorded = new Set(clips.map((clip) => clip.scriptId));
    const ood = (await listScripts()).filter((script) => !recorded.has(script.id));
    await options.writer.file(
      `${DATASET_ROOT}/styletts2/OOD_texts.txt`,
      jsonl(ood.map((script) => oodLine(mapForStyleTts2(script.phonemes))))
    );
  }
  if (options.formats.has("pocket-tts")) {
    const split = splitTrainVal(rows.map(pocketTtsLine));
    await options.writer.file(`${DATASET_ROOT}/pocket-tts/train.jsonl`, jsonl(split.train));
    await options.writer.file(`${DATASET_ROOT}/pocket-tts/valid.jsonl`, jsonl(split.val));
    for (const row of rows) {
      if (row.durationSec > 30) warnings.push(`PocketTTS: ${row.relativePath} lebih dari 30 s`);
    }
  }
  await options.writer.file(
    `${DATASET_ROOT}/manifest.json`,
    `${JSON.stringify(
      {
        app_version: options.appVersion,
        exported_at: new Date().toISOString(),
        sample_rate: options.sampleRate,
        clips: rows.length,
        total_seconds: Math.round(rows.reduce((sum, row) => sum + row.durationSec, 0)),
        g2p_versions: [...new Set(clips.map((clip) => clip.g2pVersion))],
        speaker_ids: Object.fromEntries(speakerIndex),
        styletts2_root_path: "set data_params.root_path to the dataset/ directory",
        formats: [...options.formats],
      },
      null,
      2
    )}\n`
  );
  await options.writer.file(`${DATASET_ROOT}/ATTRIBUTION.md`, await attributionFor(clips));
  await options.writer.finish();
  return { clips: rows.length, warnings };
}
