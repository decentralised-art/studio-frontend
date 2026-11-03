import type { ConnectorTreeModel } from "./connectorTreeGraph";
import type { ConnectorTreeTask } from "./connectorTreeTask";

type GraphWorker = Pick<
  Worker,
  "addEventListener" | "removeEventListener" | "postMessage" | "terminate"
>;

/** One cancellable job, no auth/network access, no change to editor or RI semantics. */
export function loadConnectorTreeInBackground(
  task: ConnectorTreeTask,
  signal?: AbortSignal,
  createWorker: () => GraphWorker = () =>
    new Worker(new URL("./connectorTreeWorker.ts", import.meta.url), { type: "module" }),
): Promise<ConnectorTreeModel> {
  if (signal?.aborted)
    return Promise.reject(new DOMException("Connector loading cancelled.", "AbortError"));
  return new Promise((resolve, reject) => {
    let worker: GraphWorker;
    try {
      worker = createWorker();
    } catch (error) {
      reject(error);
      return;
    }
    let finished = false;
    const finish = (error?: unknown, graph?: ConnectorTreeModel) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", abort);
      worker.removeEventListener("message", message);
      worker.removeEventListener("error", failed);
      worker.removeEventListener("messageerror", failed);
      worker.terminate();
      if (error) reject(error);
      else resolve(graph!);
    };
    const abort = () => finish(new DOMException("Connector loading cancelled.", "AbortError"));
    const message = (event: MessageEvent) => {
      if (event.data?.ok && event.data.graph) finish(undefined, event.data.graph);
      else finish(new Error(event.data?.message || "Could not prepare connector graph."));
    };
    const failed = () =>
      finish(new Error("Background graph loading failed. Try opening the connector again."));
    worker.addEventListener("message", message);
    worker.addEventListener("error", failed);
    worker.addEventListener("messageerror", failed);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      worker.postMessage(task);
    } catch (error) {
      finish(error);
    }
  });
}
