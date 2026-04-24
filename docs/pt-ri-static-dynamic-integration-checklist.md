# PT Static/Dynamic RI Frontend Integration Checklist

Status: Implemented and verified
Owner: Frontend  
Repo: `hypermusic-frontend`  
Created: 2026-04-11
Last verified: 2026-04-24

## Goal

Align Studio and chain integration with current PT + dcn-server behavior:

- `dynamic_ri` for `/execute`
- `static_ri` in connector definitions
- DFS-positioned RI semantics across composites and bindings
- current cursor response contracts for account/format endpoints
- user-visible error handling for PT execution rejections

## Scope

Included:

- Studio execute/deploy request contracts
- Studio connector authoring and JSON roundtrip
- Chain sync and registry mapping for `static_ri`
- Validation and UI behavior for static-vs-dynamic RI rules
- Tests for adapter and execute payload correctness

Excluded:

- Backend/protocol code changes
- New backend search/alchemy features
- Legacy feature/particle API restoration

## PR-1: API Contract Alignment

### Tasks

- [x] Update execute payload types in `src/lib/chain/registryApi.ts`:
  - replace `running_instances` with `dynamic_ri: Record<string, { start_point; transformation_shift }>`
- [x] Add `static_ri` support to chain connector request/response types in `src/lib/chain/registryApi.ts`
- [x] Ensure no Studio call path sends `running_instances`

### Acceptance

- [x] All `/execute` requests are `dynamic_ri` based
- [x] Build has zero references to legacy execute payload in Studio paths

## PR-2: Connector Model + Adapter Parity

### Tasks

- [x] Extend `StudioConnectorDef` in `src/lib/studio/domain/connectorModel.ts` with static RI model
- [x] Parse `static_ri` in `fromProtocolConnectorPayload` in `src/lib/chain/connectorContractAdapter.ts`
- [x] Serialize `static_ri` in `toProtocolConnectorPayload` in `src/lib/chain/connectorContractAdapter.ts`
- [x] Preserve `static_ri` in chain sync/fetch paths:
  - `src/lib/studio/chainStudioAdapter.ts`

### Acceptance

- [x] Synced connectors retain `static_ri` in local runtime registry
- [x] Connector deploy body includes `static_ri` when present

## PR-3: DFS RI Position Engine

### Tasks

- [x] Add RI position computation module, e.g. `src/lib/studio/riPositioning.ts`
- [x] Implement deterministic DFS position assignment compatible with backend runner semantics:
  - root at position `0`
  - dimension/composite/binding traversal position increments
  - slot projection behavior consistent with existing binding projection logic
- [x] Add cycle-safe traversal and explicit error messages
- [x] Provide two outputs:
  - map of connector-tree node -> position
  - position metadata used by execute/static RI UIs

### Acceptance

- [x] Same graph yields stable identical position mapping across refreshes
- [x] Nested composite/binding trees produce valid position maps without collisions

## PR-4: Static RI Authoring UX in Studio

### Tasks

- [x] Add static RI editor in Studio inspector in `src/routes/studio/+page.svelte`:
  - list/add/remove entries by DFS position
  - edit `start_point` and `transformation_shift`
- [x] Mark network/view-only connectors read-only for static RI editing
- [x] Add node-level visual state for static RI presence:
  - `src/lib/components/studio/StudioConnectorNode.svelte`
  - `src/lib/components/studio/StudioDimensionNode.svelte` (if needed)

### Acceptance

- [x] User can author `static_ri` for draft connectors
- [x] Read-only connector tabs prevent static RI edits

## PR-5: Execute Path with Dynamic RI Map

### Tasks

- [x] Replace legacy running-instance builder in `src/routes/studio/+page.svelte`:
  - remove legacy `buildRunningInstances` execute payload use
  - construct `dynamic_ri` map keyed by DFS position
- [x] Enforce static/dynamic override rules in execute UI:
  - static locked positions cannot be dynamically overridden
  - fallback/static-scope rules are represented in UI state
- [x] Improve execute error display for decoded backend PT errors

### Acceptance

- [x] `POST /execute` request body matches backend schema exactly
- [x] Static override attempts are blocked or reported clearly
- [x] Execute panel shows backend error reason verbatim when available

## PR-6: JSON Panel Roundtrip Contract

### Tasks

- [x] Protocol JSON panel in `src/routes/studio/+page.svelte` must include exact connector request body fields:
  - `name`
  - `dimensions`
  - `condition_name`
  - `condition_args`
  - `static_ri`
- [x] Keep resolved tree JSON as graph/debug representation
- [x] Add explicit execute request preview JSON section:
  - `connector_name`
  - `particles_count`
  - `dynamic_ri`
- [x] Ensure edit/apply roundtrip updates flow for editable fields

### Acceptance

- [x] Connector protocol JSON equals deploy request body
- [x] Execute preview JSON equals run request body

## PR-7: Sync and Feed Consistency

### Tasks

- [x] Ensure synced registry snapshots do not drop `static_ri`:
  - `src/lib/studio/chainStudioAdapter.ts`
  - `src/lib/feed/particlePostData.ts`
- [x] Ensure opening connector from network into Studio preserves RI metadata

### Acceptance

- [x] Reload/open flows preserve static RI end-to-end
- [x] No data loss in chain->studio->json->studio loops

## PR-8: Tests and Hardening

### Tasks

- [x] Add/adjust tests in `tests/`:
  - adapter parse/serialize coverage for `static_ri`
  - execute request mapping coverage for `dynamic_ri`
  - cursor contract tests remain green
- [x] Add logic tests for DFS RI position mapping and override constraints
- [x] Add integration-level test path:
  - sync connector with `static_ri` -> open in Studio -> run -> verify request body

### Acceptance

- [x] `npm run check` passes under Node `22.12.0`
- [x] `npm run lint` passes under Node `22.12.0`
- [x] `npm test` passes under Node `22.12.0`
- [x] `npm run build` passes under Node `22.12.0`

## Execution Order

1. PR-1
2. PR-2
3. PR-3
4. PR-4
5. PR-5
6. PR-6
7. PR-7
8. PR-8

## Verification Commands

Run from `hypermusic-frontend`:

```bash
PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH" npm run check
PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH" npm run lint
PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH" npm test
PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH" npm run build
```

If your shell already honors `.nvmrc`, the shorter commands are equivalent:

```bash
npm run check
npm run lint
npm test
npm run build
```

Targeted checks during implementation:

```bash
rg -n "running_instances" src tests
rg -n "dynamic_ri|static_ri" src tests
```

## Notes

- `.nvmrc` pins Node `22.12.0`. Older local Node versions can fail before project code is checked because current Svelte/Vite tooling imports `node:util.styleText`.
- Keep naming and payload keys exactly as backend contracts (`dynamic_ri`, `static_ri`, `start_point`, `transformation_shift`).
- Treat DFS positioning as protocol-facing behavior, not only UI state.
- Prefer strict validation at edit-time and request-time to avoid backend roundtrips for obvious invalid states.
