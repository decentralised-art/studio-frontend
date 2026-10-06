import { CHAIN_BASE } from "$lib/site/docs/apiReference";
import type { CodeLanguage } from "$lib/site/docs/highlight";

type Sample = { label: string; lang: CodeLanguage; code: string };

const js = (code: string): Sample => ({ label: "JavaScript", lang: "ts", code });
const py = (code: string): Sample => ({ label: "Python", lang: "python", code });

export const apiRead = `DCN_API="${CHAIN_BASE}"
curl --silent --show-error --fail-with-body "$DCN_API/connector/pitch"`;

const apiRun = (start: number) => `DCN_API="${CHAIN_BASE}"
curl --silent --show-error --fail-with-body "$DCN_API/execute" \\
  -H 'Content-Type: application/json' \\
  --data '{
    "connector_name": "pitch",
    "particles_count": 4,
    "dynamic_ri": {
      "0": {"start_point": ${start}, "transformation_shift": 0}
    }
  }'`;

export const apiFirstRun = apiRun(0);
export const apiStartingValue = apiRun(10);

export const signingAccount = `read -r -s -p 'Private key for your test account: ' DCN_OWNER_KEY
printf '\\n'
export DCN_OWNER_KEY`;

export const sdkInstall = [
  {
    label: "JavaScript",
    lang: "bash",
    code: `npm install "https://github.com/decentralised-art/sdk/releases/latest/download/decentralised-art-js-sdk.tgz" ethers`,
  },
  {
    label: "Python",
    lang: "bash",
    code: `python3 -m venv .tutorial-venv
source .tutorial-venv/bin/activate
python -m pip install "decentralised-art @ https://github.com/decentralised-art/sdk/releases/latest/download/decentralised-art-python-sdk.tar.gz"`,
  },
] satisfies Sample[];

export const apiTokenInstall = sdkInstall[1].code;

// curl sends the exercise requests; this helper uses the SDK only for wallet sign-in.
export const apiToken = `DCN_TOKEN="$(python - <<'PY'
import os
from eth_account import Account
from decentralised_art import Client

account = Account.from_key(os.environ["DCN_OWNER_KEY"])
with Client(base_url="${CHAIN_BASE}") as sdk:
    sdk.login_with_account(account)
    print(sdk.access_token)
PY
)"`;

export const apiCreateDraft = `DCN_API="${CHAIN_BASE}"
DCN_DRAFT="tutorial_step2_$(date +%s)_$RANDOM"
curl --silent --show-error --fail-with-body "$DCN_API/connector" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{
  "name": "$DCN_DRAFT",
  "dimensions": [{
    "composite": "pitch",
    "transformations": [{"name": "add", "args": [2]}]
  }],
  "static_ri": {
    "2": {"start_point": 60, "transformation_shift": 0}
  }
}
JSON`;

export const apiSimulateDraft = `curl --silent --show-error --fail-with-body "$DCN_API/simulate" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{"connector_name":"$DCN_DRAFT","particles_count":4}
JSON`;

export const sdkFirstRun = [
  js(`import { DecentralisedArtClient } from "decentralised-art";

const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
const connector = await sdk.connectorGet("pitch");
console.log(connector.dimensions);

const result = await sdk.execute("pitch", 4, {
  "0": { start_point: 0, transformation_shift: 0 },
});
for (const stream of result.particles) console.log(stream.path, stream.data);
console.log("Execution block:", result.block_number);`),
  py(`from decentralised_art import Client

with Client(base_url="${CHAIN_BASE}") as sdk:
    connector = sdk.connector_get("pitch")
    print(connector.dimensions)

    result = sdk.execute("pitch", 4, {
        "0": {"start_point": 0, "transformation_shift": 0},
    })
    for stream in result.particles:
        print(stream.path, stream.data)
    print("Execution block:", result.block_number)`),
];

export const sdkRunFirst = [
  { label: "JavaScript", lang: "bash", code: "node first-run.mjs" },
  { label: "Python", lang: "bash", code: "python first-run.py" },
] satisfies Sample[];

export const sdkStartingValue = [
  js(`import { DecentralisedArtClient } from "decentralised-art";

const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
for (const start of [0, 10]) {
  const result = await sdk.execute("pitch", 4, {
    "0": { start_point: start, transformation_shift: 0 },
  });
  console.log("Start:", start);
  for (const stream of result.particles) console.log(stream.path, stream.data);
}`),
  py(`from decentralised_art import Client

with Client(base_url="${CHAIN_BASE}") as sdk:
    for start in [0, 10]:
        result = sdk.execute("pitch", 4, {
            "0": {"start_point": start, "transformation_shift": 0},
        })
        print("Start:", start)
        for stream in result.particles:
            print(stream.path, stream.data)`),
];

export const sdkDraft = [
  js(`import { randomUUID } from "node:crypto";
import { Wallet } from "ethers";
import { DecentralisedArtClient } from "decentralised-art";

const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
const wallet = new Wallet(process.env.DCN_OWNER_KEY);
await sdk.loginWithWallet(wallet);

const step = 2;
const name = "tutorial_" + randomUUID().replaceAll("-", "");
const draft = await sdk.connectorPost({
  name,
  dimensions: [{
    composite: "pitch",
    transformations: [{ name: "add", args: [step] }],
  }],
  static_ri: {
    "2": { start_point: 60, transformation_shift: 0 },
  },
});
console.log("Draft:", draft.name, "Address:", draft.address);

const streams = await sdk.simulate(name, 4);
for (const stream of streams) console.log(stream.path, stream.data);`),
  py(`import os
from uuid import uuid4
from eth_account import Account
from decentralised_art import Client

account = Account.from_key(os.environ["DCN_OWNER_KEY"])
with Client(base_url="${CHAIN_BASE}") as sdk:
    sdk.login_with_account(account)

    step = 2
    name = "tutorial_" + uuid4().hex
    draft = sdk.connector_post({
        "name": name,
        "dimensions": [{
            "composite": "pitch",
            "transformations": [{"name": "add", "args": [step]}],
        }],
        "static_ri": {
            "2": {"start_point": 60, "transformation_shift": 0},
        },
    })
    print("Draft:", draft.name, "Address:", draft.address)

    for stream in sdk.simulate(name, 4):
        print(stream.path, stream.data)`),
];

export const sdkRunDraft = [
  { label: "JavaScript", lang: "bash", code: "node draft.mjs" },
  { label: "Python", lang: "bash", code: "python draft.py" },
] satisfies Sample[];

export const apiFormat = `DCN_API="${CHAIN_BASE}"
DCN_FORMAT="$(curl --silent --show-error --fail-with-body "$DCN_API/connector/pitch" | python3 -c 'import json,sys; print(json.load(sys.stdin)["format_hash"])')"
curl --silent --show-error --fail-with-body "$DCN_API/format/$DCN_FORMAT?limit=50"`;

export const sdkFormat = [
  js(`import { DecentralisedArtClient } from "decentralised-art";
const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
const pitch = await sdk.connectorGet("pitch");
const format = await sdk.formatInfo(pitch.format_hash);
console.log("Scalar labels:", format.scalars);
console.log("Same format:", format.connectors);`),
  py(`from decentralised_art import Client
with Client(base_url="${CHAIN_BASE}") as sdk:
    pitch = sdk.connector_get("pitch")
    format_info = sdk.format_info(pitch.format_hash)
    print("Scalar labels:", format_info.scalars)
    print("Same format:", format_info.connectors)`),
];

export const apiPrepare = `curl --silent --show-error --fail-with-body "$DCN_API/publish/connector/prepare" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --output publication-prepared.json --data @- <<JSON
{"name":"$DCN_DRAFT","relay":true}
JSON
cat publication-prepared.json`;

export const apiExecuteDraft = `curl --silent --show-error --fail-with-body "$DCN_API/execute" \\
  -H 'Content-Type: application/json' \\
  --data @- <<JSON
{"connector_name":"$DCN_DRAFT","particles_count":4}
JSON`;

export const sdkPublish = [
  js(`import { Wallet } from "ethers";
import { DecentralisedArtClient } from "decentralised-art";
const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
await sdk.loginWithWallet(new Wallet(process.env.DCN_OWNER_KEY));
const name = process.env.DCN_DRAFT;
if (!name) throw new Error("Set DCN_DRAFT to your saved name");
console.log(await sdk.publish("connector", name, {
  chainId: 11155111,
  maxFeePerGas: 50_000_000_000n,
}));
// Keep any transaction hash if confirmation is interrupted.
// Retry this read later if the execution block has not caught up.
console.log(await sdk.execute(name, 4));`),
  py(`import os
from eth_account import Account
from decentralised_art import Client
with Client(base_url="${CHAIN_BASE}") as sdk:
    sdk.login_with_account(Account.from_key(os.environ["DCN_OWNER_KEY"]))
    name = os.environ["DCN_DRAFT"]
    print(sdk.publish("connector", name,
        chain_id=11155111, max_fee_per_gas=50_000_000_000))
    # Keep any transaction hash if confirmation is interrupted.
    # Retry this read later if the execution block has not caught up.
    print(sdk.execute(name, 4))`),
];

export const sdkConditions = [
  js(`import { DecentralisedArtClient } from "decentralised-art";
const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
const pitch = await sdk.connectorGet("pitch");
console.log("Attached condition:", pitch.condition_name || "none");
console.log("Fixed arguments:", pitch.condition_args);
const page = await sdk.feed({ type: "condition_added", limit: 5, includeUnfinalized: false });
for (const item of page.items) {
  const name = item.payload.name;
  if (name) console.log(await sdk.conditionGet(name));
}`),
  py(`from decentralised_art import Client
with Client(base_url="${CHAIN_BASE}") as sdk:
    pitch = sdk.connector_get("pitch")
    print("Attached condition:", pitch.condition_name or "none")
    print("Fixed arguments:", pitch.condition_args)
    page = sdk.feed(event_type="condition_added", limit=5, include_unfinalized=False)
    for item in page.items:
        if item.payload.name:
            print(sdk.condition_get(item.payload.name))`),
];

export const apiRender = `curl --silent --show-error --fail-with-body "$DCN_API/simulate" \\
  -H 'Content-Type: application/json' \\
  --output streams.json --data @- <<JSON
{"connector_name":"$DCN_DRAFT","particles_count":4}
JSON
python3 - <<'PYTHON'
import json
from pathlib import Path
streams = json.loads(Path("streams.json").read_text())
values = next(s["data"] for s in streams if s["path"].endswith("/pitch:0"))
assert len(values) == 4 and all(isinstance(v, int) and 0 <= v <= 127 for v in values)
circles = "".join('<circle cx="' + str(55 + i * 110) + '" cy="70" r="' + str(v / 2) + '" fill="#b389ff"/>' for i, v in enumerate(values))
Path("my-world.html").write_text('<!doctype html><title>My circle prototype</title><p>Each value is a diameter in pixels.</p><svg viewBox="0 0 440 140">' + circles + '</svg>')
print("Open my-world.html in your browser. Diameters:", values)
PYTHON`;

export const sdkRender = [
  js(`import { writeFileSync } from "node:fs";
import { DecentralisedArtClient } from "decentralised-art";
const sdk = new DecentralisedArtClient({ baseUrl: "${CHAIN_BASE}" });
const name = process.env.DCN_DRAFT;
if (!name) throw new Error("Set DCN_DRAFT to your saved draft name");
const streams = await sdk.simulate(name, 4);
const values = streams.find(s => s.path.endsWith("/pitch:0"))?.data;
if (!values || values.length !== 4 || values.some(v => !Number.isInteger(v) || v < 0 || v > 127)) {
  throw new Error("Expected four pitch values between 0 and 127");
}
const circles = values.map((v, i) => '<circle cx="' + (55 + i * 110) + '" cy="70" r="' + (v / 2) + '" fill="#b389ff"/>').join("");
writeFileSync("my-world.html", '<!doctype html><title>My circle prototype</title><p>Each value is a diameter in pixels.</p><svg viewBox="0 0 440 140">' + circles + '</svg>');
console.log("Open my-world.html in your browser. Diameters:", values);`),
  py(`import os
from pathlib import Path
from decentralised_art import Client
with Client(base_url="${CHAIN_BASE}") as sdk:
    streams = sdk.simulate(os.environ["DCN_DRAFT"], 4)
values = next(s.data for s in streams if s.path.endswith("/pitch:0"))
assert len(values) == 4 and all(isinstance(v, int) and 0 <= v <= 127 for v in values)
circles = "".join('<circle cx="' + str(55 + i * 110) + '" cy="70" r="' + str(v / 2) + '" fill="#b389ff"/>' for i, v in enumerate(values))
Path("my-world.html").write_text('<!doctype html><title>My circle prototype</title><p>Each value is a diameter in pixels.</p><svg viewBox="0 0 440 140">' + circles + '</svg>')
print("Open my-world.html in your browser. Diameters:", values)`),
];

export const sdkRunRender = [
  { label: "JavaScript", lang: "bash", code: "node world-preview.mjs" },
  { label: "Python", lang: "bash", code: "python world-preview.py" },
] satisfies Sample[];

export const apiSign = `python - <<'PYTHON'
import json, os, time
from pathlib import Path
from eth_account import Account
from eth_utils import to_checksum_address

prepared = json.loads(Path("publication-prepared.json").read_text())
assert prepared["status"] == "prepared", "This definition is already published"
assert prepared["name"] == os.environ["DCN_DRAFT"], "Check the draft name"
assert prepared["deadline"] > time.time(), "Prepare again: deadline expired"
account = Account.from_key(os.environ["DCN_OWNER_KEY"])
tx, fees = prepared["transaction"], prepared["signing"]
assert account.address.lower() == tx["from"].lower(), "Use the draft owner"
assert int(tx["chainId"], 16) == 11155111, "Use Sepolia"
assert int(fees["maxFeePerGas"], 16) <= 50_000_000_000, "Fee exceeds 50 gwei ceiling"
signed = account.sign_transaction({
    "type": 2, "chainId": 11155111, "nonce": int(fees["nonce"], 16),
    "to": to_checksum_address(tx["to"]), "data": tx["data"], "gas": int(tx["gas"], 16),
    "maxFeePerGas": int(fees["maxFeePerGas"], 16),
    "maxPriorityFeePerGas": int(fees["maxPriorityFeePerGas"], 16), "value": 0,
})
Path("publication-send.json").write_text(json.dumps({
    "name": prepared["name"], "content_hash": prepared["content_hash"],
    "raw_tx": "0x" + bytes(signed.raw_transaction).hex(),
}))
print("Signed locally. Nothing sent yet.")
PYTHON`;

export const apiSend = `curl --silent --show-error --fail-with-body "$DCN_API/publish/connector/send" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --data @publication-send.json --output publication-sent.json
cat publication-sent.json`;

export const apiConfirm = `python3 - <<'PYTHON'
import json
from pathlib import Path
prepared = json.loads(Path("publication-prepared.json").read_text())
sent = json.loads(Path("publication-sent.json").read_text())
Path("publication-confirm.json").write_text(json.dumps({
    "name": prepared["name"], "content_hash": prepared["content_hash"],
    "tx_hash": sent["tx_hash"],
}))
PYTHON
curl --silent --show-error --fail-with-body "$DCN_API/publish/connector" \\
  -H "Authorization: Bearer \${DCN_TOKEN:?Sign in first}" \\
  -H 'Content-Type: application/json' \\
  --data @publication-confirm.json`;
