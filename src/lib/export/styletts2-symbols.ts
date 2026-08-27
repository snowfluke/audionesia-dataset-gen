// The symbol table of StyleTTS2's text_utils.py (178 symbols). Characters
// outside it are silently dropped by the trainer, so lines are mapped and
// checked here before they are written.
const PAD = "$";
const PUNCTUATION = ';:,.!?¡¿—…"«»“” ';
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LETTERS_IPA =
  "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";

export const STYLETTS2_SYMBOLS: ReadonlySet<string> = new Set([
  PAD,
  ...PUNCTUATION,
  ...LETTERS,
  ...LETTERS_IPA,
]);

/** The longest phoneme line StyleTTS2 accepts before its 512-token text limit bites. */
export const STYLETTS2_MAX_PHONEME_CHARS = 500;

/**
 * Rewrites an indo-g2p phoneme string for StyleTTS2: hyphens become spaces,
 * apostrophes and parentheses are removed, and the accented `é` of spelled-out
 * abbreviations becomes `e`.
 */
export function mapForStyleTts2(phonemes: string): string {
  return phonemes
    .replace(/-/g, " ")
    .replace(/['()]/g, "")
    .replace(/é/g, "e")
    .replace(/\s+/g, " ")
    .trim();
}

/** Characters of a (mapped) phoneme string that StyleTTS2 would drop. */
export function unknownStyleTts2Symbols(phonemes: string): string[] {
  const unknown = new Set<string>();
  for (const char of phonemes) if (!STYLETTS2_SYMBOLS.has(char)) unknown.add(char);
  return [...unknown];
}
