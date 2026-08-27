import type { JSX } from "@solidjs/web";
import { For, Loading, Show } from "solid-js";

import Badge from "../../components/badge.tsx";
import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import Kbd from "../../components/kbd.tsx";
import LayerCard from "../../components/layer-card.tsx";
import { attempt } from "../../components/toast.tsx";
import { formatCount, formatSeconds } from "../../lib/format.ts";
import { settings } from "../settings/settings.store.ts";
import { currentSpeakerId } from "../speakers/speakers.store.ts";
import { createReviewStore } from "./review.store.ts";

export default function ReviewView(): JSX.Element {
  const store = createReviewStore();
  return (
    <div class="flex flex-col gap-4">
      <Show when={currentSpeakerId() === null}>
        <Banner variant="alert">Pilih pembicara dulu untuk meninjau klipnya.</Banner>
      </Show>
      <p class="text-base text-kumo-subtle">
        Klik <Kbd>Spasi</Kbd> untuk memutar. Apakah naskahnya diucapkan dengan akurat dan bersih?
      </p>
      <Loading fallback={<p class="text-kumo-subtle">Memuat klip...</p>}>
        <Show
          when={store.current()}
          fallback={<Banner>Tidak ada klip yang menunggu tinjauan untuk pembicara ini.</Banner>}
        >
          {(clip) => (
            <LayerCard class="flex flex-col gap-4">
              <div class="flex items-center justify-between text-xs text-kumo-subtle">
                <span>
                  clip_{String(clip().seq).padStart(4, "0")} · {formatSeconds(clip().durationSec)} ·{" "}
                  {formatCount(store.pending().length)} menunggu
                </span>
                <Badge variant={clip().clipped ? "error" : "secondary"}>
                  Puncak {clip().peakDbfs.toFixed(1)} dBFS
                </Badge>
              </div>
              <p class="text-2xl leading-relaxed text-kumo-strong">{clip().text}</p>
              <Show when={settings().showPhonemes}>
                <p class="font-mono text-base text-kumo-subtle">{clip().phonemes}</p>
              </Show>
              <div class="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => attempt(store.play)}
                  disabled={store.playing()}
                >
                  {store.playing() ? "Memutar..." : "Putar"}
                </Button>
                <Button size="lg" onClick={() => attempt(() => store.decide("approved"))}>
                  Ya
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => attempt(() => store.decide("rejected"))}
                >
                  Tidak
                </Button>
                <Button variant="ghost" onClick={() => attempt(store.remove)}>
                  Hapus
                </Button>
                <div class="ml-auto flex items-center gap-1" aria-label="Kemajuan batch">
                  <For each={Array.from({ length: settings().batchSize }, (_, i) => i)}>
                    {(index) => (
                      <span
                        class={[
                          "h-6 w-6 rounded-full text-center text-xs leading-6 ring ring-kumo-line",
                          {
                            "bg-kumo-contrast text-kumo-base": index < store.batchDone(),
                            "text-kumo-subtle": index >= store.batchDone(),
                          },
                        ]}
                      >
                        {index + 1}
                      </span>
                    )}
                  </For>
                </div>
              </div>
              <p class="text-xs text-kumo-subtle">
                <Kbd>Y</Kbd> setujui · <Kbd>N</Kbd> tolak
              </p>
            </LayerCard>
          )}
        </Show>
      </Loading>
    </div>
  );
}
