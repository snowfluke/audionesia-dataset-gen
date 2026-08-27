import type { AsrModel, AsrRequest, AsrResponse } from "./messages.ts";

type Pending = { resolve: (text: string) => void; reject: (cause: Error) => void };

/**
 * One long-lived worker holding the loaded Whisper model. Requests carry ids
 * so replies can be matched; `progress` messages report model downloads.
 */
let worker: Worker | null = null;
let loadedModel: AsrModel | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let onProgress: ((file: string, percent: number) => void) | null = null;

function ensureWorker(): Worker {
  if (worker !== null) return worker;
  worker = new Worker(new URL("../../workers/asr.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<AsrResponse>) => {
    const response = event.data;
    if (response.kind === "progress") {
      onProgress?.(response.file, response.percent);
      return;
    }
    const waiting = pending.get(response.id);
    if (waiting === undefined) return;
    pending.delete(response.id);
    if (response.kind === "error") waiting.reject(new Error(response.message));
    else waiting.resolve(response.kind === "text" ? response.text : "");
  };
  worker.onerror = (event: ErrorEvent) => {
    const cause = new Error(event.message === "" ? "ASR worker failed" : event.message);
    for (const waiting of pending.values()) waiting.reject(cause);
    pending.clear();
    terminateAsr();
  };
  return worker;
}

function send(request: AsrRequest, transfer: Transferable[] = []): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    pending.set(request.id, { resolve, reject });
    ensureWorker().postMessage(request, transfer);
  });
}

/** Loads the model once per worker; later calls with the same model return at once. */
export async function loadAsrModel(
  model: AsrModel,
  progress?: (file: string, percent: number) => void
): Promise<void> {
  if (loadedModel === model) return;
  if (loadedModel !== null) terminateAsr();
  onProgress = progress ?? null;
  const id = nextId;
  nextId += 1;
  await send({ id, kind: "load", model });
  loadedModel = model;
  onProgress = null;
}

/** Transcribes 16 kHz mono samples with the loaded model. */
export async function transcribe(samples: Float32Array<ArrayBuffer>): Promise<string> {
  if (loadedModel === null) throw new Error("Model ASR belum dimuat");
  const id = nextId;
  nextId += 1;
  return send({ id, kind: "transcribe", samples }, [samples.buffer]);
}

export function terminateAsr(): void {
  worker?.terminate();
  worker = null;
  loadedModel = null;
}
