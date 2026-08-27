import type { JSX } from "@solidjs/web";
import { For, Show, createSignal } from "solid-js";

import Button from "../../components/button.tsx";
import Input from "../../components/input.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Select from "../../components/select.tsx";
import Switch from "../../components/switch.tsx";
import { attempt, showToast } from "../../components/toast.tsx";
import { listClipsBySpeakerStatus } from "../../lib/db/clip.repository.ts";
import { getScript } from "../../lib/db/script.repository.ts";
import type { DurationSample } from "../../lib/duration.ts";
import { MIN_CALIBRATION_CLIPS, fitSyllablesPerSecond } from "../../lib/duration.ts";
import type { AppSettings, TrainerPreset } from "../../lib/settings.ts";
import { EXPORT_SAMPLE_RATES, TRAINER_PRESETS, TRAINER_PRESET_IDS } from "../../lib/settings.ts";
import { rebuildScripts } from "../library/library.store.ts";
import { currentSpeakerId } from "../speakers/speakers.store.ts";
import { settings, updateSettings } from "./settings.store.ts";

type NumberKey = {
  [K in keyof AppSettings]: AppSettings[K] extends number ? K : never;
}[keyof AppSettings];

const NUMBER_FIELDS: readonly {
  key: NumberKey;
  label: string;
  step: number;
  min?: number;
  max?: number;
}[] = [
  {
    key: "syllablesPerSecond",
    label: "Suku kata per detik (perkiraan durasi)",
    step: 0.1,
    min: 1,
    max: 10,
  },
  { key: "targetMinSec", label: "Durasi target minimum (detik)", step: 1, min: 1 },
  { key: "targetMaxSec", label: "Durasi target maksimum (detik)", step: 1, min: 2 },
  { key: "silenceThresholdDbfs", label: "Ambang senyap (dBFS)", step: 1, min: -90, max: 0 },
  { key: "silencePaddingMs", label: "Jeda senyap yang disimpan (ms)", step: 10, min: 0, max: 1000 },
  { key: "batchSize", label: "Klip per batch", step: 1, min: 1, max: 20 },
];

const RATE_OPTIONS = EXPORT_SAMPLE_RATES.map((rate) => ({
  value: String(rate),
  label: `${rate} Hz`,
}));
const PRESET_OPTIONS = TRAINER_PRESET_IDS.map((preset) => ({
  value: preset,
  label: TRAINER_PRESETS[preset].label,
}));

export default function SettingsView(): JSX.Element {
  const [preset, setPreset] = createSignal<TrainerPreset>("pocket-tts");
  const [fitted, setFitted] = createSignal<number | null>(null);

  async function calibrate(): Promise<void> {
    const speakerId = currentSpeakerId();
    if (speakerId === null) throw new Error("Pilih pembicara dulu");
    const clips = await listClipsBySpeakerStatus(speakerId, "approved");
    if (clips.length < MIN_CALIBRATION_CLIPS) {
      throw new Error(
        `Perlu minimal ${MIN_CALIBRATION_CLIPS} klip yang disetujui; baru ${clips.length}`
      );
    }
    const samples: DurationSample[] = [];
    for (const clip of clips) {
      const script = await getScript(clip.scriptId);
      if (script !== undefined)
        samples.push({ syllables: script.syllables, durationSec: clip.durationSec });
    }
    const rate = fitSyllablesPerSecond(samples);
    if (rate === null) throw new Error("Tidak ada klip yang bisa dipakai untuk kalibrasi");
    setFitted(rate);
  }

  return (
    <div class="flex flex-col gap-4">
      <LayerCard class="flex flex-col gap-4">
        <h2 class="text-lg font-semibold text-kumo-strong">Jendela durasi</h2>
        <label class="flex flex-col gap-1 text-base">
          Preset pelatih
          <Select
            options={PRESET_OPTIONS}
            value={preset()}
            onChange={(value) => {
              setPreset(value);
              attempt(() =>
                updateSettings({
                  targetMinSec: TRAINER_PRESETS[value].minSec,
                  targetMaxSec: TRAINER_PRESETS[value].maxSec,
                })
              );
            }}
          />
        </label>
        <For each={NUMBER_FIELDS}>
          {(field) => (
            <label class="flex flex-col gap-1 text-base">
              {field.label}
              <Input
                type="number"
                step={field.step}
                min={field.min}
                max={field.max}
                value={settings()[field.key]}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (Number.isFinite(value)) attempt(() => updateSettings({ [field.key]: value }));
                }}
              />
            </label>
          )}
        </For>
        <Button
          onClick={() =>
            attempt(async () => {
              const count = await rebuildScripts();
              showToast(`${count} naskah disusun ulang`, "success");
            })
          }
        >
          Susun ulang naskah dengan jendela ini
        </Button>
      </LayerCard>

      <LayerCard class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-kumo-strong">Kalibrasi laju bicara</h2>
        <p class="text-base text-kumo-subtle">
          Menghitung suku kata per detik dari klip pembicara saat ini yang sudah disetujui (minimal{" "}
          {MIN_CALIBRATION_CLIPS} klip), lalu memakainya untuk perkiraan durasi naskah.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <Button onClick={() => attempt(calibrate)}>Hitung dari klip</Button>
          <Show when={fitted()}>
            {(rate) => (
              <>
                <span class="text-base tabular-nums">{rate().toFixed(2)} suku kata/detik</span>
                <Button
                  variant="primary"
                  onClick={() =>
                    attempt(() => updateSettings({ syllablesPerSecond: Number(rate().toFixed(2)) }))
                  }
                >
                  Terapkan
                </Button>
              </>
            )}
          </Show>
        </div>
      </LayerCard>

      <LayerCard class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-kumo-strong">Ekspor dan tampilan</h2>
        <label class="flex flex-col gap-1 text-base">
          Laju sampel ekspor
          <Select
            options={RATE_OPTIONS}
            value={String(settings().exportSampleRate)}
            onChange={(value) => {
              const rate = EXPORT_SAMPLE_RATES.find((candidate) => String(candidate) === value);
              if (rate !== undefined) attempt(() => updateSettings({ exportSampleRate: rate }));
            }}
          />
        </label>
        <Switch
          checked={settings().showPhonemes}
          onChange={(checked) => attempt(() => updateSettings({ showPhonemes: checked }))}
          label="Tampilkan fonem di bawah naskah"
        />
      </LayerCard>
    </div>
  );
}
