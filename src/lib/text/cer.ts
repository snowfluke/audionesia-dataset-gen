/** Lowercase, punctuation removed, whitespace collapsed: what a transcript comparison should see. */
export function normalizeForCer(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Edit distance between two strings, character by character. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = new Uint32Array(b.length + 1);
  let current = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length] ?? 0;
}

/** Character error rate of `hypothesis` against `reference`, 0 (identical) to 1 or more. */
export function characterErrorRate(reference: string, hypothesis: string): number {
  const target = normalizeForCer(reference);
  const guess = normalizeForCer(hypothesis);
  if (target.length === 0) return guess.length === 0 ? 0 : 1;
  return levenshtein(target, guess) / target.length;
}
