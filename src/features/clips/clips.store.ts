import { createMemo, createSignal, onCleanup } from "solid-js";

import { showToast } from "../../components/toast.tsx";
import type { Playback } from "../../lib/audio/playback.ts";
import { playWav } from "../../lib/audio/playback.ts";
import {
  deleteClip,
  getClipAudio,
  listClipsByWorkspace,
  setClipStatus,
} from "../../lib/db/clip.repository.ts";
import type { Clip, ClipStatus } from "../../lib/db/schema.ts";
import { bumpClips, clipsVersion } from "../library/library.store.ts";
import { currentWorkspace } from "../workspaces/workspaces.store.ts";

export type ClipFilter = "all" | ClipStatus;

export const CLIP_FILTERS: readonly { id: ClipFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Menunggu" },
  { id: "approved", label: "Disetujui" },
  { id: "rejected", label: "Ditolak" },
];

export const PAGE_SIZE = 100;

export type ClipCounts = { all: number; pending: number; approved: number; rejected: number };

export type ClipsStore = {
  filter: () => ClipFilter;
  setFilter: (filter: ClipFilter) => void;
  counts: () => ClipCounts;
  /** Clips of the open workspace under the current filter, newest first. */
  clips: () => Clip[];
  /** The first `limit()` of `clips()`. */
  visible: () => Clip[];
  limit: () => number;
  showMore: () => void;
  playingId: () => string | null;
  play: (clip: Clip) => Promise<void>;
  setStatus: (clip: Clip, status: ClipStatus) => Promise<void>;
  remove: (clip: Clip) => Promise<void>;
};

/** Call inside the Klip view. */
export function createClipsStore(): ClipsStore {
  const [filter, setFilterSignal] = createSignal<ClipFilter>("all");
  const [limit, setLimit] = createSignal(PAGE_SIZE);
  const [playingId, setPlayingId] = createSignal<string | null>(null);
  let playback: Playback | null = null;

  const all = createMemo(async (): Promise<Clip[]> => {
    clipsVersion();
    const workspace = currentWorkspace();
    if (workspace === null) return [];
    const rows = await listClipsByWorkspace(workspace.id);
    rows.sort((a, b) => b.seq - a.seq);
    return rows;
  });

  const counts = (): ClipCounts => {
    const result: ClipCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const clip of all()) {
      result.all += 1;
      result[clip.status] += 1;
    }
    return result;
  };
  const clips = (): Clip[] =>
    filter() === "all" ? all() : all().filter((clip) => clip.status === filter());
  const visible = (): Clip[] => clips().slice(0, limit());

  function setFilter(next: ClipFilter): void {
    setFilterSignal(next);
    setLimit(PAGE_SIZE);
  }

  function showMore(): void {
    setLimit((current) => current + PAGE_SIZE);
  }

  async function play(clip: Clip): Promise<void> {
    playback?.stop();
    const blob = await getClipAudio(clip.id);
    if (blob === undefined) throw new Error("Audio klip ini sudah dibebaskan");
    setPlayingId(clip.id);
    playback = await playWav(blob);
    await playback.finished;
    setPlayingId(null);
  }

  async function setStatus(clip: Clip, status: ClipStatus): Promise<void> {
    if (clip.status === status) return;
    await setClipStatus(clip.id, status);
    bumpClips();
    showToast(status === "approved" ? "Klip disetujui" : "Klip ditolak", "success");
  }

  async function remove(clip: Clip): Promise<void> {
    playback?.stop();
    await deleteClip(clip.id);
    bumpClips();
    showToast("Klip dihapus");
  }

  onCleanup(() => playback?.stop());

  return {
    filter,
    setFilter,
    counts,
    clips,
    visible,
    limit,
    showMore,
    playingId,
    play,
    setStatus,
    remove,
  };
}
