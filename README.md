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

1. Dev is proxy-first by default (`/services`, `/chain`) via `vite.config.ts`.
2. Production serves the SvelteKit app at the decentralised.art root, with `/app/*` kept as a compatibility redirect.
3. The former Astro website is migrated into this SvelteKit app and is no longer a production dependency.
4. Production defaults are strict network-only:
   - `https://api.decentralised.art/services`
   - `https://api.decentralised.art/chain`
5. Set `VITE_*_API_BASE_URL` only when intentionally overriding targets.

Detailed matrix:

- `docs/runtime-environment-matrix.md`

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
