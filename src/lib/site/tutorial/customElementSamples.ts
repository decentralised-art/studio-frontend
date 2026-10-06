import { CHAIN_BASE } from "$lib/site/docs/apiReference";
import type { CodeLanguage } from "$lib/site/docs/highlight";

type Sample = { label: string; lang: CodeLanguage; code: string };

export const cycleSource = "return (x + 1) % 4;";
export const thresholdSource = "return args[0] >= args[1];";

export const apiCreateElements = `DCN_API="${CHAIN_BASE}"
DCN_CUSTOM_ID="$(date +%s)_$RANDOM"
DCN_CYCLE="tutorial_cycle_$DCN_CUSTOM_ID"
DCN_THRESHOLD="tutorial_threshold_$DCN_CUSTOM_ID"
DCN_ALLOWED="tutorial_allowed_$DCN_CUSTOM_ID"
DCN_BLOCKED="tutorial_blocked_$DCN_CUSTOM_ID"

curl --silent --show-error --fail-with-body "$DCN_API/transformation" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{"name":"$DCN_CYCLE","sol_src":"${cycleSource}"}
JSON

curl --silent --show-error --fail-with-body "$DCN_API/condition" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{"name":"$DCN_THRESHOLD","sol_src":"${thresholdSource}"}
JSON`;

export const apiCreateAllowed = `curl --silent --show-error --fail-with-body "$DCN_API/connector" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{
  "name": "$DCN_ALLOWED",
  "condition_name": "$DCN_THRESHOLD",
  "condition_args": [12, 10],
  "dimensions": [{
    "composite": "pitch",
    "transformations": [{"name": "$DCN_CYCLE", "args": []}]
  }],
  "static_ri": {
    "2": {"start_point": 60, "transformation_shift": 0}
  }
}
JSON

curl --silent --show-error --fail-with-body "$DCN_API/simulate" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{"connector_name":"$DCN_ALLOWED","particles_count":6}
JSON`;

export const apiCreateBlocked = `curl --silent --show-error --fail-with-body "$DCN_API/connector" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{
  "name": "$DCN_BLOCKED",
  "condition_name": "$DCN_THRESHOLD",
  "condition_args": [8, 10],
  "dimensions": [{
    "composite": "pitch",
    "transformations": [{"name": "$DCN_CYCLE", "args": []}]
  }],
  "static_ri": {
    "2": {"start_point": 60, "transformation_shift": 0}
  }
}
JSON

curl --silent --show-error --fail-with-body "$DCN_API/simulate" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{"connector_name":"$DCN_BLOCKED","particles_count":6}
JSON`;

export const sdkCustomElements = [
  {
    label: "JavaScript",
    lang: "ts",
    code: `import { randomUUID } from "node:crypto";
import { Wallet } from "ethers";
import { DecentralisedArtClient, DecentralisedArtApiError } from "decentralised-art";

const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
const wallet = new Wallet(process.env.DCN_OWNER_KEY);
await sdk.loginWithWallet(wallet);

const id = randomUUID().replaceAll("-", "");
const cycle = "tutorial_cycle_" + id;
const threshold = "tutorial_threshold_" + id;
const allowed = "tutorial_allowed_" + id;
const blocked = "tutorial_blocked_" + id;

console.log(await sdk.transformationPost({
  name: cycle, sol_src: "${cycleSource}",
}));
console.log(await sdk.conditionPost({
  name: threshold, sol_src: "${thresholdSource}",
}));

for (const [name, value] of [[allowed, 12], [blocked, 8]]) {
  const draft = await sdk.connectorPost({
    name,
    condition_name: threshold,
    condition_args: [value, 10],
    dimensions: [{
      composite: "pitch",
      transformations: [{ name: cycle, args: [] }],
    }],
    static_ri: {
      "2": { start_point: 60, transformation_shift: 0 },
    },
  });
  console.log("Draft:", draft.name, "Address:", draft.address);
}

const streams = await sdk.simulate(allowed, 6);
for (const stream of streams) console.log(stream.path, stream.data);
const pitch = streams.find((stream) => stream.path.endsWith("/pitch:0"));
if (JSON.stringify(pitch?.data) !== JSON.stringify([60, 61, 62, 63, 60, 61])) {
  throw new Error("Unexpected pitch values; check the connector and its running instances.");
}
console.log("Cycle arguments:", (await sdk.transformationGet(cycle)).args_count);
console.log("Threshold arguments:", (await sdk.conditionGet(threshold)).args_count);

try {
  await sdk.simulate(blocked, 6);
  throw new Error("Unexpected success: the threshold should reject this run.");
} catch (error) {
  if (!(error instanceof DecentralisedArtApiError)) throw error;
  console.log("Rejected run; inspect the API error:", error.status, error.body);
}`,
  },
  {
    label: "Python",
    lang: "python",
    code: `import os
from uuid import uuid4
from eth_account import Account
from decentralised_art import Client
from decentralised_art.client import DecentralisedArtApiError

account = Account.from_key(os.environ["DCN_OWNER_KEY"])
with Client(base_url="${CHAIN_BASE}") as sdk:
    sdk.login_with_account(account)
    suffix = uuid4().hex
    cycle = "tutorial_cycle_" + suffix
    threshold = "tutorial_threshold_" + suffix
    allowed = "tutorial_allowed_" + suffix
    blocked = "tutorial_blocked_" + suffix

    print(sdk.transformation_post({
        "name": cycle, "sol_src": "${cycleSource}",
    }))
    print(sdk.condition_post({
        "name": threshold, "sol_src": "${thresholdSource}",
    }))

    for name, value in [(allowed, 12), (blocked, 8)]:
        draft = sdk.connector_post({
            "name": name,
            "condition_name": threshold,
            "condition_args": [value, 10],
            "dimensions": [{
                "composite": "pitch",
                "transformations": [{"name": cycle, "args": []}],
            }],
            "static_ri": {
                "2": {"start_point": 60, "transformation_shift": 0},
            },
        })
        print("Draft:", draft.name, "Address:", draft.address)

    streams = sdk.simulate(allowed, 6)
    for stream in streams:
        print(stream.path, stream.data)
    pitch = next((s for s in streams if s.path.endswith("/pitch:0")), None)
    if pitch is None or pitch.data != [60, 61, 62, 63, 60, 61]:
        raise RuntimeError("Unexpected pitch values; check the connector and its running instances.")
    print("Cycle arguments:", sdk.transformation_get(cycle).args_count)
    print("Threshold arguments:", sdk.condition_get(threshold).args_count)

    try:
        sdk.simulate(blocked, 6)
    except DecentralisedArtApiError as error:
        print("Rejected run; inspect the API error:", error.status_code, error.body)
    else:
        raise RuntimeError("Unexpected success: the threshold should reject this run.")`,
  },
] satisfies Sample[];
