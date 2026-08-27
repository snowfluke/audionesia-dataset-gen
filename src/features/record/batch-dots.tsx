import type { JSX } from "@solidjs/web";
import { For } from "solid-js";

export type BatchDotsProps = { done: number; size: number };

/** Common Voice-style progress dots for the current batch. */
export default function BatchDots(props: BatchDotsProps): JSX.Element {
  return (
    <div
      class="ml-auto flex items-center gap-1"
      role="group"
      aria-label={`${props.done} dari ${props.size} klip batch ini selesai`}
    >
      <For each={Array.from({ length: props.size }, (_, i) => i)}>
        {(index) => (
          <span
            aria-current={index === props.done ? "step" : undefined}
            class={[
              "h-6 w-6 rounded-full text-center text-xs leading-6 ring ring-kumo-line",
              {
                "bg-kumo-contrast text-kumo-base": index < props.done,
                "text-kumo-subtle": index >= props.done,
                "ring-2 ring-kumo-focus": index === props.done,
              },
            ]}
          >
            {index + 1}
          </span>
        )}
      </For>
    </div>
  );
}
