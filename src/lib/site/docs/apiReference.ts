// View models for the API reference page. The chain API part is read from the bundled
// OpenAPI document in chain-openapi.json, generated from decentralised-art/api-spec with the
// SDK's bundler:
//   node sdk/js/scripts/bundle-openapi.mjs --spec-root api-spec --output chain-openapi.json
// (then minified). Regenerate it whenever api-spec changes.
import spec from "$lib/site/docs/chain-openapi.json";

export type Auth = "none" | "chain" | "session" | "session-owner";

export type FieldRow = {
  name: string;
  type: string;
  /** Name of a documented schema the type refers to, for linking. */
  ref?: string;
  required: boolean;
  description: string;
  depth: number;
  location?: "path" | "query";
};

export type ApiResponse = { status: string; description: string; type?: string; ref?: string };

export type Endpoint = {
  id: string;
  method: "GET" | "HEAD" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  auth: Auth;
  also?: string;
  params: FieldRow[];
  body?: { contentType: string; fields: FieldRow[]; ref?: string };
  responses: ApiResponse[];
  example?: {
    request: string;
    response?: string;
    responseLang?: "json" | "bash";
    illustrative?: boolean;
  };
};

export type EndpointGroup = { id: string; title: string; intro: string; endpoints: Endpoint[] };

type Schema = {
  $ref?: string;
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  additionalProperties?: boolean | Schema;
  enum?: (string | number)[];
  oneOf?: Schema[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  nullable?: boolean;
  default?: unknown;
};

type Operation = {
  summary?: string;
  description?: string;
  security?: unknown[];
  parameters?: {
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: Schema;
  }[];
  requestBody?: { content: Record<string, { schema: Schema }> };
  responses: Record<
    string,
    { description?: string; content?: Record<string, { schema?: Schema }> }
  >;
};

type OpenApi = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
};

const openApi = spec as unknown as OpenApi;
const schemas = openApi.components.schemas;

export const CHAIN_BASE = "https://api.decentralised.art/chain";
export const SERVICES_BASE = "https://api.decentralised.art/services";

const refName = (schema?: Schema) => schema?.$ref?.split("/").pop();

const clean = (text?: string) => (text ?? "").replace(/\s+/g, " ").trim();

/** Short human-readable type, plus the schema it links to when there is one. */
export const describeType = (schema: Schema | undefined): { type: string; ref?: string } => {
  if (!schema) return { type: "" };
  const ref = refName(schema);
  if (ref) {
    const target = schemas[ref];
    // Named scalars (Address, Hash32, EntityName, …) read better as their base type.
    if (target && target.type && target.type !== "object" && !target.oneOf && !target.enum) {
      return { type: `${target.type} (${ref})`, ref };
    }
    return { type: ref, ref };
  }
  if (schema.oneOf) {
    const parts = schema.oneOf.map((option) => describeType(option));
    return {
      type: parts.map((part) => part.type).join(" or "),
      ref: parts.find((part) => part.ref)?.ref,
    };
  }
  if (schema.enum) return { type: schema.enum.map((value) => JSON.stringify(value)).join(" | ") };
  if (schema.type === "array") {
    const item = describeType(schema.items);
    return { type: `array of ${item.type}`, ref: item.ref };
  }
  if (
    schema.type === "object" &&
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
  ) {
    const value = describeType(schema.additionalProperties);
    return { type: `map of ${value.type}`, ref: value.ref };
  }
  const format = schema.format ? ` (${schema.format})` : "";
  return { type: `${schema.type ?? "any"}${format}${schema.nullable ? ", nullable" : ""}` };
};

const constraints = (schema: Schema | undefined, description = ""): string => {
  if (!schema) return "";
  const target = refName(schema) ? schemas[refName(schema)!] : schema;
  if (!target) return "";
  const notes: string[] = [];
  if (target.minimum !== undefined && target.maximum !== undefined)
    notes.push(`${target.minimum}–${target.maximum}`);
  else if (target.minimum !== undefined) notes.push(`≥ ${target.minimum}`);
  if (target.maxLength !== undefined) notes.push(`up to ${target.maxLength} characters`);
  if (target.default !== undefined) notes.push(`default ${JSON.stringify(target.default)}`);
  // Leave out what the description already says (for example "at most 128 characters").
  const fresh = notes.filter((note) => {
    const numbers = note.match(/\d+/g) ?? [];
    return !numbers.length || !numbers.every((number) => description.includes(number));
  });
  return fresh.length ? ` (${fresh.join(", ")})` : "";
};

/** Field rows for an object schema; inline object properties are expanded one level down. */
export const schemaFields = (schema: Schema | undefined, depth = 0): FieldRow[] => {
  if (!schema) return [];
  const target = refName(schema) ? schemas[refName(schema)!] : schema;
  if (!target?.properties) return [];
  const required = new Set(target.required ?? []);
  return Object.entries(target.properties).flatMap(([name, property]) => {
    const { type, ref } = describeType(property);
    const description =
      clean(property.description) || clean(ref ? schemas[ref]?.description : "") || "";
    const row: FieldRow = {
      name,
      type,
      ref: ref && schemas[ref]?.properties ? ref : undefined,
      required: required.has(name),
      description: description + constraints(property, description),
      depth,
    };
    const inline = !property.$ref && property.type === "object" && property.properties;
    return inline && depth < 2 ? [row, ...schemaFields(property, depth + 1)] : [row];
  });
};

/** Every object schema in the chain specification, for the schema reference. */
export const chainSchemas = Object.entries(schemas)
  .filter(([, schema]) => schema.properties || schema.oneOf)
  .map(([name, schema]) => ({
    name,
    description: clean(schema.description),
    oneOf: schema.oneOf?.map((option) => refName(option) ?? ""),
    fields: schemaFields(schema),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const chainOperation = (
  method: "GET" | "HEAD" | "POST",
  path: string,
  extra: Partial<Endpoint> = {},
): Endpoint => {
  const operation = openApi.paths[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`Missing ${method} ${path} in chain-openapi.json`);
  const params: FieldRow[] = (operation.parameters ?? []).map((parameter) => ({
    name: parameter.name,
    ...describeType(parameter.schema),
    ref: undefined,
    required: Boolean(parameter.required),
    description:
      clean(parameter.description) + constraints(parameter.schema, clean(parameter.description)),
    depth: 0,
    location: parameter.in as "path" | "query",
  }));
  const bodySchema = operation.requestBody?.content["application/json"]?.schema;
  const responses: ApiResponse[] = Object.entries(operation.responses).map(([status, response]) => {
    const content = Object.values(response.content ?? {})[0];
    const described = describeType(content?.schema);
    return {
      status,
      description: clean(response.description),
      type: described.type,
      ref: described.ref,
    };
  });
  return {
    id: `${method.toLowerCase()}-${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`,
    method,
    path,
    summary: clean(operation.summary),
    description: clean(operation.description),
    auth: operation.security?.length ? "chain" : "none",
    params,
    body: bodySchema
      ? {
          contentType: "application/json",
          fields: schemaFields(bodySchema),
          ref: refName(bodySchema),
        }
      : undefined,
    responses,
    ...extra,
  };
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

const curlGet = (path: string) => `curl ${CHAIN_BASE}${path}`;
const curlPost = (path: string, body: unknown, token = false) =>
  `curl -X POST ${CHAIN_BASE}${path} \\\n  -H "Content-Type: application/json" \\${token ? '\n  -H "Authorization: Bearer $TOKEN" \\' : ""}\n  -d '${JSON.stringify(body)}'`;

const OWNER = "fa71ff2394596f824d69961293d095a50d322e4e";
const FORMAT = "4e5aa46feeb2db48b7df17d424f29bfdee2ccbfdf2433a99da6be58d3c9e3101";
const HASH = "0x5d3f…c41a";
const TX = "0x8b21…77e0";

export const chainGroups: EndpointGroup[] = [
  {
    id: "chain-core",
    title: "Core",
    intro: "Server version information.",
    endpoints: [
      chainOperation("GET", "/version", {
        example: {
          request: curlGet("/version"),
          response: json({ build_timestamp: "2026-10-01 11:42:09 UTC", version: "0.4.0" }),
        },
      }),
    ],
  },
  {
    id: "chain-auth",
    title: "Authentication",
    intro:
      "Creating and publishing need a bearer token. Ask for a nonce, sign the message Login nonce: <nonce> with the account (EIP-191 personal_sign) and exchange the signature for an access token. Tokens are valid for five minutes.",
    endpoints: [
      chainOperation("GET", "/nonce/{address}", {
        example: {
          request: curlGet("/nonce/0xYourAddress"),
          response: json({ nonce: "827334" }),
          illustrative: true,
        },
      }),
      chainOperation("POST", "/auth", {
        example: {
          request: curlPost("/auth", {
            address: "0xYourAddress",
            message: "Login nonce: 827334",
            signature: "0x…",
          }),
          response: json({ access_token: "eyJhbGciOiJIUzI1NiIs…" }),
          illustrative: true,
        },
      }),
    ],
  },
  {
    id: "chain-accounts",
    title: "Accounts",
    intro: "Addresses that own published operations, and what each one owns.",
    endpoints: [
      chainOperation("GET", "/accounts", {
        also: "HEAD /accounts checks the same query without a body.",
        example: {
          request: curlGet("/accounts?limit=50"),
          response: json({
            accounts: [OWNER],
            cursor: { has_more: false, next_after: null },
            limit: 50,
            total_accounts: 1,
          }),
        },
      }),
      chainOperation("GET", "/account/{address}", {
        example: {
          request: curlGet(`/account/${OWNER}?limit=50`),
          response: json({
            address: OWNER,
            owned_connectors: ["pitch"],
            owned_transformations: ["add"],
            owned_conditions: [],
            cursor_connectors: { has_more: false, next_after: null },
            cursor_transformations: { has_more: false, next_after: null },
            cursor_conditions: { has_more: false, next_after: null },
            limit: 50,
          }),
        },
      }),
    ],
  },
  {
    id: "chain-connectors",
    title: "Connectors",
    intro:
      'Read a connector by name, or create one as your draft. A draft reports address "0x0" until it is published.',
    endpoints: [
      chainOperation("GET", "/connector/{name}", {
        also: "HEAD /connector/{name} answers 200 or 404 without a body.",
        example: {
          request: curlGet("/connector/pitch"),
          response: json({
            name: "pitch",
            dimensions: [
              { transformations: [{ name: "add", args: [1] }], composite: "", bindings: {} },
            ],
            condition_name: "",
            condition_args: [],
            static_ri: {},
            owner: OWNER,
            address: "0xee5fc0669ae1c9f12db4ef0c216ae387fbede644",
            format_hash: FORMAT,
          }),
        },
      }),
      chainOperation("POST", "/connector", {
        example: {
          request: curlPost(
            "/connector",
            {
              name: "rising_line",
              dimensions: [
                {
                  transformations: [
                    { name: "add", args: [1] },
                    { name: "shift_up", args: [2] },
                  ],
                },
              ],
              condition_name: "positive_only",
              condition_args: [1],
            },
            true,
          ),
          response: json({
            name: "rising_line",
            owner: "0xyouraddress…",
            address: "0x0",
            format_hash: "…",
          }),
          illustrative: true,
        },
      }),
    ],
  },
  {
    id: "chain-transformations",
    title: "Transformations",
    intro:
      "sol_src is the body of function run(uint32 x, uint32[] args) returns (uint32); args_count is derived from the highest args[i] it uses. Solidity source is never returned.",
    endpoints: [
      chainOperation("GET", "/transformation/{name}", {
        also: "HEAD /transformation/{name} answers 200 or 404 without a body.",
        example: {
          request: curlGet("/transformation/add"),
          response: json({
            name: "add",
            args_count: 1,
            owner: OWNER,
            address: "0xa112a62768ec809c50a66a6efc16cb9dd9545d03",
          }),
        },
      }),
      chainOperation("POST", "/transformation", {
        example: {
          request: curlPost(
            "/transformation",
            { name: "shift_up", sol_src: "return x + args[0];" },
            true,
          ),
          response: json({
            name: "shift_up",
            owner: "0xyouraddress…",
            address: "0x0",
            args_count: 1,
          }),
          illustrative: true,
        },
      }),
    ],
  },
  {
    id: "chain-conditions",
    title: "Conditions",
    intro:
      "sol_src is the body of function check(int32[] args) view returns (bool). A connector stops with ConditionNotMet when its condition returns false.",
    endpoints: [
      chainOperation("GET", "/condition/{name}", {
        also: "HEAD /condition/{name} answers 200 or 404 without a body.",
        example: {
          request: curlGet("/condition/positive_only"),
          response: json({ name: "positive_only", args_count: 1, owner: OWNER, address: "0x…" }),
          illustrative: true,
        },
      }),
      chainOperation("POST", "/condition", {
        example: {
          request: curlPost(
            "/condition",
            { name: "positive_only", sol_src: "return args[0] > 0;" },
            true,
          ),
          response: json({
            name: "positive_only",
            owner: "0xyouraddress…",
            address: "0x0",
            args_count: 1,
          }),
          illustrative: true,
        },
      }),
    ],
  },
  {
    id: "chain-formats",
    title: "Formats",
    intro:
      "A format hash identifies the shape of a connector's output. Connectors that share it produce compatible streams.",
    endpoints: [
      chainOperation("GET", "/formats", {
        also: "HEAD /formats checks the same query without a body.",
        example: {
          request: curlGet("/formats?limit=50"),
          response: json({
            formats: [FORMAT],
            cursor: { has_more: false, next_after: null },
            limit: 50,
            total_formats: 1,
          }),
        },
      }),
      chainOperation("GET", "/format/{hash}", {
        example: {
          request: curlGet(`/format/${FORMAT}?limit=50`),
          response: json({
            format_hash: FORMAT,
            connectors: ["pitch"],
            scalars: ["pitch:0"],
            cursor: { has_more: false, next_after: null },
            limit: 50,
            total_connectors: 1,
          }),
        },
      }),
    ],
  },
  {
    id: "chain-feed",
    title: "Feed",
    intro:
      "Chain events, newest first, as connectors, transformations and conditions are published. Items move through observed, safe and finalized, or become removed after a reorganisation.",
    endpoints: [
      chainOperation("GET", "/feed", {
        example: {
          request: curlGet("/feed?limit=1&include_unfinalized=0"),
          response: json({
            items: [
              {
                feed_id: "local:11155111:connector_added:pitch",
                event_type: "connector_added",
                status: "finalized",
                visible: true,
                tx_hash: "0x0fc499e4f88ae66792da639b29af1794fded0efd75d892b56e7591380e29d190",
                block_number: 12,
                tx_index: 0,
                log_index: 0,
                history_cursor: "c1790857774523:12:0:local:11155111:connector_added:pitch",
                created_at_ms: 1790857774523,
                updated_at_ms: 1790857792829,
                projector_version: 1,
                payload: { type: "connector", name: "pitch", owner: `0x${OWNER}` },
              },
            ],
            cursor: {
              has_more: true,
              next_before: "c1790857774523:12:0:local:11155111:connector_added:pitch",
            },
            limit: 1,
          }),
        },
      }),
      chainOperation("GET", "/feed/stream", {
        example: {
          request: `curl -N "${CHAIN_BASE}/feed/stream?since_seq=0"`,
          response: `: min_available_seq=1

id: 42
event: connector_added
data: {"stream_seq":42,"event_type":"connector_added","status":"finalized","feed_id":"…","history_cursor":"…","created_at_ms":1790857774523,"payload":{"type":"connector","name":"pitch","owner":"0x…"}}

event: stream_meta
data: {…}`,
          responseLang: "bash",
        },
      }),
    ],
  },
  {
    id: "chain-run",
    title: "Run",
    intro:
      "Simulate drafts for free in the server's local EVM, or execute published connectors on chain. Neither needs a login. particles_count is the number of steps; dynamic_ri sets running instances by position for one run.",
    endpoints: [
      chainOperation("POST", "/simulate", {
        // The server runs any registered connector since chain-backend #27; api-spec does not
        // list its 503 yet.
        description:
          "Run a connector in the server's local simulation EVM: drafts created on this server, and published connectors. A connector that exists only on chain is first deployed locally with its dependencies from their verified artifacts. No login is required, and the result carries no chain provenance.",
        responses: [
          {
            status: "200",
            description: "Executed.",
            type: "array of ParticlesResultItem",
            ref: "ParticlesResultItem",
          },
          {
            status: "400",
            description:
              "Bad request, or execution rejected by the runner (for example a condition was not met).",
            type: "ErrorResponse",
            ref: "ErrorResponse",
          },
          {
            status: "404",
            description: "Connector not found.",
            type: "ErrorResponse",
            ref: "ErrorResponse",
          },
          {
            status: "500",
            description: "Internal deployment, execution or response decoding error.",
            type: "ErrorResponse",
            ref: "ErrorResponse",
          },
          {
            status: "503",
            description:
              "A chain-only connector cannot be simulated yet: the verified artifacts of it or its dependencies are not available.",
            type: "ErrorResponse",
            ref: "ErrorResponse",
          },
        ],
        example: {
          request: curlPost("/simulate", { connector_name: "pitch", particles_count: 4 }),
          response: json([{ path: "/pitch:0", data: [0, 1, 2, 3] }]),
        },
      }),
      chainOperation("POST", "/execute", {
        example: {
          request: curlPost("/execute", {
            connector_name: "pitch",
            particles_count: 4,
            dynamic_ri: { "0": { start_point: 12, transformation_shift: 0 } },
          }),
          response: json({
            block_number: 11825489,
            block_hash: "0x1c4b37dc907b055ffd53e0d32536a408a2d93e9bedfa7ed167cba14991729cfa",
            runner: "0xe0e70f522b64a6c8d2301697cd7133be33eae77f",
            particles: [{ path: "/pitch:0", data: [12, 13, 14, 15] }],
          }),
        },
      }),
    ],
  },
  {
    id: "chain-publish",
    title: "Publication",
    intro:
      "Publish one of your drafts on chain, paid from your own wallet. Prepare, send the transaction (with a browser wallet, or signed offline and relayed through /send), then confirm. Dependencies must be published first, and publications from one owner must be made one at a time.",
    endpoints: [
      chainOperation("POST", "/publish/{kind}/prepare", {
        example: {
          request: curlPost(
            "/publish/transformation/prepare",
            { name: "shift_up", relay: true },
            true,
          ),
          response: json({
            status: "prepared",
            kind: "transformation",
            name: "shift_up",
            address: "0x…",
            content_hash: HASH,
            publication_nonce: 0,
            deadline: 1790903600,
            transaction: {
              from: "0xyouraddress…",
              to: "0xregistry…",
              data: "0x…",
              chainId: "0xaa36a7",
              gas: "0x3d090",
            },
            signing: {
              type: "0x2",
              nonce: "0x7",
              maxFeePerGas: "0x2540be400",
              maxPriorityFeePerGas: "0x3b9aca00",
              value: "0x0",
            },
          }),
          illustrative: true,
        },
      }),
      chainOperation("POST", "/publish/{kind}/send", {
        example: {
          request: curlPost(
            "/publish/transformation/send",
            { name: "shift_up", content_hash: HASH, raw_tx: "0x02f8…" },
            true,
          ),
          response: json({ status: "pending", tx_hash: TX }),
          illustrative: true,
        },
      }),
      chainOperation("POST", "/publish/{kind}", {
        example: {
          request: curlPost(
            "/publish/transformation",
            { name: "shift_up", content_hash: HASH, tx_hash: TX },
            true,
          ),
          response: json({
            status: "mined",
            kind: "transformation",
            name: "shift_up",
            tx_hash: TX,
            block_number: 11825600,
            address: "0x…",
            owner: "0xyouraddress…",
            content_hash: HASH,
          }),
          illustrative: true,
        },
      }),
    ],
  },
];
