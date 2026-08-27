import type { JSX } from "@solidjs/web";
import { For, Loading, Show, createSignal } from "solid-js";

import Badge from "../../components/badge.tsx";
import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import Dialog from "../../components/dialog.tsx";
import Tabs from "../../components/tabs.tsx";
import { Cell, Head, Row, Table } from "../../components/table.tsx";
import { attempt } from "../../components/toast.tsx";
import type { Clip, ClipStatus } from "../../lib/db/schema.ts";
import { formatCount, formatSeconds } from "../../lib/format.ts";
import { settings } from "../settings/settings.store.ts";
import type { ClipFilter } from "./clips.store.ts";
import { CLIP_FILTERS, createClipsStore } from "./clips.store.ts";

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

function fileName(clip: Clip): string {
  return `clip_${String(clip.seq).padStart(4, "0")}.wav`;
}

/** Every recorded item of the open workspace, with status, quality, and actions. */
export default function ClipsView(): JSX.Element {
  const store = createClipsStore();
  const [deleting, setDeleting] = createSignal<Clip | null>(null);
  const filterItems = (): { id: ClipFilter; label: string; count: number }[] =>
    CLIP_FILTERS.map((item) => ({ ...item, count: store.counts()[item.id] }));
  const confirmDelete = (clip: Clip): void => {
    void attempt(async () => {
      await store.remove(clip);
      setDeleting(null);
    });
  };
  const deletingName = (): string => {
    const clip = deleting();
    return clip === null ? "klip" : fileName(clip);
  };

  return (
    <div class="flex flex-col gap-4">
      <Loading fallback={<p class="text-kumo-subtle">Memuat klip...</p>}>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={filterItems()}
            value={store.filter()}
            onChange={store.setFilter}
            label="Status klip"
          />
          <span class="text-xs text-kumo-subtle">
            Terbaru di atas. Nama berkas mengikuti urutan rekam; nomor klip yang dihapus tidak
            dipakai lagi.
          </span>
        </div>
        <Show
          when={store.clips().length > 0}
          fallback={<Banner>Belum ada klip di daftar ini. Rekam naskah di tab Rekam.</Banner>}
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
                <Head>Aksi</Head>
              </tr>
            </thead>
            <tbody>
              <For each={store.visible()}>
                {(clip) => (
                  <Row>
                    <Cell class="font-mono text-xs whitespace-nowrap">{fileName(clip)}</Cell>
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
                      <div class="flex flex-wrap gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={store.playingId() === clip.id}
                          onClick={() => void attempt(() => store.play(clip))}
                        >
                          {store.playingId() === clip.id ? "Memutar" : "Putar"}
                        </Button>
                        <Show when={clip.status !== "approved"}>
                          <Button
                            size="xs"
                            variant="success"
                            onClick={() => void attempt(() => store.setStatus(clip, "approved"))}
                          >
                            Setujui
                          </Button>
                        </Show>
                        <Show when={clip.status !== "rejected"}>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => void attempt(() => store.setStatus(clip, "rejected"))}
                          >
                            Tolak
                          </Button>
                        </Show>
                        <Button size="xs" variant="ghost" onClick={() => setDeleting(clip)}>
                          Hapus
                        </Button>
                      </div>
                    </Cell>
                  </Row>
                )}
              </For>
            </tbody>
          </Table>
          <Show when={store.clips().length > store.limit()}>
            <Button variant="outline" onClick={store.showMore}>
              Tampilkan {formatCount(store.clips().length - store.limit())} klip lagi
            </Button>
          </Show>
        </Show>
      </Loading>
      <Dialog
        open={deleting() !== null}
        onClose={() => setDeleting(null)}
        title={`Hapus ${deletingName()}?`}
        description="Rekaman ini dihapus dari penyimpanan dan tidak bisa dikembalikan. Naskahnya kembali ke antrean Rekam."
      >
        <div class="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const clip = deleting();
              if (clip !== null) confirmDelete(clip);
            }}
          >
            Hapus
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
