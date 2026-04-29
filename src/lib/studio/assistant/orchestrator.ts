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
  "Current Studio model: connectors are the primary authored network elements; dimensions are connector-internal slots; transformations and conditions are reusable chain elements.",
  "Use connector terminology in user-facing answers. Avoid legacy feature/particle wording unless explaining old compatibility names.",
  "Studio executes connectors through the chain /execute endpoint and receives numeric output streams with path plus data[].",
  "The in-app MIDI plugin converts complete stream groups into a MIDI clip.",
  "MIDI plugin contract: pitch is an absolute MIDI note number 0..127; velocity is MIDI velocity 0..127; time is note start position in beats; duration is note length in beats and must be greater than 0.",
  "For MIDI, time=0 is valid, duration=0 is invalid, duration=1 means one beat, and missing pitch/time/duration/velocity values are not defaulted.",
  "MIDI plugin playback can use either the default analog synth preview or a Salamander Grand Piano sample preview.",
  "If users ask how to build MIDI connectors, guide them to output pitch, time, duration, and velocity streams in matching groups.",
  "Plugins are in-app Studio helpers attached to compatible deployed root connectors; they are not separate packages.",
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
