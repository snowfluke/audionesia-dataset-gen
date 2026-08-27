import { createSignal } from "solid-js";

import type { Clip, ClipStatus } from "../../lib/db/schema.ts";

export type ClipFilter = "all" | ClipStatus;

export const CLIP_FILTERS: readonly { id: ClipFilter; label: string }[] = [
  { id: "pending", label: "Menunggu" },
  { id: "approved", label: "Disetujui" },
  { id: "rejected", label: "Ditolak" },
  { id: "all", label: "Semua" },
];

export const PAGE_SIZE = 50;

export type ClipCounts = { all: number; pending: number; approved: number; rejected: number };

export function clipFileName(clip: Clip): string {
  return `clip_${String(clip.seq).padStart(4, "0")}.wav`;
}

function matches(clip: Clip, needle: string): boolean {
  return (
    clip.text.toLowerCase().includes(needle) ||
    clipFileName(clip).includes(needle) ||
    (clip.asrText?.toLowerCase().includes(needle) ?? false)
  );
}

/** A status filter, a text search, and pages over the workspace's clips. */
export type ClipList = {
  filter: () => ClipFilter;
  setFilter: (filter: ClipFilter) => void;
  query: () => string;
  setQuery: (query: string) => void;
  /** Current page, 1-based, never past the last page. */
  page: () => number;
  setPage: (page: number) => void;
  pageCount: () => number;
  counts: () => ClipCounts;
  /** Every clip that passes the filter and the search. */
  rows: () => Clip[];
  /** The rows on the current page. */
  visible: () => Clip[];
};

export function createClipList(all: () => Clip[]): ClipList {
  const [filter, setFilterSignal] = createSignal<ClipFilter>("pending");
  const [query, setQuerySignal] = createSignal("");
  const [rawPage, setPage] = createSignal(1);

  const counts = (): ClipCounts => {
    const result: ClipCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const clip of all()) {
      result.all += 1;
      result[clip.status] += 1;
    }
    return result;
  };
  const rows = (): Clip[] => {
    const status = filter();
    const needle = query().trim().toLowerCase();
    const result: Clip[] = [];
    for (const clip of all()) {
      if (status !== "all" && clip.status !== status) continue;
      if (needle !== "" && !matches(clip, needle)) continue;
      result.push(clip);
    }
    return result;
  };
  const pageCount = (): number => Math.max(1, Math.ceil(rows().length / PAGE_SIZE));
  const page = (): number => Math.max(1, Math.min(rawPage(), pageCount()));
  const visible = (): Clip[] => rows().slice((page() - 1) * PAGE_SIZE, page() * PAGE_SIZE);

  function setFilter(next: ClipFilter): void {
    setFilterSignal(next);
    setPage(1);
  }
  function setQuery(next: string): void {
    setQuerySignal(next);
    setPage(1);
  }

  return { filter, setFilter, query, setQuery, page, setPage, pageCount, counts, rows, visible };
}
