import { describe, expect, it } from "vitest";

import {
  ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY,
  ASSISTANT_WELCOME_MESSAGE_READY,
  SOLIDITY_ASSISTANT_WELCOME_MESSAGE,
  buildAssistantConversationTitle,
  createAssistantConversation,
  createAssistantMessage,
  createPopupAssistantMessage,
  getAssistantWelcomeMessage,
  replaceAssistantWelcomeMessages,
} from "../src/lib/studio/assistant/conversationState";

describe("Studio assistant conversation state helpers", () => {
  it("selects welcome text from API key state", () => {
    expect(getAssistantWelcomeMessage("")).toBe(ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY);
    expect(getAssistantWelcomeMessage(" key ")).toBe(ASSISTANT_WELCOME_MESSAGE_READY);
    expect(SOLIDITY_ASSISTANT_WELCOME_MESSAGE).toContain("Solidity assistant ready");
  });

  it("builds concise titles from the first user message", () => {
    expect(
      buildAssistantConversationTitle([{ id: "1", at: 1, role: "system", text: "Ready" }]),
    ).toBe("New conversation");
    expect(
      buildAssistantConversationTitle([
        { id: "1", at: 1, role: "user", text: "  inspect this flow  " },
      ]),
    ).toBe("inspect this flow");
    expect(
      buildAssistantConversationTitle([
        {
          id: "1",
          at: 1,
          role: "user",
          text: "x".repeat(80),
        },
      ]),
    ).toHaveLength(59);
  });

  it("creates deterministic assistant messages and conversations for tests", () => {
    const ids = ["conv", "msg"];
    const idFactory = () => ids.shift() ?? "fallback";
    const conversation = createAssistantConversation({
      apiKey: "key",
      idFactory,
      now: () => 123,
    });

    expect(conversation.id).toBe("assistant-conv-conv");
    expect(conversation.createdAt).toBe(123);
    expect(conversation.messages).toEqual([
      {
        id: "assistant-msg-msg",
        at: 123,
        role: "system",
        text: ASSISTANT_WELCOME_MESSAGE_READY,
      },
    ]);

    expect(
      createAssistantMessage(
        { role: "tool", text: "Done", toolCallId: "call-1" },
        { idFactory: () => "tool", now: () => 456 },
      ),
    ).toEqual({
      id: "assistant-msg-tool",
      at: 456,
      role: "tool",
      text: "Done",
      toolCallId: "call-1",
    });
  });

  it("creates messages and conversations with default browser-safe factories", () => {
    expect(() => createAssistantConversation({ apiKey: "key" })).not.toThrow();
    expect(() => createAssistantMessage({ role: "assistant", text: "Ready" })).not.toThrow();
    expect(() => createPopupAssistantMessage("assistant", "Ready")).not.toThrow();
  });

  it("replaces only managed welcome messages", () => {
    expect(
      replaceAssistantWelcomeMessages(
        [
          { id: "1", at: 1, role: "system", text: ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY },
          { id: "2", at: 2, role: "system", text: "Custom instruction" },
          { id: "3", at: 3, role: "user", text: ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY },
        ],
        ASSISTANT_WELCOME_MESSAGE_READY,
      ),
    ).toEqual([
      { id: "1", at: 1, role: "system", text: ASSISTANT_WELCOME_MESSAGE_READY },
      { id: "2", at: 2, role: "system", text: "Custom instruction" },
      { id: "3", at: 3, role: "user", text: ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY },
    ]);
  });

  it("creates popup assistant messages", () => {
    expect(
      createPopupAssistantMessage("assistant", "Done", {
        idFactory: () => "1",
        now: () => 789,
      }),
    ).toEqual({
      id: "popup-assistant-msg-1",
      at: 789,
      role: "assistant",
      text: "Done",
    });
  });
});
