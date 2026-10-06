import { CHAIN_BASE } from "$lib/site/docs/apiReference";
import type { CodeLanguage } from "$lib/site/docs/highlight";

type Sample = { label: string; lang: CodeLanguage; code: string };

export const thresholdName = "tutorial_threshold_v1";
export const divisibleName = "tutorial_divisible_v1";
export const thresholdSource = "return args[0] >= args[1];";
export const divisibleSource = "if (args[1] <= 0) return false;\nreturn args[0] % args[1] == 0;";
export const expectedValues = [60, 62, 64, 66];

export const examples = [
  {
    label: "Threshold",
    condition: thresholdName,
    explanation: "Is the supplied number at least the minimum?",
    pass: "tutorial_threshold_pass_v1",
    fail: "tutorial_threshold_fail_v1",
    passLabel: "12 ≥ 10 · allowed",
    failLabel: "8 < 10 · blocked",
    passArgs: [12, 10],
    failArgs: [8, 10],
  },
  {
    label: "Divisibility",
    condition: divisibleName,
    explanation: "Does the supplied number divide by 3 without a remainder?",
    pass: "tutorial_divisible_pass_v1",
    fail: "tutorial_divisible_fail_v1",
    passLabel: "12 ÷ 3 = 4 · allowed",
    failLabel: "14 ÷ 3 has a remainder · blocked",
    passArgs: [12, 3],
    failArgs: [14, 3],
  },
] as const;

const apiExecute = (name: string, label: string) => `# ${label}
curl --silent --show-error --fail-with-body \\
  --write-out '\\nHTTP %{http_code}\\n' \\
  "${CHAIN_BASE}/execute" \\
  -H 'Content-Type: application/json' \\
  --data '{"connector_name":"${name}","particles_count":4}'`;

export const apiThreshold = [
  apiExecute(examples[0].pass, "12 meets the minimum of 10: expect four pitch values"),
  apiExecute(examples[0].fail, "8 is below 10: expect a condition refusal"),
].join("\n\n");

export const apiDivisible = [
  apiExecute(examples[1].pass, "12 is divisible by 3: expect four pitch values"),
  apiExecute(examples[1].fail, "14 is not divisible by 3: expect a condition refusal"),
].join("\n\n");

export const apiDefinitions = `DCN_API="${CHAIN_BASE}"
curl --silent --show-error --fail-with-body \\
  --write-out '\\nHTTP %{http_code}\\n' \\
  "$DCN_API/condition/${thresholdName}"
curl --silent --show-error --fail-with-body \\
  --write-out '\\nHTTP %{http_code}\\n' \\
  "$DCN_API/condition/${divisibleName}"`;

export const sdkConditions = [
  {
    label: "JavaScript",
    lang: "ts",
    code: `import { DecentralisedArtClient, DecentralisedArtApiError } from "decentralised-art";

const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
const examples = [
  ["${examples[0].pass}", true],
  ["${examples[0].fail}", false],
  ["${examples[1].pass}", true],
  ["${examples[1].fail}", false],
];
const expected = [60, 62, 64, 66];

for (const [name, allowed] of examples) {
  const definition = await sdk.connectorGet(name);
  console.log(name, definition.condition_name, definition.condition_args);
  try {
    const result = await sdk.execute(name, 4);
    if (!allowed) throw new Error(name + " unexpectedly returned values.");
    const pitch = result.particles.find((s) => s.path.endsWith("/pitch:0"));
    if (JSON.stringify(pitch?.data) !== JSON.stringify(expected)) {
      throw new Error(name + " returned unexpected pitch values.");
    }
    console.log("Pitch:", pitch.data);
    console.log("Block:", result.block_number, result.block_hash);
  } catch (error) {
    if (!(error instanceof DecentralisedArtApiError) || allowed) throw error;
    console.log("Request rejected; inspect the reason:", error.status, error.body);
  }
}`,
  },
  {
    label: "Python",
    lang: "python",
    code: `from decentralised_art import Client
from decentralised_art.client import DecentralisedArtApiError

examples = [
    ("${examples[0].pass}", True),
    ("${examples[0].fail}", False),
    ("${examples[1].pass}", True),
    ("${examples[1].fail}", False),
]
expected = [60, 62, 64, 66]

with Client(base_url="${CHAIN_BASE}") as sdk:
    for name, allowed in examples:
        definition = sdk.connector_get(name)
        print(name, definition.condition_name, definition.condition_args)
        try:
            result = sdk.execute(name, 4)
            if not allowed:
                raise RuntimeError(name + " unexpectedly returned values.")
            pitch = next((s for s in result.particles if s.path.endswith("/pitch:0")), None)
            if pitch is None or pitch.data != expected:
                raise RuntimeError(name + " returned unexpected pitch values.")
            print("Pitch:", pitch.data)
            print("Block:", result.block_number, result.block_hash)
        except DecentralisedArtApiError as error:
            if allowed:
                raise
            print("Request rejected; inspect the reason:", error.status_code, error.body)`,
  },
] satisfies Sample[];
