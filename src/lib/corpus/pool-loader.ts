import type { PoolIndex, PoolSentence } from "./schema.ts";
import { poolIndexSchema, poolSentenceSchema } from "./schema.ts";

const CORPUS_PATH = `${import.meta.env.BASE_URL}corpus/`;

export async function fetchPoolIndex(): Promise<PoolIndex> {
  const response = await fetch(`${CORPUS_PATH}index.json`);
  if (!response.ok) throw new Error(`corpus index: HTTP ${response.status}`);
  return poolIndexSchema.parse(await response.json());
}

/**
 * Streams `pool.jsonl` and hands over validated rows in batches, so a
 * 30,000-line pool never sits in memory twice. Invalid lines are counted, not thrown.
 */
export async function fetchPoolRows(
  onBatch: (rows: PoolSentence[]) => Promise<void>,
  batchSize = 2000
): Promise<{ accepted: number; rejected: number }> {
  const response = await fetch(`${CORPUS_PATH}pool.jsonl`);
  if (!response.ok || response.body === null) {
    throw new Error(`corpus pool: HTTP ${response.status}`);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "";
  let batch: PoolSentence[] = [];
  let accepted = 0;
  let rejected = 0;

  const take = async (line: string): Promise<void> => {
    if (line.trim() === "") return;
    const parsed = poolSentenceSchema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      rejected += 1;
      return;
    }
    batch.push(parsed.data);
    accepted += 1;
    if (batch.length >= batchSize) {
      await onBatch(batch);
      batch = [];
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += value;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) await take(line);
  }
  await take(pending);
  if (batch.length > 0) await onBatch(batch);
  return { accepted, rejected };
}
