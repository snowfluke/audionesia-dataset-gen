import { db } from "./database.ts";

/** Unit labels in id order; the pool's `units` arrays index into this list. */
export async function listUnitLabels(): Promise<string[]> {
  const rows = await (await db()).getAll("units");
  rows.sort((a, b) => a.id - b.id);
  return rows.map((row) => row.label);
}

export async function putUnitLabels(labels: readonly string[], fromId = 0): Promise<void> {
  const tx = (await db()).transaction("units", "readwrite");
  labels.forEach((label, offset) => void tx.store.put({ id: fromId + offset, label }));
  await tx.done;
}
