import type { JSX } from "@solidjs/web";
import { Errored, Match, Show, Switch, createSignal } from "solid-js";

import Banner from "./components/banner.tsx";
import Button from "./components/button.tsx";
import Dialog from "./components/dialog.tsx";
import Kbd from "./components/kbd.tsx";
import Tabs from "./components/tabs.tsx";
import Toaster, { attempt } from "./components/toast.tsx";
import DatasetView from "./features/dataset/dataset.view.tsx";
import { initLibrary, phase, progress } from "./features/library/library.store.ts";
import RecordView from "./features/record/record.view.tsx";
import ReviewView from "./features/review/review.view.tsx";
import { initSettings } from "./features/settings/settings.store.ts";
import SettingsView from "./features/settings/settings.view.tsx";
import SpeakerPicker from "./features/speakers/speaker-picker.tsx";
import WriteView from "./features/write/write.view.tsx";
import { applyTheme, currentTheme, nextTheme } from "./lib/theme.ts";

const TABS = [
  { id: "record", label: "Rekam" },
  { id: "review", label: "Dengarkan" },
  { id: "write", label: "Tulis" },
  { id: "dataset", label: "Dataset" },
  { id: "settings", label: "Pengaturan" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const THEME_LABELS = { system: "sistem", light: "terang", dark: "gelap" } as const;

export default function App(): JSX.Element {
  const [tab, setTab] = createSignal<TabId>("record");
  const initialTheme = currentTheme();
  const [theme, setTheme] = createSignal(initialTheme);
  const [help, setHelp] = createSignal<"none" | "guide" | "shortcuts">("none");

  applyTheme(initialTheme);
  void attempt(async () => {
    await initSettings();
    await initLibrary();
  });

  return (
    <div class="flex min-h-screen flex-col bg-kumo-canvas text-base text-kumo-default">
      <header class="flex flex-wrap items-center gap-4 border-b border-kumo-line bg-kumo-base px-6 py-3">
        <div class="flex flex-col">
          <span class="text-lg font-semibold text-kumo-strong">Audionesia</span>
          <span class="text-xs text-kumo-subtle">
            Pembuat dataset suara untuk TTS bahasa Indonesia
          </span>
        </div>
        <SpeakerPicker />
        <div class="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = nextTheme(theme());
              setTheme(next);
              applyTheme(next);
            }}
          >
            Tema: {THEME_LABELS[theme()]}
          </Button>
        </div>
      </header>

      <nav class="flex items-center gap-4 border-b border-kumo-line bg-kumo-base px-6 py-2">
        <Tabs items={TABS} value={tab()} onChange={setTab} label="Bagian" />
        <Show when={phase() !== "ready"}>
          <span
            class={[
              "text-xs",
              { "text-kumo-danger": phase() === "error", "text-kumo-subtle": phase() !== "error" },
            ]}
          >
            {progress()}
          </span>
        </Show>
      </nav>

      <main class="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-6">
        <Errored
          fallback={(error, reset) => (
            <Banner variant="error">
              <span class="flex-1">{String(error())}</span>
              <Button size="sm" onClick={reset}>
                Coba lagi
              </Button>
            </Banner>
          )}
        >
          <Switch>
            <Match when={tab() === "record"}>
              <RecordView />
            </Match>
            <Match when={tab() === "review"}>
              <ReviewView />
            </Match>
            <Match when={tab() === "write"}>
              <WriteView />
            </Match>
            <Match when={tab() === "dataset"}>
              <DatasetView />
            </Match>
            <Match when={tab() === "settings"}>
              <SettingsView />
            </Match>
          </Switch>
        </Errored>
      </main>

      <footer class="flex items-center gap-2 border-t border-kumo-line bg-kumo-base px-6 py-3">
        <Button variant="outline" size="sm" onClick={() => setHelp("guide")}>
          Panduan
        </Button>
        <Button variant="outline" size="sm" onClick={() => setHelp("shortcuts")}>
          Pintasan keyboard
        </Button>
      </footer>

      <Dialog
        open={help() === "guide"}
        onClose={() => setHelp("none")}
        title="Panduan merekam"
        size="lg"
      >
        <ol class="flex list-decimal flex-col gap-2 pl-5 text-base">
          <li>
            Gunakan mikrofon yang sama dan ruangan yang sunyi untuk semua klip satu pembicara.
          </li>
          <li>
            Baca naskah dengan tempo wajar. Jeda pendek di koma dan titik membantu model belajar
            prosodi.
          </li>
          <li>
            Jaga puncak di bawah -3 dBFS. Klip yang terpotong (clipping) ditandai merah; rekam
            ulang.
          </li>
          <li>Setujui klip di tab Dengarkan hanya jika setiap kata terucap sesuai naskah.</li>
          <li>
            Ekspor secara berkala dari tab Dataset. Peramban bisa menghapus penyimpanan lokal.
          </li>
        </ol>
      </Dialog>
      <Dialog
        open={help() === "shortcuts"}
        onClose={() => setHelp("none")}
        title="Pintasan keyboard"
      >
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          <dt>
            <Kbd>Spasi</Kbd>
          </dt>
          <dd>Rekam / berhenti (Rekam), putar (Dengarkan)</dd>
          <dt>
            <Kbd>Enter</Kbd>
          </dt>
          <dd>Simpan klip</dd>
          <dt>
            <Kbd>R</Kbd>
          </dt>
          <dd>Rekam ulang</dd>
          <dt>
            <Kbd>P</Kbd>
          </dt>
          <dd>Putar rekaman terakhir</dd>
          <dt>
            <Kbd>S</Kbd>
          </dt>
          <dd>Lewati naskah</dd>
          <dt>
            <Kbd>Y</Kbd> / <Kbd>N</Kbd>
          </dt>
          <dd>Setujui / tolak klip</dd>
        </dl>
      </Dialog>
      <Toaster />
    </div>
  );
}
