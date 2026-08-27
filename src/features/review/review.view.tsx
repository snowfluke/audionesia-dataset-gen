import type { JSX } from "@solidjs/web";
import { Loading, Show, createSignal } from "solid-js";

import Badge from "../../components/badge.tsx";
import Button from "../../components/button.tsx";
import Dialog from "../../components/dialog.tsx";
import Kbd from "../../components/kbd.tsx";
import LayerCard from "../../components/layer-card.tsx";
import { attempt } from "../../components/toast.tsx";
import Waveform from "../../components/waveform.tsx";
import { formatSeconds } from "../../lib/format.ts";
import BatchDots from "../record/batch-dots.tsx";
import { settings } from "../settings/settings.store.ts";
import ClipTable from "./clip-table.tsx";
import { clipFileName } from "./review.list.ts";
import { createReviewStore } from "./review.store.ts";

export default function ReviewView(): JSX.Element {
  const store = createReviewStore();
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-base text-kumo-subtle">
        <Kbd>Spasi</Kbd> putar / jeda · <Kbd>Y</Kbd> setujui · <Kbd>N</Kbd> tolak. Pilih klip lain
        dari daftar di bawah.
      </p>
      <Loading fallback={<p class="text-kumo-subtle">Memuat klip...</p>}>
        <Show when={store.current()}>
          {(clip) => (
            <LayerCard class="flex flex-col gap-4">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-kumo-subtle">
                <span>
                  {clipFileName(clip())} · {formatSeconds(clip().durationSec)}
                </span>
                <div class="flex gap-2">
                  <Badge variant={clip().clipped ? "error" : "secondary"}>
                    Puncak {clip().peakDbfs.toFixed(1)} dBFS{clip().clipped ? " (terpotong)" : ""}
                  </Badge>
                  <Show when={clip().snrDb}>
                    {(snr) => (
                      <Badge variant={snr() < settings().minSnrDb ? "warning" : "secondary"}>
                        SNR {snr().toFixed(0)} dB
                      </Badge>
                    )}
                  </Show>
                  <Show when={clip().asrCer}>
                    {(cer) => (
                      <Badge variant={cer() > settings().asrCerWarn ? "warning" : "secondary"}>
                        ASR {Math.round(cer() * 100)}% beda
                      </Badge>
                    )}
                  </Show>
                </div>
              </div>
              <p class="text-2xl leading-relaxed text-kumo-strong">{clip().text}</p>
              <Show when={settings().showPhonemes}>
                <p class="font-mono text-base text-kumo-subtle">{clip().phonemes}</p>
              </Show>
              <Show when={clip().asrText}>
                {(text) => <p class="text-base text-kumo-subtle">Didengar ASR: {text()}</p>}
              </Show>
              <Loading fallback={<div class="h-[72px] rounded-md bg-kumo-tint" />}>
                <Waveform samples={store.waveform()} label="Bentuk gelombang klip" />
              </Loading>
              <div class="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="lg" onClick={() => void attempt(store.togglePlay)}>
                  {store.playState() === "playing" ? "Jeda" : "Putar"}
                </Button>
                <Show when={clip().status !== "approved"}>
                  <Button
                    variant="success"
                    size="lg"
                    onClick={() => void attempt(() => store.decide("approved"))}
                  >
                    Ya
                  </Button>
                </Show>
                <Show when={clip().status !== "rejected"}>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => void attempt(() => store.decide("rejected"))}
                  >
                    Tidak
                  </Button>
                </Show>
                <Show when={clip().status === "approved"}>
                  <Button variant="outline" onClick={() => void attempt(store.requeue)}>
                    Rekam ulang naskah
                  </Button>
                </Show>
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Hapus
                </Button>
                <Button
                  variant="outline"
                  disabled={store.asrProgress() !== null}
                  onClick={() => void attempt(store.checkAsr)}
                >
                  {store.asrProgress() ?? "Periksa dengan ASR"}
                </Button>
                <BatchDots done={store.batchDone()} size={settings().batchSize} />
              </div>
            </LayerCard>
          )}
        </Show>
        <ClipTable store={store} />
      </Loading>
      <Dialog
        open={confirmDelete()}
        onClose={() => setConfirmDelete(false)}
        title="Hapus klip?"
        description="Rekaman ini dihapus dari penyimpanan dan tidak bisa dikembalikan. Naskahnya kembali ke antrean Rekam."
      >
        <div class="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              void attempt(async () => {
                await store.remove();
                setConfirmDelete(false);
              })
            }
          >
            Hapus
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
