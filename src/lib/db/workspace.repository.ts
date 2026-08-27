import { db } from "./database.ts";
import type { Workspace } from "./schema.ts";

/** Every workspace in creation order, which is also the StyleTTS2 `speaker_id` order. */
export async function listWorkspaces(): Promise<Workspace[]> {
  const rows = await (await db()).getAll("workspaces");
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return rows;
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  return (await db()).get("workspaces", id);
}

export async function putWorkspace(workspace: Workspace): Promise<void> {
  await (await db()).put("workspaces", workspace);
}

/** Inserts the workspace unless the id exists, in one transaction. Returns false when it existed. */
export async function createWorkspaceIfAbsent(workspace: Workspace): Promise<boolean> {
  const tx = (await db()).transaction("workspaces", "readwrite");
  const existing = await tx.store.get(workspace.id);
  if (existing !== undefined) {
    await tx.done;
    return false;
  }
  await Promise.all([tx.store.add(workspace), tx.done]);
  return true;
}

/** Removes the workspace with every clip, audio blob, and skip that belongs to it. */
export async function deleteWorkspace(id: string): Promise<void> {
  const tx = (await db()).transaction(["workspaces", "clips", "audio", "skips"], "readwrite");
  const clipIds = await tx.objectStore("clips").index("by-workspace").getAllKeys(id);
  const skipRange = IDBKeyRange.bound([id, ""], [id, "￿"]);
  const skipKeys = await tx.objectStore("skips").getAllKeys(skipRange);
  await Promise.all([
    ...clipIds.map((clipId) => tx.objectStore("clips").delete(clipId)),
    ...clipIds.map((clipId) => tx.objectStore("audio").delete(clipId)),
    ...skipKeys.map((key) => tx.objectStore("skips").delete(key)),
    tx.objectStore("workspaces").delete(id),
    tx.done,
  ]);
}
