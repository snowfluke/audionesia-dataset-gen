import { createMemo, createSignal, onCleanup } from "solid-js";

import { attempt, showToast } from "../../components/toast.tsx";
import { isClipped, peakDbfs } from "../../lib/audio/level.ts";
import type { Playback } from "../../lib/audio/playback.ts";
import { playSamples } from "../../lib/audio/playback.ts";
import { trimSilence } from "../../lib/audio/trim-silence.ts";
import { encodeWav } from "../../lib/audio/wav-encode.ts";
import { saveClip, listClipsBySpeaker } from "../../lib/db/clip.repository.ts";
import { requestPersistentStorage } from "../../lib/db/database.ts";
import type { ScriptRow } from "../../lib/db/schema.ts";
import { listScripts } from "../../lib/db/script.repository.ts";
import { listSkippedScriptIds, skipScript } from "../../lib/db/skip.repository.ts";
import { estimateSeconds } from "../../lib/duration.ts";
import { registerShortcuts } from "../../lib/shortcuts.ts";
import { bumpClips, clipsVersion, scriptsVersion } from "../library/library.store.ts";
import { settings } from "../settings/settings.store.ts";
import { currentSpeakerId } from "../speakers/speakers.store.ts";
import type { Level, Recorder } from "./recorder.ts";
import { createRecorder } from "./recorder.ts";

export type RecordPhase = "idle" | "arming" | "ready" | "recording" | "review" | "saving";

export type Take = {
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
  durationSec: number;
  peakDbfs: number;
  clipped: boolean;
};

export type RecordStore = {
  queue: () => ScriptRow[];
  current: () => ScriptRow | undefined;
  estimate: (script: ScriptRow) => number;
  phase: () => RecordPhase;
  level: () => Level;
  take: () => Take | null;
  batchDone: () => number;
  arm: () => Promise<void>;
  start: () => void;
  stop: () => void;
  save: () => Promise<void>;
  retake: () => void;
  skip: () => Promise<void>;
  play: () => Promise<void>;
  toggle: () => void;
};

/** Call inside the Rekam view; the recorder and shortcuts live as long as the view. */
export function createRecordStore(): RecordStore {
  const [refresh, setRefresh] = createSignal(0);
  const [phase, setPhase] = createSignal<RecordPhase>("idle");
  const [level, setLevel] = createSignal<Level>({ rms: 0, peak: 0 });
  const [take, setTake] = createSignal<Take | null>(null);
  const [batchDone, setBatchDone] = createSignal(0);
  let recorder: Recorder | null = null;
  let playback: Playback | null = null;

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

  async function arm(): Promise<void> {
    if (recorder !== null) return;
    setPhase("arming");
    try {
      recorder = await createRecorder(setLevel);
      await requestPersistentStorage();
      setPhase("ready");
    } catch (error: unknown) {
      setPhase("idle");
      throw error instanceof Error ? error : new Error("Mikrofon tidak dapat dibuka");
    }
  }

  function start(): void {
    if (recorder === null || phase() !== "ready") return;
    playback?.stop();
    recorder.start();
    setPhase("recording");
  }

  function stop(): void {
    if (recorder === null || phase() !== "recording") return;
    const raw = recorder.stop();
    const current = settings();
    const samples = trimSilence(raw.samples, {
      sampleRate: raw.sampleRate,
      thresholdDbfs: current.silenceThresholdDbfs,
      paddingMs: current.silencePaddingMs,
    });
    setTake({
      samples,
      sampleRate: raw.sampleRate,
      durationSec: samples.length / raw.sampleRate,
      peakDbfs: peakDbfs(samples),
      clipped: isClipped(samples),
    });
    setPhase("review");
  }

  async function save(): Promise<void> {
    const script = current();
    const taken = take();
    const speakerId = currentSpeakerId();
    if (script === undefined || taken === null || speakerId === null || phase() !== "review")
      return;
    setPhase("saving");
    const wav = new Blob([encodeWav(taken.samples, taken.sampleRate)], { type: "audio/wav" });
    await saveClip(
      {
        id: crypto.randomUUID(),
        speakerId,
        scriptId: script.id,
        status: "pending",
        text: script.text,
        phonemes: script.phonemes,
        g2pVersion: script.g2pVersion,
        sampleRate: taken.sampleRate,
        durationSec: taken.durationSec,
        peakDbfs: taken.peakDbfs,
        clipped: taken.clipped,
        recordedAt: new Date().toISOString(),
      },
      wav
    );
    setTake(null);
    setBatchDone((done) => (done + 1) % settings().batchSize);
    bumpClips();
    setRefresh((n) => n + 1);
    setPhase("ready");
    showToast("Klip tersimpan", "success");
  }

  function retake(): void {
    if (phase() !== "review") return;
    playback?.stop();
    setTake(null);
    setPhase(recorder === null ? "idle" : "ready");
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
    else if (phase() === "idle") attempt(arm);
  }

  // oxlint-disable solid/reactivity -- keydown handlers run outside Solid tracking on purpose
  const unregister = registerShortcuts(
    new Map([
      [" ", toggle],
      ["Enter", () => attempt(save)],
      ["r", retake],
      ["s", () => attempt(skip)],
      ["p", () => attempt(play)],
    ])
  );
  // oxlint-enable solid/reactivity
  onCleanup(() => {
    unregister();
    playback?.stop();
    attempt(async () => {
      await recorder?.close();
    });
  });

  return {
    queue,
    current,
    estimate,
    phase,
    level,
    take,
    batchDone,
    arm,
    start,
    stop,
    save,
    retake,
    skip,
    play,
    toggle,
  };
}
