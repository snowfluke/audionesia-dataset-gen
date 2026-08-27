import { createMemo, createSignal, onCleanup } from "solid-js";

import { attempt, showToast } from "../../components/toast.tsx";
import { isClipped, peakDbfs } from "../../lib/audio/level.ts";
import type { Playback } from "../../lib/audio/playback.ts";
import { playSamples } from "../../lib/audio/playback.ts";
import { analyzeTake } from "../../lib/audio/trim-silence.ts";
import { encodeWav } from "../../lib/audio/wav-encode.ts";
import { listClipsBySpeaker, saveClip } from "../../lib/db/clip.repository.ts";
import { requestPersistentStorage } from "../../lib/db/database.ts";
import type { ScriptRow } from "../../lib/db/schema.ts";
import { listScripts } from "../../lib/db/script.repository.ts";
import { listSkippedScriptIds, skipScript } from "../../lib/db/skip.repository.ts";
import { estimateSeconds } from "../../lib/duration.ts";
import { registerShortcuts } from "../../lib/shortcuts.ts";
import { bumpClips, clipsVersion, scriptsVersion } from "../library/library.store.ts";
import { settings, updateSettings } from "../settings/settings.store.ts";
import { currentSpeakerId } from "../speakers/speakers.store.ts";
import { createCapture } from "./record.capture.ts";
import type { InputDevice, Level } from "./recorder.ts";

export type RecordPhase = "idle" | "arming" | "ready" | "recording" | "review" | "saving";

export type Take = {
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
  durationSec: number;
  peakDbfs: number;
  clipped: boolean;
  snrDb: number | null;
};

export type RecordStore = {
  queue: () => ScriptRow[];
  current: () => ScriptRow | undefined;
  estimate: (script: ScriptRow) => number;
  phase: () => RecordPhase;
  level: () => Level;
  devices: () => InputDevice[];
  take: () => Take | null;
  batchDone: () => number;
  /** Why the current take cannot be saved, or null. */
  saveBlocker: () => string | null;
  arm: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  start: () => void;
  stop: () => void;
  save: () => Promise<void>;
  retake: () => void;
  skip: () => Promise<void>;
  play: () => Promise<void>;
  toggle: () => void;
};

/** Call inside the Rekam view; the microphone and shortcuts live as long as the view. */
export function createRecordStore(): RecordStore {
  const [refresh, setRefresh] = createSignal(0);
  const [busy, setBusy] = createSignal<"review" | "saving" | null>(null);
  const [take, setTake] = createSignal<Take | null>(null);
  const [batchDone, setBatchDone] = createSignal(0);
  let playback: Playback | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  const capture = createCapture((reason) => {
    if (stopTimer !== null) clearTimeout(stopTimer);
    setTake(null);
    setBusy(null);
    showToast(`${reason}. Nyalakan mikrofon lagi untuk melanjutkan.`, "error");
  });

  const queue = createMemo(async (): Promise<ScriptRow[]> => {
    refresh();
    scriptsVersion();
    clipsVersion();
    const speakerId = currentSpeakerId();
    if (speakerId === null) return [];
    const [scripts, clips, skipped] = await Promise.all([
      listScripts(),
      listClipsBySpeaker(speakerId),
      listSkippedScriptIds(speakerId),
    ]);
    const done = new Set(
      clips.filter((clip) => clip.status !== "rejected").map((clip) => clip.scriptId)
    );
    return scripts.filter((script) => !done.has(script.id) && !skipped.has(script.id));
  });

  const current = (): ScriptRow | undefined => queue()[0];
  const estimate = (script: ScriptRow): number =>
    estimateSeconds(script.syllables, settings().syllablesPerSecond);
  const phase = (): RecordPhase => busy() ?? capture.phase();

  const saveBlocker = (): string | null => {
    const taken = take();
    if (taken === null) return null;
    if (taken.samples.length === 0) return "Tidak ada suara yang terekam";
    if (taken.clipped && settings().rejectClipped)
      return "Rekaman terpotong (clipping); turunkan level dan rekam ulang";
    return null;
  };

  async function arm(): Promise<void> {
    await capture.arm(settings().inputDeviceId);
    await requestPersistentStorage();
  }

  async function selectDevice(deviceId: string): Promise<void> {
    await updateSettings({ inputDeviceId: deviceId });
    if (capture.phase() !== "idle") await capture.arm(deviceId);
  }

  function stop(): void {
    if (stopTimer !== null) clearTimeout(stopTimer);
    stopTimer = null;
    const raw = capture.stop();
    if (raw === null) return;
    const current = settings();
    const analysis = analyzeTake(raw.samples, {
      sampleRate: raw.sampleRate,
      thresholdDbfs: current.silenceThresholdDbfs,
      paddingMs: current.silencePaddingMs,
    });
    setTake({
      samples: analysis.samples,
      sampleRate: raw.sampleRate,
      durationSec: analysis.samples.length / raw.sampleRate,
      peakDbfs: peakDbfs(analysis.samples),
      clipped: isClipped(analysis.samples),
      snrDb: analysis.snrDb,
    });
    setBusy("review");
    if (analysis.snrDb !== null && analysis.snrDb < current.minSnrDb) {
      showToast(
        `Rasio sinyal terhadap derau hanya ${analysis.snrDb.toFixed(0)} dB; cari ruangan yang lebih sunyi.`,
        "info"
      );
    }
  }

  function start(): void {
    if (phase() !== "ready") return;
    playback?.stop();
    if (!capture.start()) return;
    stopTimer = setTimeout(() => {
      stop();
      showToast(`Rekaman dihentikan otomatis setelah ${settings().maxTakeSec} detik`, "info");
    }, settings().maxTakeSec * 1000);
  }

  async function save(): Promise<void> {
    const script = current();
    const taken = take();
    const speakerId = currentSpeakerId();
    if (script === undefined || taken === null || speakerId === null || phase() !== "review")
      return;
    const blocker = saveBlocker();
    if (blocker !== null) throw new Error(blocker);
    setBusy("saving");
    const wav = new Blob([encodeWav(taken.samples, taken.sampleRate)], { type: "audio/wav" });
    const clip = {
      id: crypto.randomUUID(),
      speakerId,
      scriptId: script.id,
      status: "pending" as const,
      text: script.text,
      phonemes: script.phonemes,
      g2pVersion: script.g2pVersion,
      sampleRate: taken.sampleRate,
      durationSec: taken.durationSec,
      peakDbfs: taken.peakDbfs,
      clipped: taken.clipped,
      recordedAt: new Date().toISOString(),
    };
    await saveClip(taken.snrDb === null ? clip : { ...clip, snrDb: taken.snrDb }, wav);
    setTake(null);
    const size = settings().batchSize;
    const done = batchDone() + 1;
    setBatchDone(done % size);
    bumpClips();
    setRefresh((n) => n + 1);
    setBusy(null);
    showToast(done === size ? `Batch ${size} klip selesai` : "Klip tersimpan", "success");
  }

  function retake(): void {
    if (phase() !== "review") return;
    playback?.stop();
    setTake(null);
    setBusy(null);
  }

  async function skip(): Promise<void> {
    const script = current();
    const speakerId = currentSpeakerId();
    if (script === undefined || speakerId === null) return;
    await skipScript(speakerId, script.id);
    setRefresh((n) => n + 1);
  }

  async function play(): Promise<void> {
    const taken = take();
    if (taken === null) return;
    playback?.stop();
    playback = await playSamples(taken.samples, taken.sampleRate);
  }

  function toggle(): void {
    if (phase() === "recording") stop();
    else if (phase() === "ready") start();
    else if (phase() === "idle") void attempt(arm);
  }

  // oxlint-disable solid/reactivity -- keydown handlers run outside Solid tracking on purpose
  const unregister = registerShortcuts(
    new Map([
      [" ", toggle],
      ["Enter", () => void attempt(save)],
      ["r", retake],
      ["s", () => void attempt(skip)],
      ["p", () => void attempt(play)],
    ])
  );
  // oxlint-enable solid/reactivity
  onCleanup(() => {
    unregister();
    if (stopTimer !== null) clearTimeout(stopTimer);
    playback?.stop();
    void attempt(capture.close);
  });

  return {
    queue,
    current,
    estimate,
    phase,
    level: capture.level,
    devices: capture.devices,
    take,
    batchDone,
    saveBlocker,
    arm,
    selectDevice,
    start,
    stop,
    save,
    retake,
    skip,
    play,
    toggle,
  };
}
