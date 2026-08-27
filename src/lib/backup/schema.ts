import { z } from "zod";

import { poolSentenceSchema } from "../corpus/schema.ts";
import type { Clip, SkipRow, Speaker, Workspace } from "../db/schema.ts";
import { AGE_RANGES, CLIP_STATUSES, SPEAKER_GENDERS } from "../db/schema.ts";

export const BACKUP_VERSION = 2;

export const backupManifestSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  clips: z.number().int().nonnegative(),
});

export const speakerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(SPEAKER_GENDERS).optional(),
  ageRange: z.enum(AGE_RANGES).optional(),
  dialect: z.string().optional(),
  microphone: z.string().optional(),
  consentAt: z.string().optional(),
  notes: z.string().optional(),
});

export const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  speaker: speakerSchema,
  targetHours: z.number().positive(),
  nextSeq: z.number().int().positive(),
  createdAt: z.string(),
});

export const clipSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  speakerId: z.string().min(1),
  scriptId: z.string().min(1),
  seq: z.number().int().positive(),
  status: z.enum(CLIP_STATUSES),
  text: z.string(),
  phonemes: z.string(),
  g2pVersion: z.string(),
  sampleRate: z.number().positive(),
  durationSec: z.number().nonnegative(),
  peakDbfs: z.number(),
  clipped: z.boolean(),
  snrDb: z.number().optional(),
  asrCer: z.number().optional(),
  asrText: z.string().optional(),
  recordedAt: z.string(),
  reviewedAt: z.string().optional(),
});

export const skipSchema = z.object({
  workspaceId: z.string().min(1),
  scriptId: z.string().min(1),
  skippedAt: z.string(),
});

export const workspacesFileSchema = z.array(workspaceSchema);
export const clipsFileSchema = z.array(clipSchema);
export const skipsFileSchema = z.array(skipSchema);
export const sentencesFileSchema = z.array(poolSentenceSchema);

/** Builds a `Speaker` without the undefined keys Zod's optional fields carry. */
function toSpeaker(parsed: z.infer<typeof speakerSchema>): Speaker {
  const speaker: Speaker = { id: parsed.id, name: parsed.name };
  if (parsed.gender !== undefined) speaker.gender = parsed.gender;
  if (parsed.ageRange !== undefined) speaker.ageRange = parsed.ageRange;
  if (parsed.dialect !== undefined) speaker.dialect = parsed.dialect;
  if (parsed.microphone !== undefined) speaker.microphone = parsed.microphone;
  if (parsed.consentAt !== undefined) speaker.consentAt = parsed.consentAt;
  if (parsed.notes !== undefined) speaker.notes = parsed.notes;
  return speaker;
}

export function toWorkspace(parsed: z.infer<typeof workspaceSchema>): Workspace {
  return {
    id: parsed.id,
    name: parsed.name,
    speaker: toSpeaker(parsed.speaker),
    targetHours: parsed.targetHours,
    nextSeq: parsed.nextSeq,
    createdAt: parsed.createdAt,
  };
}

export function toClip(parsed: z.infer<typeof clipSchema>): Clip {
  const clip: Clip = {
    id: parsed.id,
    workspaceId: parsed.workspaceId,
    speakerId: parsed.speakerId,
    scriptId: parsed.scriptId,
    seq: parsed.seq,
    status: parsed.status,
    text: parsed.text,
    phonemes: parsed.phonemes,
    g2pVersion: parsed.g2pVersion,
    sampleRate: parsed.sampleRate,
    durationSec: parsed.durationSec,
    peakDbfs: parsed.peakDbfs,
    clipped: parsed.clipped,
    recordedAt: parsed.recordedAt,
  };
  if (parsed.snrDb !== undefined) clip.snrDb = parsed.snrDb;
  if (parsed.asrCer !== undefined) clip.asrCer = parsed.asrCer;
  if (parsed.asrText !== undefined) clip.asrText = parsed.asrText;
  if (parsed.reviewedAt !== undefined) clip.reviewedAt = parsed.reviewedAt;
  return clip;
}

export function toSkip(parsed: z.infer<typeof skipSchema>): SkipRow {
  return {
    workspaceId: parsed.workspaceId,
    scriptId: parsed.scriptId,
    skippedAt: parsed.skippedAt,
  };
}
