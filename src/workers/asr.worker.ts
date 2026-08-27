import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

import type { AsrRequest, AsrResponse } from "../lib/asr/messages.ts";

type ProgressEvent = { status: string; file?: string; progress?: number };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

function reply(response: AsrResponse): void {
  self.postMessage(response);
}

async function load(model: string): Promise<void> {
  // The library and its ONNX runtime only reach this worker's chunk, on first use.
  const transformers = await import("@huggingface/transformers");
  transformers.env.allowLocalModels = false;
  const hasWebGpu = "gpu" in navigator;
  transcriber = await transformers.pipeline("automatic-speech-recognition", model, {
    device: hasWebGpu ? "webgpu" : "wasm",
    progress_callback: (event: ProgressEvent) => {
      if (event.status === "progress" && event.file !== undefined && event.progress !== undefined) {
        reply({ id: 0, kind: "progress", file: event.file, percent: event.progress });
      }
    },
  });
}

self.onmessage = async (event: MessageEvent<AsrRequest>) => {
  const request = event.data;
  try {
    if (request.kind === "load") {
      await load(request.model);
      reply({ id: request.id, kind: "ready" });
      return;
    }
    if (transcriber === null) throw new Error("Model ASR belum dimuat");
    const output = await transcriber(request.samples, {
      language: "indonesian",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const text = Array.isArray(output) ? (output[0]?.text ?? "") : output.text;
    reply({ id: request.id, kind: "text", text });
  } catch (cause: unknown) {
    reply({
      id: request.id,
      kind: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
};
