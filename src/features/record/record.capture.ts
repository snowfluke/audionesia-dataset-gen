import { createSignal } from "solid-js";

import type { InputDevice, Level, Recorder, Recording } from "./recorder.ts";
import { createRecorder, listInputDevices } from "./recorder.ts";

export type CapturePhase = "idle" | "arming" | "ready" | "recording";

export type Capture = {
  phase: () => CapturePhase;
  level: () => Level;
  devices: () => InputDevice[];
  /** Label of the open microphone, or null while it is closed. */
  openDeviceLabel: () => string | null;
  refreshDevices: () => Promise<void>;
  /** Opens the microphone; `deviceId` "" means the system default. */
  arm: (deviceId: string) => Promise<void>;
  start: () => boolean;
  stop: () => Recording | null;
  close: () => Promise<void>;
};

/** Owns the microphone for the Rekam tab. Call `close` from `onCleanup`. */
export function createCapture(onLost: (reason: string) => void): Capture {
  const [phase, setPhase] = createSignal<CapturePhase>("idle");
  const [level, setLevel] = createSignal<Level>({ rms: 0, peak: 0 });
  const [devices, setDevices] = createSignal<InputDevice[]>([]);
  const [openDeviceLabel, setOpenDeviceLabel] = createSignal<string | null>(null);
  let recorder: Recorder | null = null;

  async function refreshDevices(): Promise<void> {
    try {
      setDevices(await listInputDevices());
    } catch {
      setDevices([]);
    }
  }

  async function close(): Promise<void> {
    const current = recorder;
    recorder = null;
    setPhase("idle");
    setLevel({ rms: 0, peak: 0 });
    setOpenDeviceLabel(null);
    if (current !== null) await current.close();
  }

  async function arm(deviceId: string): Promise<void> {
    if (recorder !== null) await close();
    setPhase("arming");
    try {
      recorder = await createRecorder(deviceId, {
        onLevel: setLevel,
        onLost: (reason) => {
          void close();
          onLost(reason);
        },
        onDevicesChange: () => void refreshDevices(),
      });
      setOpenDeviceLabel(recorder.deviceLabel);
      setPhase("ready");
      await refreshDevices();
    } catch (cause: unknown) {
      setPhase("idle");
      throw cause instanceof Error ? cause : new Error("Mikrofon tidak dapat dibuka");
    }
  }

  function start(): boolean {
    if (recorder === null || phase() !== "ready") return false;
    recorder.start();
    setPhase("recording");
    return true;
  }

  function stop(): Recording | null {
    if (recorder === null || phase() !== "recording") return null;
    const recording = recorder.stop();
    setPhase("ready");
    return recording;
  }

  return { phase, level, devices, openDeviceLabel, refreshDevices, arm, start, stop, close };
}
