import { describe, expect, it } from "vitest";
import { waitForFlowReady, type FlowLoadingSnapshot } from "../src/lib/studio/flowLoading";

const ready: FlowLoadingSnapshot = { measured: 2, total: 2, layoutPending: false, signature: "a" };
describe("flow loading readiness", () => {
  it("waits for measurements, queued layout and stable geometry before revealing the flow", async () => {
    const frames: FlowLoadingSnapshot[] = [
      { ...ready, measured: 0 },
      { ...ready, layoutPending: true },
      ready,
      { ...ready, signature: "moved" },
      { ...ready, signature: "moved" },
      { ...ready, signature: "moved" },
      { ...ready, signature: "moved" },
    ];
    let frame = -1;
    const states: FlowLoadingSnapshot[] = [];
    expect(
      await waitForFlowReady({
        signal: new AbortController().signal,
        isCurrent: () => true,
        nextFrame: async () => {
          frame++;
        },
        read: () => frames[frame] ?? ready,
        onProgress: (value) => states.push(value),
        now: () => frame * 16,
      }),
    ).toBe(true);
    expect(frame).toBe(6);
    expect(states).toEqual(frames);
  });
  it("never completes a cancelled load even when its measurements are ready", async () => {
    const controller = new AbortController();
    await expect(
      waitForFlowReady({
        signal: controller.signal,
        isCurrent: () => true,
        read: () => ready,
        nextFrame: async () => {
          controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("does not reveal a different tab or a superseding operation", async () => {
    let current = true;
    expect(
      await waitForFlowReady({
        signal: new AbortController().signal,
        isCurrent: () => current,
        read: () => ready,
        nextFrame: async () => {
          current = false;
        },
      }),
    ).toBe(false);
  });
  it("reports measurement failures rather than leaving an endless loader", async () => {
    let clock = 0;
    await expect(
      waitForFlowReady({
        signal: new AbortController().signal,
        isCurrent: () => true,
        read: () => ({ ...ready, measured: 0 }),
        nextFrame: async () => {
          clock += 10;
        },
        now: () => clock,
        timeoutMs: 25,
      }),
    ).rejects.toThrow("could not finish its layout");
  });
});
