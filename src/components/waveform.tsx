import type { JSX } from "@solidjs/web";
import { createEffect, createSignal } from "solid-js";

export type WaveformProps = {
  samples: Float32Array | null;
  /** CSS pixels; the canvas follows its container's width. */
  height?: number;
  label: string;
};

const DEFAULT_HEIGHT = 72;

function draw(canvas: HTMLCanvasElement, samples: Float32Array | null): void {
  const width = Math.max(1, Math.floor(canvas.clientWidth));
  const height = Math.max(1, Math.floor(canvas.clientHeight));
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (context === null) return;
  context.scale(scale, scale);
  context.clearRect(0, 0, width, height);
  const middle = height / 2;
  context.strokeStyle = getComputedStyle(canvas).color;
  context.globalAlpha = 0.35;
  context.beginPath();
  context.moveTo(0, middle);
  context.lineTo(width, middle);
  context.stroke();
  if (samples === null || samples.length === 0) return;
  context.globalAlpha = 1;
  context.lineWidth = 1;
  const perColumn = samples.length / width;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const start = Math.floor(x * perColumn);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((x + 1) * perColumn)));
    let low = 0;
    let high = 0;
    for (let i = start; i < end; i += 1) {
      const sample = samples[i] ?? 0;
      if (sample < low) low = sample;
      if (sample > high) high = sample;
    }
    context.moveTo(x + 0.5, middle - high * middle);
    context.lineTo(x + 0.5, middle - low * middle);
  }
  context.stroke();
}

/** Static min/max waveform of a take or clip, in the current text colour. */
export default function Waveform(props: WaveformProps): JSX.Element {
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>();
  createEffect(
    () => ({ element: canvas(), samples: props.samples }),
    ({ element, samples }) => {
      if (element !== undefined) draw(element, samples);
    }
  );
  return (
    <canvas
      ref={setCanvas}
      role="img"
      aria-label={props.label}
      class="w-full rounded-md bg-kumo-tint text-kumo-contrast"
      style={{ height: `${props.height ?? DEFAULT_HEIGHT}px` }}
    />
  );
}
