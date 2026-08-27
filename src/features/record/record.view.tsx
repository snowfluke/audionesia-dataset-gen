import type { JSX } from "@solidjs/web";
import { For, Loading, Show, createMemo } from "solid-js";

import Badge from "../../components/badge.tsx";
import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import Kbd from "../../components/kbd.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Meter from "../../components/meter.tsx";
import { attempt } from "../../components/toast.tsx";
import { amplitudeToDbfs } from "../../lib/audio/level.ts";
import { formatCount, formatSeconds } from "../../lib/format.ts";
import { settings } from "../settings/settings.store.ts";
import { currentSpeakerId } from "../speakers/speakers.store.ts";
import { createRecordStore } from "./record.store.ts";

const METER_FLOOR_DBFS = -60;
const CLIP_PEAK = 0.99;

export default function RecordView(): JSX.Element {
  const store = createRecordStore();
  const levelRatio = createMemo(() => {
    const dbfs = amplitudeToDbfs(store.level().peak);
    return Math.max(0, Math.min(1, (dbfs - METER_FLOOR_DBFS) / -METER_FLOOR_DBFS));
  });
  const outsideWindow = (seconds: number): boolean =>
    seconds < settings().targetMinSec || seconds > settings().targetMaxSec;

  const recordLabel = (): string => {
    const phase = store.phase();
    if (phase === "idle") return "Nyalakan mikrofon";
    if (phase === "arming") return "Membuka mikrofon...";
    if (phase === "recording") return "Berhenti";
    if (phase === "review") return "Rekam ulang";
    return "Rekam";
  };

  const onMainButton = (): void => {
    if (store.phase() === "review") store.retake();
    else store.toggle();
  };

  return (
    <div class="flex flex-col gap-4">
      <Show when={currentSpeakerId() === null}>
        <Banner variant="alert">Pilih atau buat pembicara dulu di bagian atas halaman.</Banner>
      </Show>
      <Loading fallback={<p class="text-kumo-subtle">Memuat antrean naskah...</p>}>
        <Show
          when={store.current()}
          fallback={
            <Banner>Semua naskah sudah direkam atau dilewati. Tambahkan teks di tab Tulis.</Banner>
          }
        >
          {(script) => (
            <LayerCard class="flex flex-col gap-4">
              <div class="flex items-center justify-between gap-3 text-xs text-kumo-subtle">
                <span>
                  Perkiraan {formatSeconds(store.estimate(script()))} · {script().syllables} suku
                  kata · {formatCount(store.queue().length)} naskah tersisa
                </span>
                <Badge variant={outsideWindow(store.estimate(script())) ? "warning" : "secondary"}>
                  Target {settings().targetMinSec}–{settings().targetMaxSec} s
                </Badge>
              </div>
              <p class="text-2xl leading-relaxed text-kumo-strong">{script().text}</p>
              <Show when={settings().showPhonemes}>
                <p class="font-mono text-base text-kumo-subtle">{script().phonemes}</p>
              </Show>
            </LayerCard>
          )}
        </Show>
      </Loading>

      <LayerCard class="flex flex-col gap-3">
        <Meter
          value={levelRatio()}
          label="Level mikrofon"
          detail={
            store.level().peak >= CLIP_PEAK
              ? "Terlalu keras"
              : `${amplitudeToDbfs(store.level().peak).toFixed(0)} dBFS`
          }
          tone={store.level().peak >= CLIP_PEAK ? "danger" : "default"}
        />
        <Show when={store.take()}>
          {(take) => (
            <div class="flex flex-wrap items-center gap-2 text-base">
              <Badge variant={outsideWindow(take().durationSec) ? "warning" : "success"}>
                Durasi {formatSeconds(take().durationSec)}
              </Badge>
              <Badge variant={take().clipped ? "error" : "secondary"}>
                Puncak {take().peakDbfs.toFixed(1)} dBFS{take().clipped ? " (terpotong)" : ""}
              </Badge>
              <Show when={outsideWindow(take().durationSec)}>
                <span class="text-kumo-warning">Di luar jendela target; tetap bisa disimpan.</span>
              </Show>
            </div>
          )}
        </Show>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant={store.phase() === "recording" ? "destructive" : "primary"}
            size="lg"
            disabled={
              store.phase() === "arming" ||
              store.phase() === "saving" ||
              currentSpeakerId() === null
            }
            onClick={onMainButton}
          >
            {recordLabel()}
          </Button>
          <Show when={store.phase() === "review"}>
            <Button variant="primary" size="lg" onClick={() => attempt(store.save)}>
              Simpan
            </Button>
            <Button onClick={() => attempt(store.play)}>Putar</Button>
          </Show>
          <Button
            variant="ghost"
            onClick={() => attempt(store.skip)}
            disabled={store.phase() === "recording"}
          >
            Lewati
          </Button>
          <div class="ml-auto flex items-center gap-1" aria-label="Kemajuan batch">
            <For each={Array.from({ length: settings().batchSize }, (_, i) => i)}>
              {(index) => (
                <span
                  class={[
                    "h-6 w-6 rounded-full text-center text-xs leading-6 ring ring-kumo-line",
                    {
                      "bg-kumo-contrast text-kumo-base": index < store.batchDone(),
                      "text-kumo-subtle": index >= store.batchDone(),
                    },
                  ]}
                >
                  {index + 1}
                </span>
              )}
            </For>
          </div>
        </div>
        <p class="text-xs text-kumo-subtle">
          <Kbd>Spasi</Kbd> rekam / berhenti · <Kbd>Enter</Kbd> simpan · <Kbd>R</Kbd> rekam ulang ·{" "}
          <Kbd>P</Kbd> putar · <Kbd>S</Kbd> lewati
        </p>
      </LayerCard>
    </div>
  );
}
