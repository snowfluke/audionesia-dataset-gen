// Downloads the CC0 Indonesian sentence files of the Common Voice repository.
import type { RawSentence } from "../../src/lib/corpus/schema.ts";
import { RAW_DIR, download, writeJsonl } from "./shared.ts";

const BASE_URL = "https://raw.githubusercontent.com/common-voice/common-voice/main/server/data/id/";
const FILES = ["sentence-collector.txt", "common.txt"];

const rows: RawSentence[] = [];
for (const file of FILES) {
  const text = await (await download(`${BASE_URL}${file}`)).text();
  let added = 0;
  for (const line of text.split("\n")) {
    const sentence = line.trim();
    if (sentence === "") continue;
    rows.push({ text: sentence, source: "common-voice", license: "CC0-1.0" });
    added += 1;
  }
  console.log(`${file}: ${added} sentences`);
}

const target = `${RAW_DIR}/common-voice.jsonl`;
await writeJsonl(target, rows);
console.log(`wrote ${rows.length} rows to ${target}`);
