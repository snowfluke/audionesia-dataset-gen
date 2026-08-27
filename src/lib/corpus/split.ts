/** Words that end with a period without ending a sentence. Lowercase, no trailing dot. */
const ABBREVIATIONS = new Set([
  "dr",
  "prof",
  "ir",
  "drs",
  "no",
  "hal",
  "tgl",
  "dll",
  "dsb",
  "dst",
  "rp",
  "jl",
  "kec",
  "kab",
  "prov",
  "sdr",
  "sdri",
  "bpk",
  "st",
  "mr",
  "mrs",
  "ms",
  "ny",
  "tn",
  "h",
  "hj",
  "kh",
  "yth",
  "cs",
  "vs",
  "a.n",
  "u.p",
  "s.d",
  "d.a",
]);

const CLOSERS = /["')\]]/;
const SENTENCE_START = /[A-Z"'(]/;

function isAbbreviation(text: string, dotIndex: number): boolean {
  const before = text.slice(0, dotIndex).match(/([A-Za-z.]+)$/);
  if (before === null) return false;
  const word = (before[1] ?? "").replace(/\.$/, "").toLowerCase();
  if (word.length === 1) return true;
  return ABBREVIATIONS.has(word);
}

/**
 * Splits prose into sentences at `. ! ?` followed by a space and a capital,
 * quote, or parenthesis. Abbreviations and initials do not split.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch !== "." && ch !== "!" && ch !== "?") {
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < text.length && CLOSERS.test(text.charAt(end))) end += 1;
    const next = text.charAt(end + 1);
    const splits =
      end < text.length &&
      text.charAt(end) === " " &&
      SENTENCE_START.test(next) &&
      !(ch === "." && isAbbreviation(text, i));
    if (splits) {
      sentences.push(text.slice(start, end).trim());
      start = end + 1;
    }
    i = end;
  }
  const tail = text.slice(start).trim();
  if (tail.length > 0) sentences.push(tail);
  return sentences;
}

/**
 * Groups consecutive items into runs whose total stays within `maxTotal`.
 * An item larger than `maxTotal` becomes a run of its own.
 */
export function packByTotal<T>(
  items: readonly T[],
  measure: (item: T) => number,
  maxTotal: number
): T[][] {
  const runs: T[][] = [];
  let current: T[] = [];
  let total = 0;
  for (const item of items) {
    const size = measure(item);
    if (current.length > 0 && total + size > maxTotal) {
      runs.push(current);
      current = [];
      total = 0;
    }
    current.push(item);
    total += size;
  }
  if (current.length > 0) runs.push(current);
  return runs;
}
