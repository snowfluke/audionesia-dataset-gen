const MIN_CHARS = 10;
const MAX_CHARS = 300;
 /** One- to three-word fragments read badly and add little coverage. */
const MIN_WORDS = 4;
const MIN_LETTERS = 3;
const MAX_DIGIT_RATIO = 0.2;
const MAX_CAPITAL_RATIO = 0.3;
/**
 * Function words of Dutch, English, German, French, Spanish, Portuguese, and
 * Italian. None of them is an Indonesian word, so two hits mean the sentence
 * carries a foreign clause or title rather than one borrowed term.
 * Deliberately absent: `pas` and `plus`, which Indonesian uses itself;
 * `para`, which only collides once per sentence at most; `per`, which is an
 * Indonesian preposition; and short `del`/`dal`/`col`/`sul`, which match
 * fragments of acronyms like COL1A1 once digits are stripped.
 */
const FOREIGN_FUNCTION_WORDS: ReadonlySet<string> = new Set(
  `de het een van voor met die dat niet geen aan naar door tussen onder tegen zonder wordt zijn heeft hebben
   deze dit welke zoals maar ook als hun onze mijn jouw zij wij jullie
   the and of with for from that this these those are was were been has have had will would an
   about into over under between through their them they your our her his than then there here where which while during because
   der das und nicht mit von fuer ist sind eine einer eines einem einen auch aber oder wenn durch beim zum zur kein keine
   dieser diese dieses als aus auf dem den im ins
   les des une et est sont dans pour avec cette ces comme mais aussi leur leurs votre entre sans sous sur par qui que quoi dont ou quand alors donc tout toute
   los las una para como pero porque hasta desde donde cuando este esta estos estas muy sobre tambien dos das uma pelo essa esse mais tres
   che con come sono siamo hanno anche molto questo questa questi queste dei degli della nella`
    .split(/\s+/),
);
/** Hits that mark a sentence as carrying a foreign clause or title. */
const FOREIGN_FUNCTION_HITS = 2;
/** Letter runs no native Indonesian word spells: Dutch `ij`/`sch`, English `th`/`ph`, and friends. */
const FOREIGN_SPELLING = /(sch|ck|tz|ij|qu|th|ph|rh|gh|oe|ch|x)/;
/** Qur'anic spellings are the one native use of `qu`. */
const QURANIC_WORD = /^(al)?qur'?an$|^qunut$|^iqra$|^qori$|^qari$/;
/** Words with foreign spelling that mark a sentence as non-Indonesian. */
const FOREIGN_SPELLING_HITS = 2;
/**
 * Mid-sentence capitals that mark a name-heavy sentence. Four keeps one or two
 * local names (Jakarta, Budi) while the `foreign-names` rule below catches
 * lists of foreign titles paired with any other foreign signal.
 */
const NAME_HEAVY_CAPITALS = 4;
/** Template residue that leaks from Wikipedia extracts into prose. */
const TEMPLATE_RESIDUE = /code:\s*[a-z]{2}\b|is deprecated|\{\{|\}\}/;
/**
 * Suffixes of Latin taxonomic names (`Cerambycidae`, `negrosensis`) that no
 * Indonesian word carries. `saurus` and `ella` are excluded on purpose:
 * `dinosaurus` and `Nutella` are ordinary Indonesian vocabulary.
 */
const TAXONOMIC_SUFFIX = /(ensis|oides|aceae|idae|inae|coccus|bacillus|myces|mycota|ptera|phora|phyta|rhiza|thrix)$/;
/**
 * Species epithets no reader pronounces from Indonesian spelling, matched only
 * in binomial position (`Panthera tigris`). `sapiens` and `erectus` are
 * excluded: school vocabulary that `indo-g2p` reads correctly.
 */
const TAXONOMIC_EPITHET: ReadonlySet<string> = new Set(
  ["tigris", "lupus", "sativa", "indica", "coli", "familiaris", "domestica", "vulgaris"],
);
const BINOMIAL = new RegExp(`\\b[A-Z][a-z]+ (${[...TAXONOMIC_EPITHET].join("|")})\\b`);
/**
 * A word mixing letters and digits the way formulas and catalogue numbers do
 * (`223Am`, `COL1A1`, `H3AuO3`). Readings people agree on are exempt:
 * alternating letter-digit codes (`H5N1`, `B1A4`, `mp3`), one letter-digit
 * pair (`F3F`), a bare size suffix (`3D`), and rupiah amounts, which
 * `indo-g2p` spells out.
 */
const CHEMICAL_WORD = /[A-Za-z][0-9]|[0-9][A-Za-z]/;
/** Short codes people read one way (`H5N1`, `mp3`, `B1A4`); longer mixes stay chemical. */
const CHEMICAL_SHORT_CODE = /^(?:[A-Za-z]+[0-9]+)+$/i;
const CHEMICAL_SHORT_LEN = 4;
const CHEMICAL_EXEMPT = /^[A-Za-z][0-9][A-Za-z]$|^[0-9]+[A-Za-z]$|^rp[0-9]/i;

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
  | "too-few-words"
  | "too-long"
  | "non-ascii"
  | "markup"
  | "parenthetical"
  | "url"
  | "no-letters"
  | "too-many-digits"
  | "too-many-capitals"
  | "foreign-words"
  | "foreign-spelling"
  | "foreign-names"
  | "latin-taxonomy"
  | "chemical-notation";

/** Foreign function words in a normalized sentence, e.g. Dutch `van` or English `the`. */
function foreignFunctionHits(text: string): number {
  let hits = 0;
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    if (word !== "" && FOREIGN_FUNCTION_WORDS.has(word)) hits += 1;
  }
  return hits;
}

/** Words whose spelling no native Indonesian word uses, e.g. Dutch `ij` or English `th`. */
function foreignSpellingHits(text: string): number {
  let hits = 0;
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    if (word === "" || QURANIC_WORD.test(word)) continue;
    if (FOREIGN_SPELLING.test(word)) hits += 1;
  }
  return hits;
}

/** Capitalized words past the first word of each sentence: names and titles. */
function midSentenceCapitals(text: string): number {
  let count = 0;
  for (const sentence of text.split(/[.!?]+/)) {
    const words = sentence.trim().split(/[^A-Za-z]+/).filter((word) => word !== "");
    for (const word of words.slice(1)) {
      const first = word.charAt(0);
      if (first >= "A" && first <= "Z") count += 1;
    }
  }
  return count;
}

/** True for species-list Latin no Indonesian reader pronounces with confidence. */
function hasTaxonomy(text: string): boolean {
  if (BINOMIAL.test(text)) return true;
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    if (word !== "" && TAXONOMIC_SUFFIX.test(word)) return true;
  }
  return false;
}

/** True for a formula or catalogue number nobody reads the same way twice. */
function hasChemicalNotation(text: string): boolean {
  for (const word of text.split(/[^A-Za-z0-9]+/)) {
    if (word === "" || !CHEMICAL_WORD.test(word)) continue;
    if (CHEMICAL_EXEMPT.test(word)) continue;
    if (word.length <= CHEMICAL_SHORT_LEN && CHEMICAL_SHORT_CODE.test(word)) continue;
    return true;
  }
  return false;
}

/** Returns why a normalized sentence cannot enter the pool, or `null` when it can. */
export function rejectReason(text: string): RejectReason | null {
  if (text.length < MIN_CHARS) return "too-short";
  if (text.length > MAX_CHARS) return "too-long";
  if (!PRINTABLE_ASCII.test(text)) return "non-ascii";
  if (MARKUP.test(text) || TEMPLATE_RESIDUE.test(text)) return "markup";
  if (text.includes("(") || text.includes(")")) return "parenthetical";
  if (URL_LIKE.test(text)) return "url";
  const letters = text.match(/[A-Za-z]/g) ?? [];
  if (letters.length < MIN_LETTERS) return "no-letters";
  const digits = text.match(/[0-9]/g) ?? [];
  if (digits.length / text.length > MAX_DIGIT_RATIO) return "too-many-digits";
  const capitals = text.match(/[A-Z]/g) ?? [];
  if (capitals.length / letters.length > MAX_CAPITAL_RATIO) return "too-many-capitals";
  if (text.split(" ").length < MIN_WORDS) return "too-few-words";
  if (hasTaxonomy(text)) return "latin-taxonomy";
  if (hasChemicalNotation(text)) return "chemical-notation";
  const functionHits = foreignFunctionHits(text);
  if (functionHits >= FOREIGN_FUNCTION_HITS) return "foreign-words";
  const spellingHits = foreignSpellingHits(text);
  if (spellingHits >= FOREIGN_SPELLING_HITS) return "foreign-spelling";
  if (midSentenceCapitals(text) >= NAME_HEAVY_CAPITALS && (functionHits >= 1 || spellingHits >= 1)) {
    return "foreign-names";
  }
  return null;
}

/** Case- and punctuation-insensitive identity of a sentence, for deduplication. */
export function dedupKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
