import { createMemo, createSignal, onCleanup } from "solid-js";

import { attempt, showToast } from "../../components/toast.tsx";
import type { Playback } from "../../lib/audio/playback.ts";
import { playWav } from "../../lib/audio/playback.ts";
import { decodeWav } from "../../lib/audio/wav-encode.ts";
import {
  deleteClip,
  getClipAudio,
  listClipsBySpeakerStatus,
  setClipStatus,
} from "../../lib/db/clip.repository.ts";
import type { Clip, ClipStatus } from "../../lib/db/schema.ts";
import { registerShortcuts } from "../../lib/shortcuts.ts";
import { bumpClips, clipsVersion } from "../library/library.store.ts";
import { settings } from "../settings/settings.store.ts";
import { currentSpeakerId } from "../speakers/speakers.store.ts";

export const REVIEW_FILTERS: readonly { id: ClipStatus; label: string }[] = [
  { id: "pending", label: "Menunggu" },
  { id: "approved", label: "Disetujui" },
  { id: "rejected", label: "Ditolak" },
];

export type ReviewStore = {
  filter: () => ClipStatus;
  setFilter: (status: ClipStatus) => void;
  clips: () => Clip[];
  current: () => Clip | undefined;
  /** Decoded samples of the current clip for the waveform; null while loading or absent. */
  waveform: () => Float32Array | null;
  playing: () => boolean;
  batchDone: () => number;
  play: () => Promise<void>;
  decide: (status: ClipStatus) => Promise<void>;
  /** Marks the clip rejected so its script returns to the Rekam queue. */
  requeue: () => Promise<void>;
  remove: () => Promise<void>;
};

/** Call inside the Dengarkan view. Lists the current speaker's clips by status, oldest first. */
export function createReviewStore(): ReviewStore {
  const [filter, setFilter] = createSignal<ClipStatus>("pending");
  const [batchDone, setBatchDone] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  let playback: Playback | null = null;

  const clips = createMemo(async (): Promise<Clip[]> => {
    clipsVersion();
    const speakerId = currentSpeakerId();
    if (speakerId === null) return [];
    const rows = await listClipsBySpeakerStatus(speakerId, filter());
    rows.sort((a, b) => a.seq - b.seq);
    return rows;
  });

  const current = (): Clip | undefined => clips()[0];

  const waveform = createMemo(async (): Promise<Float32Array | null> => {
    const clip = current();
    if (clip === undefined) return null;
    const blob = await getClipAudio(clip.id);
    if (blob === undefined) return null;
    return decodeWav(new Uint8Array(await blob.arrayBuffer())).samples;
  });

  async function play(): Promise<void> {
    const clip = current();
    if (clip === undefined) return;
    playback?.stop();
    const blob = await getClipAudio(clip.id);
    if (blob === undefined) throw new Error("Audio klip tidak ditemukan");
    setPlaying(true);
    playback = await playWav(blob);
    await playback.finished;
    setPlaying(false);
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
    playback?.stop();
    setPlaying(false);
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
    playback?.stop();
    setPlaying(false);
    await setClipStatus(clip.id, "rejected");
    bumpClips();
    showToast("Naskah kembali ke antrean Rekam", "info");
  }

  async function remove(): Promise<void> {
    const clip = current();
    if (clip === undefined) return;
    playback?.stop();
    await deleteClip(clip.id);
    bumpClips();
    showToast("Klip dihapus");
  }

  // oxlint-disable solid/reactivity -- keydown handlers run outside Solid tracking on purpose
  const unregister = registerShortcuts(
    new Map([
      [" ", () => void attempt(play)],
      ["y", () => void attempt(() => decide("approved"))],
      ["n", () => void attempt(() => decide("rejected"))],
    ])
  );
  // oxlint-enable solid/reactivity
  onCleanup(() => {
    unregister();
    playback?.stop();
  });

  return {
    filter,
    setFilter,
    clips,
    current,
    waveform,
    playing,
    batchDone,
    play,
    decide,
    requeue,
    remove,
  };
}
