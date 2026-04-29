import { describe, expect, it, vi } from "vitest";

const { callAssistantStructuredModelMock } = vi.hoisted(() => ({
  callAssistantStructuredModelMock: vi.fn(),
}));

vi.mock("../src/lib/studio/assistant/modelClient", () => ({
  callAssistantStructuredModel: callAssistantStructuredModelMock,
}));

import {
  buildSolidityEditorSystemPrompt,
  requestSolidityEditorAssistant,
} from "../src/lib/studio/assistant/solidityEditorAssistant";

describe("studio solidity editor assistant", () => {
  it("teaches transformation snippets the MIDI stream contract", () => {
    const prompt = buildSolidityEditorSystemPrompt("transformation");

    expect(prompt).toContain("pitch and velocity streams should use MIDI 0..127 values");
    expect(prompt).toContain("time and duration streams should use beat values");
    expect(prompt).toContain("duration must be greater than 0");
  });

  it("teaches condition snippets the current connector model", () => {
    const prompt = buildSolidityEditorSystemPrompt("condition");

    expect(prompt).toContain("conditions wrap connectors");
    expect(prompt).toContain("whether a connector outputs values");
  });

  it("parses assistant response and strips fenced code", async () => {
    callAssistantStructuredModelMock.mockResolvedValueOnce(
      JSON.stringify({
        assistant_response: "Updated clamp behavior.",
        thought_log: ["Understand request", "Apply safe range"],
        name: "clamp",
        code: "```solidity\nif (x < args[0]) return args[0];\nreturn x;\n```",
      }),
    );

    const result = await requestSolidityEditorAssistant({
      settings: {
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4.1-mini",
        apiKey: "k",
        temperature: 0.2,
      },
      target: "transformation",
      draftName: "identity",
      draftCode: "return x;",
      userPrompt: "make a basic clamp",
    });

    expect(result.assistantResponse).toBe("Updated clamp behavior.");
    expect(result.thoughtLog).toEqual(["Understand request", "Apply safe range"]);
    expect(result.suggestedName).toBe("clamp");
    expect(result.code).toBe("if (x < args[0]) return args[0];\nreturn x;");
  });

  it("throws when assistant returns invalid json", async () => {
    callAssistantStructuredModelMock.mockResolvedValueOnce("not-json");

    await expect(
      requestSolidityEditorAssistant({
        settings: {
          endpoint: "https://api.openai.com/v1/chat/completions",
          model: "gpt-4.1-mini",
          apiKey: "k",
          temperature: 0.2,
        },
        target: "condition",
        draftName: "in_range",
        draftCode: "return true;",
        userPrompt: "just test",
      }),
    ).rejects.toThrow("Solidity assistant returned invalid JSON.");
  });
});
