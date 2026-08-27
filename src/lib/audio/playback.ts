import { decodeWav } from "./wav-encode.ts";

export type Playback = { stop: () => void; finished: Promise<void> };

let shared: AudioContext | null = null;

function context(): AudioContext {
  shared ??= new AudioContext();
  return shared;
}

/** Plays a master WAV blob written by this app. Resolves when playback ends or is stopped. */
export async function playWav(blob: Blob): Promise<Playback> {
  const decoded = decodeWav(new Uint8Array(await blob.arrayBuffer()));
  return playSamples(decoded.samples, decoded.sampleRate);
}

/** Plays raw mono samples, for a take that is not saved yet. */
export async function playSamples(
  samples: Float32Array<ArrayBuffer>,
  sampleRate: number
): Promise<Playback> {
  const audio = context();
  if (audio.state === "suspended") await audio.resume();
  const buffer = audio.createBuffer(1, Math.max(1, samples.length), sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(audio.destination);
  const finished = new Promise<void>((resolve) => {
    source.onended = () => resolve();
  });
  source.start();
  return { stop: () => source.stop(), finished };
}
