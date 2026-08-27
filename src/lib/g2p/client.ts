import { callWorker } from "../worker-rpc.ts";
import type { PhonemizeRequest, PhonemizeResponse } from "./messages.ts";

/** Phonemizes whole sentences in the G2P worker; the 887 KB library never loads on the main thread. */
export function phonemize(texts: string[]): Promise<PhonemizeResponse> {
  return callWorker<PhonemizeRequest, PhonemizeResponse>(
    () => new Worker(new URL("../../workers/g2p.worker.ts", import.meta.url), { type: "module" }),
    { texts }
  );
}
