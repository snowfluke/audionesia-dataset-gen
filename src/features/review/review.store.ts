import { createMemo, createSignal, onCleanup } from "solid-js";

import { attempt, showToast } from "../../components/toast.tsx";
import type { Playback } from "../../lib/audio/playback.ts";
import { playWav } from "../../lib/audio/playback.ts";
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

export type ReviewStore = {
  pending: () => Clip[];
  current: () => Clip | undefined;
  playing: () => boolean;
  batchDone: () => number;
  play: () => Promise<void>;
  decide: (status: ClipStatus) => Promise<void>;
  remove: () => Promise<void>;
};

/** Call inside the Dengarkan view. Reviews the current speaker's pending clips, oldest first. */
export function createReviewStore(): ReviewStore {
  const [batchDone, setBatchDone] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  let playback: Playback | null = null;

  const pending = createMemo(async (): Promise<Clip[]> => {
    clipsVersion();
    const speakerId = currentSpeakerId();
    if (speakerId === null) return [];
    const clips = await listClipsBySpeakerStatus(speakerId, "pending");
    clips.sort((a, b) => a.seq - b.seq);
    return clips;
  });

  const current = (): Clip | undefined => pending()[0];

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

  async function decide(status: ClipStatus): Promise<void> {
    const clip = current();
    if (clip === undefined) return;
    playback?.stop();
    setPlaying(false);
    await setClipStatus(clip.id, status);
    setBatchDone((done) => (done + 1) % settings().batchSize);
    bumpClips();
    showToast(
      status === "approved" ? "Klip disetujui" : "Klip ditolak",
      status === "approved" ? "success" : "info"
    );
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
      [" ", () => attempt(play)],
      ["y", () => attempt(() => decide("approved"))],
      ["n", () => attempt(() => decide("rejected"))],
    ])
  );
  // oxlint-enable solid/reactivity
  onCleanup(() => {
    unregister();
    playback?.stop();
  });

  return { pending, current, playing, batchDone, play, decide, remove };
}
