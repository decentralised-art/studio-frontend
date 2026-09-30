import type {
  AddConnectorToFlowArgs,
  AddTransformationToDimensionArgs,
  AssistantExecutionResult,
  AssistantToolCall,
  ConnectConnectorsArgs,
  CreateConnectorArgs,
  DisconnectConnectorsArgs,
  InspectFlowArgs,
  RemoveTransformationFromDimensionArgs,
  RenameConnectorArgs,
  RunConnectorArgs,
  SelectConnectorArgs,
  SetConnectorRiModeArgs,
  SetConnectorRiValuesArgs,
} from "$lib/studio/assistant/types";

type AssistantRuntimeActionResult = {
  message: string;
  data?: unknown;
};

export type AssistantRuntimeBridge = {
  inspectFlow: (
    args: InspectFlowArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  selectConnector: (
    args: SelectConnectorArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  renameConnector: (
    args: RenameConnectorArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  addConnectorToFlow: (
    args: AddConnectorToFlowArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  connectConnectors: (
    args: ConnectConnectorsArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  disconnectConnectors: (
    args: DisconnectConnectorsArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  setConnectorRiMode: (
    args: SetConnectorRiModeArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  setConnectorRiValues: (
    args: SetConnectorRiValuesArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  addTransformationToDimension: (
    args: AddTransformationToDimensionArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  removeTransformationFromDimension: (
    args: RemoveTransformationFromDimensionArgs,
  ) => Promise<AssistantRuntimeActionResult> | AssistantRuntimeActionResult;
  runConnector: (args: RunConnectorArgs) => Promise<AssistantRuntimeActionResult>;
  createConnector: (args: CreateConnectorArgs) => Promise<AssistantRuntimeActionResult>;
  publishConnector: (args: CreateConnectorArgs) => Promise<AssistantRuntimeActionResult>;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Action failed.";
};

const asResult = (result: unknown, fallbackMessage: string): AssistantRuntimeActionResult => {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const typed = result as Partial<AssistantRuntimeActionResult>;
    if (typeof typed.message === "string" && typed.message.trim()) {
      return {
        message: typed.message,
        data: typed.data,
      };
    }
  }
  return {
    message: fallbackMessage,
    data: result,
  };
};

export const dispatchAssistantToolCall = async (
  call: AssistantToolCall,
  bridge: AssistantRuntimeBridge,
): Promise<AssistantExecutionResult> => {
  try {
    switch (call.tool_name) {
      case "inspect_flow": {
        const result = await bridge.inspectFlow(call.arguments);
        const normalized = asResult(result, "Flow inspected.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "select_connector": {
        const result = await bridge.selectConnector(call.arguments);
        const normalized = asResult(result, "Connector selected.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "rename_connector": {
        const result = await bridge.renameConnector(call.arguments);
        const normalized = asResult(result, "Connector renamed.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "add_connector_to_flow": {
        const result = await bridge.addConnectorToFlow(call.arguments);
        const normalized = asResult(result, "Connector added to flow.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "connect_connectors": {
        const result = await bridge.connectConnectors(call.arguments);
        const normalized = asResult(result, "Connectors linked.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "disconnect_connectors": {
        const result = await bridge.disconnectConnectors(call.arguments);
        const normalized = asResult(result, "Connector links removed.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "set_connector_ri_mode": {
        const result = await bridge.setConnectorRiMode(call.arguments);
        const normalized = asResult(result, "Connector RI mode updated.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "set_connector_ri_values": {
        const result = await bridge.setConnectorRiValues(call.arguments);
        const normalized = asResult(result, "Connector RI values updated.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "add_transformation_to_dimension": {
        const result = await bridge.addTransformationToDimension(call.arguments);
        const normalized = asResult(result, "Transformation added.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "remove_transformation_from_dimension": {
        const result = await bridge.removeTransformationFromDimension(call.arguments);
        const normalized = asResult(result, "Transformation removed.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "run_connector": {
        const result = await bridge.runConnector(call.arguments);
        const normalized = asResult(result, "Connector executed.");
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      case "create_connector":
      case "publish_connector": {
        const result = await (call.tool_name === "create_connector"
          ? bridge.createConnector(call.arguments)
          : bridge.publishConnector(call.arguments));
        const normalized = asResult(
          result,
          call.tool_name === "create_connector"
            ? "Connector created locally."
            : "Connector published on Sepolia.",
        );
        return {
          callId: call.id,
          toolName: call.tool_name,
          ok: true,
          message: normalized.message,
          data: normalized.data,
        };
      }
      default: {
        const unreachableTool = (call as { tool_name: string }).tool_name;
        return {
          callId: (call as { id: string }).id,
          toolName: unreachableTool as AssistantExecutionResult["toolName"],
          ok: false,
          message: `Unsupported tool '${unreachableTool}'.`,
        };
      }
    }
  } catch (error) {
    return {
      callId: call.id,
      toolName: call.tool_name,
      ok: false,
      message: toErrorMessage(error),
    };
  }
};
