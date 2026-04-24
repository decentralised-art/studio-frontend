import type { AssistantMessage, AssistantToolCall } from "./types";

export const ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY =
  "Studio assistant ready. Add API key in settings to enable actionable copilot mode.";
export const ASSISTANT_WELCOME_MESSAGE_READY =
  "Studio assistant ready. Ask me to inspect, edit, run, or deploy your flow.";
export const SOLIDITY_ASSISTANT_WELCOME_MESSAGE =
  "Solidity assistant ready. Ask for code edits or guidance; accepted edits are applied directly to this draft.";

export type AssistantPendingConfirmation = {
  id: string;
  calls: AssistantToolCall[];
  createdAt: number;
  summary: string;
};

export type AssistantConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AssistantMessage[];
  pendingConfirmation: AssistantPendingConfirmation | null;
  lastError: string | null;
};

export type PopupAssistantMessage = {
  id: string;
  at: number;
  role: "system" | "user" | "assistant" | "error";
  text: string;
};

export type AssistantMessageDraft = Omit<AssistantMessage, "id" | "at"> &
  Partial<Pick<AssistantMessage, "id" | "at">>;

type FactoryOptions = {
  idFactory?: () => string;
  now?: () => number;
};

const createRandomId = () => crypto.randomUUID();
const getNow = () => Date.now();

export const getAssistantWelcomeMessage = (apiKey: string) =>
  apiKey.trim() ? ASSISTANT_WELCOME_MESSAGE_READY : ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY;

export const isAssistantWelcomeMessage = (text: string) =>
  text === ASSISTANT_WELCOME_MESSAGE_NEEDS_KEY || text === ASSISTANT_WELCOME_MESSAGE_READY;

export const buildAssistantConversationTitle = (messages: AssistantMessage[]): string => {
  const firstUser = messages.find((message) => message.role === "user");
  const seed = firstUser?.text?.trim();
  if (!seed) return "New conversation";
  return seed.length > 56 ? `${seed.slice(0, 56).trim()}...` : seed;
};

export const createAssistantMessage = (
  message: AssistantMessageDraft,
  options: FactoryOptions & { idPrefix?: string } = {},
): AssistantMessage => {
  const idFactory = options.idFactory ?? createRandomId;
  const now = options.now ?? getNow;
  return {
    id: message.id ?? `${options.idPrefix ?? "assistant-msg"}-${idFactory()}`,
    at: message.at ?? now(),
    role: message.role,
    text: message.text,
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.pendingConfirmationId
      ? { pendingConfirmationId: message.pendingConfirmationId }
      : {}),
  };
};

export const createAssistantConversation = ({
  apiKey,
  idFactory = createRandomId,
  now = getNow,
}: FactoryOptions & { apiKey: string }): AssistantConversation => {
  const createdAt = now();
  return {
    id: `assistant-conv-${idFactory()}`,
    title: "New conversation",
    createdAt,
    updatedAt: createdAt,
    messages: [
      createAssistantMessage(
        {
          at: createdAt,
          role: "system",
          text: getAssistantWelcomeMessage(apiKey),
        },
        { idFactory, now, idPrefix: "assistant-msg" },
      ),
    ],
    pendingConfirmation: null,
    lastError: null,
  };
};

export const replaceAssistantWelcomeMessages = (
  messages: AssistantMessage[],
  nextWelcome: string,
): AssistantMessage[] =>
  messages.map((message) =>
    message.role === "system" && isAssistantWelcomeMessage(message.text)
      ? { ...message, text: nextWelcome }
      : message,
  );

export const createPopupAssistantMessage = (
  role: PopupAssistantMessage["role"],
  text: string,
  options: FactoryOptions = {},
): PopupAssistantMessage => {
  const idFactory = options.idFactory ?? createRandomId;
  const now = options.now ?? getNow;
  return {
    id: `popup-assistant-msg-${idFactory()}`,
    at: now(),
    role,
    text,
  };
};
