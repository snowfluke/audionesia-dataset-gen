import type { JSX } from "@solidjs/web";
import { Errored, Match, Show, Switch, createSignal } from "solid-js";

import type { HelpTopic } from "./app-help.tsx";
import HelpDialogs from "./app-help.tsx";
import Badge from "./components/badge.tsx";
import Banner from "./components/banner.tsx";
import Button from "./components/button.tsx";
import Tabs from "./components/tabs.tsx";
import Toaster, { attempt } from "./components/toast.tsx";
import ClipsView from "./features/clips/clips.view.tsx";
import DatasetView from "./features/dataset/dataset.view.tsx";
import { initLibrary, phase, progress } from "./features/library/library.store.ts";
import RecordView from "./features/record/record.view.tsx";
import ReviewView from "./features/review/review.view.tsx";
import { initSettings } from "./features/settings/settings.store.ts";
import SettingsView from "./features/settings/settings.view.tsx";
import HomeView from "./features/workspaces/home.view.tsx";
import { TABS, setTab, tab } from "./features/workspaces/navigation.store.ts";
import {
  closeWorkspace,
  currentWorkspace,
  initWorkspaces,
} from "./features/workspaces/workspaces.store.ts";
import WriteView from "./features/write/write.view.tsx";
import { applyTheme, currentTheme, nextTheme } from "./lib/theme.ts";

const REPO_URL = "https://github.com/snowfluke/audionesia-dataset-gen";
const THEME_LABELS = { system: "sistem", light: "terang", dark: "gelap" } as const;

export default function App(): JSX.Element {
  const initialTheme = currentTheme();
  const [theme, setTheme] = createSignal(initialTheme);
  const [help, setHelp] = createSignal<HelpTopic>("none");

  applyTheme(initialTheme);
  void attempt(async () => {
    await initSettings();
    await initWorkspaces();
    await initLibrary();
  });

  return (
    <div class="flex min-h-screen flex-col bg-kumo-canvas text-base text-kumo-default">
      <header class="flex flex-wrap items-center gap-4 border-b border-kumo-line bg-kumo-base px-6 py-3">
        <button type="button" class="flex flex-col text-left" onClick={closeWorkspace}>
          <span class="text-lg font-semibold text-kumo-strong">Audionesia Dataset Generator</span>
          <span class="text-xs text-kumo-subtle">
            Pembuat dataset suara untuk TTS bahasa Indonesia
          </span>
        </button>
        <Show when={currentWorkspace()}>
          {(workspace) => (
            <nav aria-label="Lokasi" class="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={closeWorkspace}>
                ← Semua dataset
              </Button>
              <span class="text-kumo-subtle">/</span>
              <span class="font-medium text-kumo-strong">{workspace().name}</span>
              <Badge>{workspace().speaker.name}</Badge>
            </nav>
          )}
        </Show>
        <div class="ml-auto flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            class="inline-flex h-8 items-center gap-1 rounded-md px-2 text-base text-kumo-default hover:bg-kumo-fill"
          >
            GitHub ↗
          </a>
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

      <Show when={currentWorkspace() !== null || phase() !== "ready"}>
        <nav class="flex items-center gap-4 border-b border-kumo-line bg-kumo-base px-6 py-2">
          <Show when={currentWorkspace() !== null}>
            <Tabs items={TABS} value={tab()} onChange={setTab} label="Bagian" />
          </Show>
          <Show when={phase() !== "ready"}>
            <span
              class={[
                "text-xs",
                {
                  "text-kumo-danger": phase() === "error",
                  "text-kumo-subtle": phase() !== "error",
                },
              ]}
            >
              {progress()}
            </span>
          </Show>
        </nav>
      </Show>

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
          <Show when={currentWorkspace() !== null} fallback={<HomeView />}>
            <Switch>
              <Match when={tab() === "record"}>
                <RecordView />
              </Match>
              <Match when={tab() === "review"}>
                <ReviewView />
              </Match>
              <Match when={tab() === "clips"}>
                <ClipsView />
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
          </Show>
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

      <HelpDialogs topic={help()} onClose={() => setHelp("none")} />
      <Toaster />
    </div>
  );
}
