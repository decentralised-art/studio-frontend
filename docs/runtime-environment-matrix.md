# Runtime Environment Matrix

Status: active
Owner: frontend
Last updated: 2026-04-15

## Goal

Keep runtime behavior strict and predictable across local dev, preview, and production:

1. Dev is proxy-first by default.
2. Production is network-only by default.
3. Overrides are explicit and environment-driven.
4. The public app is served at the decentralised.art root; `/app/*` is a compatibility redirect.
5. The former Astro website is migrated into this SvelteKit app and is no longer a production dependency.

## API Base Resolution

Code authority:

- `src/lib/url/url.ts`

Resolution rules:

1. Services base:
   - `VITE_SERVICES_API_BASE_URL` (if set)
   - else `VITE_API_BASE_URL` (if set)
   - else:
     - dev: `/services`
     - prod: `https://api.decentralised.art/services`

2. Chain base:
   - `VITE_CHAIN_API_BASE_URL` (if set)
   - else:
     - dev: `/chain`
     - prod: `https://api.decentralised.art/chain`

3. World runtime assets:
   - world bundle entries are resolved from backend `entryUrn` values such as
     `/world-assets/{world_id}/index.html`
   - world SDK modules are served from `/js/sdk/*`
   - dev: same-origin proxy paths
   - prod: `https://api.decentralised.art/services/world-assets/*` and
     `https://api.decentralised.art/services/js/sdk/*`

## Environment Matrix

### Local dev (`npm run dev`)

Expected defaults:

- services: `/services`
- chain: `/chain`
- world assets: `/services/world-assets` (legacy `/world-assets` is proxied there)
- world SDK: `/services/js/sdk` (legacy `/js/sdk` is proxied there)

Proxy authority:

- `vite.config.ts` dev proxy rewrites `/services/*` and `/chain/*` directly, with
  legacy `/world-assets/*` and `/js/sdk/*` routed through `/services/*` on
  `https://api.decentralised.art`.

Implication:

- If no env override is set, local dev uses Vite proxy instead of directly hitting production hosts from client code.

### Preview/prod build (`npm run build`, deployed app)

Expected defaults:

- services: `https://api.decentralised.art/services`
- chain: `https://api.decentralised.art/chain`
- world assets: `https://api.decentralised.art/services/world-assets`
- world SDK: `https://api.decentralised.art/services/js/sdk`
- base path: `/`

Implication:

- Runtime is strict network-only by default.
- No mock fallback endpoints should be used for core network/studio flows.
- Services auth is the app-entry gate. Chain auth is requested only when a chain action needs it.
- Login and registration use services accounts only; there is no prototype-preview account shortcut.
- Chain actions authenticate through MetaMask message signing and may patch the services profile's
  `ethereum_address`.

## Explicit Override Examples

Use these only when intentionally targeting alternate stacks:

```bash
# custom chain endpoint
VITE_CHAIN_API_BASE_URL=https://staging.example.com/chain

# custom services endpoint
VITE_SERVICES_API_BASE_URL=https://staging.example.com/services
```

## Operational Notes

1. Do not silently switch between endpoint families in runtime code.
2. If chain/services are unavailable, surface explicit errors in UI instead of fallbacking to mock data.
3. Keep this file synchronized whenever URL-resolution logic changes.
