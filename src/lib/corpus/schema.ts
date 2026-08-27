import { z } from "zod";

export const CORPUS_SOURCES = ["common-voice", "tatoeba", "wikipedia", "news", "llm", "user"] as const;

export const corpusSourceSchema = z.enum(CORPUS_SOURCES);
export type CorpusSource = z.infer<typeof corpusSourceSchema>;

/** One line of `corpus/raw/<source>.jsonl`, as a fetch script writes it. */
export const rawSentenceSchema = z.object({
  text: z.string().min(1),
  source: corpusSourceSchema,
  license: z.string().min(1),
  attribution: z.string().min(1).optional(),
});
export type RawSentence = z.infer<typeof rawSentenceSchema>;

/**
 * One line of `public/corpus/pool.jsonl`. `units` are indices into the
 * `units` table of `index.json`; the script builder covers them.
 */
export const poolSentenceSchema = rawSentenceSchema.extend({
  id: z.string().min(1),
  phonemes: z.string().min(1),
  syllables: z.number().int().nonnegative(),
  units: z.array(z.number().int().nonnegative()),
  g2pVersion: z.string().min(1),
});
export type PoolSentence = z.infer<typeof poolSentenceSchema>;

export const poolSourceSummarySchema = z.object({
  source: corpusSourceSchema,
  license: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const poolIndexSchema = z.object({
  g2pVersion: z.string().min(1),
  count: z.number().int().nonnegative(),
  units: z.array(z.string().min(1)),
  sources: z.array(poolSourceSummarySchema),
});
export type PoolIndex = z.infer<typeof poolIndexSchema>;
