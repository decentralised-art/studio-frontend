import { describe, expect, it } from "vitest";
import {
  buildAssistantRepairPrompt,
  buildAssistantSystemPrompt,
  splitAssistantToolCallsByConfirmation,
  summarizeAssistantToolCalls,
} from "../src/lib/studio/assistant/orchestrator";
import { parseAssistantToolCall } from "../src/lib/studio/assistant/types";

describe("studio assistant orchestrator helpers", () => {
  it("teaches the assistant the current connector and MIDI plugin contracts", () => {
    const prompt = buildAssistantSystemPrompt();

    expect(prompt).toContain("connectors are the primary authored network elements");
    expect(prompt).toContain("pitch is an absolute MIDI note number 0..127");
    expect(prompt).toContain("velocity is MIDI velocity 0..127");
    expect(prompt).toContain("time is note start position in beats");
    expect(prompt).toContain("duration is note length in beats");
    expect(prompt).toContain("duration=0 is invalid");
    expect(prompt).toContain("Salamander Grand Piano sample preview");
    expect(prompt).toContain("not separate packages");
  });

  it("splits low/high risk calls for confirmation gate", () => {
    const calls = [
      parseAssistantToolCall(
        {
          id: "call-1",
          tool_name: "add_connector_to_flow",
          arguments: { connector: "t0" },
        },
        0,
      ),
      parseAssistantToolCall(
        {
          id: "call-2",
          tool_name: "disconnect_connectors",
          arguments: { from_connector: "t0", to_connector: "pitch" },
        },
        1,
      ),
    ];

    const split = splitAssistantToolCallsByConfirmation(calls);

    expect(split.autoExecute).toHaveLength(1);
    expect(split.requiresConfirmation).toHaveLength(1);
    expect(split.requiresConfirmation[0].tool_name).toBe("disconnect_connectors");
  });

  it("summarizes tool calls into numbered assistant plan", () => {
    const calls = [
      parseAssistantToolCall(
        {
          id: "call-1",
          tool_name: "inspect_flow",
          arguments: {},
        },
        0,
      ),
      parseAssistantToolCall(
        {
          id: "call-2",
          tool_name: "deploy_connector",
          arguments: {},
        },
        1,
      ),
    ];

    const summary = summarizeAssistantToolCalls(calls);

    expect(summary).toContain("1. Inspect current flow");
    expect(summary).toContain("2. Deploy active graph");
  });

  it("builds corrective repair prompt with failed execution details", () => {
    const calls = [
      parseAssistantToolCall(
        {
          id: "call-1",
          tool_name: "connect_connectors",
          arguments: {
            from_connector: "root",
            to_connector: "pitch",
            dimension: 1,
          },
        },
        0,
      ),
    ];

    const prompt = buildAssistantRepairPrompt({
      originalPrompt: "Connect root to pitch",
      attemptedCalls: calls,
      executionResults: [
        {
          callId: "call-1",
          toolName: "connect_connectors",
          ok: false,
          message: "Target connector 'pitch' not found.",
        },
      ],
    });

    expect(prompt).toContain("partially unsuccessful");
    expect(prompt).toContain("connect_connectors");
    expect(prompt).toContain("Target connector 'pitch' not found.");
  });
});
