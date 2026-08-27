import type { JSX } from "@solidjs/web";
import { For, Show, createSignal } from "solid-js";

import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import InputArea from "../../components/input-area.tsx";
import LayerCard from "../../components/layer-card.tsx";
import { Cell, Head, Row, Table } from "../../components/table.tsx";
import { attempt } from "../../components/toast.tsx";
import { formatCount } from "../../lib/format.ts";
import { createWriteStore } from "./write.store.ts";

const PREVIEW_ROWS = 20;

export default function WriteView(): JSX.Element {
  const store = createWriteStore();
  const [dragging, setDragging] = createSignal(false);

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer?.files;
    if (files !== undefined && files.length > 0) attempt(() => store.addFiles(files));
  };

  return (
    <div class="flex flex-col gap-4">
      <p class="text-base text-kumo-subtle">
        Tempel kalimat atau paragraf bahasa Indonesia, satu per baris. Berkas .txt, .tsv (misalnya
        validated_sentences.tsv dari Common Voice), atau .jsonl bisa dijatuhkan ke kotak ini.
      </p>
      <LayerCard
        class={["flex flex-col gap-3", { "ring-2 ring-kumo-focus": dragging() }]}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <InputArea
          rows={10}
          placeholder="Anak-anak bermain layang-layang di pantai."
          value={store.text()}
          onInput={(event) => store.setText(event.currentTarget.value)}
          disabled={store.phase() === "analyzing" || store.phase() === "saving"}
        />
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => attempt(store.analyze)}
            disabled={store.phase() !== "editing"}
          >
            {store.phase() === "analyzing" ? "Mengubah ke fonem..." : "Pratinjau fonem"}
          </Button>
          <label class="cursor-pointer text-base text-kumo-link">
            Pilih berkas
            <input
              type="file"
              multiple
              accept=".txt,.tsv,.csv,.jsonl,.json"
              class="hidden"
              onChange={(event) => {
                const files = event.currentTarget.files;
                if (files !== null && files.length > 0) attempt(() => store.addFiles(files));
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Show when={store.rejected() > 0}>
            <span class="text-xs text-kumo-subtle">
              {formatCount(store.rejected())} baris dilewati (terlalu pendek, duplikat, atau bukan
              teks Latin)
            </span>
          </Show>
        </div>
      </LayerCard>

      <Show when={store.phase() === "previewing" || store.phase() === "saving"}>
        <LayerCard class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-base font-medium text-kumo-strong">
              {formatCount(store.preview().length)} kalimat siap ditambahkan
            </span>
            <div class="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => store.discard()}
                disabled={store.phase() === "saving"}
              >
                Batal
              </Button>
              <Button
                onClick={() => attempt(() => store.commit(false))}
                disabled={store.phase() === "saving"}
              >
                Tambahkan
              </Button>
              <Button
                variant="primary"
                onClick={() => attempt(() => store.commit(true))}
                disabled={store.phase() === "saving"}
              >
                Tambahkan dan susun ulang naskah
              </Button>
            </div>
          </div>
          <Banner variant="secondary">
            Menyusun ulang naskah mengganti antrean rekam semua pembicara. Klip yang sudah direkam
            tidak berubah.
          </Banner>
          <Table>
            <thead>
              <tr>
                <Head>Teks</Head>
                <Head>Fonem</Head>
                <Head class="text-right">Suku kata</Head>
              </tr>
            </thead>
            <tbody>
              <For each={store.preview().slice(0, PREVIEW_ROWS)}>
                {(row) => (
                  <Row>
                    <Cell>{row.text}</Cell>
                    <Cell class="font-mono text-kumo-subtle">{row.phonemes}</Cell>
                    <Cell class="text-right tabular-nums">{row.syllables}</Cell>
                  </Row>
                )}
              </For>
            </tbody>
          </Table>
        </LayerCard>
      </Show>
    </div>
  );
}
