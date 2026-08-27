// oxlint-disable-next-line import/default -- Vite builds the worklet from this query import
import workletUrl from "../../workers/recorder.worklet.ts?worker&url";
import { peakAmplitude, rms } from "../../lib/audio/level.ts";

const RECORDER_PROCESSOR_NAME = "audionesia-recorder";

export type Level = { rms: number; peak: number };
export type Recording = { samples: Float32Array<ArrayBuffer>; sampleRate: number };
export type InputDevice = { deviceId: string; label: string };

export type RecorderEvents = {
  /** Fires for every audio block, recording or not, so the meter works before the first take. */
  onLevel: (level: Level) => void;
  /** The microphone went away or the browser paused audio; the take should stop. */
  onLost: (reason: string) => void;
};

export type Recorder = {
  /** The device rate; the master WAV is stored at this rate. */
  sampleRate: number;
  start(): void;
  stop(): Recording;
  close(): Promise<void>;
};

/** Microphones the browser exposes. Labels are empty until a microphone permission was granted. */
export async function listInputDevices(): Promise<InputDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label === "" ? `Mikrofon ${index + 1}` : device.label,
    }));
}

function constraintsFor(deviceId: string): MediaTrackConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  };
  if (deviceId !== "") audio.deviceId = { exact: deviceId };
  return audio;
}

/**
 * Opens the microphone with every browser effect off and streams raw PCM
 * blocks from an AudioWorklet. If anything after `getUserMedia` fails, the
 * stream and context are released before the error is rethrown.
 */
export async function createRecorder(deviceId: string, events: RecorderEvents): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: constraintsFor(deviceId) });
  const context = new AudioContext();
  let node: AudioWorkletNode;
  let source: MediaStreamAudioSourceNode;
  try {
    await context.audioWorklet.addModule(workletUrl);
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, RECORDER_PROCESSOR_NAME);
    source.connect(node);
  } catch (cause: unknown) {
    for (const track of stream.getTracks()) track.stop();
    await context.close();
    throw cause instanceof Error ? cause : new Error("Perekam gagal dimulai");
  }

  let recording = false;
  let blocks: Float32Array<ArrayBuffer>[] = [];
  node.port.onmessage = (event: MessageEvent<Float32Array<ArrayBuffer>>) => {
    const block = event.data;
    events.onLevel({ rms: rms(block, 0, block.length), peak: peakAmplitude(block) });
    if (recording) blocks.push(block);
  };
  for (const track of stream.getAudioTracks()) {
    track.onended = () => events.onLost("Mikrofon terputus");
  }
  const resumeOrLose = async (): Promise<void> => {
    try {
      await context.resume();
    } catch {
      events.onLost("Audio dijeda oleh peramban");
    }
  };
  context.onstatechange = () => {
    if (context.state === "suspended") void resumeOrLose();
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
      context.onstatechange = null;
      source.disconnect();
      node.disconnect();
      for (const track of stream.getTracks()) track.stop();
      await context.close();
    },
  };
}
