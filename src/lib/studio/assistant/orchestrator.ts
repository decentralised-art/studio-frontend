import { callAssistantModel, type AssistantModelSettings } from "$lib/studio/assistant/modelClient";
import {
  ASSISTANT_TOOL_NAMES,
  parseAssistantEnvelopeFromJson,
  summarizeToolCall,
  type AssistantEnvelope,
  type AssistantExecutionResult,
  type AssistantToolCall,
} from "$lib/studio/assistant/types";

export type AssistantTurnPlan = {
  envelope: AssistantEnvelope;
  rawResponse: string;
};

export type AssistantPlanInput = {
  prompt: string;
  context: Record<string, unknown>;
  settings: AssistantModelSettings;
};

const ASSISTANT_SYSTEM_PROMPT = [
  "You are the DCN Studio copilot and workflow guide.",
  "You must return only valid JSON with shape: { intent, assistant_response, thought_log, tool_calls }.",
  "assistant_response is concise natural language for the user.",
  "thought_log is a short step-by-step planning/execution preview.",
  "tool_calls is an array of tool call objects.",
  "Never include markdown, prose, or explanations outside JSON.",
  "Only use tool names from this list:",
  ASSISTANT_TOOL_NAMES.map((name) => `- ${name}`).join("\n"),
  "Arguments must follow each tool contract exactly.",
  "When the request is only informational/guidance, set tool_calls to [].",
  "When editing the flow, keep root connector context in mind and avoid contradictory edits.",
  "For rename requests, use rename_connector with { connector, new_name }.",
  "Prefer the smallest number of tool calls needed to satisfy the prompt.",
].join("\n");

export const buildAssistantSystemPrompt = (): string => ASSISTANT_SYSTEM_PROMPT;

export const planAssistantTurn = async ({
  prompt,
  context,
  settings,
}: AssistantPlanInput): Promise<AssistantTurnPlan> => {
  const rawResponse = await callAssistantModel({
    settings,
    systemPrompt: buildAssistantSystemPrompt(),
    userPrompt: prompt,
    context,
  });

  const envelope = parseAssistantEnvelopeFromJson(rawResponse);
  return {
    envelope,
    rawResponse,
  };
};

export type SplitAssistantToolCalls = {
  autoExecute: AssistantToolCall[];
  requiresConfirmation: AssistantToolCall[];
};

export const splitAssistantToolCallsByConfirmation = (
  toolCalls: AssistantToolCall[],
): SplitAssistantToolCalls => {
  const autoExecute: AssistantToolCall[] = [];
  const requiresConfirmation: AssistantToolCall[] = [];

  toolCalls.forEach((call) => {
    if (call.requires_confirmation) {
      requiresConfirmation.push(call);
      return;
    }
    autoExecute.push(call);
  });

  return { autoExecute, requiresConfirmation };
};

export const summarizeAssistantToolCalls = (toolCalls: AssistantToolCall[]): string => {
  if (!toolCalls.length) return "No actions proposed.";
  return toolCalls.map((call, index) => `${index + 1}. ${summarizeToolCall(call)}`).join("\n");
};

const summarizeExecutionResults = (results: AssistantExecutionResult[]): string =>
  results
    .map((result, index) => {
      const status = result.ok ? "ok" : "error";
      return `${index + 1}. ${status} · ${result.toolName} · ${result.message}`;
    })
    .join("\n");

export const buildAssistantRepairPrompt = ({
  originalPrompt,
  attemptedCalls,
  executionResults,
}: {
  originalPrompt: string;
  attemptedCalls: AssistantToolCall[];
  executionResults: AssistantExecutionResult[];
}): string => {
  const failed = executionResults.filter((result) => !result.ok);
  if (!failed.length) return originalPrompt;

  return [
    "Previous assistant action batch was partially unsuccessful.",
    "Produce only corrective next actions for unresolved failures.",
    "Do not repeat steps that already succeeded.",
    "",
    `Original user request: ${originalPrompt}`,
    "",
    "Attempted calls:",
    summarizeAssistantToolCalls(attemptedCalls),
    "",
    "Execution results:",
    summarizeExecutionResults(executionResults),
  ].join("\n");
};
