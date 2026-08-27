import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import Badge from "../../components/badge.tsx";
import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import Input from "../../components/input.tsx";
import Tabs from "../../components/tabs.tsx";
import { Cell, Head, Row, Table } from "../../components/table.tsx";
import { attempt } from "../../components/toast.tsx";
import type { Clip, ClipStatus } from "../../lib/db/schema.ts";
import { formatCount, formatSeconds } from "../../lib/format.ts";
import { settings } from "../settings/settings.store.ts";
import type { ClipFilter } from "./review.list.ts";
import { CLIP_FILTERS, clipFileName } from "./review.list.ts";
import type { ReviewStore } from "./review.store.ts";

const STATUS_LABELS = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
} as const satisfies Record<ClipStatus, string>;

const STATUS_VARIANTS = {
  pending: "warning",
  approved: "success",
  rejected: "error",
} as const satisfies Record<ClipStatus, "warning" | "success" | "error">;

export type ClipTableProps = { store: ReviewStore };

/** Every clip of the workspace: filter by status, search, page, and pick one to review. */
export default function ClipTable(props: ClipTableProps): JSX.Element {
  const list = (): ReviewStore["list"] => props.store.list;
  const isCurrent = (clip: Clip): boolean => props.store.current()?.id === clip.id;
  const filterItems = (): { id: ClipFilter; label: string; count: number }[] =>
    CLIP_FILTERS.map((item) => ({ ...item, count: list().counts()[item.id] }));
  const rowLabel = (clip: Clip): string =>
    isCurrent(clip) && props.store.playState() === "playing" ? "Jeda" : "Putar";

  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={filterItems()}
          value={list().filter()}
          onChange={(filter) => list().setFilter(filter)}
          label="Status klip"
        />
        <Input
          type="search"
          size="sm"
          class="w-64"
          aria-label="Cari klip"
          placeholder="Cari teks atau nama berkas"
          value={list().query()}
          onInput={(event) => list().setQuery(event.currentTarget.value)}
        />
      </div>
      <Show
        when={list().rows().length > 0}
        fallback={
          <Banner>
            {list().query().trim() === ""
              ? "Tidak ada klip di daftar ini."
              : "Tidak ada klip yang cocok dengan pencarian."}
          </Banner>
        }
      >
        <Table>
          <thead>
            <tr>
              <Head>Berkas</Head>
              <Head>Status</Head>
              <Head class="text-right">Durasi</Head>
              <Head class="text-right">SNR</Head>
              <Head class="text-right">ASR</Head>
              <Head>Teks</Head>
              <Head />
            </tr>
          </thead>
          <tbody>
            <For each={list().visible()}>
              {(clip) => (
                <Row
                  class={[
                    "cursor-pointer",
                    { "outline-2 -outline-offset-2 outline-kumo-contrast": isCurrent(clip) },
                  ]}
                  aria-current={isCurrent(clip) ? "true" : "false"}
                  onClick={() => props.store.select(clip)}
                >
                  <Cell class="font-mono text-xs whitespace-nowrap">{clipFileName(clip)}</Cell>
                  <Cell>
                    <Badge variant={STATUS_VARIANTS[clip.status]}>
                      {STATUS_LABELS[clip.status]}
                    </Badge>
                  </Cell>
                  <Cell class="text-right tabular-nums whitespace-nowrap">
                    {formatSeconds(clip.durationSec)}
                  </Cell>
                  <Cell class="text-right tabular-nums">
                    <Show when={clip.snrDb} fallback="-">
                      {(snr) => (
                        <span class={{ "text-kumo-warning": snr() < settings().minSnrDb }}>
                          {snr().toFixed(0)} dB
                        </span>
                      )}
                    </Show>
                  </Cell>
                  <Cell class="text-right tabular-nums">
                    <Show when={clip.asrCer} fallback="-">
                      {(cer) => (
                        <span class={{ "text-kumo-warning": cer() > settings().asrCerWarn }}>
                          {Math.round(cer() * 100)}% beda
                        </span>
                      )}
                    </Show>
                  </Cell>
                  <Cell>
                    <span class="line-clamp-2 max-w-md" title={clip.text}>
                      {clip.text}
                    </span>
                  </Cell>
                  <Cell>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        const store = props.store;
                        void attempt(() => store.playRow(clip));
                      }}
                    >
                      {rowLabel(clip)}
                    </Button>
                  </Cell>
                </Row>
              )}
            </For>
          </tbody>
        </Table>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-kumo-subtle">
          <span>
            Halaman {list().page()} dari {list().pageCount()} · {formatCount(list().rows().length)}{" "}
            klip, urutan rekam
          </span>
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={list().page() <= 1}
              onClick={() => list().setPage(list().page() - 1)}
            >
              Sebelumnya
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={list().page() >= list().pageCount()}
              onClick={() => list().setPage(list().page() + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
