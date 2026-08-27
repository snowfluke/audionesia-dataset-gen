import { normalizeText } from "indo-g2p/core";

import { normalizePeak, removeDcOffset } from "../audio/normalize.ts";
import { resample } from "../audio/resample.ts";
import { decodeWav, encodeWav } from "../audio/wav-encode.ts";
import { getClipAudio } from "../db/clip.repository.ts";
import type { Clip } from "../db/schema.ts";
import { getScript } from "../db/script.repository.ts";
import { getSentences } from "../db/sentence.repository.ts";
import { shortHash } from "../hash.ts";
import { CC0_SOURCES } from "../settings.ts";
import type { ExportRow } from "./manifest.ts";
import { DATASET_ROOT, relativeClipPath, splitFor } from "./manifest.ts";
import type { DatasetWriter } from "./writer.ts";

export type ClipExportOptions = {
  writer: DatasetWriter;
  sampleRate: number;
  /** `null` keeps the master level. */
  normalizePeakDbfs: number | null;
  /** Clips shorter than this are skipped with a warning. */
  minClipSec: number;
};

export type ClipExportResult = { row: ExportRow | null; warning: string | null };

/** Resamples, normalizes, writes, and hashes one approved clip. */
export async function exportClip(
  clip: Clip,
  speakerIndex: number,
  options: ClipExportOptions
): Promise<ClipExportResult> {
  const blob = await getClipAudio(clip.id);
  if (blob === undefined) return { row: null, warning: `Audio klip ${clip.id} tidak ditemukan` };
  const master = decodeWav(new Uint8Array(await blob.arrayBuffer()));
  const masterSeconds = master.samples.length / master.sampleRate;
  const relativePath = relativeClipPath(clip.speakerId, clip.seq);
  if (masterSeconds < options.minClipSec) {
    return {
      row: null,
      warning: `${relativePath} hanya ${masterSeconds.toFixed(2)} s, di bawah batas ${options.minClipSec} s, dilewati`,
    };
  }
  let samples = removeDcOffset(master.samples);
  if (options.normalizePeakDbfs !== null)
    samples = normalizePeak(samples, options.normalizePeakDbfs);
  samples = await resample(samples, master.sampleRate, options.sampleRate);
  const wav = encodeWav(samples, options.sampleRate);
  await options.writer.file(`${DATASET_ROOT}/${relativePath}`, wav);
  return {
    row: {
      clipId: clip.id,
      hash: await shortHash(wav),
      path: `${DATASET_ROOT}/${relativePath}`,
      relativePath,
      text: clip.text,
      phonemes: clip.phonemes,
      transcript: normalizeText(clip.text),
      durationSec: samples.length / options.sampleRate,
      speakerId: clip.speakerId,
      speakerIndex,
      split: await splitFor(clip.id),
    },
    warning: null,
  };
}

/**
 * Script ids whose every sentence comes from a public-domain source. A script
 * that no longer exists cannot be checked and is not allowed.
 */
export async function cc0ScriptIds(scriptIds: Iterable<string>): Promise<Set<string>> {
  const allowed = new Set<string>();
  for (const scriptId of scriptIds) {
    const script = await getScript(scriptId);
    if (script === undefined) continue;
    const sentences = await getSentences(script.sentenceIds);
    if (sentences.length !== script.sentenceIds.length) continue;
    if (sentences.every((sentence) => CC0_SOURCES.has(sentence.source))) allowed.add(scriptId);
  }
  return allowed;
}
