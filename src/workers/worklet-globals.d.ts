// The AudioWorklet global scope is not part of lib.dom. Only the members the
// recorder worklet uses are declared here.
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  abstract process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;
