import type { WordTrace } from "indo-g2p";

/** Phones `indo-g2p` writes with two characters. Checked before single characters. */
export const MULTI_CHAR_PHONES: readonly string[] = ["tʃ", "dʒ", "aɪ", "aʊ", "ɔɪ"];

const SINGLE_PHONE = /[a-zəʔŋɲʃʒɪʊɔé]/;

export const WORD_BOUNDARY = "#";

/** Splits one phonemized word into phones. Punctuation and unknown characters are dropped. */
export function tokenizePhones(word: string): string[] {
  const phones: string[] = [];
  let i = 0;
  while (i < word.length) {
    const pair = word.slice(i, i + 2);
    if (MULTI_CHAR_PHONES.includes(pair)) {
      phones.push(pair);
      i += 2;
      continue;
    }
    const ch = word.charAt(i);
    if (SINGLE_PHONE.test(ch)) phones.push(ch);
    i += 1;
  }
  return phones;
}

export type PhoneUnits = { phones: Set<string>; diphones: Set<string> };

/** Phones and diphones (with `#` word boundaries) present in a phoneme string. */
export function phoneUnits(phonemes: string): PhoneUnits {
  const phones = new Set<string>();
  const diphones = new Set<string>();
  for (const word of phonemes.split(/\s+/)) {
    const tokens = tokenizePhones(word);
    if (tokens.length === 0) continue;
    let previous = WORD_BOUNDARY;
    for (const phone of tokens) {
      phones.add(phone);
      diphones.add(`${previous}.${phone}`);
      previous = phone;
    }
    diphones.add(`${previous}.${WORD_BOUNDARY}`);
  }
  return { phones, diphones };
}

export const PHENOMENA = [
  "schwa",
  "glottal",
  "digraph",
  "diphthong",
  "number",
  "english",
  "homograph",
  "reduplication",
  "abbreviation",
  "question",
  "exclamation",
  "commas",
  "quote",
] as const;
export type Phenomenon = (typeof PHENOMENA)[number];

/** Spelling and prosody phenomena a sentence exercises, from its text, phonemes, and traces. */
export function detectPhenomena(
  text: string,
  phonemes: string,
  traces: readonly WordTrace[]
): Phenomenon[] {
  const found: Phenomenon[] = [];
  if (/ə/.test(phonemes)) found.push("schwa");
  if (/ʔ/.test(phonemes)) found.push("glottal");
  if (/[ŋɲʃx]/.test(phonemes)) found.push("digraph");
  if (/aɪ|aʊ|ɔɪ/.test(phonemes)) found.push("diphthong");
  if (/[0-9]|Rp|%/.test(text)) found.push("number");
  if (traces.some((trace) => trace.source === "english")) found.push("english");
  if (traces.some((trace) => trace.source === "collocation")) found.push("homograph");
  if (/[A-Za-z]-[A-Za-z]/.test(text)) found.push("reduplication");
  if (/\b[b-df-hj-np-tv-z]{2,}\b/i.test(text)) found.push("abbreviation");
  if (text.includes("?")) found.push("question");
  if (text.includes("!")) found.push("exclamation");
  if ((text.match(/,/g) ?? []).length >= 2) found.push("commas");
  if (/["']/.test(text)) found.push("quote");
  return found;
}

/** Share of words indo-g2p read as English, 0 to 1. Above about 0.3 the sentence is not Indonesian. */
export function englishShare(traces: readonly WordTrace[]): number {
  if (traces.length === 0) return 0;
  return traces.filter((trace) => trace.source === "english").length / traces.length;
}

/** Sentences with at least this share of English readings are foreign text, not loanwords. */
export const FOREIGN_SHARE = 0.3;

/** Every coverage unit of a sentence as a label: `p:<phone>`, `d:<a>.<b>`, `f:<phenomenon>`. */
export function unitLabels(text: string, phonemes: string, traces: readonly WordTrace[]): string[] {
  const units = phoneUnits(phonemes);
  const labels: string[] = [];
  for (const phone of units.phones) labels.push(`p:${phone}`);
  for (const diphone of units.diphones) labels.push(`d:${diphone}`);
  for (const phenomenon of detectPhenomena(text, phonemes, traces)) labels.push(`f:${phenomenon}`);
  return labels.sort();
}

/** Interns unit labels to stable small integers, in first-seen order. */
export type UnitTable = { labels: string[]; index: Map<string, number> };

export function createUnitTable(labels: readonly string[] = []): UnitTable {
  const table: UnitTable = { labels: [], index: new Map() };
  for (const label of labels) internUnit(table, label);
  return table;
}

export function internUnit(table: UnitTable, label: string): number {
  const existing = table.index.get(label);
  if (existing !== undefined) return existing;
  const id = table.labels.length;
  table.labels.push(label);
  table.index.set(label, id);
  return id;
}
