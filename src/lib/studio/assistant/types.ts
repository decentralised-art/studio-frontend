export type AssistantRiskLevel = "low" | "high";

export type AssistantIntent = "inspect" | "edit" | "run" | "deploy" | "mixed";

export const ASSISTANT_TOOL_NAMES = [
  "inspect_flow",
  "select_connector",
  "rename_connector",
  "add_connector_to_flow",
  "connect_connectors",
  "disconnect_connectors",
  "set_connector_ri_mode",
  "set_connector_ri_values",
  "add_transformation_to_dimension",
  "remove_transformation_from_dimension",
  "run_connector",
  "deploy_connector",
] as const;

export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

export type InspectFlowArgs = Record<string, never>;

export type SelectConnectorArgs = {
  connector: string;
};

export type AddConnectorToFlowArgs = {
  connector: string;
};

export type RenameConnectorArgs = {
  connector?: string;
  new_name: string;
};

export type ConnectConnectorsArgs = {
  from_connector: string;
  to_connector: string;
  dimension: number;
  relation?: "composite" | "binding";
};

export type DisconnectConnectorsArgs = {
  from_connector?: string;
  to_connector?: string;
  dimension?: number;
  relation?: "composite" | "binding";
};

export type SetConnectorRiModeArgs = {
  connector: string;
  mode: "dynamic" | "static";
};

export type SetConnectorRiValuesArgs = {
  connector: string;
  start_point: number;
  transformation_shift: number;
};

export type AddTransformationToDimensionArgs = {
  connector: string;
  dimension: number;
  transformation: string;
  args?: number[];
};

export type RemoveTransformationFromDimensionArgs = {
  connector: string;
  dimension: number;
  transformation?: string;
  index?: number;
};

export type RunConnectorArgs = {
  connector?: string;
  particles_count?: number;
};

export type DeployConnectorArgs = {
  connector?: string;
};

export type AssistantToolArgumentsByName = {
  inspect_flow: InspectFlowArgs;
  select_connector: SelectConnectorArgs;
  rename_connector: RenameConnectorArgs;
  add_connector_to_flow: AddConnectorToFlowArgs;
  connect_connectors: ConnectConnectorsArgs;
  disconnect_connectors: DisconnectConnectorsArgs;
  set_connector_ri_mode: SetConnectorRiModeArgs;
  set_connector_ri_values: SetConnectorRiValuesArgs;
  add_transformation_to_dimension: AddTransformationToDimensionArgs;
  remove_transformation_from_dimension: RemoveTransformationFromDimensionArgs;
  run_connector: RunConnectorArgs;
  deploy_connector: DeployConnectorArgs;
};

export type AssistantToolCallForName<Name extends AssistantToolName> = {
  id: string;
  tool_name: Name;
  arguments: AssistantToolArgumentsByName[Name];
  risk_level: AssistantRiskLevel;
  requires_confirmation: boolean;
};

export type AssistantToolCall = {
  [Name in AssistantToolName]: AssistantToolCallForName<Name>;
}[AssistantToolName];

export type AssistantEnvelope = {
  intent: AssistantIntent;
  assistant_response?: string;
  thought_log?: string[];
  tool_calls: AssistantToolCall[];
};

export type AssistantMessageRole = "system" | "user" | "assistant" | "tool" | "error";

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  text: string;
  at: number;
  toolCallId?: string;
  pendingConfirmationId?: string;
};

export type AssistantExecutionResult = {
  callId: string;
  toolName: AssistantToolName;
  ok: boolean;
  message: string;
  data?: unknown;
};

const HIGH_RISK_TOOLS = new Set<AssistantToolName>([
  "deploy_connector",
  "disconnect_connectors",
  "remove_transformation_from_dimension",
]);

const TOOL_NAME_SET = new Set<string>(ASSISTANT_TOOL_NAMES);

const toRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const INTENT_TOKEN_MAP = new Map<string, AssistantIntent>([
  ["inspect", "inspect"],
  ["inspection", "inspect"],
  ["explain", "inspect"],
  ["read", "inspect"],
  ["analyze", "inspect"],
  ["analyse", "inspect"],
  ["edit", "edit"],
  ["build", "edit"],
  ["create", "edit"],
  ["update", "edit"],
  ["modify", "edit"],
  ["run", "run"],
  ["execute", "run"],
  ["deploy", "deploy"],
  ["publish", "deploy"],
  ["mixed", "mixed"],
  ["multi", "mixed"],
  ["all", "mixed"],
]);

const parseAssistantIntent = (value: unknown): AssistantIntent => {
  if (typeof value !== "string") {
    throw new Error("intent must be a string.");
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error("intent cannot be empty.");
  }

  if (["inspect", "edit", "run", "deploy", "mixed"].includes(normalized)) {
    return normalized as AssistantIntent;
  }

  const tokens = normalized
    .split(/[\s|,/&+]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const mapped = tokens
    .map((token) => INTENT_TOKEN_MAP.get(token))
    .filter((token): token is AssistantIntent => Boolean(token));
  const unique = Array.from(new Set(mapped));

  if (!unique.length) {
    throw new Error(`Unsupported intent '${value}'.`);
  }

  if (unique.includes("mixed") || unique.length > 1) {
    return "mixed";
  }

  return unique[0];
};

const parseOptionalAssistantResponse = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error("assistant_response must be a string when provided.");
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const parseOptionalThoughtLog = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("thought_log must be an array of strings when provided.");
  }
  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length ? normalized : undefined;
};

const parseNonEmptyString = (
  value: unknown,
  field: string,
  { optional = false }: { optional?: boolean } = {},
): string | undefined => {
  if (value === undefined || value === null) {
    if (optional) return undefined;
    throw new Error(`${field} is required.`);
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (optional) return undefined;
    throw new Error(`${field} cannot be empty.`);
  }
  return trimmed;
};

const parseNonNegativeInt = (
  value: unknown,
  field: string,
  { optional = false, minimum = 0 }: { optional?: boolean; minimum?: number } = {},
): number | undefined => {
  if (value === undefined || value === null || value === "") {
    if (optional) return undefined;
    throw new Error(`${field} is required.`);
  }
  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber) || !Number.isInteger(asNumber) || asNumber < minimum) {
    const comparator = minimum > 0 ? `>= ${minimum}` : ">= 0";
    throw new Error(`${field} must be an integer ${comparator}.`);
  }
  return asNumber;
};

const parseNumberArray = (value: unknown, field: string): number[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of numbers.`);
  }
  return value.map((entry, index) => {
    const parsed = Number(entry);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${field}[${index}] must be a number.`);
    }
    return parsed;
  });
};

const getAliasedValue = (
  args: Record<string, unknown>,
  keys: string[],
  fallback?: unknown,
): unknown => {
  for (const key of keys) {
    if (key in args && args[key] !== undefined && args[key] !== null && args[key] !== "") {
      return args[key];
    }
  }
  return fallback;
};

const parseAliasedString = (
  args: Record<string, unknown>,
  keys: string[],
  field: string,
  options: { optional?: boolean } = {},
): string | undefined =>
  parseNonEmptyString(getAliasedValue(args, keys), field, {
    optional: options.optional,
  });

const parseAliasedInt = (
  args: Record<string, unknown>,
  keys: string[],
  field: string,
  options: { optional?: boolean; minimum?: number } = {},
): number | undefined =>
  parseNonNegativeInt(getAliasedValue(args, keys), field, {
    optional: options.optional,
    minimum: options.minimum,
  });

const parseAliasedDimension = (
  args: Record<string, unknown>,
  field: string,
  { optional = false }: { optional?: boolean } = {},
): number | undefined => {
  const raw = parseAliasedInt(
    args,
    ["dimension", "dim", "dimension_index", "slot", "dimension_slot"],
    field,
    { optional: true, minimum: 0 },
  );
  if (raw === undefined) {
    if (optional) return undefined;
    throw new Error(`${field} is required.`);
  }
  return raw === 0 ? 1 : raw;
};

const parseToolName = (value: unknown): AssistantToolName => {
  if (typeof value !== "string") {
    throw new Error("tool_name must be a string.");
  }
  const normalized = value.trim();
  if (!TOOL_NAME_SET.has(normalized)) {
    throw new Error(`Unsupported tool_name '${value}'.`);
  }
  return normalized as AssistantToolName;
};

export const getToolRiskLevel = (toolName: AssistantToolName): AssistantRiskLevel =>
  HIGH_RISK_TOOLS.has(toolName) ? "high" : "low";

export const requiresToolConfirmation = (toolName: AssistantToolName): boolean =>
  getToolRiskLevel(toolName) === "high";

export const summarizeToolCall = (toolCall: AssistantToolCall): string => {
  switch (toolCall.tool_name) {
    case "inspect_flow":
      return "Inspect current flow";
    case "select_connector":
      return `Select connector '${toolCall.arguments.connector}'`;
    case "rename_connector":
      return `Rename connector '${toolCall.arguments.connector ?? "selected connector"}' to '${toolCall.arguments.new_name}'`;
    case "add_connector_to_flow":
      return `Add connector '${toolCall.arguments.connector}' to flow`;
    case "connect_connectors":
      return `Connect '${toolCall.arguments.from_connector}' -> '${toolCall.arguments.to_connector}' (D${toolCall.arguments.dimension})`;
    case "disconnect_connectors":
      return "Disconnect matching connector link(s)";
    case "set_connector_ri_mode":
      return `Set RI mode for '${toolCall.arguments.connector}' to ${toolCall.arguments.mode}`;
    case "set_connector_ri_values":
      return `Set RI values for '${toolCall.arguments.connector}'`;
    case "add_transformation_to_dimension":
      return `Add '${toolCall.arguments.transformation}' to '${toolCall.arguments.connector}' D${toolCall.arguments.dimension}`;
    case "remove_transformation_from_dimension":
      return `Remove transformation from '${toolCall.arguments.connector}' D${toolCall.arguments.dimension}`;
    case "run_connector":
      return toolCall.arguments.connector
        ? `Run connector '${toolCall.arguments.connector}'`
        : "Run active connector";
    case "deploy_connector":
      return "Deploy active graph";
    default:
      return "Unknown action";
  }
};

const parseToolArguments = (
  toolName: AssistantToolName,
  rawArgs: unknown,
): AssistantToolArgumentsByName[AssistantToolName] => {
  const args = rawArgs === undefined ? {} : toRecord(rawArgs, "arguments");

  switch (toolName) {
    case "inspect_flow":
      return {};
    case "select_connector":
      return {
        connector:
          parseAliasedString(
            args,
            ["connector", "connector_name", "name", "target_connector"],
            "arguments.connector",
          ) ?? "",
      };
    case "add_connector_to_flow":
      return {
        connector:
          parseAliasedString(
            args,
            ["connector", "connector_name", "name", "source_connector"],
            "arguments.connector",
          ) ?? "",
      };
    case "rename_connector":
      return {
        connector: parseAliasedString(
          args,
          ["connector", "connector_name", "target_connector", "source_connector", "id"],
          "arguments.connector",
          { optional: true },
        ),
        new_name:
          parseAliasedString(
            args,
            ["new_name", "newName", "newLabel", "label", "new_label", "rename_to", "to"],
            "arguments.new_name",
          ) ?? "",
      };
    case "connect_connectors": {
      const relationRaw = parseAliasedString(
        args,
        ["relation", "kind", "type"],
        "arguments.relation",
        { optional: true },
      )?.toLowerCase();
      if (relationRaw && !["composite", "binding"].includes(relationRaw)) {
        throw new Error("arguments.relation must be 'composite' or 'binding'.");
      }
      return {
        from_connector:
          parseAliasedString(
            args,
            ["from_connector", "from", "source_connector", "source"],
            "arguments.from_connector",
          ) ?? "",
        to_connector:
          parseAliasedString(
            args,
            ["to_connector", "to", "target_connector", "target"],
            "arguments.to_connector",
          ) ?? "",
        dimension: parseAliasedDimension(args, "arguments.dimension", { optional: true }) ?? 1,
        relation: relationRaw as "composite" | "binding" | undefined,
      };
    }
    case "disconnect_connectors": {
      const relationRaw = parseAliasedString(
        args,
        ["relation", "kind", "type"],
        "arguments.relation",
        { optional: true },
      )?.toLowerCase();
      if (relationRaw && !["composite", "binding"].includes(relationRaw)) {
        throw new Error("arguments.relation must be 'composite' or 'binding'.");
      }
      return {
        from_connector: parseAliasedString(
          args,
          ["from_connector", "from", "source_connector", "source"],
          "arguments.from_connector",
          { optional: true },
        ),
        to_connector: parseAliasedString(
          args,
          ["to_connector", "to", "target_connector", "target"],
          "arguments.to_connector",
          { optional: true },
        ),
        dimension: parseAliasedDimension(args, "arguments.dimension", { optional: true }),
        relation: relationRaw as "composite" | "binding" | undefined,
      };
    }
    case "set_connector_ri_mode": {
      const modeRaw = parseAliasedString(args, ["mode", "ri_mode", "state"], "arguments.mode")
        ?.toLowerCase()
        .trim();
      const normalizedMode =
        modeRaw === "open" || modeRaw === "dynamic"
          ? "dynamic"
          : modeRaw === "locked" || modeRaw === "static"
            ? "static"
            : modeRaw;
      if (normalizedMode !== "dynamic" && normalizedMode !== "static") {
        throw new Error("arguments.mode must be 'dynamic' or 'static'.");
      }
      return {
        connector:
          parseAliasedString(
            args,
            ["connector", "connector_name", "name", "target_connector"],
            "arguments.connector",
          ) ?? "",
        mode: normalizedMode,
      };
    }
    case "set_connector_ri_values":
      return {
        connector:
          parseAliasedString(
            args,
            ["connector", "connector_name", "name", "target_connector"],
            "arguments.connector",
          ) ?? "",
        start_point:
          parseAliasedInt(args, ["start_point", "startPoint", "start"], "arguments.start_point", {
            optional: true,
            minimum: 0,
          }) ?? 0,
        transformation_shift:
          parseAliasedInt(
            args,
            ["transformation_shift", "transformationShift", "shift"],
            "arguments.transformation_shift",
            {
              optional: true,
              minimum: 0,
            },
          ) ?? 0,
      };
    case "add_transformation_to_dimension":
      return {
        connector:
          parseAliasedString(
            args,
            ["connector", "connector_name", "name", "target_connector"],
            "arguments.connector",
          ) ?? "",
        dimension: parseAliasedDimension(args, "arguments.dimension", { optional: true }) ?? 1,
        transformation:
          parseAliasedString(
            args,
            ["transformation", "transformation_name", "tx", "name"],
            "arguments.transformation",
          ) ?? "",
        args: parseNumberArray(args.args, "arguments.args"),
      };
    case "remove_transformation_from_dimension": {
      const parsedIndex = parseAliasedInt(args, ["index", "position"], "arguments.index", {
        optional: true,
        minimum: 1,
      });
      const transformation = parseAliasedString(
        args,
        ["transformation", "transformation_name", "tx", "name"],
        "arguments.transformation",
        {
          optional: true,
        },
      );
      if (!transformation && !parsedIndex) {
        throw new Error("arguments.transformation or arguments.index is required.");
      }
      return {
        connector:
          parseAliasedString(
            args,
            ["connector", "connector_name", "name", "target_connector"],
            "arguments.connector",
          ) ?? "",
        dimension: parseAliasedDimension(args, "arguments.dimension", { optional: true }) ?? 1,
        transformation,
        index: parsedIndex,
      };
    }
    case "run_connector":
      return {
        connector: parseAliasedString(
          args,
          ["connector", "connector_name", "name", "target_connector"],
          "arguments.connector",
          { optional: true },
        ),
        particles_count:
          parseAliasedInt(
            args,
            ["particles_count", "particlesCount", "n"],
            "arguments.particles_count",
            {
              optional: true,
              minimum: 1,
            },
          ) ?? undefined,
      };
    case "deploy_connector":
      return {
        connector: parseAliasedString(
          args,
          ["connector", "connector_name", "name", "target_connector"],
          "arguments.connector",
          { optional: true },
        ),
      };
    default:
      throw new Error(`Unsupported tool '${toolName}'.`);
  }
};

export const parseAssistantToolCall = (raw: unknown, index: number): AssistantToolCall => {
  const entry = toRecord(raw, `tool_calls[${index}]`);
  const toolName = parseToolName(entry.tool_name);
  const id =
    parseNonEmptyString(entry.id, `tool_calls[${index}].id`, { optional: true }) ??
    `tool-${index + 1}`;
  const args = parseToolArguments(toolName, entry.arguments);

  return {
    id,
    tool_name: toolName,
    arguments: args,
    risk_level: getToolRiskLevel(toolName),
    requires_confirmation: requiresToolConfirmation(toolName),
  } as AssistantToolCall;
};

export const parseAssistantEnvelopeFromJson = (jsonText: string): AssistantEnvelope => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Assistant response is not valid JSON.");
  }

  const root = toRecord(parsed, "assistant response");
  const intent = parseAssistantIntent(root.intent);
  const assistantResponse = parseOptionalAssistantResponse(
    root.assistant_response ?? root.response ?? root.message,
  );
  const thoughtLog = parseOptionalThoughtLog(root.thought_log ?? root.execution_log ?? root.log);

  if (!Array.isArray(root.tool_calls)) {
    throw new Error("tool_calls must be an array.");
  }

  const toolCalls = root.tool_calls.map((item, index) => parseAssistantToolCall(item, index));

  return {
    intent,
    assistant_response: assistantResponse,
    thought_log: thoughtLog,
    tool_calls: toolCalls,
  };
};
