// oxlint-disable-next-line import/default -- Vite builds the worklet from this query import
import workletUrl from "../../workers/recorder.worklet.ts?worker&url";
import { peakAmplitude, rms } from "../../lib/audio/level.ts";

const RECORDER_PROCESSOR_NAME = "audionesia-recorder";

export type Level = { rms: number; peak: number };
export type Recording = { samples: Float32Array<ArrayBuffer>; sampleRate: number };

export type Recorder = {
  /** The device rate; the master WAV is stored at this rate. */
  sampleRate: number;
  start(): void;
  stop(): Recording;
  close(): Promise<void>;
};

/**
 * Opens the microphone with every browser effect off and streams raw PCM
 * blocks from an AudioWorklet. `onLevel` fires for every block, recording or
 * not, so the meter works before the first take.
 */
export async function createRecorder(onLevel: (level: Level) => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
  });
  const context = new AudioContext();
  await context.audioWorklet.addModule(workletUrl);
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, RECORDER_PROCESSOR_NAME);
  source.connect(node);

  let recording = false;
  let blocks: Float32Array<ArrayBuffer>[] = [];
  node.port.onmessage = (event: MessageEvent<Float32Array<ArrayBuffer>>) => {
    const block = event.data;
    onLevel({ rms: rms(block, 0, block.length), peak: peakAmplitude(block) });
    if (recording) blocks.push(block);
  };

  return {
    sampleRate: context.sampleRate,
    start() {
      blocks = [];
      recording = true;
    },
    stop() {
      recording = false;
      const length = blocks.reduce((sum, block) => sum + block.length, 0);
      const samples = new Float32Array(length);
      let offset = 0;
      for (const block of blocks) {
        samples.set(block, offset);
        offset += block.length;
      }
      blocks = [];
      return { samples, sampleRate: context.sampleRate };
    },
    async close() {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      for (const track of stream.getTracks()) track.stop();
      await context.close();
    },
  };
}
