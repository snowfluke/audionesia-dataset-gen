import { unzipSync } from "fflate";
import type { z } from "zod";

import { getClip, putClipWithAudio } from "../db/clip.repository.ts";
import { existingSentenceIds, putSentences } from "../db/sentence.repository.ts";
import { putSkips } from "../db/skip.repository.ts";
import { getSpeaker, putSpeaker } from "../db/speaker.repository.ts";
import { BACKUP_ROOT } from "./backup.ts";
import {
  backupManifestSchema,
  clipsFileSchema,
  sentencesFileSchema,
  skipsFileSchema,
  speakersFileSchema,
  toClip,
  toSkip,
  toSpeaker,
} from "./schema.ts";

/** Reads backup files by path relative to the backup root. */
export type BackupSource = {
  readText(path: string): Promise<string | null>;
  readBytes(path: string): Promise<Uint8Array<ArrayBuffer> | null>;
};

async function fileIn(root: FileSystemDirectoryHandle, path: string): Promise<File | null> {
  const parts = path.split("/");
  const name = parts.pop();
  if (name === undefined) return null;
  let directory = root;
  try {
    for (const part of parts) directory = await directory.getDirectoryHandle(part);
    return await (await directory.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
}

/** A picked folder that contains `audionesia-backup/`, or is that folder itself. */
export function folderSource(root: FileSystemDirectoryHandle): BackupSource {
  const locate = async (path: string): Promise<File | null> =>
    (await fileIn(root, `${BACKUP_ROOT}/${path}`)) ?? (await fileIn(root, path));
  return {
    async readText(path) {
      const file = await locate(path);
      return file === null ? null : file.text();
    },
    async readBytes(path) {
      const file = await locate(path);
      return file === null ? null : new Uint8Array(await file.arrayBuffer());
    },
  };
}

/** A ZIP produced by the ZIP writer; everything is unpacked in memory. */
export async function zipSource(file: File): Promise<BackupSource> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const find = (path: string): Uint8Array | undefined =>
    entries[`${BACKUP_ROOT}/${path}`] ?? entries[path];
  return {
    async readText(path) {
      const bytes = find(path);
      return bytes === undefined ? null : new TextDecoder().decode(bytes);
    },
    async readBytes(path) {
      const bytes = find(path);
      return bytes === undefined ? null : new Uint8Array(bytes);
    },
  };
}

export type RestoreReport = {
  speakers: number;
  clips: number;
  skippedClips: number;
  sentences: number;
};

async function readJson<T>(source: BackupSource, path: string, schema: z.ZodType<T>): Promise<T> {
  const text = await source.readText(path);
  if (text === null) throw new Error(`Berkas cadangan ${path} tidak ditemukan`);
  return schema.parse(JSON.parse(text));
}

/**
 * Merges a backup into the current database. Existing clips are left alone;
 * speakers keep the higher sequence counter so new clips never reuse a name.
 */
export async function restoreBackup(
  source: BackupSource,
  onProgress: (done: number, total: number) => void
): Promise<RestoreReport> {
  await readJson(source, "manifest.json", backupManifestSchema);
  const speakers = (await readJson(source, "speakers.json", speakersFileSchema)).map(toSpeaker);
  const clips = (await readJson(source, "clips.json", clipsFileSchema)).map(toClip);
  const skips = (await readJson(source, "skips.json", skipsFileSchema)).map(toSkip);
  const sentencesText = await source.readText("user-sentences.json");
  const sentences =
    sentencesText === null ? [] : sentencesFileSchema.parse(JSON.parse(sentencesText));

  for (const speaker of speakers) {
    const existing = await getSpeaker(speaker.id);
    await putSpeaker(
      existing === undefined
        ? speaker
        : { ...existing, nextSeq: Math.max(existing.nextSeq, speaker.nextSeq) }
    );
  }
  let restored = 0;
  let skippedClips = 0;
  for (const [done, clip] of clips.entries()) {
    if ((await getClip(clip.id)) !== undefined) {
      skippedClips += 1;
    } else {
      const bytes = await source.readBytes(`audio/${clip.id}.wav`);
      if (bytes === null) skippedClips += 1;
      else {
        await putClipWithAudio(clip, new Blob([bytes], { type: "audio/wav" }));
        restored += 1;
      }
    }
    onProgress(done + 1, clips.length);
  }
  await putSkips(skips);
  const existing = await existingSentenceIds(sentences.map((row) => row.id));
  const fresh = sentences.filter((row) => !existing.has(row.id));
  await putSentences(fresh);
  return { speakers: speakers.length, clips: restored, skippedClips, sentences: fresh.length };
}
