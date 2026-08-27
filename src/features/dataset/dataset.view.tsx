import type { JSX } from "@solidjs/web";
import { For, Loading, Show } from "solid-js";

import Button from "../../components/button.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Meter from "../../components/meter.tsx";
import { Cell, Head, Row, Table } from "../../components/table.tsx";
import { attempt } from "../../components/toast.tsx";
import { formatBytes, formatCount, formatDuration } from "../../lib/format.ts";
import { settings } from "../settings/settings.store.ts";
import ExportPanel from "./export-panel.tsx";
import type { CoverageCount } from "./dataset.store.ts";
import { createDatasetStore } from "./dataset.store.ts";

function coverageDetail(count: CoverageCount): string {
  return `${formatCount(count.covered)} / ${formatCount(count.total)}`;
}

export default function DatasetView(): JSX.Element {
  const store = createDatasetStore();
  const targetSeconds = (): number => settings().targetHours * 3600;
  return (
    <div class="flex flex-col gap-4">
      <Loading fallback={<p class="text-kumo-subtle">Menghitung statistik...</p>}>
        <LayerCard class="flex flex-col gap-3">
          <h2 class="text-lg font-semibold text-kumo-strong">Kemajuan</h2>
          <Meter
            value={store.stats().totalApprovedSeconds}
            max={targetSeconds()}
            label={`Durasi disetujui, semua pembicara (target ${settings().targetHours} jam)`}
            detail={`${formatDuration(store.stats().totalApprovedSeconds)} / ${formatDuration(targetSeconds())}`}
          />
          <Meter
            value={store.stats().coverage.phones.covered}
            max={store.stats().coverage.phones.total}
            label="Fonem tercakup"
            detail={coverageDetail(store.stats().coverage.phones)}
          />
          <Meter
            value={store.stats().coverage.diphones.covered}
            max={store.stats().coverage.diphones.total}
            label="Difon tercakup"
            detail={coverageDetail(store.stats().coverage.diphones)}
          />
          <Meter
            value={store.stats().coverage.phenomena.covered}
            max={store.stats().coverage.phenomena.total}
            label="Fenomena ejaan dan prosodi tercakup"
            detail={coverageDetail(store.stats().coverage.phenomena)}
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
              <Row class="font-medium">
                <Cell>Total</Cell>
                <Cell class="text-right tabular-nums">
                  {formatCount(store.stats().speakers.reduce((sum, row) => sum + row.pending, 0))}
                </Cell>
                <Cell class="text-right tabular-nums">
                  {formatCount(store.stats().speakers.reduce((sum, row) => sum + row.approved, 0))}
                </Cell>
                <Cell class="text-right tabular-nums">
                  {formatCount(store.stats().speakers.reduce((sum, row) => sum + row.rejected, 0))}
                </Cell>
                <Cell class="text-right tabular-nums">
                  {formatDuration(store.stats().totalApprovedSeconds)}
                </Cell>
              </Row>
            </tbody>
          </Table>
          <div class="flex flex-wrap items-center gap-3 text-xs text-kumo-subtle">
            <Show when={store.stats().storage}>
              {(storage) => (
                <span>
                  Penyimpanan peramban: {formatBytes(storage().usageBytes)} dari{" "}
                  {formatBytes(storage().quotaBytes)}
                </span>
              )}
            </Show>
            <Show when={store.stats().rejectedAudioBytes > 0}>
              <Button
                size="xs"
                variant="outline"
                onClick={() => void attempt(store.freeRejectedAudio)}
              >
                Bebaskan {formatBytes(store.stats().rejectedAudioBytes)} audio klip ditolak
              </Button>
            </Show>
          </div>
        </LayerCard>
      </Loading>

      <ExportPanel store={store} />
    </div>
  );
}
