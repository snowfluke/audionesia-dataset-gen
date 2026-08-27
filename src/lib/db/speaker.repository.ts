import { db } from "./database.ts";
import type { Speaker } from "./schema.ts";

export async function listSpeakers(): Promise<Speaker[]> {
  return (await db()).getAll("speakers");
}

export async function getSpeaker(id: string): Promise<Speaker | undefined> {
  return (await db()).get("speakers", id);
}

export async function putSpeaker(speaker: Speaker): Promise<void> {
  await (await db()).put("speakers", speaker);
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
