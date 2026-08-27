import { attributionMarkdown } from "../corpus/attribution.ts";
import type { CorpusSource } from "../corpus/schema.ts";
import { listClipsByStatus } from "../db/clip.repository.ts";
import type { Clip, ScriptRow, Speaker } from "../db/schema.ts";
import { getScript } from "../db/script.repository.ts";
import { getSentences, listSentences } from "../db/sentence.repository.ts";
import { listSpeakers } from "../db/speaker.repository.ts";
import type { LicenseMode } from "../settings.ts";
import { cc0ScriptIds, exportClip } from "./export-clips.ts";
import { jsonl, oodLines, pocketTtsLists, styleTts2Lists } from "./export-lists.ts";
import type { ExportRow } from "./manifest.ts";
import { DATASET_ROOT, hfMetadataLine, speakersJsonlLine } from "./manifest.ts";
import type { DatasetWriter } from "./writer.ts";

export const EXPORT_FORMATS = ["hf", "styletts2", "pocket-tts"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportOptions = {
  writer: DatasetWriter;
  formats: ReadonlySet<ExportFormat>;
  sampleRate: number;
  normalizePeakDbfs: number | null;
  minClipSec: number;
  licenseMode: LicenseMode;
  appVersion: string;
  onProgress: (done: number, total: number) => void;
};

export type ExportReport = { clips: number; skipped: number; warnings: string[] };

async function scriptsOf(clips: readonly Clip[]): Promise<ScriptRow[]> {
  const ids = [...new Set(clips.map((clip) => clip.scriptId))];
  const scripts = await Promise.all(ids.map((id) => getScript(id)));
  return scripts.filter((script): script is ScriptRow => script !== undefined);
}

async function attributionFor(scripts: readonly ScriptRow[]): Promise<string> {
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
      attributions: new Set<string>(),
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

type SpeakerEntry = {
  speaker_id: number;
  id: string;
  name: string;
  gender: string | null;
  age_range: string | null;
  dialect: string | null;
  microphone: string | null;
  consent_at: string | null;
};

function speakerEntry(speaker: Speaker, index: number): SpeakerEntry {
  return {
    speaker_id: index,
    id: speaker.id,
    name: speaker.name,
    gender: speaker.gender ?? null,
    age_range: speaker.ageRange ?? null,
    dialect: speaker.dialect ?? null,
    microphone: speaker.microphone ?? null,
    consent_at: speaker.consentAt ?? null,
  };
}

/** Writes every approved clip and the manifests the chosen formats need. */
export async function exportDataset(options: ExportOptions): Promise<ExportReport> {
  const [approved, speakers] = await Promise.all([listClipsByStatus("approved"), listSpeakers()]);
  approved.sort((a, b) => a.speakerId.localeCompare(b.speakerId) || a.seq - b.seq);
  const speakerIndex = new Map(speakers.map((speaker, index) => [speaker.id, index]));
  const warnings: string[] = [];
  let skipped = 0;

  let clips = approved;
  if (options.licenseMode === "cc0") {
    const allowed = await cc0ScriptIds(new Set(approved.map((clip) => clip.scriptId)));
    clips = approved.filter((clip) => allowed.has(clip.scriptId));
    skipped += approved.length - clips.length;
    if (skipped > 0) warnings.push(`${skipped} klip dilewati karena teksnya bukan sumber CC0`);
  }

  const rows: ExportRow[] = [];
  for (const [done, clip] of clips.entries()) {
    const result = await exportClip(clip, speakerIndex.get(clip.speakerId) ?? 0, {
      writer: options.writer,
      sampleRate: options.sampleRate,
      normalizePeakDbfs: options.normalizePeakDbfs,
      minClipSec: options.minClipSec,
    });
    if (result.warning !== null) warnings.push(result.warning);
    if (result.row === null) skipped += 1;
    else rows.push(result.row);
    options.onProgress(done + 1, clips.length);
  }

  const write = options.writer.file.bind(options.writer);
  await write(`${DATASET_ROOT}/speakers.jsonl`, jsonl(rows.map(speakersJsonlLine)));
  if (options.formats.has("hf")) {
    await write(`${DATASET_ROOT}/metadata.jsonl`, jsonl(rows.map(hfMetadataLine)));
  }
  const scripts = await scriptsOf(clips);
  if (options.formats.has("styletts2")) {
    const lists = styleTts2Lists(rows, warnings);
    await write(`${DATASET_ROOT}/styletts2/train_list.txt`, jsonl(lists.train));
    await write(`${DATASET_ROOT}/styletts2/val_list.txt`, jsonl(lists.val));
    const recorded = new Set(scripts.flatMap((script) => script.sentenceIds));
    await write(
      `${DATASET_ROOT}/styletts2/OOD_texts.txt`,
      jsonl(oodLines(await listSentences(), recorded))
    );
  }
  if (options.formats.has("pocket-tts")) {
    const lists = pocketTtsLists(rows, warnings);
    await write(`${DATASET_ROOT}/pocket-tts/train.jsonl`, jsonl(lists.train));
    await write(`${DATASET_ROOT}/pocket-tts/valid.jsonl`, jsonl(lists.val));
  }
  const manifest = {
    app_version: options.appVersion,
    exported_at: new Date().toISOString(),
    sample_rate: options.sampleRate,
    peak_dbfs: options.normalizePeakDbfs,
    license_mode: options.licenseMode,
    clips: rows.length,
    skipped,
    total_seconds: Math.round(rows.reduce((sum, row) => sum + row.durationSec, 0)),
    g2p_versions: [...new Set(clips.map((clip) => clip.g2pVersion))],
    speakers: speakers.map((speaker, index) => speakerEntry(speaker, index)),
    styletts2_root_path: "set data_params.root_path to the dataset/ directory",
    pocket_tts_cwd:
      "paths are relative to dataset/; run training with dataset/ as the working directory",
    formats: [...options.formats],
    warnings: warnings.length,
  };
  await write(`${DATASET_ROOT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  await write(`${DATASET_ROOT}/ATTRIBUTION.md`, await attributionFor(scripts));
  if (warnings.length > 0) await write(`${DATASET_ROOT}/export-warnings.txt`, jsonl(warnings));
  await options.writer.finish();
  return { clips: rows.length, skipped, warnings };
}
