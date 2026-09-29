import { describe, expect, it } from "vitest";
import {
  parseAssistantEnvelopeFromJson,
  parseAssistantToolCall,
  requiresToolConfirmation,
} from "../src/lib/studio/assistant/types";

describe("studio assistant tool envelope parsing", () => {
  it("preserves explicit local simulation and rejects unknown execution modes", () => {
    const call = parseAssistantToolCall(
      {
        id: "run",
        tool_name: "run_connector",
        arguments: { mode: "simulate", particles_count: 3 },
      },
      0,
    );
    expect(call.arguments).toMatchObject({ mode: "simulate", particles_count: 3 });
    expect(() =>
      parseAssistantToolCall(
        {
          id: "run",
          tool_name: "run_connector",
          arguments: { mode: "auto" },
        },
        0,
      ),
    ).toThrow(/mode/);
  });
  it("parses valid tool calls and marks high-risk confirmation", () => {
    const envelope = parseAssistantEnvelopeFromJson(
      JSON.stringify({
        intent: "edit",
        assistant_response: "I will add and connect the requested connectors.",
        thought_log: ["Inspect flow", "Add connector", "Connect connectors"],
        tool_calls: [
          {
            id: "a1",
            tool_name: "set_connector_ri_mode",
            arguments: {
              connector: "t0",
              mode: "static",
            },
          },
          {
            id: "a2",
            tool_name: "deploy_connector",
            arguments: {},
          },
        ],
      }),
    );

    expect(envelope.intent).toBe("edit");
    expect(envelope.assistant_response).toBe("I will add and connect the requested connectors.");
    expect(envelope.thought_log).toEqual(["Inspect flow", "Add connector", "Connect connectors"]);
    expect(envelope.tool_calls).toHaveLength(2);
    expect(envelope.tool_calls[0].tool_name).toBe("set_connector_ri_mode");
    expect(envelope.tool_calls[0].requires_confirmation).toBe(false);
    expect(envelope.tool_calls[1].tool_name).toBe("deploy_connector");
    expect(envelope.tool_calls[1].requires_confirmation).toBe(true);
    expect(requiresToolConfirmation("disconnect_connectors")).toBe(true);
  });

  it("rejects malformed envelope or malformed tool args", () => {
    expect(() => parseAssistantEnvelopeFromJson("{}")).toThrow("intent must be a string.");

    expect(() =>
      parseAssistantToolCall(
        {
          tool_name: "remove_transformation_from_dimension",
          arguments: {
            connector: "root",
            dimension: 1,
          },
        },
        0,
      ),
    ).toThrow("arguments.transformation or arguments.index is required.");
  });

  it("accepts common argument aliases from model output", () => {
    const envelope = parseAssistantEnvelopeFromJson(
      JSON.stringify({
        intent: "edit",
        tool_calls: [
          {
            id: "a3",
            tool_name: "set_connector_ri_values",
            arguments: {
              connector_name: "pitch",
              startPoint: 5,
              transformationShift: 0,
            },
          },
          {
            id: "a4",
            tool_name: "connect_connectors",
            arguments: {
              from: "TestConnector17",
              to: "pitch",
              slot: 0,
            },
          },
          {
            id: "a5",
            tool_name: "rename_connector",
            arguments: {
              id: "feature-root-abc123",
              newLabel: "switcher11890",
            },
          },
        ],
      }),
    );

    expect(envelope.tool_calls[0].tool_name).toBe("set_connector_ri_values");
    if (envelope.tool_calls[0].tool_name === "set_connector_ri_values") {
      expect(envelope.tool_calls[0].arguments.connector).toBe("pitch");
      expect(envelope.tool_calls[0].arguments.start_point).toBe(5);
      expect(envelope.tool_calls[0].arguments.transformation_shift).toBe(0);
    }

    expect(envelope.tool_calls[1].tool_name).toBe("connect_connectors");
    if (envelope.tool_calls[1].tool_name === "connect_connectors") {
      expect(envelope.tool_calls[1].arguments.from_connector).toBe("TestConnector17");
      expect(envelope.tool_calls[1].arguments.to_connector).toBe("pitch");
      expect(envelope.tool_calls[1].arguments.dimension).toBe(1);
    }

    expect(envelope.tool_calls[2].tool_name).toBe("rename_connector");
    if (envelope.tool_calls[2].tool_name === "rename_connector") {
      expect(envelope.tool_calls[2].arguments.connector).toBe("feature-root-abc123");
      expect(envelope.tool_calls[2].arguments.new_name).toBe("switcher11890");
    }
  });

  it("accepts compound intent values and normalizes to mixed", () => {
    const envelope = parseAssistantEnvelopeFromJson(
      JSON.stringify({
        intent: "inspect | edit",
        message: "I can inspect and edit this flow.",
        execution_log: ["Inspecting selected node"],
        tool_calls: [
          {
            id: "a5",
            tool_name: "inspect_flow",
            arguments: {},
          },
        ],
      }),
    );

    expect(envelope.intent).toBe("mixed");
    expect(envelope.assistant_response).toBe("I can inspect and edit this flow.");
    expect(envelope.thought_log).toEqual(["Inspecting selected node"]);
  });
});
