import type { JSX } from "@solidjs/web";
import { Loading, Show } from "solid-js";

import Button from "../../components/button.tsx";
import Input from "../../components/input.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Meter from "../../components/meter.tsx";
import { attempt } from "../../components/toast.tsx";
import { formatBytes, formatCount, formatDuration } from "../../lib/format.ts";
import { updateWorkspace } from "../workspaces/workspaces.store.ts";
import type { CoverageCount } from "./dataset.store.ts";
import { createDatasetStore } from "./dataset.store.ts";
import ExportPanel from "./export-panel.tsx";

const SECONDS_PER_HOUR = 3600;

function coverageDetail(count: CoverageCount): string {
  return `${formatCount(count.covered)} / ${formatCount(count.total)}`;
}

function Stat(props: { label: string; value: string }): JSX.Element {
  return (
    <div class="flex flex-col gap-0.5 rounded-lg bg-kumo-tint px-3 py-2">
      <span class="text-xs text-kumo-subtle">{props.label}</span>
      <span class="text-lg font-semibold text-kumo-strong tabular-nums">{props.value}</span>
    </div>
  );
}

export default function DatasetView(): JSX.Element {
  const store = createDatasetStore();
  const targetHours = (): number => store.workspace()?.targetHours ?? 0;
  const targetSeconds = (): number => targetHours() * SECONDS_PER_HOUR;
  return (
    <div class="flex flex-col gap-4">
      <Loading fallback={<p class="text-kumo-subtle">Menghitung statistik...</p>}>
        <LayerCard class="flex flex-col gap-3">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h2 class="text-lg font-semibold text-kumo-strong">Kemajuan</h2>
            <label class="flex items-center gap-2 text-xs whitespace-nowrap text-kumo-subtle">
              Target (jam)
              <Input
                type="number"
                size="sm"
                class="w-24"
                min={0.5}
                step={0.5}
                value={targetHours()}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (Number.isFinite(value) && value > 0)
                    void attempt(() => updateWorkspace({ targetHours: value }));
                }}
              />
            </label>
          </div>
          <Meter
            value={store.stats().approvedSeconds}
            max={targetSeconds()}
            label="Durasi disetujui"
            detail={`${formatDuration(store.stats().approvedSeconds)} / ${targetHours()} jam`}
          />
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Menunggu" value={formatCount(store.stats().pending)} />
            <Stat label="Disetujui" value={formatCount(store.stats().approved)} />
            <Stat label="Ditolak" value={formatCount(store.stats().rejected)} />
            <Stat label="Durasi disetujui" value={formatDuration(store.stats().approvedSeconds)} />
          </div>
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
