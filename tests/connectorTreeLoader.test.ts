import { describe, expect, it, vi } from "vitest";
import { loadConnectorTreeInBackground } from "../src/lib/studio/connectorTreeLoader";
import { runConnectorTreeTask, type ConnectorTreeTask } from "../src/lib/studio/connectorTreeTask";

const task: ConnectorTreeTask = {
  rootConnectorName: "phrase",
  idPrefix: "phrase",
  origin: { x: 360, y: 120 },
  labels: { phrase: "Phrase" },
  connectorRegistry: {
    pitch: {
      name: "pitch",
      dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
    },
    phrase: {
      name: "phrase",
      dimensions: [{ transformations: [], composite: "pitch", bindings: {} }],
      staticRi: { "2": { startPoint: 60, transformationShift: 0 } },
    },
  },
};
class FakeWorker extends EventTarget {
  terminate = vi.fn();
  postMessage = vi.fn();
  send(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}
const factory = (worker: FakeWorker) => () => worker as unknown as Worker;

describe("background connector loading", () => {
  it("returns the normal graph with its deterministic identities, binding and static RI data", async () => {
    const worker = new FakeWorker();
    const pending = loadConnectorTreeInBackground(task, undefined, factory(worker));
    const graph = runConnectorTreeTask(task);
    worker.send({ ok: true, graph });
    const loaded = await pending;
    expect(loaded.nodes.some((node) => node.data.label === "Phrase")).toBe(true);
    expect(loaded.nodes.some((node) => node.data.riLocked && node.data.riStart === 60)).toBe(true);
    expect(loaded.edges.length).toBeGreaterThan(0);
    expect(worker.postMessage).toHaveBeenCalledWith(task);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("terminates cancelled work and ignores its late reply", async () => {
    const worker = new FakeWorker(),
      controller = new AbortController();
    const pending = loadConnectorTreeInBackground(task, controller.signal, factory(worker));
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    worker.send({ ok: true, graph: runConnectorTreeTask(task) });
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("does not start a worker for an already cancelled owner/workspace request", async () => {
    const create = vi.fn(),
      controller = new AbortController();
    controller.abort();
    await expect(
      loadConnectorTreeInBackground(task, controller.signal, create),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(create).not.toHaveBeenCalled();
  });
  it("releases the worker on errors so a later load can retry", async () => {
    const worker = new FakeWorker();
    const pending = loadConnectorTreeInBackground(task, undefined, factory(worker));
    worker.send({ ok: false, message: "Invalid graph" });
    await expect(pending).rejects.toThrow("Invalid graph");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
