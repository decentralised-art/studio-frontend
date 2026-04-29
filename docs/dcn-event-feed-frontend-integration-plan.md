# DCN Event Feed Frontend Integration Plan

This note preserves the detailed context for the planned frontend migration to the new `dcn-server`
event system. It is meant as implementation memory for future Codex turns.

## Current Repository State

- `dcn-server` was fetched with `git fetch origin --prune --tags`.
- Local `dcn-server/main` is intentionally still behind `origin/main` by 10 commits; the analysis used
  `origin/main` directly and did not merge it.
- `origin/main` is currently at `777d9f5`.
- New server commits introduce a chain event ingestion/projection/feed system plus `GET /feed` and
  `GET /feed/stream`.
- `hypermusic-frontend` has existing uncommitted work from earlier tasks. Before starting this migration,
  either commit it or intentionally park it, because the migration will touch the same areas.

## New Server Contract

Frontend-facing endpoints through the existing dev/prod chain base:

- `GET /chain/feed?limit=<uint>&before=<cursor>&type=<type>&include_unfinalized=<0|1>`
- `GET /chain/feed/stream?since_seq=<uint>&limit=<uint>`

Actual server routes are `/feed` and `/feed/stream`; frontend URL helper should use
`buildChainApiUrl("/feed?...")`, which maps to `/chain/feed?...`.

Supported event types:

- `connector_added`
- `transformation_added`
- `condition_added`

Supported lifecycle statuses:

- `observed`
- `safe`
- `finalized`
- `removed`

`GET /feed` response shape:

```ts
{
  limit: number;
  cursor: {
    has_more: boolean;
    next_before: string | null;
  }
  items: Array<{
    feed_id: string;
    event_type: "connector_added" | "transformation_added" | "condition_added" | string;
    status: "observed" | "safe" | "finalized" | "removed" | string;
    visible: boolean;
    tx_hash: string;
    block_number: number;
    tx_index: number;
    log_index: number;
    history_cursor: string;
    created_at_ms: number;
    updated_at_ms: number;
    projector_version: number;
    payload: {
      type?: "connector" | "transformation" | "condition" | string;
      name?: string;
      owner?: string;
    };
  }>;
}
```

`GET /feed/stream` is SSE:

- Replay starts with a comment like `: min_available_seq=<n>`.
- Delta frames use `id: <stream_seq>`, `event: <event_type>`, and `data: <json>`.
- Delta data currently includes:

```ts
{
  stream_seq: number;
  event_type: string;
  status: string;
  feed_id: string;
  history_cursor: string;
  created_at_ms: number;
  payload: {
    type?: string;
    name?: string;
    owner?: string;
  };
}
```

- A `stream_meta` frame includes:

```ts
{
  has_more: boolean;
  last_seq: number | null;
  requested_since_seq: number;
  min_available_seq: number;
  replay_floor_seq: number;
  stale_since_seq: boolean;
}
```

Important backend limitations as of this analysis:

- `/feed` has no `owner` filter.
- Connector feed payload does not include `format_hash`.
- Transformation/condition feed payload does not include `args_count`, `entity_address`, or `sol_src`.
- SSE delta data does not expose `op`; infer removal from `status === "removed"` or `visible` where available.
- `/feed` requires `limit`.
- `/feed/stream` is EventSource-friendly, but it logs every poll server-side, so avoid unnecessary duplicate
  stream connections.

## Current Frontend Data Flow To Replace

The frontend currently reconstructs network activity by scanning chain accounts.

Key modules/routes:

- `src/lib/chain/registryApi.ts`
  - Has canonical chain fetch helpers:
    - `getChainAccount`
    - `getChainAccounts`
    - `getChainConnector`
    - `getChainTransformation`
    - `getChainCondition`
    - `getChainFormat`
    - `getChainFormats`
    - `postChainExecuteDetailed`
- `src/lib/feed/particlePostData.ts`
  - Current global feed/search cache.
  - `syncParticlePostDataFromChain()` calls account snapshot code.
  - Public functions are used broadly and should be preserved initially:
    - `syncParticlePostDataFromChain`
    - `listParticlePosts`
    - `listNetworkFeedEvents`
    - `listNetworkFeedEventsByAuthor`
    - `getParticleRecordById`
    - `ensureParticleRecordLoadedById`
    - `listParticleSearchEntities`
    - `getParticleDependencyRegistrySnapshot`
- `src/lib/studio/chainStudioAdapter.ts`
  - `fetchChainOwnedStudioSnapshot(address)` calls `/account/<address>` and fans out to entity endpoints.
  - `fetchChainParticleForStudio(name)` fetches one connector and converts it into Studio structures.
  - Keep `fetchChainParticleForStudio` as an exact detail hydration helper.
  - Quarantine `fetchChainOwnedStudioSnapshot` as legacy/targeted account scan; stop using it as default feed sync.
- `src/routes/network/+page.svelte`
  - Computes current/followed source addresses from services profile.
  - Calls `syncParticlePostDataFromChain({ sourceAddresses })`.
  - Filters by followed users and followed formats client-side.
  - Search currently also depends on `listParticleSearchEntities()`.
- `src/routes/account/+page.svelte`
  - Uses `fetchChainOwnedStudioSnapshot()` to refresh authored activity for logged-in profile.
- `src/routes/u/[id]/+page.svelte`
  - Uses `fetchChainOwnedStudioSnapshot()` for targeted public user activity.
- `src/routes/f/[slug]/+page.svelte`
  - Uses `/format/<hash>` and targeted connector fetches. This can remain mostly as-is initially.
- `src/routes/studio/+page.svelte`
  - `syncChainOwnedRegistry()` scans current/followed account sources sequentially with
    `fetchChainOwnedStudioSnapshot()`.
  - Toolbox should remain services-profile based.
  - Network library/search should move toward event-feed-backed discovery plus exact entity hydration.

## Product Model To Preserve

- Services auth controls whether the user can enter app pages.
- Services profile controls:
  - followed users
  - followed formats
  - toolbox
  - display names/avatars
- Chain API controls canonical entity data:
  - connectors
  - transformations
  - conditions
  - execute
  - event feed
- The event feed is the discovery/activity/index layer.
- Exact entity endpoints remain the canonical detail layer. This is not a fallback; it is the correct split.

## Step 1: Add Typed Event Feed Client

Create:

`src/lib/chain/eventFeedApi.ts`

Responsibilities:

- Define raw backend types and normalized frontend types.
- Add `getChainFeedPage(options)`.
- Add `createChainFeedStream(options)`.
- Normalize event type/status strings.
- Normalize payload owner addresses.
- Normalize cursor fields.
- Parse non-JSON error payloads consistently, ideally reusing error behavior from `registryApi.ts`.
- Use `buildChainApiUrl`.

Suggested exports:

```ts
export type ChainFeedEventType = "connector_added" | "transformation_added" | "condition_added";

export type ChainFeedStatus = "observed" | "safe" | "finalized" | "removed";

export type ChainFeedPayload = {
  type: "connector" | "transformation" | "condition" | string;
  name: string;
  owner: string;
};

export type ChainFeedItem = {
  feedId: string;
  eventType: string;
  status: string;
  visible: boolean;
  txHash: string;
  blockNumber: number;
  txIndex: number;
  logIndex: number;
  historyCursor: string;
  createdAtMs: number;
  updatedAtMs: number;
  projectorVersion: number;
  payload: ChainFeedPayload;
};

export type ChainFeedPage = {
  limit: number;
  hasMore: boolean;
  nextBefore: string | null;
  items: ChainFeedItem[];
};

export type ChainFeedStreamDelta = {
  streamSeq: number;
  eventType: string;
  status: string;
  feedId: string;
  historyCursor: string;
  createdAtMs: number;
  payload: ChainFeedPayload;
};

export type ChainFeedStreamMeta = {
  hasMore: boolean;
  lastSeq: number | null;
  requestedSinceSeq: number;
  minAvailableSeq: number;
  replayFloorSeq: number;
  staleSinceSeq: boolean;
};
```

Testing:

- `tests/eventFeedApi.test.ts`
- Test feed page parsing, bad payload handling, cursor handling.
- Test stream data parser functions separately from live `EventSource`.

## Step 2: Add Feed Projection Cache

Create:

`src/lib/feed/chainEventFeed.ts`

Responsibilities:

- Convert `ChainFeedItem` and `ChainFeedStreamDelta` into existing `NetworkFeedEvent` shapes.
- Deduplicate by `feedId`.
- Preserve newest-first sorting.
- Apply status updates.
- Hide/remove `removed` events.
- Track pagination and stream cursor.
- Keep a cache of connector records and search entities.

Mapping rules:

- `connector_added` with payload `{ name, owner }` maps to `ConnectorPostEvent`:
  - `type: "connector"`
  - `id: "event-connector-created-" + feedId or name`
  - `authorId: normalized owner`
  - `createdAt: created_at_ms`
  - `particleId: name`
  - `particleLabel: name`
  - dependencies initially empty until connector detail hydration
  - `formatHash` only after connector detail hydration
- `transformation_added` maps to `RuntimeCodePostEvent`:
  - `type: "transformation"`
  - `elementId: name`
  - `elementLabel: name`
  - `runtimeSnippet` empty or a minimal non-fake placeholder until detail hydration
- `condition_added` maps similarly.

Important: do not invent fake code snippets or fake graph data. If a component requires detail data,
hydrate the exact entity endpoint.

Testing:

- `tests/chainEventFeed.test.ts`
- Cover:
  - connector/transformation/condition mapping
  - owner normalization
  - dedupe by `feedId`
  - observed -> finalized update
  - removed event hiding
  - newest-first ordering

## Step 3: Add Entity Detail Hydration

Create:

`src/lib/feed/chainEventHydration.ts`

Responsibilities:

- Given a feed event or entity name, fetch canonical detail:
  - connector -> `getChainConnector(name)`
  - transformation -> `getChainTransformation(name)`
  - condition -> `getChainCondition(name)`
- Reuse existing conversion helpers:
  - `fromProtocolConnectorPayload`
  - `fetchChainParticleForStudio` logic where useful
  - `extractToolboxRuntimeSnippet`
  - Solidity arg inference helpers
- Update feed cache records with:
  - connector dependencies
  - connector format hash
  - connector Studio definition
  - runtime snippets
  - runtime arg counts

Avoid large fan-out. Hydrate details only for:

- visible feed cards
- search results
- followed-format filtering candidates
- user opens a connector
- Studio needs connector closure

Testing:

- `tests/chainEventHydration.test.ts`
- Mock `fetch` and assert exact endpoint calls.

## Step 4: Refactor `particlePostData.ts` Without Breaking Public API

Keep external call sites stable at first. Internally:

- Change `syncParticlePostDataFromChain()` default implementation to use event feed history.
- Keep source filtering as an option:
  - input `sourceAddresses` should be used to client-filter event owners.
- Use detail hydration for connector cards/search only as needed.
- Keep old account snapshot scan in a clearly named legacy function, e.g.
  `syncParticlePostDataFromOwnedAccountSnapshotsForDebug` or private fallback-free helper.

Cache should store:

- feed events by `feedId`
- `NetworkFeedEvent[]`
- `ParticleRecord` by connector name
- registry snapshot for dependency graphs
- searchable connectors/transformations/conditions
- last history cursor
- last stream seq

Do not add fallback behavior that hides backend/profile failures. If services profile or feed load fails,
surface a clear error.

Testing:

- Add `tests/particlePostData.eventFeed.test.ts`.
- Existing tests should keep passing or be updated to assert event-feed behavior.

## Step 5: Migrate `/network`

Current problem:

- `/network` scans followed accounts and then filters locally.

New flow:

1. Load current services profile using `getCurrentUserProfileState`.
2. Compute:
   - current user source addresses
   - followed user addresses
   - followed format hashes
   - toolbox connector IDs
3. Call event feed history loader with a page size larger than visible page size.
4. Client-filter visible events:
   - own events are visible
   - followed owner events are visible
   - connector events with followed `formatHash` are visible after connector hydration
5. Render visible events.
6. Load More uses `/feed` `next_before`, not just local slicing.
7. Start SSE stream after initial history page.
8. Apply deltas to cache and visible list.
9. If `stream_meta.stale_since_seq` is true, reload initial history and reset stream seq.

Keep user/format search:

- Users still come from services `/users` plus chain `/accounts`.
- Formats still come from `/formats`.
- Entity search should use event-feed-discovered entities plus hydrated details.

Playwright:

- Mock `/chain/feed`.
- Assert `/network` renders event-feed items.
- Assert anonymous route protection remains.
- Assert no `/chain/account` call is needed for initial network feed.

## Step 6: Migrate `/account` And `/u/[id]`

Replace targeted account snapshot feed loading with event-feed filtering.

`/account`:

- Resolve logged-in user source addresses from services profile.
- Show feed events whose owner matches those addresses.
- Use services profile name/avatar maps for display.
- Hydrate details only for rendered cards.

`/u/[id]`:

- Resolve services user by ID or address as it does now.
- Determine source address.
- Show feed events owned by that address.
- Keep follower/following UI services-based.

Important:

- This should fix inconsistencies where the profile says no activity even though the chain has authored items.
- Public profile route for an address should not fabricate a different services profile; if no services user maps
  to the address, show an address-based public profile.

Testing:

- Unit tests for author filtering.
- Playwright route for `/u/<address>` with mocked feed.

## Step 7: Migrate Studio Network Library

Current problem:

- Studio `syncChainOwnedRegistry()` scans every current/followed account source sequentially.

New default:

- On mount:
  - load services toolbox
  - hydrate exact toolbox IDs
- Network tab:
  - load event feed history
  - create library entries from feed events
  - hydrate details on open/drag/add
- Deep link:
  - fetch exact connector/transformation/condition by ID
- Connector closure:
  - when a connector is opened, recursively fetch missing composite connectors.

Suggested helper:

```ts
hydrateConnectorClosure(rootName: string): Promise<void>
```

It should:

- fetch root connector if missing
- parse its dimensions/composites
- fetch missing composite connectors recursively
- guard cycles
- merge into deployed registry/library

After deployment:

- Do not refresh every followed account.
- Hydrate exact deployed entity by name, or let SSE add it to the event-feed-backed library.

Manual sync button:

- Temporarily keep it, but change behavior to event feed refresh.
- If we keep old account scan for emergency debugging, label it as such and do not use it automatically.

Testing:

- Studio unit tests for connector closure hydration.
- Existing connector tree graph tests should stay valid.
- Playwright: Studio Network tab can add/open connector discovered through feed.

## Step 8: Keep Format Pages Mostly Stable

`/f/[slug]` already uses `/format/<hash>` and targeted connector fetches. Do not rewrite it first.

Later improvement:

- When feed payload includes `format_hash`, format pages and followed-format filtering can use feed directly.
- For now, followed-format filtering requires connector detail hydration.

## Step 9: Documentation And Backend Follow-Ups

Add/update frontend docs after implementation:

- event feed contract
- route data source matrix
- Studio sync behavior

Track backend requests separately:

- Add `owner=<address>` filter to `/feed`.
- Include `format_hash` in connector feed payload.
- Include `args_count` and `entity_address` in runtime feed payloads.
- Include `op` in SSE delta data.
- Allow omitted `limit` on `/feed`.

Do not block frontend integration on these.

## Step 10: Verification Checklist For Each Slice

For every implementation slice, run at minimum:

- `npm run check`
- `npm run lint`
- `npm run format:check`
- targeted `npm run test -- <test files>` or full `npm run test` when practical
- relevant Playwright tests
- `npm run build` before preparing a commit

Suggested commit slices:

1. `Add typed DCN event feed client`
2. `Project DCN feed events into network activity`
3. `Load Network page from DCN event feed`
4. `Load profile activity from DCN event feed`
5. `Use DCN event feed for Studio network library`
6. `Quarantine legacy account snapshot sync`

## Step 11: Feature-Safe Rollout Guardrails

The migration should stay sliceable even after the first broad implementation. Keep the following
boundaries explicit so regressions remain easy to isolate.

Rollout slices:

1. Add the typed event feed client, projection cache, hydration helpers, and unit tests without route
   usage.
2. Wire `/network` to feed-backed history, pagination, and SSE while keeping services profile/follow
   ownership as the filtering source of truth.
3. Wire `/account` and `/u/[id]` to feed-backed profile activity by normalized chain owner address.
4. Wire Studio Network library discovery to event feed metadata, with exact entity hydration only when
   opening, adding, dragging, deep-linking, or after deploy success.
5. Quarantine old owned-account snapshot scans behind debug or targeted detail helpers only.
6. Update route tests, source-level rollout guard tests, and docs before preparing a commit.

Current guardrails:

- `tests/eventFeedApi.test.ts`, `tests/chainEventFeed.test.ts`, and
  `tests/chainEventHydration.test.ts` protect the raw backend contract, projection behavior, detail
  hydration, SSE metadata, removed events, and no-fake-detail rule.
- `tests/particlePostData.eventFeed.test.ts` protects the public feed cache API while its internals use
  `/feed`.
- `tests/profileActivity.test.ts` protects account/profile activity loading by owner address.
- `tests/studioEventFeedLibrary.test.ts` protects Studio Network library discovery without detail fan-out.
- `tests/eventFeedRollout.test.ts` prevents broad route paths from being rewired back to owned-account
  scans and keeps old snapshot sync debug-only.
- `e2e/app-smoke.spec.ts` verifies `/network`, `/account`, `/u/[id]`, and Studio Network discovery against
  mocked `/chain/feed` responses and asserts the broad feed paths do not need `/chain/account`.

CI/local acceptance for every slice:

- `npm run format:check`
- `npm run lint`
- `npm run check`
- `npm run test`
- relevant `npm run test:e2e` coverage, or targeted Playwright specs while developing
- `npm run build` before commit/push

Notes:

- The debug workflow already runs format check, lint, Svelte check, unit tests, production build, and
  Playwright. The Playwright report artifact upload is temporarily disabled only because of the current
  GitHub Actions storage quota issue.
- The release workflow still performs the production build and release-artifact smoke test.
- Exact entity endpoints remain canonical detail fetches. They are not fallbacks.

## Step 12: Backend Contract Gap Tracking

Backend event-feed improvements are tracked separately in
`docs/dcn-event-feed-backend-contract-gaps.md`.

This keeps frontend work unblocked while giving the backend developer an actionable list:

- Add `owner=<address>` filter support to `/feed`.
- Include `format_hash` in connector feed payloads.
- Include `args_count` and `entity_address` in runtime feed payloads.
- Include `op` in SSE delta data.
- Allow omitted `limit` on `/feed`.

The frontend adapter boundary should stay centralized in `eventFeedApi.ts`, `chainEventFeed.ts`,
`chainEventHydration.ts`, `particlePostData.ts`, `profileActivity.ts`, and
`studioEventFeedLibrary.ts`, so each backend contract improvement remains a small adapter/test change rather
than a route rewrite.

## Non-Negotiable Behavior Constraints

- Do not add confusing mock or static fallbacks for real app behavior.
- If services profile loading fails, show a clear services-profile error.
- If chain feed loading fails, show a clear chain-feed error.
- Toolbox is services-profile based.
- Follow graph is services-profile based.
- Chain event feed is discovery/activity.
- Exact chain entity endpoints are canonical details.
- Backend repos are sources of truth; frontend should adapt to their published contract unless user explicitly asks
  us to modify backend.
