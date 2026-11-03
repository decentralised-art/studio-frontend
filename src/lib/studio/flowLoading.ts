export type FlowLoadingSnapshot = {
  measured: number;
  total: number;
  layoutPending: boolean;
  signature: string;
};

/** Yield through a paint, with cancellation even if the document stops drawing. */
export function nextFlowFrame(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      cancelAnimationFrame(frame);
      reject(signal.reason ?? new DOMException("Loading cancelled.", "AbortError"));
    };
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    });
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Read SvelteFlow's measurements, not DOM boxes, until layout survives three frames. */
export async function waitForFlowReady({
  signal,
  isCurrent,
  read,
  nextFrame = () => nextFlowFrame(signal),
  onProgress,
  now = () => performance.now(),
  timeoutMs = 30000,
}: {
  signal: AbortSignal;
  isCurrent: () => boolean;
  read: () => FlowLoadingSnapshot;
  nextFrame?: () => Promise<void>;
  onProgress?: (state: FlowLoadingSnapshot) => void;
  now?: () => number;
  timeoutMs?: number;
}): Promise<boolean> {
  const started = now();
  let previous = "",
    stableFrames = 0;
  while (isCurrent()) {
    signal.throwIfAborted();
    await nextFrame();
    signal.throwIfAborted();
    if (!isCurrent()) return false;
    const state = read();
    onProgress?.(state);
    const ready = state.measured === state.total && !state.layoutPending;
    stableFrames = ready && state.signature === previous ? stableFrames + 1 : 0;
    previous = state.signature;
    if (stableFrames >= 3) return true;
    if (now() - started > timeoutMs)
      throw new Error("The flow could not finish its layout. Reopen the tab to retry.");
  }
  return false;
}
