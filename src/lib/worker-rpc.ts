/**
 * One request, one response. Each call gets its own worker so concurrent
 * calls cannot cross their replies; the worker is terminated when done.
 */
export async function callWorker<Request, Response>(
  createWorker: () => Worker,
  request: Request,
  transfer: Transferable[] = []
): Promise<Response> {
  const worker = createWorker();
  try {
    return await new Promise<Response>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<Response>) => resolve(event.data);
      worker.onerror = (event: ErrorEvent) =>
        reject(new Error(event.message === "" ? "worker failed" : event.message));
      worker.postMessage(request, transfer);
    });
  } finally {
    worker.terminate();
  }
}
