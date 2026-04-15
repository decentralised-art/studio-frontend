export type AssistantModelSettings = {
  endpoint: string;
  model: string;
  apiKey: string;
  temperature: number;
};

export type AssistantModelContext = Record<string, unknown>;

export type AssistantModelRequest = {
  settings: AssistantModelSettings;
  systemPrompt: string;
  userPrompt: string;
  context: AssistantModelContext;
};

export type AssistantResponseSchema = {
  name: string;
  schema: Record<string, unknown>;
};

export type AssistantStructuredModelRequest = {
  settings: AssistantModelSettings;
  systemPrompt: string;
  payload: Record<string, unknown>;
  responseSchema: AssistantResponseSchema;
};

const RESPONSE_CHAR_LIMIT = 40_000;
const ASSISTANT_ENVELOPE_JSON_SCHEMA = {
  name: "studio_assistant_envelope",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intent", "assistant_response", "thought_log", "tool_calls"],
    properties: {
      intent: {
        type: "string",
        enum: ["inspect", "edit", "run", "deploy", "mixed"],
      },
      assistant_response: {
        type: ["string", "null"],
      },
      thought_log: {
        type: "array",
        items: {
          type: "string",
        },
      },
      tool_calls: {
        type: "array",
        items: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "inspect_flow" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: [],
                  properties: {},
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "rename_connector" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector", "new_name"],
                  properties: {
                    connector: { type: ["string", "null"] },
                    new_name: { type: "string" },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: {
                  type: "string",
                  enum: ["select_connector", "add_connector_to_flow"],
                },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector"],
                  properties: {
                    connector: { type: "string" },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "connect_connectors" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["from_connector", "to_connector", "dimension", "relation"],
                  properties: {
                    from_connector: { type: "string" },
                    to_connector: { type: "string" },
                    dimension: { type: "integer" },
                    relation: {
                      type: ["string", "null"],
                      enum: ["composite", "binding", null],
                    },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "disconnect_connectors" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["from_connector", "to_connector", "dimension", "relation"],
                  properties: {
                    from_connector: { type: ["string", "null"] },
                    to_connector: { type: ["string", "null"] },
                    dimension: { type: ["integer", "null"] },
                    relation: {
                      type: ["string", "null"],
                      enum: ["composite", "binding", null],
                    },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "set_connector_ri_mode" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector", "mode"],
                  properties: {
                    connector: { type: "string" },
                    mode: { type: "string", enum: ["dynamic", "static"] },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "set_connector_ri_values" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector", "start_point", "transformation_shift"],
                  properties: {
                    connector: { type: "string" },
                    start_point: { type: "integer" },
                    transformation_shift: { type: "integer" },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "add_transformation_to_dimension" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector", "dimension", "transformation", "args"],
                  properties: {
                    connector: { type: "string" },
                    dimension: { type: "integer" },
                    transformation: { type: "string" },
                    args: {
                      type: ["array", "null"],
                      items: { type: "number" },
                    },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: {
                  type: "string",
                  const: "remove_transformation_from_dimension",
                },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector", "dimension", "transformation", "index"],
                  properties: {
                    connector: { type: "string" },
                    dimension: { type: "integer" },
                    transformation: { type: ["string", "null"] },
                    index: { type: ["integer", "null"] },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "run_connector" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector", "particles_count"],
                  properties: {
                    connector: { type: ["string", "null"] },
                    particles_count: { type: ["integer", "null"] },
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["id", "tool_name", "arguments"],
              properties: {
                id: { type: "string" },
                tool_name: { type: "string", const: "deploy_connector" },
                arguments: {
                  type: "object",
                  additionalProperties: false,
                  required: ["connector"],
                  properties: {
                    connector: { type: ["string", "null"] },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
} as const;

export const DEFAULT_ASSISTANT_MODEL_SETTINGS: Omit<AssistantModelSettings, "apiKey"> = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4.1-mini",
  temperature: 0.2,
};

const toErrorDetail = (payload: unknown): string => {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const directMessage = record.message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage.trim();
  }
  if (record.error && typeof record.error === "object") {
    const message = (record.error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "";
};

const extractCompletionContent = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Assistant endpoint returned an empty response.");
  }

  const root = payload as Record<string, unknown>;
  const choices = root.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("Assistant endpoint response does not include choices.");
  }

  const first = choices[0];
  if (!first || typeof first !== "object") {
    throw new Error("Assistant endpoint returned a malformed choice entry.");
  }

  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    throw new Error("Assistant endpoint returned a malformed message entry.");
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const item = part as Record<string, unknown>;
        if (typeof item.text === "string") return item.text;
        if (typeof item.content === "string") return item.content;
        return "";
      })
      .join("\n")
      .trim();
    if (text) return text;
  }

  throw new Error("Assistant endpoint did not return text content.");
};

export const callAssistantModel = async ({
  settings,
  systemPrompt,
  userPrompt,
  context,
}: AssistantModelRequest): Promise<string> => {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    throw new Error("Assistant API key is missing. Add it in Assistant settings.");
  }

  const endpoint = settings.endpoint.trim();
  if (!endpoint) {
    throw new Error("Assistant endpoint is missing.");
  }

  const model = settings.model.trim();
  if (!model) {
    throw new Error("Assistant model is missing.");
  }

  return callAssistantStructuredModel({
    settings: { ...settings, model, endpoint, apiKey },
    systemPrompt,
    responseSchema: {
      name: ASSISTANT_ENVELOPE_JSON_SCHEMA.name,
      schema: ASSISTANT_ENVELOPE_JSON_SCHEMA.schema as Record<string, unknown>,
    },
    payload: {
      prompt: userPrompt,
      context,
      rules: [
        "Return JSON only.",
        "Do not include prose outside JSON.",
        "Always include assistant_response for user-facing explanation.",
        "Always include thought_log as short execution-oriented steps.",
        "Use tool_calls to express every action.",
        "Use canonical argument names matching the schema.",
      ],
    },
  });
};

export const callAssistantStructuredModel = async ({
  settings,
  systemPrompt,
  payload,
  responseSchema,
}: AssistantStructuredModelRequest): Promise<string> => {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    throw new Error("Assistant API key is missing. Add it in Assistant settings.");
  }

  const endpoint = settings.endpoint.trim();
  if (!endpoint) {
    throw new Error("Assistant endpoint is missing.");
  }

  const model = settings.model.trim();
  if (!model) {
    throw new Error("Assistant model is missing.");
  }

  const requestBody = {
    model,
    temperature: settings.temperature,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: responseSchema.name,
        strict: true,
        schema: responseSchema.schema,
      },
    },
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(payload, null, 2),
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  let responsePayload: unknown = null;
  try {
    responsePayload = await response.json();
  } catch {
    responsePayload = null;
  }

  if (!response.ok) {
    const detail = toErrorDetail(responsePayload);
    const statusLine = `Assistant model call failed (${response.status}).`;
    throw new Error(detail ? `${statusLine} ${detail}` : statusLine);
  }

  const content = extractCompletionContent(responsePayload);
  if (content.length > RESPONSE_CHAR_LIMIT) {
    throw new Error("Assistant response is too large to process safely.");
  }

  return content;
};
