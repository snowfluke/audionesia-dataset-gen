import { db } from "./database.ts";

export async function skipScript(speakerId: string, scriptId: string): Promise<void> {
  await (await db()).put("skips", { speakerId, scriptId, skippedAt: new Date().toISOString() });
}

export async function unskipScript(speakerId: string, scriptId: string): Promise<void> {
  await (await db()).delete("skips", [speakerId, scriptId]);
}

/** Ids of the scripts this speaker skipped. */
export async function listSkippedScriptIds(speakerId: string): Promise<Set<string>> {
  const range = IDBKeyRange.bound([speakerId, ""], [speakerId, "￿"]);
  const rows = await (await db()).getAll("skips", range);
  return new Set(rows.map((row) => row.scriptId));
}
