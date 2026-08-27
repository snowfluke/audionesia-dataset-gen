import { createSignal } from "solid-js";

import { buildScriptsInWorker } from "../../lib/corpus/builder-client.ts";
import { createUnitTable, internUnit } from "../../lib/corpus/coverage.ts";
import { dedupKey } from "../../lib/corpus/filter.ts";
import { fetchPoolIndex, fetchPoolRows } from "../../lib/corpus/pool-loader.ts";
import type { PoolIndex, PoolSentence } from "../../lib/corpus/schema.ts";
import { listClips } from "../../lib/db/clip.repository.ts";
import type { ScriptRow } from "../../lib/db/schema.ts";
import { countScripts, listScripts, replaceScripts } from "../../lib/db/script.repository.ts";
import {
  clearSentences,
  existingSentenceIds,
  listSentences,
  listSentencesBySource,
  putSentences,
} from "../../lib/db/sentence.repository.ts";
import { loadLibraryMeta, saveLibraryMeta } from "../../lib/db/settings.repository.ts";
import { clearUnitLabels, listUnitLabels, putUnitLabels } from "../../lib/db/unit.repository.ts";
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

/** Maps a sentence's unit ids from an old label table onto the current one. */
function remapUnits(
  units: readonly number[],
  oldLabels: readonly string[],
  table: ReturnType<typeof createUnitTable>
): number[] {
  const mapped: number[] = [];
  for (const id of units) {
    const label = oldLabels[id];
    if (label !== undefined) mapped.push(internUnit(table, label));
  }
  return mapped;
}

/**
 * Replaces the bundled pool with the one the site currently serves. Sentences
 * added in Tulis survive with their units remapped onto the new label table.
 */
async function reseed(index: PoolIndex): Promise<void> {
  setPhase("seeding");
  setProgress("Memuat indeks korpus...");
  const [oldLabels, userRows] = await Promise.all([
    listUnitLabels(),
    listSentencesBySource("user"),
  ]);
  await clearSentences();
  await clearUnitLabels();
  await putUnitLabels(index.units);
  let loaded = 0;
  await fetchPoolRows(async (rows) => {
    await putSentences(rows);
    loaded += rows.length;
    setProgress(
      `Memuat kalimat ${loaded.toLocaleString("id-ID")} / ${index.count.toLocaleString("id-ID")}`
    );
  });
  const table = createUnitTable(index.units);
  const remapped = userRows.map((row) => ({
    ...row,
    units: remapUnits(row.units, oldLabels, table),
  }));
  if (table.labels.length > index.units.length) {
    await putUnitLabels(table.labels.slice(index.units.length), index.units.length);
  }
  await putSentences(remapped);
  await saveLibraryMeta({
    poolCount: index.count,
    g2pVersion: index.g2pVersion,
    seededAt: new Date().toISOString(),
  });
}

/**
 * Rebuilds every script from the current pool and window settings. Scripts made
 * only of the user's own sentences come first in the queue. Script ids hash
 * their sentence ids, so unchanged groupings keep their id; old scripts that
 * recorded clips still reference are kept so nothing dangles.
 */
export async function rebuildScripts(): Promise<number> {
  setPhase("building");
  setProgress("Menyusun naskah...");
  const current = settings();
  const [sentences, labels, oldScripts, clips] = await Promise.all([
    listSentences(),
    listUnitLabels(),
    listScripts(),
    listClips(),
  ]);
  const bySentenceId = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const result = await buildScriptsInWorker({
    entries: sentences.map((sentence) => ({
      id: sentence.id,
      syllables: sentence.syllables,
      units: sentence.units,
      source: sentence.source,
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
  const isUserScript = (row: ScriptRow): boolean =>
    row.sentenceIds.every((id) => bySentenceId.get(id)?.source === "user");
  rows.sort((a, b) => Number(isUserScript(b)) - Number(isUserScript(a)) || a.order - b.order);
  rows.forEach((row, order) => {
    row.order = order;
  });
  const newIds = new Set(rows.map((row) => row.id));
  const referenced = new Set(clips.map((clip) => clip.scriptId));
  const kept = oldScripts
    .filter((script) => referenced.has(script.id) && !newIds.has(script.id))
    .map((script, offset) => ({ ...script, order: rows.length + offset }));
  await replaceScripts([...rows, ...kept]);
  setScriptsVersion((version) => version + 1);
  setPhase("ready");
  setProgress("");
  return rows.length;
}

/** Seeds or refreshes the pool when the served pool differs from the seeded one, then builds scripts. */
export async function initLibrary(): Promise<void> {
  try {
    const meta = await loadLibraryMeta();
    let index: PoolIndex | null = null;
    try {
      index = await fetchPoolIndex();
    } catch (cause: unknown) {
      if (meta === null) throw cause;
    }
    if (
      index !== null &&
      (meta === null || meta.poolCount !== index.count || meta.g2pVersion !== index.g2pVersion)
    ) {
      await reseed(index);
      await rebuildScripts();
    } else if ((await countScripts()) === 0) {
      await rebuildScripts();
    }
    setPhase("ready");
    setProgress("");
  } catch (cause: unknown) {
    setPhase("error");
    setProgress(cause instanceof Error ? cause.message : "Korpus gagal dimuat");
  }
}

export type AddResult = { added: number; duplicates: number };

/** Adds phonemized user text to the pool; sentences already in the pool are skipped. */
export async function addUserSentences(
  results: readonly Phonemized[],
  g2pVersion: string
): Promise<AddResult> {
  const labels = await listUnitLabels();
  const table = createUnitTable(labels);
  const candidates: PoolSentence[] = [];
  for (const result of results) {
    candidates.push({
      id: await textId(dedupKey(result.text)),
      text: result.text,
      phonemes: result.phonemes,
      syllables: result.syllables,
      units: result.labels.map((label) => internUnit(table, label)),
      source: "user",
      license: "unknown",
      g2pVersion,
    });
  }
  const existing = await existingSentenceIds(candidates.map((row) => row.id));
  const fresh = candidates.filter((row) => !existing.has(row.id));
  if (table.labels.length > labels.length) {
    await putUnitLabels(table.labels.slice(labels.length), labels.length);
  }
  await putSentences(fresh);
  return { added: fresh.length, duplicates: candidates.length - fresh.length };
}
