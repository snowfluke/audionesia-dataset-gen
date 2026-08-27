import { db } from "./database.ts";
import type { Clip, ClipStatus } from "./schema.ts";

/**
 * Stores a clip, its audio, and the speaker's next sequence number in one
 * transaction, so a crash can never leave a clip without audio. The clip's
 * `seq` is assigned here from the speaker row.
 */
export async function saveClip(clip: Omit<Clip, "seq">, wav: Blob): Promise<Clip> {
  const tx = (await db()).transaction(["clips", "audio", "speakers"], "readwrite");
  const speaker = await tx.objectStore("speakers").get(clip.speakerId);
  if (speaker === undefined) throw new Error(`speaker ${clip.speakerId} does not exist`);
  const saved: Clip = { ...clip, seq: speaker.nextSeq };
  await Promise.all([
    tx.objectStore("clips").put(saved),
    tx.objectStore("audio").put({ clipId: saved.id, blob: wav }),
    tx.objectStore("speakers").put({ ...speaker, nextSeq: speaker.nextSeq + 1 }),
    tx.done,
  ]);
  return saved;
}

export async function getClip(id: string): Promise<Clip | undefined> {
  return (await db()).get("clips", id);
}

export async function getClipAudio(clipId: string): Promise<Blob | undefined> {
  return (await (await db()).get("audio", clipId))?.blob;
}

export async function listClipsBySpeaker(speakerId: string): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-speaker", speakerId);
}

export async function listClipsBySpeakerStatus(
  speakerId: string,
  status: ClipStatus
): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-speaker-status", [speakerId, status]);
}

export async function listClipsByStatus(status: ClipStatus): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-status", status);
}

export async function listClipsByScript(scriptId: string): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-script", scriptId);
}

export async function setClipStatus(id: string, status: ClipStatus): Promise<void> {
  const tx = (await db()).transaction("clips", "readwrite");
  const clip = await tx.store.get(id);
  if (clip === undefined) throw new Error(`clip ${id} does not exist`);
  await Promise.all([
    tx.store.put({ ...clip, status, reviewedAt: new Date().toISOString() }),
    tx.done,
  ]);
}

/** Removes the clip and its audio together. */
export async function deleteClip(id: string): Promise<void> {
  const tx = (await db()).transaction(["clips", "audio"], "readwrite");
  await Promise.all([
    tx.objectStore("clips").delete(id),
    tx.objectStore("audio").delete(id),
    tx.done,
  ]);
}
