const MIN_CHARS = 10;
const MAX_CHARS = 400;
const MIN_LETTERS = 3;
const MAX_DIGIT_RATIO = 0.2;
const MAX_CAPITAL_RATIO = 0.3;

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;
const MARKUP = /[<>[\]{}|\\*_#~^=]/;
const URL_LIKE = /https?:\/\/|www\.|\b\w+\.(?:com|net|org|id|co)\b/i;

/**
 * Folds typographic punctuation onto the plain characters `indo-g2p` reads
 * and collapses whitespace. Applied to every sentence before filtering, so
 * the dataset text and the phonemes always agree.
 */
export function normalizeSentence(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type RejectReason =
  | "too-short"
  | "too-long"
  | "non-ascii"
  | "markup"
  | "url"
  | "no-letters"
  | "too-many-digits"
  | "too-many-capitals";

/** Returns why a normalized sentence cannot enter the pool, or `null` when it can. */
export function rejectReason(text: string): RejectReason | null {
  if (text.length < MIN_CHARS) return "too-short";
  if (text.length > MAX_CHARS) return "too-long";
  if (!PRINTABLE_ASCII.test(text)) return "non-ascii";
  if (MARKUP.test(text)) return "markup";
  if (URL_LIKE.test(text)) return "url";
  const letters = text.match(/[A-Za-z]/g) ?? [];
  if (letters.length < MIN_LETTERS) return "no-letters";
  const digits = text.match(/[0-9]/g) ?? [];
  if (digits.length / text.length > MAX_DIGIT_RATIO) return "too-many-digits";
  const capitals = text.match(/[A-Z]/g) ?? [];
  if (capitals.length / letters.length > MAX_CAPITAL_RATIO) return "too-many-capitals";
  return null;
}

/** Case- and punctuation-insensitive identity of a sentence, for deduplication. */
export function dedupKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
