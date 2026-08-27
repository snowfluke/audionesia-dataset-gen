import { resample } from "../audio/resample.ts";
import { decodeWav } from "../audio/wav-encode.ts";
import { getClipAudio, updateClip } from "../db/clip.repository.ts";
import type { Clip } from "../db/schema.ts";
import { characterErrorRate } from "../text/cer.ts";
import { loadAsrModel, transcribe } from "./client.ts";
import type { AsrModel } from "./messages.ts";
import { ASR_SAMPLE_RATE } from "./messages.ts";

export type AsrCheck = { text: string; cer: number };

/**
 * Transcribes a clip's master audio and stores the transcript with its
 * character error rate against the script, so misreads surface in review.
 */
export async function checkClipWithAsr(
  clip: Clip,
  model: AsrModel,
  onProgress?: (file: string, percent: number) => void
): Promise<AsrCheck> {
  await loadAsrModel(model, onProgress);
  const blob = await getClipAudio(clip.id);
  if (blob === undefined) throw new Error("Audio klip tidak ditemukan");
  const master = decodeWav(new Uint8Array(await blob.arrayBuffer()));
  const samples = await resample(master.samples, master.sampleRate, ASR_SAMPLE_RATE);
  const text = await transcribe(new Float32Array(samples));
  const cer = characterErrorRate(clip.text, text);
  await updateClip(clip.id, { asrText: text, asrCer: cer });
  return { text, cer };
}
