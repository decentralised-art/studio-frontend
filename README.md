# Hypermusic.ai Svelte

## Developing

Use Node `22.12.0` as pinned in `.nvmrc`:

```sh
nvm use
```

If your shell does not auto-load `nvm`, use the installed local runtime explicitly:

```sh
PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH" npm run check
```

Once dependencies are installed with `npm install`, start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Run linter

```sh
npm run lint
```

Run the standard local verification set:

```sh
npm run check
npm run lint
npm test
npm run build
```

## Building

To create a production version of your app:

```sh
npm run build
```

Optional build/runtime env vars:

```sh
# Services API base URL (defaults to https://api.decentralised.art/services)
VITE_SERVICES_API_BASE_URL=https://api.decentralised.art/services

# Chain API base URL (defaults to /chain in dev, https://api.decentralised.art/chain in prod)
VITE_CHAIN_API_BASE_URL=https://api.decentralised.art/chain
```

Runtime behavior notes:

1. Dev is proxy-first by default (`/services`, `/chain`, `/world-assets`, `/js/sdk`) via `vite.config.ts`; world asset and SDK traffic is routed to the backend services gateway.
2. Production serves the SvelteKit app at the decentralised.art root, with `/app/*` kept as a compatibility redirect.
3. The former Astro website is migrated into this SvelteKit app and is no longer a production dependency.
4. Production defaults are strict network-only:
   - `https://api.decentralised.art/services`
   - `https://api.decentralised.art/chain`
   - `https://api.decentralised.art/services/world-assets`
   - `https://api.decentralised.art/services/js/sdk`
5. Set `VITE_*_API_BASE_URL` only when intentionally overriding targets.

Detailed matrix:

- `docs/runtime-environment-matrix.md`

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Current chain lifecycle

The SDK is pinned to `1cc7924` (API specification `8761ecb`). Studio has two entity libraries:

- **Network** lists published Sepolia connectors, transformations and conditions, discovered through chain events or verified nonzero chain addresses.
- **Local** lists the signed-in wallet's entities created on the simulation server, including creations made through the API outside this browser. Account discovery is filtered by both owner and the unpublished address `0x0`. Local entries are not added to public Toolbox profiles. Browser graphs and publication records are scoped by API URL and wallet.

**Create locally** creates an immutable entity on the server without a blockchain transaction. Transformation and condition editors use this action too. **Simulate** runs a created Local connector with its Local and Network dependencies on the server without gas. Published dependencies require their verified artifacts to be available on that server.

**Publish to the Network** separately publishes the owner's local dependencies before their parent, using wallet-approved transactions and Sepolia ETH for gas. **Execute on the Network** reads a published connector at a pinned block using `eth_call`; it does not send a paid wallet transaction. Its output retains `{block_number, block_hash, runner, particles}`. Simulation returns particles without chain provenance.

Pending receipts and interrupted sends survive reloads in localStorage, scoped by API URL and wallet. Confirmed publications show their transaction hash, explorer link and contract address in Studio. The recovery field accepts a transaction hash from wallet activity. Web Locks serialize publication for the same API and owner. A mined receipt can precede safe-block execution and indexing: retry execution or confirmation without sending another publication. Publishing requires HTTPS or localhost and a browser supporting Web Locks.

Created definitions remain immutable. Runtime argument metadata uses `args_count`; public GET responses do not return editable Solidity source. Local visibility is scoped in Studio; the current server's GET endpoints remain public, so this is not a server-side confidentiality boundary.

Uploaded Worlds use the current SDK directly: `sdk.execute` returns `{block_number, block_hash, runner, particles}`, and Worlds read `result.particles` for the output streams. `sdk.simulate` returns local output streams and remains a separate operation using the SDK's `dcn.execute` permission. The services backend and frontend use the same pinned SDK.

Verification is offline by default. The optional live smoke test requires an explicitly supplied token and published connector fixtures; unit tests mock the server and wallet and send no transactions.

If bundled Playwright Chromium/ffmpeg are not installed, use existing Chrome without video recording:

```sh
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome PLAYWRIGHT_VIDEO=off npm run test:e2e -- e2e/studio-local-network.spec.ts --workers=1
```

These selected browser tests intercept services/chain traffic and inject a mock wallet; they create no live entities or transactions.
