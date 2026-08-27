import { db } from "./database.ts";
import type { Clip, ClipStatus } from "./schema.ts";

/**
 * Stores a clip, its audio, and the workspace's next sequence number in one
 * transaction, so a crash can never leave a clip without audio. The clip's
 * `seq` is assigned here from the workspace row.
 */
export async function saveClip(clip: Omit<Clip, "seq">, wav: Blob): Promise<Clip> {
  const tx = (await db()).transaction(["clips", "audio", "workspaces"], "readwrite");
  const workspace = await tx.objectStore("workspaces").get(clip.workspaceId);
  if (workspace === undefined) throw new Error(`workspace ${clip.workspaceId} does not exist`);
  const saved: Clip = { ...clip, seq: workspace.nextSeq };
  await Promise.all([
    tx.objectStore("clips").put(saved),
    tx.objectStore("audio").put({ clipId: saved.id, blob: wav }),
    tx.objectStore("workspaces").put({ ...workspace, nextSeq: workspace.nextSeq + 1 }),
    tx.done,
  ]);
  return saved;
}

export async function getClip(id: string): Promise<Clip | undefined> {
  return (await db()).get("clips", id);
}

/** Restores a clip with its audio and its sequence number as they were, in one transaction. */
export async function putClipWithAudio(clip: Clip, wav: Blob): Promise<void> {
  const tx = (await db()).transaction(["clips", "audio"], "readwrite");
  await Promise.all([
    tx.objectStore("clips").put(clip),
    tx.objectStore("audio").put({ clipId: clip.id, blob: wav }),
    tx.done,
  ]);
}

export async function listClips(): Promise<Clip[]> {
  return (await db()).getAll("clips");
}

/** Merges fields into a clip row without touching its audio. */
export async function updateClip(id: string, patch: Partial<Clip>): Promise<void> {
  const tx = (await db()).transaction("clips", "readwrite");
  const clip = await tx.store.get(id);
  if (clip === undefined) throw new Error(`clip ${id} does not exist`);
  await Promise.all([tx.store.put({ ...clip, ...patch, id }), tx.done]);
}

/** Frees the audio of every rejected clip in a workspace; the rows stay. Returns bytes freed. */
export async function deleteRejectedAudio(workspaceId: string): Promise<number> {
  const tx = (await db()).transaction(["clips", "audio"], "readwrite");
  const rejected = await tx
    .objectStore("clips")
    .index("by-workspace-status")
    .getAll([workspaceId, "rejected"]);
  let bytes = 0;
  for (const clip of rejected) {
    const row = await tx.objectStore("audio").get(clip.id);
    if (row === undefined) continue;
    bytes += row.blob.size;
    await tx.objectStore("audio").delete(clip.id);
  }
  await tx.done;
  return bytes;
}

export async function getClipAudio(clipId: string): Promise<Blob | undefined> {
  return (await (await db()).get("audio", clipId))?.blob;
}

export async function listClipsByWorkspace(workspaceId: string): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-workspace", workspaceId);
}

export async function listClipsByWorkspaceStatus(
  workspaceId: string,
  status: ClipStatus
): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-workspace-status", [workspaceId, status]);
}

export async function listClipsByStatus(status: ClipStatus): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-status", status);
}

export async function listClipsByScript(scriptId: string): Promise<Clip[]> {
  return (await db()).getAllFromIndex("clips", "by-script", scriptId);
}

/**
 * Moves a clip along the status machine. A rejected clip can return to
 * approved only while its master audio still exists, because `deleteRejectedAudio`
 * may have freed it.
 */
export async function setClipStatus(id: string, status: ClipStatus): Promise<void> {
  const tx = (await db()).transaction(["clips", "audio"], "readwrite");
  const clip = await tx.objectStore("clips").get(id);
  if (clip === undefined) throw new Error(`clip ${id} does not exist`);
  if (clip.status === "rejected" && status === "approved") {
    const audio = await tx.objectStore("audio").getKey(id);
    if (audio === undefined) {
      throw new Error("Audio klip ini sudah dibebaskan; rekam ulang naskahnya");
    }
  }
  const reviewedAt = new Date().toISOString();
  await Promise.all([tx.objectStore("clips").put({ ...clip, status, reviewedAt }), tx.done]);
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
