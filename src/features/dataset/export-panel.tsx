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
import { settings, updateSettings } from "../settings/settings.store.ts";
import type { DatasetStore } from "./dataset.store.ts";
import ExportTree from "./export-tree.tsx";

const FORMAT_LABELS = {
  hf: "Hugging Face audiofolder (metadata.jsonl dengan kolom split)",
  styletts2: "StyleTTS2 (train_list.txt, val_list.txt, OOD_texts.txt)",
  "pocket-tts": "PocketTTS (train.jsonl, valid.jsonl)",
} as const satisfies Record<ExportFormat, string>;

export type ExportPanelProps = { store: DatasetStore };

export default function ExportPanel(props: ExportPanelProps): JSX.Element {
  const busy = (): boolean => props.store.progress() !== null;
  return (
    <>
      <LayerCard class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-kumo-strong">Ekspor dataset</h2>
        <p class="text-base text-kumo-subtle">
          Hanya klip yang disetujui yang diekspor. speakers.jsonl, manifest.json, dan ATTRIBUTION.md
          selalu ditulis; format pelatih di bawah ini menambah berkasnya. Struktur folder yang
          dihasilkan mengikuti pilihan Anda.
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
          <Switch
            checked={settings().normalizePeakDbfs !== null}
            onChange={(checked) =>
              void attempt(() => updateSettings({ normalizePeakDbfs: checked ? -3 : null }))
            }
            label="Normalisasi puncak ke -3 dBFS (DC offset selalu dihilangkan)"
          />
        </div>
        <ExportTree store={props.store} />
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
        <h2 class="text-lg font-semibold text-kumo-strong">Pemeriksaan ASR</h2>
        <p class="text-base text-kumo-subtle">
          Whisper ({settings().asrModel.replace("onnx-community/", "")}) berjalan di peramban dan
          menulis ulang setiap klip yang menunggu; klip yang berbeda lebih dari{" "}
          {Math.round(settings().asrCerWarn * 100)}% dari naskahnya diberi tanda di tab Dengarkan.
          Model diunduh sekali dan disimpan peramban.
        </p>
        <Button
          disabled={busy()}
          onClick={() => {
            const store = props.store;
            void attempt(() => store.checkPendingWithAsr());
          }}
        >
          Periksa semua klip menunggu
        </Button>
      </LayerCard>
    </>
  );
}
