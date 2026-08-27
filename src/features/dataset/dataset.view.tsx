import type { JSX } from "@solidjs/web";
import { For, Loading, Show } from "solid-js";

import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Meter from "../../components/meter.tsx";
import Switch from "../../components/switch.tsx";
import { Cell, Head, Row, Table } from "../../components/table.tsx";
import { attempt } from "../../components/toast.tsx";
import type { ExportFormat } from "../../lib/export/export.ts";
import { EXPORT_FORMATS } from "../../lib/export/export.ts";
import { formatBytes, formatCount, formatDuration } from "../../lib/format.ts";
import { settings } from "../settings/settings.store.ts";
import { createDatasetStore } from "./dataset.store.ts";

const FORMAT_LABELS = {
  hf: "metadata.jsonl (Hugging Face audiofolder)",
  styletts2: "styletts2/train_list.txt, val_list.txt, OOD_texts.txt",
  "pocket-tts": "pocket-tts/train.jsonl, valid.jsonl",
} as const satisfies Record<ExportFormat, string>;

export default function DatasetView(): JSX.Element {
  const store = createDatasetStore();
  return (
    <div class="flex flex-col gap-4">
      <Loading fallback={<p class="text-kumo-subtle">Menghitung statistik...</p>}>
        <LayerCard class="flex flex-col gap-3">
          <h2 class="text-lg font-semibold text-kumo-strong">Cakupan klip yang disetujui</h2>
          <Meter
            value={store.stats().coverage.phones.covered}
            max={store.stats().coverage.phones.total}
            label="Fonem"
            detail={`${store.stats().coverage.phones.covered} / ${store.stats().coverage.phones.total}`}
          />
          <Meter
            value={store.stats().coverage.diphones.covered}
            max={store.stats().coverage.diphones.total}
            label="Difon"
            detail={`${store.stats().coverage.diphones.covered} / ${store.stats().coverage.diphones.total}`}
          />
          <Meter
            value={store.stats().coverage.phenomena.covered}
            max={store.stats().coverage.phenomena.total}
            label="Fenomena ejaan dan prosodi"
            detail={`${store.stats().coverage.phenomena.covered} / ${store.stats().coverage.phenomena.total}`}
          />
        </LayerCard>

        <LayerCard class="flex flex-col gap-3">
          <h2 class="text-lg font-semibold text-kumo-strong">Pembicara</h2>
          <Table>
            <thead>
              <tr>
                <Head>Pembicara</Head>
                <Head class="text-right">Menunggu</Head>
                <Head class="text-right">Disetujui</Head>
                <Head class="text-right">Ditolak</Head>
                <Head class="text-right">Durasi disetujui</Head>
              </tr>
            </thead>
            <tbody>
              <For each={store.stats().speakers}>
                {(row) => (
                  <Row>
                    <Cell>{row.speaker.name}</Cell>
                    <Cell class="text-right tabular-nums">{formatCount(row.pending)}</Cell>
                    <Cell class="text-right tabular-nums">{formatCount(row.approved)}</Cell>
                    <Cell class="text-right tabular-nums">{formatCount(row.rejected)}</Cell>
                    <Cell class="text-right tabular-nums">
                      {formatDuration(row.approvedSeconds)}
                    </Cell>
                  </Row>
                )}
              </For>
            </tbody>
          </Table>
          <Show when={store.stats().storage}>
            {(storage) => (
              <p class="text-xs text-kumo-subtle">
                Penyimpanan peramban: {formatBytes(storage().usageBytes)} dari{" "}
                {formatBytes(storage().quotaBytes)}
              </p>
            )}
          </Show>
        </LayerCard>
      </Loading>

      <LayerCard class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-kumo-strong">Ekspor dataset</h2>
        <p class="text-base text-kumo-subtle">
          Hanya klip yang disetujui yang diekspor, sebagai WAV mono 16-bit{" "}
          {formatCount(settings().exportSampleRate)} Hz ke
          dataset/audio/&lt;pembicara&gt;/clip_0001.wav beserta speakers.jsonl, manifest.json, dan
          ATTRIBUTION.md.
        </p>
        <div class="flex flex-col gap-2">
          <For each={EXPORT_FORMATS}>
            {(format) => (
              <Switch
                checked={store.formats().has(format)}
                onChange={() => store.toggleFormat(format)}
                label={FORMAT_LABELS[format]}
              />
            )}
          </For>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={store.exporting() !== null || !store.canPickDirectory()}
            onClick={() => attempt(() => store.exportTo("folder"))}
          >
            Simpan ke folder
          </Button>
          <Button
            disabled={store.exporting() !== null}
            onClick={() => attempt(() => store.exportTo("zip"))}
          >
            Unduh ZIP
          </Button>
          <Show when={!store.canPickDirectory()}>
            <span class="self-center text-xs text-kumo-subtle">
              Peramban ini tidak mendukung penyimpanan langsung ke folder; gunakan ZIP.
            </span>
          </Show>
        </div>
        <Show when={store.exporting()}>
          {(progress) => (
            <Meter
              value={progress().done}
              max={Math.max(1, progress().total)}
              label="Mengekspor"
              detail={`${progress().done} / ${progress().total}`}
            />
          )}
        </Show>
        <Show when={store.warnings().length > 0}>
          <Banner variant="alert">
            <ul class="flex flex-col gap-1">
              <For each={store.warnings()}>{(warning) => <li>{warning}</li>}</For>
            </ul>
          </Banner>
        </Show>
      </LayerCard>
    </div>
  );
}
