import { db } from "./database.ts";
import type { SkipRow } from "./schema.ts";

export async function skipScript(workspaceId: string, scriptId: string): Promise<void> {
  await (await db()).put("skips", { workspaceId, scriptId, skippedAt: new Date().toISOString() });
}

export async function unskipScript(workspaceId: string, scriptId: string): Promise<void> {
  await (await db()).delete("skips", [workspaceId, scriptId]);
}

export async function listSkips(): Promise<SkipRow[]> {
  return (await db()).getAll("skips");
}

export async function putSkips(rows: readonly SkipRow[]): Promise<void> {
  const tx = (await db()).transaction("skips", "readwrite");
  for (const row of rows) void tx.store.put(row);
  await tx.done;
}

/** Ids of the scripts this workspace skipped. */
export async function listSkippedScriptIds(workspaceId: string): Promise<Set<string>> {
  const range = IDBKeyRange.bound([workspaceId, ""], [workspaceId, "￿"]);
  const rows = await (await db()).getAll("skips", range);
  return new Set(rows.map((row) => row.scriptId));
}
