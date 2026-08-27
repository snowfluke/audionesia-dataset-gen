import { getClipAudio, listClips } from "../db/clip.repository.ts";
import { listSentencesBySource } from "../db/sentence.repository.ts";
import { loadSettings } from "../db/settings.repository.ts";
import { listSkips } from "../db/skip.repository.ts";
import { listWorkspaces } from "../db/workspace.repository.ts";
import type { DatasetWriter } from "../export/writer.ts";
import { BACKUP_VERSION } from "./schema.ts";

export const BACKUP_ROOT = "audionesia-backup";

export type BackupReport = { clips: number; missingAudio: number };

function json<T>(value: T): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Writes everything that cannot be regenerated: workspaces, clips with their
 * master WAVs, skips, settings, and sentences added in Tulis. The bundled pool
 * and the scripts are rebuilt from the site, so they are not included.
 */
export async function exportBackup(
  writer: DatasetWriter,
  onProgress: (done: number, total: number) => void
): Promise<BackupReport> {
  const [workspaces, clips, skips, settings, sentences] = await Promise.all([
    listWorkspaces(),
    listClips(),
    listSkips(),
    loadSettings(),
    listSentencesBySource("user"),
  ]);
  await writer.file(`${BACKUP_ROOT}/workspaces.json`, json(workspaces));
  await writer.file(`${BACKUP_ROOT}/clips.json`, json(clips));
  await writer.file(`${BACKUP_ROOT}/skips.json`, json(skips));
  await writer.file(`${BACKUP_ROOT}/settings.json`, json(settings));
  await writer.file(`${BACKUP_ROOT}/user-sentences.json`, json(sentences));
  let missingAudio = 0;
  for (const [done, clip] of clips.entries()) {
    const blob = await getClipAudio(clip.id);
    if (blob === undefined) missingAudio += 1;
    else
      await writer.file(
        `${BACKUP_ROOT}/audio/${clip.id}.wav`,
        new Uint8Array(await blob.arrayBuffer())
      );
    onProgress(done + 1, clips.length);
  }
  await writer.file(
    `${BACKUP_ROOT}/manifest.json`,
    json({ version: BACKUP_VERSION, exportedAt: new Date().toISOString(), clips: clips.length })
  );
  await writer.finish();
  return { clips: clips.length, missingAudio };
}
