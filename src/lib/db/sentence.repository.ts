import type { CorpusSource, PoolSentence } from "../corpus/schema.ts";
import { db } from "./database.ts";

const PUT_BATCH = 2000;

export async function countSentences(): Promise<number> {
  return (await db()).count("sentences");
}

export async function listSentences(): Promise<PoolSentence[]> {
  return (await db()).getAll("sentences");
}

export async function listSentencesBySource(source: CorpusSource): Promise<PoolSentence[]> {
  return (await db()).getAllFromIndex("sentences", "by-source", source);
}

export async function getSentences(ids: readonly string[]): Promise<PoolSentence[]> {
  const tx = (await db()).transaction("sentences");
  const rows = await Promise.all(ids.map((id) => tx.store.get(id)));
  return rows.filter((row): row is PoolSentence => row !== undefined);
}

/** Which of the given ids already exist. */
export async function existingSentenceIds(ids: readonly string[]): Promise<Set<string>> {
  const tx = (await db()).transaction("sentences");
  const keys = await Promise.all(ids.map((id) => tx.store.getKey(id)));
  return new Set(keys.filter((key): key is string => key !== undefined));
}

/** Inserts or replaces rows in batches, each batch in its own transaction. */
export async function putSentences(rows: readonly PoolSentence[]): Promise<void> {
  const database = await db();
  for (let start = 0; start < rows.length; start += PUT_BATCH) {
    const tx = database.transaction("sentences", "readwrite");
    for (const row of rows.slice(start, start + PUT_BATCH)) void tx.store.put(row);
    await tx.done;
  }
}

export async function clearSentences(): Promise<void> {
  await (await db()).clear("sentences");
}

export async function deleteSentencesBySource(source: CorpusSource): Promise<number> {
  const tx = (await db()).transaction("sentences", "readwrite");
  const keys = await tx.store.index("by-source").getAllKeys(source);
  await Promise.all([...keys.map((key) => tx.store.delete(key)), tx.done]);
  return keys.length;
}
