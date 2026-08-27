export type PhonemizeRequest = { texts: string[] };

export type Phonemized = {
  text: string;
  phonemes: string;
  syllables: number;
  /** Coverage unit labels, see `lib/corpus/coverage.ts`. */
  labels: string[];
};

export type PhonemizeResponse = { g2pVersion: string; results: Phonemized[] };
