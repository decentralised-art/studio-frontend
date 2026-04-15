# Runtime Environment Matrix

Status: active
Owner: frontend
Last updated: 2026-04-15

## Goal

Keep runtime behavior strict and predictable across local dev, preview, and production:

1. Dev is proxy-first by default.
2. Production is network-only by default.
3. Overrides are explicit and environment-driven.

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

## Environment Matrix

### Local dev (`npm run dev`)

Expected defaults:

- services: `/services`
- chain: `/chain`

Proxy authority:

- `vite.config.ts` dev proxy rewrites `/services/*` and `/chain/*` to `https://api.decentralised.art`.

Implication:

- If no env override is set, local dev uses Vite proxy instead of directly hitting production hosts from client code.

### Preview/prod build (`npm run build`, deployed app)

Expected defaults:

- services: `https://api.decentralised.art/services`
- chain: `https://api.decentralised.art/chain`

Implication:

- Runtime is strict network-only by default.
- No mock fallback endpoints should be used for core network/studio flows.

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
