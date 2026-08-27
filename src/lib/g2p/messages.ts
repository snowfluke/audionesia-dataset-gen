export type PhonemizeRequest = { texts: string[] };

export type Phonemized = {
  text: string;
  phonemes: string;
  syllables: number;
  /** Coverage unit labels, see `lib/corpus/coverage.ts`. */
  labels: string[];
  /** Share of words read as English, 0 to 1. */
  englishShare: number;
};

export type PhonemizeResponse = { g2pVersion: string; results: Phonemized[] };
