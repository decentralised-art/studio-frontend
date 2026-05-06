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
  "For Music Score composition, use the position schema documented in studio-music-score-position-schema.md. A score root's D1-D8 layers are Notes, Parts, Meter, Clefs, Tempo, Key, Articulations, and Slurs; semantic meaning comes from slot position, not from connector names under those slots.",
  "A Notes layer connects to one or more note tables. A NOTE_TABLE maps D1 onset_tick, D2 duration_tick, D3 pitch, D4 event_id, D5 part, D6 staff, D7 voice, and D8 dynamic_code; D1-D3 are required for pitched notes.",
  "Build score examples with ordinary reusable value-generator connectors under positional fields: root D1 -> note table or note set, note table D1 -> score_quarter_note_tick_grid, D2 -> constant_value, D3 -> major_scale_steps. Do not rely on removed template workflows or terminal score_onset/score_pitch connector semantics.",
  "For optional score layers, use the position schema slots directly: Parts D1 part and D2 staff_count; Meter D1 time_tick, D2 beats, D3 beat_type; Clefs D1 time_tick, D2 part, D3 staff, D4 clef_sign_code, D5 clef_line; Tempo D1 time_tick and D2 bpm; Key D1 time_tick, D2 fifths, D3 mode_code, D4 part.",
  "Do not suggest renamed copies of existing on-chain connectors such as constant_value, counter, major_scale_steps, or score collector archetypes. Prefer reusing deployed connectors with usage-specific RI values in the authored root context.",
  "A binding is not an edit to the reused connector. Protocol bindings attach to open slots of a composite occurrence, and static RI is keyed by the DFS RI position in the new root context. This is how one reused connector such as constant_value can appear many times in one root with different static RI starts.",
  "For concrete score examples, give exact Studio operations: connector to add, parent dimension, child slot, RI start, RI shift, and transformation list. Do not merely say that a connector should generate a target stream.",
  "Use protocol-native cyclic transformation sequences before inventing custom transformations. A dimension emits its current RI value, then applies transformations cyclically. Prefer a small reusable shaper vocabulary: constant_value uses RI start=value with add(0); counter uses RI start=first with add(1); score_quarter_note_tick_grid uses RI start=first onset tick with add(2520), because 2520 score ticks equals one quarter note; major_scale_steps leaves RI start open and uses transformations add(2), add(2), add(1), add(2), add(2), add(2), add(1). Reuse constant_value in many semantic contexts instead of inventing separate one-off constant connectors; the collector slot gives semantic meaning and the usage RI start gives the value. RI start chooses the major-scale tonic: 60 gives C major, 62 gives D major, 65 gives F major. Do not call the reusable shaper C major unless RI start is intentionally fixed to 60 in a wrapper/specialization.",
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
