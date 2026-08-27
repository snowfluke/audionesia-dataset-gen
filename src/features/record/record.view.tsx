import type { JSX } from "@solidjs/web";
import { Loading, Show, createMemo } from "solid-js";

import Badge from "../../components/badge.tsx";
import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import Kbd from "../../components/kbd.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Meter from "../../components/meter.tsx";
import Select from "../../components/select.tsx";
import { attempt } from "../../components/toast.tsx";
import Waveform from "../../components/waveform.tsx";
import { amplitudeToDbfs } from "../../lib/audio/level.ts";
import { formatCount, formatSeconds } from "../../lib/format.ts";
import { settings } from "../settings/settings.store.ts";
import { currentSpeakerId } from "../speakers/speakers.store.ts";
import BatchDots from "./batch-dots.tsx";
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
  const levelDetail = (): string => {
    const peak = store.level().peak;
    if (store.phase() === "idle" || store.phase() === "arming") return "Mikrofon belum aktif";
    if (peak >= CLIP_PEAK) return "Terlalu keras";
    if (peak === 0) return "Senyap";
    return `${amplitudeToDbfs(peak).toFixed(0)} dBFS`;
  };
  const deviceOptions = (): { value: string; label: string }[] => [
    { value: "", label: "Mikrofon bawaan sistem" },
    ...store.devices().map((device) => ({ value: device.deviceId, label: device.label })),
  ];
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
  const mainVariant = (): "destructive" | "outline" | "primary" => {
    if (store.phase() === "recording") return "destructive";
    if (store.phase() === "review") return "outline";
    return "primary";
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
            <Show when={currentSpeakerId() !== null}>
              <Banner>
                Semua naskah sudah direkam atau dilewati. Tambahkan teks di tab Tulis.
              </Banner>
            </Show>
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
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-1">
            <Meter
              value={levelRatio()}
              label="Level mikrofon"
              detail={levelDetail()}
              tone={store.level().peak >= CLIP_PEAK ? "danger" : "default"}
            />
          </div>
          <label class="flex flex-col gap-1 text-xs text-kumo-subtle">
            Mikrofon
            <Select
              size="sm"
              options={deviceOptions()}
              value={settings().inputDeviceId}
              onChange={(id) => void attempt(() => store.selectDevice(id))}
            />
          </label>
        </div>
        <Show when={store.take()}>
          {(take) => (
            <div class="flex flex-col gap-2">
              <Waveform samples={take().samples} label="Bentuk gelombang rekaman" />
              <div class="flex flex-wrap items-center gap-2 text-base">
                <Badge variant={outsideWindow(take().durationSec) ? "warning" : "success"}>
                  Durasi {formatSeconds(take().durationSec)}
                </Badge>
                <Badge variant={take().clipped ? "error" : "secondary"}>
                  Puncak {take().peakDbfs.toFixed(1)} dBFS{take().clipped ? " (terpotong)" : ""}
                </Badge>
                <Show when={take().snrDb}>
                  {(snr) => (
                    <Badge variant={snr() < settings().minSnrDb ? "warning" : "secondary"}>
                      SNR {snr().toFixed(0)} dB
                    </Badge>
                  )}
                </Show>
                <Show when={outsideWindow(take().durationSec)}>
                  <span class="text-kumo-warning">
                    Di luar jendela target; tetap bisa disimpan.
                  </span>
                </Show>
              </div>
              <Show when={store.saveBlocker()}>
                {(blocker) => <Banner variant="error">{blocker()}</Banner>}
              </Show>
            </div>
          )}
        </Show>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant={mainVariant()}
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
            <Button
              variant="primary"
              size="lg"
              disabled={store.saveBlocker() !== null}
              onClick={() => void attempt(store.save)}
            >
              Simpan
            </Button>
            <Button onClick={() => void attempt(store.play)}>Putar</Button>
          </Show>
          <Button
            variant="ghost"
            onClick={() => void attempt(store.skip)}
            disabled={store.phase() === "recording"}
          >
            Lewati
          </Button>
          <BatchDots done={store.batchDone()} size={settings().batchSize} />
        </div>
        <p class="text-xs text-kumo-subtle">
          <Kbd>Spasi</Kbd> rekam / berhenti · <Kbd>Enter</Kbd> simpan · <Kbd>R</Kbd> rekam ulang ·{" "}
          <Kbd>P</Kbd> putar · <Kbd>S</Kbd> lewati
        </p>
      </LayerCard>
    </div>
  );
}
