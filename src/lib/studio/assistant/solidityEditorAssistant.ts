import {
  callAssistantStructuredModel,
  type AssistantModelSettings,
} from "$lib/studio/assistant/modelClient";

export type SolidityEditorAssistantTarget = "transformation" | "condition";

export type SolidityEditorAssistantRequest = {
  settings: AssistantModelSettings;
  target: SolidityEditorAssistantTarget;
  draftName: string;
  draftCode: string;
  userPrompt: string;
};

export type SolidityEditorAssistantResponse = {
  assistantResponse?: string;
  thoughtLog: string[];
  suggestedName?: string;
  code: string;
};

const SOLIDITY_EDITOR_RESPONSE_SCHEMA = {
  name: "studio_solidity_editor_assistant",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["assistant_response", "thought_log", "name", "code"],
    properties: {
      assistant_response: {
        type: ["string", "null"],
      },
      thought_log: {
        type: "array",
        items: {
          type: "string",
        },
      },
      name: {
        type: ["string", "null"],
      },
      code: {
        type: "string",
      },
    },
  },
} as const;

const TRANSFORMATION_SYSTEM_PROMPT = [
  "You are a Solidity code assistant for DCN transformation snippets.",
  "Return JSON only following the provided schema.",
  "The code field must contain ONLY the Solidity snippet body used inside run(x,args).",
  "Do NOT return full contracts, imports, markdown fences, comments outside code, or explanations in code.",
  "Transformation snippet must compile as body of: function run(uint32 x, uint32[] memory args) internal pure returns (uint32).",
  "Use x and args safely; always include a return statement.",
  "If user asks for guidance-only, keep code as close as possible to provided draft and explain in assistant_response.",
].join("\n");

const CONDITION_SYSTEM_PROMPT = [
  "You are a Solidity code assistant for DCN condition snippets.",
  "Return JSON only following the provided schema.",
  "The code field must contain ONLY the Solidity snippet body used inside check(args).",
  "Do NOT return full contracts, imports, markdown fences, comments outside code, or explanations in code.",
  "Condition snippet must compile as body of: function check(uint32[] memory args) internal pure returns (bool).",
  "Use args safely; always include a return statement.",
  "If user asks for guidance-only, keep code as close as possible to provided draft and explain in assistant_response.",
].join("\n");

const stripCodeFences = (code: string): string => {
  const trimmed = code.trim();
  const fenceMatch = trimmed.match(/^```(?:solidity)?\s*([\s\S]*?)\s*```$/i);
  if (!fenceMatch) return trimmed;
  return fenceMatch[1].trim();
};

const parseOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const requestSolidityEditorAssistant = async ({
  settings,
  target,
  draftName,
  draftCode,
  userPrompt,
}: SolidityEditorAssistantRequest): Promise<SolidityEditorAssistantResponse> => {
  const systemPrompt =
    target === "condition" ? CONDITION_SYSTEM_PROMPT : TRANSFORMATION_SYSTEM_PROMPT;

  const raw = await callAssistantStructuredModel({
    settings,
    systemPrompt,
    responseSchema: SOLIDITY_EDITOR_RESPONSE_SCHEMA,
    payload: {
      target,
      prompt: userPrompt,
      current_draft: {
        name: draftName,
        code: draftCode,
      },
      rules: [
        "Return JSON only.",
        "Provide concise assistant_response.",
        "Provide short thought_log execution steps.",
        "name may be null if unchanged.",
      ],
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Solidity assistant returned invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Solidity assistant returned an invalid response object.");
  }

  const record = parsed as Record<string, unknown>;
  const codeRaw = parseOptionalString(record.code);
  if (!codeRaw) {
    throw new Error("Solidity assistant response did not include a valid code snippet.");
  }

  const thoughtLog = Array.isArray(record.thought_log)
    ? record.thought_log
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

  return {
    assistantResponse: parseOptionalString(record.assistant_response),
    thoughtLog,
    suggestedName: parseOptionalString(record.name),
    code: stripCodeFences(codeRaw),
  };
};
