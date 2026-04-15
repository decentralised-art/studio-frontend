import { describe, expect, it, vi } from "vitest";
import {
  dispatchAssistantToolCall,
  type AssistantRuntimeBridge,
} from "../src/lib/studio/assistant/dispatcher";
import { parseAssistantToolCall } from "../src/lib/studio/assistant/types";

const createBridge = (): AssistantRuntimeBridge => ({
  inspectFlow: vi.fn().mockReturnValue({ message: "inspected" }),
  selectConnector: vi.fn().mockReturnValue({ message: "selected" }),
  renameConnector: vi.fn().mockReturnValue({ message: "renamed" }),
  addConnectorToFlow: vi.fn().mockReturnValue({ message: "added" }),
  connectConnectors: vi.fn().mockReturnValue({ message: "connected" }),
  disconnectConnectors: vi.fn().mockReturnValue({ message: "disconnected" }),
  setConnectorRiMode: vi.fn().mockReturnValue({ message: "mode" }),
  setConnectorRiValues: vi.fn().mockReturnValue({ message: "values" }),
  addTransformationToDimension: vi.fn().mockReturnValue({ message: "tx added" }),
  removeTransformationFromDimension: vi.fn().mockReturnValue({ message: "tx removed" }),
  runConnector: vi.fn().mockResolvedValue({ message: "ran" }),
  deployConnector: vi.fn().mockResolvedValue({ message: "deployed" }),
});

describe("studio assistant dispatcher", () => {
  it("dispatches tool calls through the runtime bridge", async () => {
    const bridge = createBridge();
    const toolCall = parseAssistantToolCall(
      {
        id: "tool-1",
        tool_name: "set_connector_ri_values",
        arguments: {
          connector: "root",
          start_point: 12,
          transformation_shift: 3,
        },
      },
      0,
    );

    const result = await dispatchAssistantToolCall(toolCall, bridge);

    expect(result.ok).toBe(true);
    expect(result.message).toBe("values");
    expect(bridge.setConnectorRiValues).toHaveBeenCalledWith({
      connector: "root",
      start_point: 12,
      transformation_shift: 3,
    });
  });

  it("dispatches rename connector calls through the runtime bridge", async () => {
    const bridge = createBridge();
    const toolCall = parseAssistantToolCall(
      {
        id: "tool-rename",
        tool_name: "rename_connector",
        arguments: {
          connector: "feature-root-02fd7c80-6006-4c6c-ad82-668b1100db0e",
          new_name: "switcher11890",
        },
      },
      0,
    );

    const result = await dispatchAssistantToolCall(toolCall, bridge);

    expect(result.ok).toBe(true);
    expect(result.message).toBe("renamed");
    expect(bridge.renameConnector).toHaveBeenCalledWith({
      connector: "feature-root-02fd7c80-6006-4c6c-ad82-668b1100db0e",
      new_name: "switcher11890",
    });
  });

  it("normalizes bridge failures into failed execution result", async () => {
    const bridge = createBridge();
    bridge.deployConnector = vi.fn().mockRejectedValue(new Error("deploy blocked"));
    const toolCall = parseAssistantToolCall(
      {
        id: "tool-2",
        tool_name: "deploy_connector",
        arguments: {},
      },
      0,
    );

    const result = await dispatchAssistantToolCall(toolCall, bridge);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("deploy blocked");
  });
});
