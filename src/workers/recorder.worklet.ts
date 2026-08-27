// Globals of the AudioWorklet scope are declared in ./worklet-globals.d.ts.
export const RECORDER_PROCESSOR_NAME = "audionesia-recorder";

/** Forwards every 128-frame block of the first input channel to the main thread. */
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel !== undefined && channel.length > 0) {
      const block = new Float32Array(channel);
      this.port.postMessage(block, [block.buffer]);
    }
    return true;
  }
}

registerProcessor(RECORDER_PROCESSOR_NAME, RecorderProcessor);
