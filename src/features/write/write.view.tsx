import type { JSX } from "@solidjs/web";
import { For, Show, createSignal } from "solid-js";

import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import InputArea from "../../components/input-area.tsx";
import LayerCard from "../../components/layer-card.tsx";
import { Cell, Head, Row, Table } from "../../components/table.tsx";
import { attempt } from "../../components/toast.tsx";
import { SAMPLE_FILES, sampleDataUrl } from "../../lib/corpus/sample-text.ts";
import { formatCount } from "../../lib/format.ts";
import { REJECT_LABELS, createWriteStore } from "./write.store.ts";

const PREVIEW_ROWS = 20;
const REJECTED_ROWS = 20;

export default function WriteView(): JSX.Element {
  const store = createWriteStore();
  const [dragging, setDragging] = createSignal(false);

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer?.files;
    if (files !== undefined && files.length > 0) void attempt(() => store.addFiles(files));
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold text-kumo-strong">Teks sendiri</h2>
        <p class="text-base text-kumo-subtle">
          Tambahkan kalimat atau paragraf bahasa Indonesia yang ingin Anda baca sendiri, satu per
          baris. Teks ini masuk ke kumpulan kalimat dan naskahnya menjadi urutan pertama di antrean
          Rekam. Berkas .txt, .tsv (misalnya validated_sentences.tsv dari Common Voice), atau .jsonl
          bisa dijatuhkan ke kotak ini.
        </p>
      </div>
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
        <div class="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => void attempt(store.analyze)}
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
                if (files !== null && files.length > 0) void attempt(() => store.addFiles(files));
                event.currentTarget.value = "";
              }}
            />
          </label>
          <span class="text-base text-kumo-subtle">
            Contoh berkas:{" "}
            <For each={SAMPLE_FILES}>
              {(file, index) => (
                <>
                  <Show when={index() > 0}> · </Show>
                  <a
                    class="text-kumo-link hover:underline"
                    href={sampleDataUrl(file)}
                    download={file.name}
                  >
                    {file.name}
                  </a>
                </>
              )}
            </For>
          </span>
        </div>
        <Show when={store.rejected().length > 0}>
          <details class="text-xs text-kumo-subtle">
            <summary class="cursor-pointer">
              {formatCount(store.rejected().length)} baris dilewati
            </summary>
            <ul class="mt-2 flex flex-col gap-1">
              <For each={store.rejected().slice(0, REJECTED_ROWS)}>
                {(item) => (
                  <li>
                    <span class="text-kumo-warning">{REJECT_LABELS[item.reason]}</span>: {item.line}
                  </li>
                )}
              </For>
            </ul>
          </details>
        </Show>
      </LayerCard>

      <Show when={store.phase() === "previewing" || store.phase() === "saving"}>
        <LayerCard class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-base font-medium text-kumo-strong">
              {formatCount(store.preview().length)} kalimat siap ditambahkan
            </span>
            <div class="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => store.discard()}
                disabled={store.phase() === "saving"}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={() => void attempt(store.commit)}
                disabled={store.phase() === "saving"}
              >
                {store.phase() === "saving" ? "Menyusun naskah..." : "Tambahkan ke antrean Rekam"}
              </Button>
            </div>
          </div>
          <Banner variant="secondary">
            Naskah disusun ulang untuk semua dataset; naskah dari teks Anda menjadi urutan pertama.
            Klip yang sudah direkam tidak berubah.
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
