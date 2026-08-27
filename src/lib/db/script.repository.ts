import { db } from "./database.ts";
import type { ScriptRow } from "./schema.ts";

export async function countScripts(): Promise<number> {
  return (await db()).count("scripts");
}

/** All scripts in reading order. */
export async function listScripts(): Promise<ScriptRow[]> {
  return (await db()).getAllFromIndex("scripts", "by-order");
}

export async function getScript(id: string): Promise<ScriptRow | undefined> {
  return (await db()).get("scripts", id);
}

export async function putScripts(rows: readonly ScriptRow[]): Promise<void> {
  const tx = (await db()).transaction("scripts", "readwrite");
  for (const row of rows) void tx.store.put(row);
  await tx.done;
}

export async function deleteScript(id: string): Promise<void> {
  await (await db()).delete("scripts", id);
}

export async function clearScripts(): Promise<void> {
  await (await db()).clear("scripts");
}
