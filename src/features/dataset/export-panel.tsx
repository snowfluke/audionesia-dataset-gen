import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Meter from "../../components/meter.tsx";
import Switch from "../../components/switch.tsx";
import { attempt } from "../../components/toast.tsx";
import type { ExportFormat } from "../../lib/export/export.ts";
import { EXPORT_FORMATS } from "../../lib/export/export.ts";
import { formatCount } from "../../lib/format.ts";
import { settings, updateSettings } from "../settings/settings.store.ts";
import type { DatasetStore } from "./dataset.store.ts";

const FORMAT_LABELS = {
  hf: "metadata.jsonl (Hugging Face audiofolder, dengan kolom split)",
  styletts2: "styletts2/train_list.txt, val_list.txt, OOD_texts.txt",
  "pocket-tts": "pocket-tts/train.jsonl, valid.jsonl",
} as const satisfies Record<ExportFormat, string>;

export type ExportPanelProps = { store: DatasetStore };

export default function ExportPanel(props: ExportPanelProps): JSX.Element {
  const busy = (): boolean => props.store.progress() !== null;
  return (
    <>
      <LayerCard class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-kumo-strong">Ekspor dataset</h2>
        <p class="text-base text-kumo-subtle">
          Hanya klip yang disetujui yang diekspor, sebagai WAV mono 16-bit{" "}
          {formatCount(settings().exportSampleRate)} Hz
          {settings().normalizePeakDbfs === null
            ? ""
            : ` dengan puncak ${settings().normalizePeakDbfs} dBFS`}{" "}
          ke dataset/audio/&lt;pembicara&gt;/clip_0001.wav beserta speakers.jsonl, manifest.json,
          dan ATTRIBUTION.md.
        </p>
        <div class="flex flex-col gap-2">
          <For each={EXPORT_FORMATS}>
            {(format) => (
              <Switch
                checked={props.store.formats().has(format)}
                onChange={() => props.store.toggleFormat(format)}
                label={FORMAT_LABELS[format]}
              />
            )}
          </For>
          <Switch
            checked={settings().licenseMode === "cc0"}
            onChange={(checked) =>
              void attempt(() => updateSettings({ licenseMode: checked ? "cc0" : "all" }))
            }
            label="Hanya klip dengan teks CC0 (Common Voice dan teks buatan), untuk dataset yang akan dipublikasikan"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={busy() || !props.store.canPickDirectory()}
            onClick={() => {
              const store = props.store;
              void attempt(() => store.exportTo("folder"));
            }}
          >
            Simpan ke folder
          </Button>
          <Button
            disabled={busy()}
            onClick={() => {
              const store = props.store;
              void attempt(() => store.exportTo("zip"));
            }}
          >
            Unduh ZIP
          </Button>
          <Show when={!props.store.canPickDirectory()}>
            <span class="self-center text-xs text-kumo-subtle">
              Peramban ini tidak mendukung penyimpanan langsung ke folder; gunakan ZIP.
            </span>
          </Show>
        </div>
        <Show when={props.store.progress()}>
          {(progress) => (
            <Meter
              value={progress().done}
              max={Math.max(1, progress().total)}
              label={progress().label}
              detail={`${progress().done} / ${progress().total}`}
            />
          )}
        </Show>
        <Show when={props.store.warnings().length > 0}>
          <Banner variant="alert">
            <ul class="flex flex-col gap-1">
              <For each={props.store.warnings()}>{(warning) => <li>{warning}</li>}</For>
            </ul>
          </Banner>
        </Show>
      </LayerCard>

      <LayerCard class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-kumo-strong">Cadangan</h2>
        <p class="text-base text-kumo-subtle">
          Peramban bisa menghapus penyimpanan lokal kapan saja. Cadangan menyimpan pembicara, semua
          klip beserta audio aslinya, naskah yang dilewati, pengaturan, dan teks dari tab Tulis.
          Memulihkan cadangan menambahkan apa yang belum ada tanpa menimpa klip yang sudah
          tersimpan.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            disabled={busy() || !props.store.canPickDirectory()}
            onClick={() => {
              const store = props.store;
              void attempt(() => store.backupTo("folder"));
            }}
          >
            Cadangkan ke folder
          </Button>
          <Button
            disabled={busy()}
            onClick={() => {
              const store = props.store;
              void attempt(() => store.backupTo("zip"));
            }}
          >
            Cadangkan sebagai ZIP
          </Button>
          <Button
            variant="outline"
            disabled={busy() || !props.store.canPickDirectory()}
            onClick={() => void attempt(props.store.restoreFromFolder)}
          >
            Pulihkan dari folder
          </Button>
          <label class="inline-flex cursor-pointer items-center text-base text-kumo-link">
            Pulihkan dari ZIP
            <input
              type="file"
              accept=".zip"
              class="hidden"
              disabled={busy()}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file !== undefined) void attempt(() => props.store.restoreFromZip(file));
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </LayerCard>
    </>
  );
}
