import { z } from "zod";

import { ASR_MODELS } from "./asr/messages.ts";
import { DEFAULT_SYLLABLES_PER_SECOND } from "./duration.ts";

export const EXPORT_SAMPLE_RATES = [16000, 22050, 24000, 44100, 48000] as const;

/**
 * Target clip windows per trainer. StyleTTS2 crops training audio to
 * `max_len` frames (5 s by default, 10 s in practice) and rejects phoneme
 * strings over 512 tokens; PocketTTS accepts up to 30 s per file.
 */
export const TRAINER_PRESETS = {
  styletts2: { label: "StyleTTS2 (5-15 s)", minSec: 5, maxSec: 15, targetHours: 5 },
  "pocket-tts": { label: "PocketTTS (10-30 s)", minSec: 10, maxSec: 30, targetHours: 100 },
} as const;
export type TrainerPreset = keyof typeof TRAINER_PRESETS;
export const TRAINER_PRESET_IDS: readonly TrainerPreset[] = ["styletts2", "pocket-tts"];
export const DEFAULT_TRAINER_PRESET: TrainerPreset = "styletts2";

export const LICENSE_MODES = ["all", "cc0"] as const;
export type LicenseMode = (typeof LICENSE_MODES)[number];

export const appSettingsSchema = z
  .object({
    syllablesPerSecond: z.number().positive().default(DEFAULT_SYLLABLES_PER_SECOND),
    targetMinSec: z.number().positive().default(TRAINER_PRESETS[DEFAULT_TRAINER_PRESET].minSec),
    targetMaxSec: z.number().positive().default(TRAINER_PRESETS[DEFAULT_TRAINER_PRESET].maxSec),
    /** Recording hours the current effort aims for; drives the progress meter. */
    targetHours: z.number().positive().default(TRAINER_PRESETS[DEFAULT_TRAINER_PRESET].targetHours),
    silenceThresholdDbfs: z.number().max(0).default(-45),
    silencePaddingMs: z.number().nonnegative().default(150),
    exportSampleRate: z.literal(EXPORT_SAMPLE_RATES).default(24000),
    batchSize: z.number().int().positive().max(20).default(5),
    showPhonemes: z.boolean().default(true),
    /** `""` means the system default microphone. */
    inputDeviceId: z.string().default(""),
    /** A take stops itself after this many seconds. */
    maxTakeSec: z.number().positive().default(90),
    /** Clips shorter than this are not exported. */
    minClipSec: z.number().positive().default(1.5),
    /** Takes below this signal-to-noise ratio get a warning. */
    minSnrDb: z.number().default(20),
    /** A clipped take cannot be saved; it must be recorded again. */
    rejectClipped: z.boolean().default(true),
    /** Peak level of exported audio; `null` exports the master level. */
    normalizePeakDbfs: z.number().max(0).nullable().default(-3),
    /** `cc0` exports only clips whose text is public domain. */
    licenseMode: z.enum(LICENSE_MODES).default("all"),
    /** Whisper model used by the ASR check; larger is slower and more accurate. */
    asrModel: z.enum(ASR_MODELS).default("onnx-community/whisper-base"),
    /** Clips whose ASR transcript differs from the script by more than this share get flagged. */
    asrCerWarn: z.number().min(0).max(1).default(0.2),
  })
  .refine((settings) => settings.targetMinSec < settings.targetMaxSec, {
    message: "Durasi minimum harus lebih kecil dari durasi maksimum",
    path: ["targetMaxSec"],
  });
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = appSettingsSchema.parse({});

/** The preset whose window matches these settings, or null for a custom window. */
export function matchingPreset(settings: AppSettings): TrainerPreset | null {
  return (
    TRAINER_PRESET_IDS.find(
      (id) =>
        TRAINER_PRESETS[id].minSec === settings.targetMinSec &&
        TRAINER_PRESETS[id].maxSec === settings.targetMaxSec
    ) ?? null
  );
}

/** Sources whose text is public domain or generated, safe for a CC0-only dataset. */
export const CC0_SOURCES: ReadonlySet<string> = new Set(["common-voice", "llm"]);
