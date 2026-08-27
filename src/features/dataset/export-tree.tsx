import type { JSX } from "@solidjs/web";
import { Loading } from "solid-js";

import { datasetTree, renderTree } from "../../lib/export/tree.ts";
import { settings } from "../settings/settings.store.ts";
import type { DatasetStore } from "./dataset.store.ts";

export type ExportTreeProps = { store: DatasetStore };

/** The folder layout the current export options produce, as a text tree. */
export default function ExportTree(props: ExportTreeProps): JSX.Element {
  const lines = (): string =>
    renderTree(
      datasetTree({
        speakerId: props.store.workspace()?.speaker.id ?? "pembicara",
        clipCount: props.store.stats().approved,
        sampleRate: settings().exportSampleRate,
        formats: props.store.formats(),
      })
    ).join("\n");
  return (
    <Loading fallback={<div class="h-40 rounded-lg bg-kumo-tint" />}>
      <pre
        aria-label="Struktur folder ekspor"
        class="overflow-x-auto rounded-lg bg-kumo-tint p-3 font-mono text-xs leading-5 text-kumo-default"
      >
        {lines()}
      </pre>
    </Loading>
  );
}
