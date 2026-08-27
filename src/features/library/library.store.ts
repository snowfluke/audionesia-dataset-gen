import { createSignal } from "solid-js";

import { buildScriptsInWorker } from "../../lib/corpus/builder-client.ts";
import { createUnitTable, internUnit } from "../../lib/corpus/coverage.ts";
import { fetchPoolIndex, fetchPoolRows } from "../../lib/corpus/pool-loader.ts";
import type { PoolSentence } from "../../lib/corpus/schema.ts";
import type { ScriptRow } from "../../lib/db/schema.ts";
import { clearScripts, countScripts, putScripts } from "../../lib/db/script.repository.ts";
import { countSentences, listSentences, putSentences } from "../../lib/db/sentence.repository.ts";
import { listUnitLabels, putUnitLabels } from "../../lib/db/unit.repository.ts";
import { estimateSeconds } from "../../lib/duration.ts";
import type { Phonemized } from "../../lib/g2p/messages.ts";
import { textId } from "../../lib/hash.ts";
import { settings } from "../settings/settings.store.ts";

export type LibraryPhase = "idle" | "seeding" | "building" | "ready" | "error";

const [phase, setPhase] = createSignal<LibraryPhase>("idle");
const [progress, setProgress] = createSignal("");
const [scriptsVersion, setScriptsVersion] = createSignal(0);
const [clipsVersion, setClipsVersion] = createSignal(0);

export { clipsVersion, phase, progress, scriptsVersion };

export function bumpClips(): void {
  setClipsVersion((version) => version + 1);
}

async function seedPool(): Promise<void> {
  setPhase("seeding");
  setProgress("Memuat indeks korpus...");
  const index = await fetchPoolIndex();
  await putUnitLabels(index.units);
  let loaded = 0;
  await fetchPoolRows(async (rows) => {
    await putSentences(rows);
    loaded += rows.length;
    setProgress(
      `Memuat kalimat ${loaded.toLocaleString("id-ID")} / ${index.count.toLocaleString("id-ID")}`
    );
  });
}

/** Rebuilds every script from the current pool and window settings. Script ids are stable per sentence set. */
export async function rebuildScripts(): Promise<number> {
  setPhase("building");
  setProgress("Menyusun naskah...");
  const current = settings();
  const [sentences, labels] = await Promise.all([listSentences(), listUnitLabels()]);
  const bySentenceId = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const result = await buildScriptsInWorker({
    entries: sentences.map((sentence) => ({
      id: sentence.id,
      syllables: sentence.syllables,
      units: sentence.units,
    })),
    options: {
      unitCount: labels.length,
      minSyllables: Math.round(current.targetMinSec * current.syllablesPerSecond),
      maxSyllables: Math.round(current.targetMaxSec * current.syllablesPerSecond),
      scriptCount: sentences.length,
    },
  });
  const createdAt = new Date().toISOString();
  const rows: ScriptRow[] = [];
  for (const [order, draft] of result.scripts.entries()) {
    const parts = draft.sentenceIds
      .map((id) => bySentenceId.get(id))
      .filter((sentence): sentence is PoolSentence => sentence !== undefined);
    if (parts.length === 0) continue;
    rows.push({
      id: await textId(draft.sentenceIds.join(",")),
      sentenceIds: draft.sentenceIds,
      text: parts.map((sentence) => sentence.text).join(" "),
      phonemes: parts.map((sentence) => sentence.phonemes).join(" "),
      syllables: draft.syllables,
      estSeconds: estimateSeconds(draft.syllables, current.syllablesPerSecond),
      g2pVersion: parts[0]?.g2pVersion ?? "",
      order,
      createdAt,
    });
  }
  await clearScripts();
  await putScripts(rows);
  setScriptsVersion((version) => version + 1);
  setPhase("ready");
  setProgress("");
  return rows.length;
}

/** Seeds the pool on first run and builds scripts when there are none. */
export async function initLibrary(): Promise<void> {
  try {
    if ((await countSentences()) === 0) await seedPool();
    if ((await countScripts()) === 0) await rebuildScripts();
    setPhase("ready");
    setProgress("");
  } catch (error: unknown) {
    setPhase("error");
    setProgress(error instanceof Error ? error.message : "Korpus gagal dimuat");
  }
}

/** Adds phonemized user text to the pool, extending the unit table with any new labels. */
export async function addUserSentences(
  results: readonly Phonemized[],
  g2pVersion: string
): Promise<number> {
  const labels = await listUnitLabels();
  const table = createUnitTable(labels);
  const rows: PoolSentence[] = [];
  for (const result of results) {
    rows.push({
      id: await textId(result.text.toLowerCase()),
      text: result.text,
      phonemes: result.phonemes,
      syllables: result.syllables,
      units: result.labels.map((label) => internUnit(table, label)),
      source: "user",
      license: "unknown",
      g2pVersion,
    });
  }
  if (table.labels.length > labels.length) {
    await putUnitLabels(table.labels.slice(labels.length), labels.length);
  }
  await putSentences(rows);
  return rows.length;
}
