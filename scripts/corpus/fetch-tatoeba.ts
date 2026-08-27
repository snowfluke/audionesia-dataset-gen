// Downloads the Tatoeba Indonesian export. The detailed export carries the
// contributor of every sentence, which CC-BY attribution requires.
import { $ } from "bun";

import type { RawSentence } from "../../src/lib/corpus/schema.ts";
import { RAW_DIR, download, writeJsonl } from "./shared.ts";

const EXPORT_URL =
  "https://downloads.tatoeba.org/exports/per_language/ind/ind_sentences_detailed.tsv.bz2";
const ANONYMOUS = "\\N";

const archive = `${RAW_DIR}/tatoeba.tsv.bz2`;
await Bun.write(archive, await download(EXPORT_URL));
const tsv = await $`bzip2 -dc ${archive}`.text();

const rows: RawSentence[] = [];
for (const line of tsv.split("\n")) {
  const columns = line.split("\t");
  const id = columns[0];
  const language = columns[1];
  const text = columns[2]?.trim();
  const username = columns[3];
  if (id === undefined || language !== "ind" || text === undefined || text === "") continue;
  const contributor =
    username === undefined || username === ANONYMOUS ? "an anonymous contributor" : username;
  rows.push({
    text,
    source: "tatoeba",
    license: "CC-BY-2.0-FR",
    attribution: `Tatoeba sentence ${id} by ${contributor}, https://tatoeba.org/sentences/show/${id}`,
  });
}

const target = `${RAW_DIR}/tatoeba.jsonl`;
await writeJsonl(target, rows);
console.log(`wrote ${rows.length} rows to ${target}`);
