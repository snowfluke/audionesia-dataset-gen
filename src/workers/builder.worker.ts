import type { BuildRequest, BuildResponse } from "../lib/corpus/builder-client.ts";
import { buildScripts } from "../lib/corpus/script-builder.ts";

self.onmessage = (event: MessageEvent<BuildRequest>) => {
  const result: BuildResponse = buildScripts(event.data.entries, event.data.options);
  self.postMessage(result, { transfer: [result.unitCounts.buffer] });
};
