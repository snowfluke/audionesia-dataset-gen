import type { CorpusSource, PoolSentence } from "../corpus/schema.ts";
import type { AppSettings } from "../settings.ts";

export const DB_NAME = "audionesia";
export const DB_VERSION = 1;

export const CLIP_STATUSES = ["pending", "approved", "rejected"] as const;
export type ClipStatus = (typeof CLIP_STATUSES)[number];

export const SPEAKER_GENDERS = ["female", "male", "other"] as const;
export type SpeakerGender = (typeof SPEAKER_GENDERS)[number];

export const AGE_RANGES = ["under-18", "18-29", "30-44", "45-59", "60-plus"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export type Speaker = {
  /** Slug of the name; also the folder name under `dataset/audio/`. */
  id: string;
  name: string;
  gender?: SpeakerGender;
  ageRange?: AgeRange;
  /** Regional accent or dialect, free text (e.g. "Jawa Tengah"). */
  dialect?: string;
  /** Microphone model, free text. */
  microphone?: string;
  /** When the speaker agreed to the dataset use of their voice. */
  consentAt?: string;
  notes?: string;
  /** Next `clip_XXXX` sequence number for this speaker. */
  nextSeq: number;
  createdAt: string;
};

/** A 10 to 30 s reading unit built from pool sentences. */
export type ScriptRow = {
  id: string;
  sentenceIds: string[];
  text: string;
  phonemes: string;
  syllables: number;
  estSeconds: number;
  g2pVersion: string;
  /** Reading order; scripts with the most coverage gain come first. */
  order: number;
  createdAt: string;
};

export type Clip = {
  id: string;
  speakerId: string;
  scriptId: string;
  seq: number;
  status: ClipStatus;
  /** Text and phonemes frozen at record time, so a later pool rebuild cannot change them. */
  text: string;
  phonemes: string;
  g2pVersion: string;
  /** The capture device rate the master WAV is stored at. */
  sampleRate: number;
  /** Measured from the trimmed PCM. */
  durationSec: number;
  peakDbfs: number;
  clipped: boolean;
  /** Speech RMS over the noise floor of the leading silence; absent when no silence was captured. */
  snrDb?: number;
  /** Character error rate between the script and an ASR transcript, 0 to 1. */
  asrCer?: number;
  asrText?: string;
  recordedAt: string;
  reviewedAt?: string;
};

export type AudioRow = { clipId: string; blob: Blob };

export type SkipRow = { speakerId: string; scriptId: string; skippedAt: string };

/** What the last successful seed loaded, so a changed pool is detected. */
export type LibraryMeta = { poolCount: number; g2pVersion: string; seededAt: string };

export type SettingsRow =
  | { key: "app"; value: AppSettings }
  | { key: "library"; value: LibraryMeta };

/** A coverage unit label and its id; ids match `units` arrays on sentences. */
export type UnitRow = { id: number; label: string };

/** Every store, key, and index of the database. Bump `DB_VERSION` when this changes. */
export type AudionesiaDb = {
  speakers: { key: string; value: Speaker };
  sentences: { key: string; value: PoolSentence; indexes: { "by-source": CorpusSource } };
  scripts: { key: string; value: ScriptRow; indexes: { "by-order": number } };
  clips: {
    key: string;
    value: Clip;
    indexes: {
      "by-speaker": string;
      "by-status": ClipStatus;
      "by-speaker-status": [string, ClipStatus];
      "by-script": string;
    };
  };
  audio: { key: string; value: AudioRow };
  skips: { key: [string, string]; value: SkipRow };
  settings: { key: string; value: SettingsRow };
  units: { key: number; value: UnitRow };
};
