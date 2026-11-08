import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";

import Button, { buttonClass } from "../../components/button.tsx";
import Meter from "../../components/meter.tsx";
import { attempt } from "../../components/toast.tsx";
import type { HomeStore } from "./home.store.ts";

export type BackupPanelProps = { store: HomeStore };

/** Backup and restore of every dataset in this browser. */
export default function BackupPanel(props: BackupPanelProps): JSX.Element {
  const busy = (): boolean => props.store.progress() !== null;
  return (
    <section class="mt-4 flex flex-col gap-3">
      <h2 class="text-lg font-semibold text-kumo-strong">Cadangan semua dataset</h2>
      <p class="text-base text-kumo-subtle">
        Peramban bisa menghapus penyimpanan lokal kapan saja. Cadangan menyimpan setiap dataset,
        semua klip beserta audio aslinya, naskah yang dilewati, pengaturan, dan teks dari tab Teks
        sendiri. Memulihkan cadangan menambahkan apa yang belum ada tanpa menimpa klip yang sudah
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
          disabled={busy() || !props.store.canPickDirectory()}
          onClick={() => void attempt(props.store.restoreFromFolder)}
        >
          Pulihkan dari folder
        </Button>
        <label
          class={[
            ...buttonClass("secondary", "base"),
            "focus-within:ring-2 focus-within:ring-kumo-focus has-disabled:cursor-not-allowed has-disabled:opacity-50",
          ]}
        >
          Pulihkan dari ZIP
          <input
            type="file"
            accept=".zip"
            class="sr-only"
            disabled={busy()}
            onChange={(event) => {
              const store = props.store;
              const file = event.currentTarget.files?.[0];
              if (file !== undefined) void attempt(() => store.restoreFromZip(file));
              event.currentTarget.value = "";
            }}
          />
        </label>
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
    </section>
  );
}
