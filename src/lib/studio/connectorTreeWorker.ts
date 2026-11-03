import { runConnectorTreeTask, type ConnectorTreeTask } from "./connectorTreeTask";

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ConnectorTreeTask>) => void) | null;
  postMessage: (value: unknown) => void;
};
scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({ ok: true, graph: runConnectorTreeTask(data) });
  } catch (error) {
    scope.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : "Could not prepare connector graph.",
    });
  }
};
