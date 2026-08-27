import { callWorker } from "../worker-rpc.ts";
import type { BuildResult, BuilderEntry, BuilderOptions } from "./script-builder.ts";

export type BuildRequest = { entries: BuilderEntry[]; options: BuilderOptions };
export type BuildResponse = BuildResult;

/** Runs the greedy script builder off the main thread. */
export function buildScriptsInWorker(request: BuildRequest): Promise<BuildResponse> {
  return callWorker<BuildRequest, BuildResponse>(
    () => new Worker(new URL("../../workers/builder.worker.ts", import.meta.url), { type: "module" }),
    request
  );
}
