import { decodeWav } from "./wav-encode.ts";

/** One playback of a buffer that can be paused and resumed at the same position. */
export type Playback = {
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  /** True while audio is audible; false when paused, stopped, or finished. */
  playing: () => boolean;
  /** Resolves when the buffer ends or `stop()` is called, never on pause. */
  finished: Promise<void>;
};

let shared: AudioContext | null = null;

function context(): AudioContext {
  shared ??= new AudioContext();
  return shared;
}

/** Plays a master WAV blob written by this app. */
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

  let source: AudioBufferSourceNode | null = null;
  let offset = 0;
  let startedAt = 0;
  let done = false;
  let finish: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
  });

  function start(): void {
    source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    const own = source;
    own.onended = () => {
      if (source === own) {
        source = null;
        finish();
      }
    };
    startedAt = audio.currentTime;
    own.start(0, offset);
  }

  function halt(): void {
    if (source === null) return;
    const own = source;
    source = null;
    own.onended = null;
    own.stop();
  }

  start();
  return {
    pause() {
      if (source === null) return;
      offset += audio.currentTime - startedAt;
      halt();
    },
    async resume() {
      if (done || source !== null) return;
      if (audio.state === "suspended") await audio.resume();
      start();
    },
    stop() {
      halt();
      finish();
    },
    playing: () => source !== null,
    finished,
  };
}
