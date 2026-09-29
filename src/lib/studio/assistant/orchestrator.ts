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
  "run_connector mode=simulate creates local drafts and uses /simulate for draft previews (array of path/data streams). mode=execute uses /execute for published connectors and receives {block_number, block_hash, runner, particles}; retain the provenance. Choose the mode explicitly and do not claim a simulation is on-chain.",
  "deploy_connector prepares and publishes dependencies in order using the owner browser wallet on Sepolia. The owner approves transactions and pays test ETH gas. Creation POSTs alone only save drafts; mined publication may precede safe-block execution and indexing. Retry pending confirmations without sending again.",
  "The in-app MIDI world/runtime converts complete stream groups into a MIDI clip.",
  "MIDI world/runtime contract: pitch is an absolute MIDI note number 0..127; velocity is MIDI velocity 0..127; time is note start position in beats; duration is note length in beats and must be greater than 0.",
  "For MIDI, time=0 is valid, duration=0 is invalid, duration=1 means one beat, and missing pitch/time/duration/velocity values are not defaulted.",
  "MIDI world playback can use either the default analog synth preview or a Salamander Grand Piano sample preview.",
  "If users ask how to build MIDI connectors, guide them to output pitch, time, duration, and velocity streams in matching groups.",
  "Worlds are in-app Studio visualizers/runtimes attached to compatible deployed root connectors; legacy code may still call them plugins internally.",
  "For MusicXML Score World composition, use the format contract documented in musicxml-world-format-contract.md. Compatibility comes from accepted format hashes and semantic terminal scalar names, not from positional slot meanings.",
  "A basic note table must expose onset_tick, duration_tick, and pitch_midi streams under the same parent execution path. The same parent path plus the same array index is one note event.",
  "Build score examples with reusable value-generator connectors internally, but expose terminal scalar connectors named onset_tick, duration_tick, and pitch_midi. Optional terminal scalars include event_id, part, staff, voice, velocity_midi, dynamic_code, meter_time_tick, meter_beats, and meter_beat_type.",
  "For concrete score examples, give exact Studio operations that lead to semantic terminal output streams. Do not suggest old positional-score roots or terminal score_onset/score_pitch connector semantics.",
  "Do not suggest renamed copies of existing on-chain connectors such as constant_value, counter, major_scale_steps, or score collector archetypes. Prefer reusing deployed connectors with usage-specific RI values in the authored root context.",
  "A binding is not an edit to the reused connector. Protocol bindings attach to open slots of a composite occurrence, and static RI is keyed by the DFS RI position in the new root context. This is how one reused connector such as constant_value can appear many times in one root with different static RI starts.",
  "For concrete score examples, give exact Studio operations: connector to add, parent dimension, child slot, RI start, RI shift, and transformation list. Do not merely say that a connector should generate a target stream.",
  "Use protocol-native cyclic transformation sequences before inventing custom transformations. A dimension emits its current RI value, then applies transformations cyclically. Prefer a small reusable shaper vocabulary: constant_value uses RI start=value with add(0); counter uses RI start=first with add(1); quarter_tick_grid uses RI start=first onset tick with add(2520), because 2520 score ticks equals one quarter note; major_scale_steps leaves RI start open and uses transformations add(2), add(2), add(1), add(2), add(2), add(2), add(1). Reuse value-generator connectors internally, but expose semantic terminal scalar connectors for MusicXML-readable output. RI start chooses the major-scale tonic: 60 gives C major, 62 gives D major, 65 gives F major. Do not call the reusable shaper C major unless RI start is intentionally fixed to 60 in a wrapper/specialization.",
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
