import { db } from "./database.ts";
import type { Speaker } from "./schema.ts";

/** Every speaker in creation order, which is also their StyleTTS2 `speaker_id` order. */
export async function listSpeakers(): Promise<Speaker[]> {
  const speakers = await (await db()).getAll("speakers");
  speakers.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return speakers;
}

export async function getSpeaker(id: string): Promise<Speaker | undefined> {
  return (await db()).get("speakers", id);
}

export async function putSpeaker(speaker: Speaker): Promise<void> {
  await (await db()).put("speakers", speaker);
}

/** Inserts the speaker unless the id exists, in one transaction. Returns false when it existed. */
export async function createSpeakerIfAbsent(speaker: Speaker): Promise<boolean> {
  const tx = (await db()).transaction("speakers", "readwrite");
  const existing = await tx.store.get(speaker.id);
  if (existing !== undefined) {
    await tx.done;
    return false;
  }
  await Promise.all([tx.store.add(speaker), tx.done]);
  return true;
}

/** Removes the speaker with every clip, audio blob, and skip that belongs to them. */
export async function deleteSpeaker(id: string): Promise<void> {
  const tx = (await db()).transaction(["speakers", "clips", "audio", "skips"], "readwrite");
  const clipIds = await tx.objectStore("clips").index("by-speaker").getAllKeys(id);
  const skipRange = IDBKeyRange.bound([id, ""], [id, "￿"]);
  const skipKeys = await tx.objectStore("skips").getAllKeys(skipRange);
  await Promise.all([
    ...clipIds.map((clipId) => tx.objectStore("clips").delete(clipId)),
    ...clipIds.map((clipId) => tx.objectStore("audio").delete(clipId)),
    ...skipKeys.map((key) => tx.objectStore("skips").delete(key)),
    tx.objectStore("speakers").delete(id),
    tx.done,
  ]);
}
