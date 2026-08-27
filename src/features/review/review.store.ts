import { createMemo, createSignal, onCleanup } from "solid-js";

import { attempt, showToast } from "../../components/toast.tsx";
import { checkClipWithAsr } from "../../lib/asr/check.ts";
import type { PlayState } from "../../lib/audio/player.ts";
import { createPlayer } from "../../lib/audio/player.ts";
import type { Playback } from "../../lib/audio/playback.ts";
import { playWav } from "../../lib/audio/playback.ts";
import { decodeWav } from "../../lib/audio/wav-encode.ts";
import {
  deleteClip,
  getClipAudio,
  listClipsByWorkspace,
  setClipStatus,
} from "../../lib/db/clip.repository.ts";
import type { Clip, ClipStatus } from "../../lib/db/schema.ts";
import { registerShortcuts } from "../../lib/shortcuts.ts";
import { bumpClips, clipsVersion } from "../library/library.store.ts";
import { settings } from "../settings/settings.store.ts";
import { currentWorkspace } from "../workspaces/workspaces.store.ts";
import type { ClipList } from "./review.list.ts";
import { createClipList } from "./review.list.ts";

export type ReviewStore = {
  list: ClipList;
  /** The selected clip, or the first clip on the current page. */
  current: () => Clip | undefined;
  select: (clip: Clip) => void;
  /** Decoded samples of the current clip for the waveform; null while loading or absent. */
  waveform: () => Float32Array | null;
  playState: () => PlayState;
  /** Putar / Jeda for the current clip. */
  togglePlay: () => Promise<void>;
  /** Selects a row and plays or pauses it. */
  playRow: (clip: Clip) => Promise<void>;
  batchDone: () => number;
  decide: (status: ClipStatus) => Promise<void>;
  /** Marks the clip rejected so its script returns to the Rekam queue. */
  requeue: () => Promise<void>;
  remove: () => Promise<void>;
  /** Model download or transcription in flight; text describes the step. */
  asrProgress: () => string | null;
  checkAsr: () => Promise<void>;
};

/** Call inside the Dengarkan view. Lists the open workspace's clips in recording order. */
export function createReviewStore(): ReviewStore {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [batchDone, setBatchDone] = createSignal(0);
  const [asrProgress, setAsrProgress] = createSignal<string | null>(null);
  const player = createPlayer();

  const all = createMemo(async (): Promise<Clip[]> => {
    clipsVersion();
    const workspace = currentWorkspace();
    if (workspace === null) return [];
    const rows = await listClipsByWorkspace(workspace.id);
    rows.sort((a, b) => a.seq - b.seq);
    return rows;
  });
  const list = createClipList(all);

  const current = (): Clip | undefined =>
    list.rows().find((clip) => clip.id === selectedId()) ?? list.visible()[0];

  const waveform = createMemo(async (): Promise<Float32Array | null> => {
    const clip = current();
    if (clip === undefined) return null;
    const blob = await getClipAudio(clip.id);
    if (blob === undefined) return null;
    return decodeWav(new Uint8Array(await blob.arrayBuffer())).samples;
  });

  function select(clip: Clip): void {
    if (current()?.id !== clip.id) player.stop();
    setSelectedId(clip.id);
  }

  function startFor(clip: Clip): () => Promise<Playback> {
    return async () => {
      const blob = await getClipAudio(clip.id);
      if (blob === undefined) throw new Error("Audio klip ini sudah dibebaskan");
      return playWav(blob);
    };
  }

  async function togglePlay(): Promise<void> {
    const clip = current();
    if (clip === undefined) return;
    await player.toggle(startFor(clip));
  }

  // The selection write lands on the next flush, so play the row itself, not `current()`.
  async function playRow(clip: Clip): Promise<void> {
    select(clip);
    await player.toggle(startFor(clip));
  }

  function advanceBatch(): void {
    const size = settings().batchSize;
    const done = batchDone() + 1;
    setBatchDone(done % size);
    if (done === size) showToast(`Batch ${size} klip selesai ditinjau`, "success");
  }

  async function decide(status: ClipStatus): Promise<void> {
    const clip = current();
    if (clip === undefined || clip.status === status) return;
    player.stop();
    await setClipStatus(clip.id, status);
    advanceBatch();
    bumpClips();
    showToast(
      status === "approved" ? "Klip disetujui" : "Klip ditolak",
      status === "approved" ? "success" : "info"
    );
  }

  async function requeue(): Promise<void> {
    const clip = current();
    if (clip === undefined) return;
    player.stop();
    await setClipStatus(clip.id, "rejected");
    bumpClips();
    showToast("Naskah kembali ke antrean Rekam", "info");
  }

  async function remove(): Promise<void> {
    const clip = current();
    if (clip === undefined) return;
    player.stop();
    await deleteClip(clip.id);
    bumpClips();
    showToast("Klip dihapus");
  }

  async function checkAsr(): Promise<void> {
    const clip = current();
    if (clip === undefined || asrProgress() !== null) return;
    setAsrProgress("Menyiapkan model ASR...");
    try {
      const result = await checkClipWithAsr(clip, settings().asrModel, (file, percent) =>
        setAsrProgress(`Mengunduh ${file} ${percent.toFixed(0)}%`)
      );
      bumpClips();
      const percent = Math.round(result.cer * 100);
      showToast(
        result.cer > settings().asrCerWarn
          ? `ASR berbeda ${percent}% dari naskah; dengarkan lagi`
          : `ASR cocok dengan naskah (${percent}% beda)`,
        result.cer > settings().asrCerWarn ? "info" : "success"
      );
    } finally {
      setAsrProgress(null);
    }
  }

  // oxlint-disable solid/reactivity -- keydown handlers run outside Solid tracking on purpose
  const unregister = registerShortcuts(
    new Map([
      [" ", () => void attempt(togglePlay)],
      ["y", () => void attempt(() => decide("approved"))],
      ["n", () => void attempt(() => decide("rejected"))],
    ])
  );
  // oxlint-enable solid/reactivity
  onCleanup(() => {
    unregister();
    player.stop();
  });

  return {
    list,
    current,
    select,
    waveform,
    playState: player.state,
    togglePlay,
    playRow,
    batchDone,
    decide,
    requeue,
    remove,
    asrProgress,
    checkAsr,
  };
}
