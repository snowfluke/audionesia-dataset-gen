import { z } from "zod";

import { DEFAULT_SYLLABLES_PER_SECOND } from "./duration.ts";

export const EXPORT_SAMPLE_RATES = [16000, 22050, 24000, 44100, 48000] as const;

/**
 * Target clip windows per trainer. StyleTTS2 crops training audio to
 * `max_len` frames (5 s by default, 10 s in practice) and rejects phoneme
 * strings over 512 tokens; PocketTTS accepts up to 30 s per file.
 */
export const TRAINER_PRESETS = {
  "pocket-tts": { label: "PocketTTS (10-30 s)", minSec: 10, maxSec: 30 },
  styletts2: { label: "StyleTTS2 (5-15 s)", minSec: 5, maxSec: 15 },
} as const;
export type TrainerPreset = keyof typeof TRAINER_PRESETS;
export const TRAINER_PRESET_IDS: readonly TrainerPreset[] = ["pocket-tts", "styletts2"];

export const appSettingsSchema = z.object({
  syllablesPerSecond: z.number().positive().default(DEFAULT_SYLLABLES_PER_SECOND),
  targetMinSec: z.number().positive().default(TRAINER_PRESETS["pocket-tts"].minSec),
  targetMaxSec: z.number().positive().default(TRAINER_PRESETS["pocket-tts"].maxSec),
  silenceThresholdDbfs: z.number().max(0).default(-45),
  silencePaddingMs: z.number().nonnegative().default(150),
  exportSampleRate: z.literal(EXPORT_SAMPLE_RATES).default(24000),
  batchSize: z.number().int().positive().max(20).default(5),
  showPhonemes: z.boolean().default(true),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = appSettingsSchema.parse({});
