/** Whisper expects 16 kHz mono float samples. */
export const ASR_SAMPLE_RATE = 16000;

export const ASR_MODELS = [
  "onnx-community/whisper-tiny",
  "onnx-community/whisper-base",
  "onnx-community/whisper-small",
] as const;
export type AsrModel = (typeof ASR_MODELS)[number];

export type AsrRequest =
  | { id: number; kind: "load"; model: AsrModel }
  | { id: number; kind: "transcribe"; samples: Float32Array<ArrayBuffer> };

export type AsrResponse =
  | { id: number; kind: "ready" }
  | { id: number; kind: "text"; text: string }
  | { id: number; kind: "error"; message: string }
  | { id: 0; kind: "progress"; file: string; percent: number };
