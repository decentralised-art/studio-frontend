// Code samples for the SDK documentation page. Kept here so the page markup stays readable.
// Every sample targets the SDK's current public surface (DecentralisedArtClient / Client).

import type { CodeLanguage } from "$lib/site/docs/highlight";

type Sample = { label: string; lang: CodeLanguage; code: string };

const js = (code: string): Sample => ({ label: "JavaScript", lang: "ts", code });
const py = (code: string): Sample => ({ label: "Python", lang: "python", code });

export const install = [
  {
    label: "JavaScript",
    lang: "bash",
    code: `npm install "https://github.com/decentralised-art/sdk/releases/latest/download/decentralised-art-js-sdk.tgz"

# Optional: wallet signing for login and publication
npm install ethers`,
  },
  {
    label: "Python",
    lang: "bash",
    code: `pip install "decentralised-art @ https://github.com/decentralised-art/sdk/releases/latest/download/decentralised-art-python-sdk.tar.gz"`,
  },
] satisfies Sample[];

export const installPinned = [
  {
    label: "JavaScript",
    lang: "bash",
    code: `npm install "https://github.com/decentralised-art/sdk/releases/download/vX.Y.Z/decentralised-art-js-sdk.tgz"`,
  },
  {
    label: "Python",
    lang: "bash",
    code: `pip install "decentralised-art @ https://github.com/decentralised-art/sdk/releases/download/vX.Y.Z/decentralised-art-python-sdk.tar.gz"`,
  },
] satisfies Sample[];

export const quickStart = [
  js(`import { DecentralisedArtClient } from "decentralised-art";

const sdk = new DecentralisedArtClient(); // https://api.decentralised.art/chain

// Read a published connector.
const connector = await sdk.connectorGet("pitch");
console.log(connector.dimensions, connector.format_hash);

// Run it on chain. No login and no gas.
const result = await sdk.execute("pitch", 8);
console.log(result.particles);
// [{ path: "/pitch:0", data: [0, 1, 2, 3, 4, 5, 6, 7] }]`),
  py(`import decentralised_art

with decentralised_art.Client() as sdk:  # https://api.decentralised.art/chain
    # Read a published connector.
    connector = sdk.connector_get("pitch")
    print(connector.dimensions, connector.format_hash)

    # Run it on chain. No login and no gas.
    result = sdk.execute("pitch", 8)
    print(result.particles[0].path, result.particles[0].data)
    # /pitch:0 [0, 1, 2, 3, 4, 5, 6, 7]`),
];

export const configure = [
  js(`import { DecentralisedArtClient } from "decentralised-art";

const sdk = new DecentralisedArtClient({
  baseUrl: "https://api.decentralised.art/chain", // or DECENTRALISED_ART_API_BASE in Node
  accessToken: savedToken ?? null,                 // reuse a token from an earlier login
  fetch: globalThis.fetch,                          // custom runtimes, tests, instrumentation
});`),
  py(`import decentralised_art

sdk = decentralised_art.Client(
    base_url="https://api.decentralised.art/chain",  # or DECENTRALISED_ART_API_BASE
    access_token=None,   # reuse a token from an earlier login
    timeout=15.0,        # seconds per request
    verify_ssl=True,
)
...
sdk.close()  # or use the client as a context manager: with Client() as sdk: ...`),
];

export const loginWallet = [
  js(`import { Wallet } from "ethers";

// Server or script: a local key also becomes the default signer for publish().
const wallet = new Wallet(process.env.OWNER_KEY!);
await sdk.loginWithWallet(wallet);

// Browser: any ethers signer works for login.
// const signer = await new BrowserProvider(window.ethereum).getSigner();
// await sdk.loginWithWallet(signer, { origin: window.location.origin });

console.log(sdk.accessToken);`),
  py(`import os

from eth_account import Account

# The account also becomes the default signer for publish().
account = Account.from_key(os.environ["OWNER_KEY"])
sdk.login_with_account(account)

print(sdk.access_token)`),
];

export const loginSignature = [
  js(`const { nonce, message } = await sdk.getNonce(address);
// Browser clients pass { origin: window.location.origin } to getNonce.
const signature = await signMessageSomehow(message); // EIP-191 personal_sign

await sdk.loginWithSignature(address, nonce, signature);`),
  py(`challenge = sdk.get_nonce(address)
signature = sign_message_somehow(challenge.message)  # EIP-191 personal_sign

sdk.login_with_signature(address, challenge.nonce, signature)`),
];

export const reading = [
  js(`// Existence checks return false on 404 instead of throwing.
if (await sdk.connectorExists("pitch")) {
  const connector = await sdk.connectorGet("pitch");
  console.log(connector.owner, connector.address); // address is "0x0" for a local draft
}

const add = await sdk.transformationGet("add");
console.log(add.args_count); // 1

// Who has published what.
const { accounts } = await sdk.listAccounts({ limit: 50 });
const owned = await sdk.accountInfo(accounts[0]);

// Connectors that share an output shape.
const { formats } = await sdk.listFormats();
const format = await sdk.formatInfo(formats[0]);
console.log(format.connectors, format.scalars);`),
  py(`# Existence checks return False on 404 instead of raising.
if sdk.connector_exists("pitch"):
    connector = sdk.connector_get("pitch")
    print(connector.owner, connector.address)  # address is "0x0" for a local draft

add = sdk.transformation_get("add")
print(add.args_count)  # 1

# Who has published what.
accounts = sdk.list_accounts(limit=50).accounts
owned = sdk.account_info(accounts[0])

# Connectors that share an output shape.
formats = sdk.list_formats().formats
fmt = sdk.format_info(formats[0])
print(fmt.connectors, fmt.scalars)`),
];

export const pagination = [
  js(`let after: string | undefined;
do {
  const page = await sdk.listFormats({ limit: 100, after });
  handle(page.formats);
  after = page.cursor.has_more ? (page.cursor.next_after ?? undefined) : undefined;
} while (after);`),
  py(`after = None
while True:
    page = sdk.list_formats(limit=100, after=after)
    handle(page.formats)
    if not page.cursor.has_more:
        break
    after = page.cursor.next_after`),
];

export const feed = [
  js(`// Newest first. includeUnfinalized: false returns finalized items only.
const page = await sdk.feed({ limit: 20, type: "connector_added", includeUnfinalized: false });
for (const item of page.items) {
  console.log(item.status, item.payload.type, item.payload.name, item.payload.owner);
}

// Older items: pass the cursor back.
const older = await sdk.feed({ limit: 20, before: page.cursor.next_before ?? undefined });`),
  py(`# Newest first. include_unfinalized=False returns finalized items only.
page = sdk.feed(limit=20, event_type="connector_added", include_unfinalized=False)
for item in page.items:
    print(item.status, item.payload.name, item.payload.owner)

# Older items: pass the cursor back.
older = sdk.feed(limit=20, before=page.cursor.next_before)`),
];

export const feedStream = [
  js(`const response = await sdk.feedStream({ sinceSeq: 0 });
const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();

let buffer = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += value;
  const frames = buffer.split("\\n\\n");
  buffer = frames.pop() ?? "";
  for (const frame of frames) {
    const data = frame.split("\\n").find((line) => line.startsWith("data: "));
    if (data && !frame.includes("event: stream_meta")) {
      const delta = JSON.parse(data.slice(6));
      console.log(delta.stream_seq, delta.event_type, delta.payload.name);
    }
  }
}`),
  py(`import json

with sdk.feed_stream(since_seq=0) as response:
    event = None
    for line in response.iter_lines():
        if line.startswith("event: "):
            event = line[7:]
        elif line.startswith("data: ") and event != "stream_meta":
            delta = json.loads(line[6:])
            print(delta["stream_seq"], delta["event_type"], delta["payload"]["name"])
        elif line == "":
            event = None`),
];

export const createTransformation = [
  js(`// The body of: function run(uint32 x, uint32[] args) returns (uint32)
await sdk.transformationPost({
  name: "shift_up",
  sol_src: "return x + args[0];",
});

const created = await sdk.transformationGet("shift_up");
console.log(created.args_count, created.address); // 1 "0x0"`),
  py(`# The body of: function run(uint32 x, uint32[] args) returns (uint32)
sdk.transformation_post({
    "name": "shift_up",
    "sol_src": "return x + args[0];",
})

created = sdk.transformation_get("shift_up")
print(created.args_count, created.address)  # 1 0x0`),
];

export const createCondition = [
  js(`// The body of: function check(int32[] args) view returns (bool)
await sdk.conditionPost({
  name: "positive_only",
  sol_src: "return args[0] > 0;",
});`),
  py(`# The body of: function check(int32[] args) view returns (bool)
sdk.condition_post({
    "name": "positive_only",
    "sol_src": "return args[0] > 0;",
})`),
];

export const createConnector = [
  js(`await sdk.connectorPost({
  name: "rising_line",
  dimensions: [
    {
      // Applied in order on this dimension.
      transformations: [
        { name: "add", args: [1] },
        { name: "shift_up", args: [2] },
      ],
    },
  ],
  // Optional gate, checked whenever the connector runs.
  condition_name: "positive_only",
  condition_args: [1],
});`),
  py(`sdk.connector_post({
    "name": "rising_line",
    "dimensions": [
        {
            # Applied in order on this dimension.
            "transformations": [
                {"name": "add", "args": [1]},
                {"name": "shift_up", "args": [2]},
            ],
        },
    ],
    # Optional gate, checked whenever the connector runs.
    "condition_name": "positive_only",
    "condition_args": [1],
})`),
];

export const createComposite = [
  js(`await sdk.connectorPost({
  name: "phrase",
  dimensions: [
    // This dimension builds on the published "pitch" connector.
    { composite: "pitch", transformations: [{ name: "add", args: [1] }] },
    { transformations: [{ name: "add", args: [2] }] },
  ],
  // Fixed running instance for position 0 (the connector itself).
  static_ri: { "0": { start_point: 60, transformation_shift: 0 } },
});`),
  py(`sdk.connector_post({
    "name": "phrase",
    "dimensions": [
        # This dimension builds on the published "pitch" connector.
        {"composite": "pitch", "transformations": [{"name": "add", "args": [1]}]},
        {"transformations": [{"name": "add", "args": [2]}]},
    ],
    # Fixed running instance for position 0 (the connector itself).
    "static_ri": {"0": {"start_point": 60, "transformation_shift": 0}},
})`),
];

export const simulate = [
  js(`// Runs your drafts, and any published operations they use, in the server's local EVM.
const streams = await sdk.simulate("rising_line", 16);
for (const { path, data } of streams) console.log(path, data);`),
  py(`# Runs your drafts, and any published operations they use, in the server's local EVM.
streams = sdk.simulate("rising_line", 16)
for stream in streams:
    print(stream.path, stream.data)`),
];

export const publishRelay = [
  js(`import { Wallet } from "ethers";

const wallet = new Wallet(process.env.OWNER_KEY!); // no provider needed
await sdk.loginWithWallet(wallet);

// Dependencies first, one at a time, then the connector that uses them.
await sdk.publish("transformation", "shift_up", { maxFeePerGas: 50_000_000_000n });
await sdk.publish("condition", "positive_only", { maxFeePerGas: 50_000_000_000n });
const result = await sdk.publish("connector", "rising_line", {
  maxFeePerGas: 50_000_000_000n, // refuse to sign above 50 gwei
  chainId: 11155111,             // refuse to sign for any other chain (Sepolia)
});

console.log(result.status); // "mined", or "published" if it already was`),
  py(`import os

from eth_account import Account

account = Account.from_key(os.environ["OWNER_KEY"])
sdk.login_with_account(account)

# Dependencies first, one at a time, then the connector that uses them.
sdk.publish("transformation", "shift_up", max_fee_per_gas=50_000_000_000)
sdk.publish("condition", "positive_only", max_fee_per_gas=50_000_000_000)
result = sdk.publish(
    "connector",
    "rising_line",
    max_fee_per_gas=50_000_000_000,  # refuse to sign above 50 gwei
    chain_id=11155111,               # refuse to sign for any other chain (Sepolia)
)

print(type(result).__name__)  # ConfirmResponse, or AlreadyPublished if it already was`),
];

export const publishBrowser =
  js(`const prepared = await sdk.publishPrepare("transformation", "shift_up");

if (prepared.status === "prepared") {
  // { from, to, data, chainId, gas } as hex quantities: the params of eth_sendTransaction.
  const txHash = (await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [prepared.transaction],
  })) as string;

  // Store txHash now. If the page reloads, confirm again with the same hash.
  const request = { name: "shift_up", content_hash: prepared.content_hash, tx_hash: txHash };
  let confirmed = await sdk.publishConfirm("transformation", request);
  while (confirmed.status === "pending") {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    confirmed = await sdk.publishConfirm("transformation", request);
  }
  console.log(confirmed.status); // "mined"
}
// prepared.status === "published": the registry already holds this exact entity.`);

export const publishSteps = [
  js(`const prepared = await sdk.publishPrepare("transformation", "shift_up", { relay: true });
if (prepared.status === "prepared" && prepared.signing) {
  // Sign { ...prepared.transaction, ...prepared.signing } offline (eth_signTransaction).
  const raw_tx = await signOffline({ ...prepared.transaction, ...prepared.signing });
  const { tx_hash } = await sdk.publishSend("transformation", {
    name: "shift_up",
    content_hash: prepared.content_hash,
    raw_tx,
  });
  await sdk.publishConfirm("transformation", {
    name: "shift_up",
    content_hash: prepared.content_hash,
    tx_hash,
  });
}`),
  py(`from decentralised_art.client import PreparedPublication

prepared = sdk.publish_prepare("transformation", "shift_up", relay=True)
if isinstance(prepared, PreparedPublication):
    raw_tx = sign_offline(prepared.transaction, prepared.signing)  # 0x02… signed transaction
    sent = sdk.publish_send("transformation", "shift_up", prepared.content_hash, raw_tx)
    sdk.publish_confirm("transformation", "shift_up", prepared.content_hash, sent.tx_hash)`),
];

export const execute = [
  js(`const result = await sdk.execute("pitch", 8, {
  // Override the running instance at position 0 for this run only.
  "0": { start_point: 12, transformation_shift: 0 },
});

console.log(result.block_number, result.block_hash, result.runner, result.registry);
console.log(result.particles);
// [{ path: "/pitch:0", data: [12, 13, 14, 15, 16, 17, 18, 19] }]`),
  py(`result = sdk.execute(
    "pitch",
    8,
    # Override the running instance at position 0 for this run only.
    {"0": {"start_point": 12, "transformation_shift": 0}},
)

print(result.block_number, result.block_hash, result.runner, result.registry)
print(result.particles[0].path, result.particles[0].data)
# /pitch:0 [12, 13, 14, 15, 16, 17, 18, 19]`),
];

export const errors = [
  js(`import { DecentralisedArtApiError } from "decentralised-art";

try {
  await sdk.connectorGet("does_not_exist");
} catch (error) {
  if (error instanceof DecentralisedArtApiError) {
    console.log(error.status, error.body); // 404 { message: "..." }
  } else {
    throw error; // network failure, aborted request, ...
  }
}`),
  py(`from decentralised_art.client import DecentralisedArtApiError

try:
    sdk.connector_get("does_not_exist")
except DecentralisedArtApiError as error:
    print(error.status_code, error.body)  # 404 {'message': '...'}`),
];

export const worldManifest = `{
  "schemaVersion": 1,
  "slug": "simple-counter",
  "name": "Simple Counter World",
  "version": "0.1.0",
  "entry": "index.html",
  "runtime": "iframe",
  "surfaces": ["world-page", "studio-plugin"],
  "permissions": ["decentralised.art.connectors.read", "decentralised.art.execute"],
  "description": "Renders connector metadata and numeric output streams.",
  "shortDescription": "Minimal World example.",
  "accentColor": "#34d399",
  "preview": "preview.png",
  "acceptedConnectorSets": [
    { "connectors": ["simple_counter"], "optionalConnectors": ["velocity_midi"] }
  ],
  "valueLimits": {
    "particlesCount": { "min": 1, "max": 64 },
    "connectorValues": { "/simple_counter:0": { "min": 0, "max": 127 } }
  }
}`;

export const worldScript = `// world.js — loaded by index.html as <script type="module" src="world.js">.
// Import the runtime the platform serves; Worlds never bundle their own copy.
// From /world-assets/{id}/world.js this resolves to /js/sdk/world-runtime.js.
import { createWorldSdk } from "../../js/sdk/world-runtime.js";

const sdk = createWorldSdk({ worldId: "simple-counter" });

sdk.onState(async (state) => {
  const payload = state.payload ?? {};
  const streams = payload.executeOutput ?? []; // [{ path, data }]

  try {
    draw(streams, payload.particlesCount);

    // Brokered calls: the host checks this World's manifest permissions.
    if (payload.connectorName) {
      const connector = await sdk.connectorGet(payload.connectorName);
      showFormat(connector.format_hash);
    }
    sdk.reportRendered(state.requestId);
  } catch (error) {
    sdk.reportError(error instanceof Error ? error.message : "Render failed");
  }
});

// Tell the host the World is listening. Calls made before this are rejected.
sdk.ready();`;

export const worldCalls = `// Needs "decentralised.art.execute" in the manifest.
const result = await sdk.execute("pitch", 16, { "0": { start_point: 60, transformation_shift: 0 } });
const preview = await sdk.simulate("pitch", 16);

// Needs "decentralised.art.social.read".
const latest = await sdk.feed({ limit: 10 });`;

export const worldZip = `cd my-world
zip -r ../my-world.zip world-manifest.json index.html world.js style.css preview.png`;

export const worldHost = `import { DecentralisedArtClient } from "decentralised-art";
import { createWorldHost } from "decentralised-art/worlds/host";

const iframe = document.querySelector<HTMLIFrameElement>("#world")!;
iframe.setAttribute("sandbox", "allow-scripts"); // opaque "null" origin

const host = createWorldHost({
  client: new DecentralisedArtClient(),
  iframe,
  permissions: manifest.permissions,
  valueLimits: manifest.valueLimits,
  expectedOrigin: "null",
  onReady: () =>
    host.pushState({
      payload: { connectorName: "pitch", particlesCount: 8, executeOutput: result.particles },
    }),
  onRendered: () => console.log("rendered"),
  onError: ({ message }) => console.error(message),
});

// The per-mount channel token travels in the URL; set src only after creating the host.
iframe.src = host.worldUrl(worldEntryUrl);

// Later: host.dispose();`;

export const cli = `decentralised-art-auth version
decentralised-art-auth nonce 0xYourAddress
decentralised-art-auth --base-url http://localhost:54321 version`;
