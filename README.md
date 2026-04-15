# Hypermusic.ai Svelte

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Run linter

```sh
npm run lint
```

## Building

To create a production version of your app:

```sh
npm run build
```

Optional build/runtime env vars:

```sh
# Mount app under reverse-proxy prefix (e.g. /app)
PUBLIC_BASE_PATH=/app

# Services API base URL (defaults to https://api.decentralised.art/services)
VITE_SERVICES_API_BASE_URL=https://api.decentralised.art/services

# Chain API base URL (defaults to /chain in dev, https://api.decentralised.art/chain in prod)
VITE_CHAIN_API_BASE_URL=https://api.decentralised.art/chain
```

Runtime behavior notes:

1. Dev is proxy-first by default (`/services`, `/chain`) via `vite.config.ts`.
2. Production defaults are strict network-only:
   - `https://api.decentralised.art/services`
   - `https://api.decentralised.art/chain`
3. Set `VITE_*_API_BASE_URL` only when intentionally overriding targets.

Detailed matrix:

- `docs/runtime-environment-matrix.md`

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
