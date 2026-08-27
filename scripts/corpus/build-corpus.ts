// Turns corpus/raw/*.jsonl into the phonemized, deduplicated pool the app ships.
import { Glob } from "bun";
import { VERSION, explain, toPhoneme } from "indo-g2p";

import { attributionMarkdown } from "../../src/lib/corpus/attribution.ts";
import {
  FOREIGN_SHARE,
  createUnitTable,
  englishShare,
  internUnit,
  unitLabels,
} from "../../src/lib/corpus/coverage.ts";
import { dedupKey, normalizeSentence, rejectReason } from "../../src/lib/corpus/filter.ts";
import type {
  CorpusSource,
  PoolIndex,
  PoolSentence,
  RawSentence,
} from "../../src/lib/corpus/schema.ts";
import { rawSentenceSchema } from "../../src/lib/corpus/schema.ts";
import { packByTotal, splitSentences } from "../../src/lib/corpus/split.ts";
import { DEFAULT_SYLLABLES_PER_SECOND } from "../../src/lib/duration.ts";
import { textId } from "../../src/lib/hash.ts";
import { PUBLIC_DIR, RAW_DIR } from "./shared.ts";

/** Sources whose rows are prose paragraphs rather than single sentences. */
const PARAGRAPH_SOURCES: ReadonlySet<CorpusSource> = new Set(["wikipedia", "news", "llm"]);
/** 30 s at the default reading rate; longer paragraphs are split at sentence boundaries. */
const MAX_SYLLABLES_PER_ENTRY = Math.round(30 * DEFAULT_SYLLABLES_PER_SECOND);

type Analyzed = { text: string; phonemes: string; syllables: number; labels: string[] };
type SourceTally = { license: string; count: number };

/** Null when indo-g2p reads most of the words as English: a quote or caption in another language. */
function analyze(sentence: string): Analyzed | null {
  const result = toPhoneme(sentence);
  const traces = explain(sentence);
  if (englishShare(traces) >= FOREIGN_SHARE) return null;
  const syllables = result.syllables.filter((syllable) => syllable !== " ").length;
  const labels = unitLabels(sentence, result.phonemes, traces);
  return { text: sentence, phonemes: result.phonemes, syllables, labels };
}

function mergeRun(run: readonly Analyzed[]): Analyzed {
  const labels = new Set<string>();
  for (const part of run) for (const label of part.labels) labels.add(label);
  return {
    text: run.map((part) => part.text).join(" "),
    phonemes: run.map((part) => part.phonemes).join(" "),
    syllables: run.reduce((sum, part) => sum + part.syllables, 0),
    labels: [...labels].sort(),
  };
}

function tally(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

async function readRawRows(file: string, rejected: Map<string, number>): Promise<RawSentence[]> {
  const rows: RawSentence[] = [];
  const text = await Bun.file(`${RAW_DIR}/${file}`).text();
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const parsed = rawSentenceSchema.safeParse(JSON.parse(line));
      if (parsed.success) rows.push(parsed.data);
      else tally(rejected, "invalid-row");
    } catch {
      tally(rejected, "invalid-json");
    }
  }
  return rows;
}

const files = [...new Glob("*.jsonl").scanSync(RAW_DIR)].sort();
if (files.length === 0) {
  console.error(`no raw files in ${RAW_DIR}; run \`bun run corpus:common-voice\` first`);
  process.exit(1);
}

const table = createUnitTable();
const seen = new Set<string>();
const rejected = new Map<string, number>();
const perSource = new Map<CorpusSource, SourceTally>();
const pool: PoolSentence[] = [];

for (const file of files) {
  const rows = await readRawRows(file, rejected);
  let kept = 0;
  for (const row of rows) {
    const isParagraph = PARAGRAPH_SOURCES.has(row.source);
    const normalized = normalizeSentence(row.text);
    const sentences = isParagraph ? splitSentences(normalized) : [normalized];
    const accepted: Analyzed[] = [];
    for (const sentence of sentences) {
      const reason = rejectReason(sentence);
      if (reason !== null) {
        tally(rejected, reason);
        continue;
      }
      const key = dedupKey(sentence);
      if (seen.has(key)) {
        tally(rejected, "duplicate");
        continue;
      }
      seen.add(key);
      const analyzed = analyze(sentence);
      if (analyzed === null) {
        tally(rejected, "foreign");
        continue;
      }
      accepted.push(analyzed);
    }
    const runs = isParagraph
      ? packByTotal(accepted, (entry) => entry.syllables, MAX_SYLLABLES_PER_ENTRY)
      : accepted.map((entry) => [entry]);
    for (const run of runs) {
      const merged = mergeRun(run);
      pool.push({
        id: await textId(dedupKey(merged.text)),
        text: merged.text,
        phonemes: merged.phonemes,
        syllables: merged.syllables,
        units: merged.labels.map((label) => internUnit(table, label)),
        source: row.source,
        license: row.license,
        attribution: row.attribution,
        g2pVersion: VERSION,
      });
      const summary = perSource.get(row.source) ?? { license: row.license, count: 0 };
      summary.count += 1;
      perSource.set(row.source, summary);
      kept += 1;
    }
  }
  console.log(`${file}: ${rows.length} rows -> ${kept} entries`);
}

const index: PoolIndex = {
  g2pVersion: VERSION,
  count: pool.length,
  units: table.labels,
  sources: [...perSource].map(([source, summary]) => ({
    source,
    license: summary.license,
    count: summary.count,
  })),
};

await Bun.write(`${PUBLIC_DIR}/pool.jsonl`, `${pool.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
await Bun.write(`${PUBLIC_DIR}/index.json`, `${JSON.stringify(index, null, 2)}\n`);
await Bun.write(`${PUBLIC_DIR}/ATTRIBUTION.md`, attributionMarkdown(index.sources));

const totalSyllables = pool.reduce((sum, entry) => sum + entry.syllables, 0);
const hours = totalSyllables / DEFAULT_SYLLABLES_PER_SECOND / 3600;
console.log(`pool: ${pool.length} entries, ${table.labels.length} coverage units, ~${hours.toFixed(1)} h of reading`);
console.log(`rejected: ${[...rejected].map(([reason, n]) => `${reason}=${n}`).join(", ")}`);
