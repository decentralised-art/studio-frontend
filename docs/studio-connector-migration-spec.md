# Studio Connector-Centered Migration Spec

Status: historical migration record; current code is connector-first at the chain boundary
Owner: Frontend
Repo: `studio-frontend`
Last updated: 2026-03-15
Last reviewed: 2026-04-24

## Current State Note (2026-04-24)

This document records the original connector-centered migration plan. It is no longer a precise
description of current frontend gaps.

Implemented since this spec was written:

- `src/lib/chain/registryApi.ts` has connector-first chain methods and no active Studio deploy path
  posts `/chain/feature` or `/chain/particle`.
- `src/lib/studio/domain/connectorModel.ts` and `src/lib/studio/domain/slotProjection.ts` exist.
- `src/lib/chain/connectorContractAdapter.ts` round-trips current connector payloads.
- `src/lib/studio/chainStudioAdapter.ts` reads `owned_connectors`,
  `owned_transformations`, and `owned_conditions`.
- Studio deploy order is transformations, conditions, then connectors.
- Static/dynamic RI handling and execute payload construction are covered in
  `docs/pt-ri-static-dynamic-integration-checklist.md`.

Remaining frontend debt:

- `src/routes/studio/+page.svelte` still carries most Studio state and behavior in one large route
  module and should be split before major product expansion.
- Compatibility types and names such as `feature`, `particle`, and `rootParticle` still exist inside
  runtime/feed/map/mock-data layers. These are frontend compatibility shims around connector data,
  not backend source-of-truth contracts.
- Legacy/demo surfaces such as the old flow editor still reference `/feature`; they should either be
  removed from active product paths or migrated separately.
- Route names such as `/p/[id]` remain as compatibility routes even though UI copy now presents
  connectors.

## 1. Objective

Refactor Studio from the legacy `feature + particle + dimension-node` authoring model to the current PT protocol model where:

- **connector** is the primary authored unit
- dimensions are connector-internal configuration (not standalone nodes)
- each dimension owns its transformation chain
- composites and bindings are first-class per-dimension semantics
- conditions wrap connectors directly

## 2. Confirmed Upstream State (Fetched 2026-03-15)

### PT

- Local `PT/main` is behind `origin/main` by 1 commit.
- New head: `66ebe8f` (`Protocol (#4)`).
- Main protocol deltas in:
  - `solidity/contracts/connector/ConnectorBase.sol`
  - `solidity/contracts/runner/Runner.sol`

### chain-backend

- Local `chain-backend/main` is behind `origin/main` by 15 commits.
- New head: `2b49373`.
- Protocol work from former `protocol` branch is merged into `main`; `origin/protocol` is deleted.

### Practical meaning

The connector model is now fully dimension-native in server/protocol surfaces, with explicit bindings/composites semantics and no feature API in the primary route set.

## 3. Source of Truth (Current Contract)

### 3.1 Connector payload shape

From `chain-backend/src/pt/proto/connector.proto`:

- `Connector`
  - `name`
  - `dimensions[]`
  - `condition_name`
  - `condition_args[]`
- `Dimension`
  - `transformations[]` (`name`, `args[]`)
  - `composite` (string)
  - `bindings` (map<string, string>) // slotId -> connectorName

No `feature_name` in connector contract.

### 3.2 Exposed server API

From `chain-backend/src/main.cpp` and `src/api/include/api.hpp`:

- `/connector` routes are active
- `/feature` routes removed
- account response includes:
  - `owned_connectors`
  - `owned_transformations`
  - `owned_conditions`

## 4. Binding and Composite Semantics to Mirror in Studio

From PT runner + server validation + protocol tests:

1. Bindings are allowed only on dimensions with a composite.
2. Slot IDs must be numeric canonical strings (`"1"` valid, `"01"` invalid).
3. Slot IDs must be in range of child open slots (after protocol open-slot computation).
4. Binding targets must exist.
5. Duplicate canonical slot IDs within same dimension are invalid.
6. Parent bindings may override or forward into static child binding ranges (DFS-mapped addressing).
7. Rebinding over nested composites is valid and explicitly tested.

Studio must treat slot addressing as a projected index space, not a naive static index list.

## 5. In-Scope / Out-of-Scope

### In scope

- Studio data model, graph model, inspector, deploy preview, deploy execution
- chain sync for connectors/transformations/conditions
- visual composite and binding authoring UX

### Out of scope

- backend implementation
- full feed/route rename migration
- historical chain data reindexing

## 6. Original Frontend Gaps (Historical)

At the time this spec was written, the frontend still assumed the old model:

- `src/lib/studio/studioRuntime.ts`
  - registry uses `features + particles`
  - root output built as a particle referencing a feature
- `src/lib/studio/chainStudioAdapter.ts`
  - sync depends on `owned_features` and feature hydration
- `src/lib/chain/registryApi.ts`
  - API types/methods centered around `/feature` + `/particle`
- `src/routes/studio/+page.svelte`
  - node kinds and connection grammar still `feature/dimension/particle`
  - deploy pipeline posts feature then particle
- Studio node components still split by legacy entities:
  - `StudioFeatureNode.svelte`
  - `StudioDimensionNode.svelte`
  - `StudioParticleNode.svelte`

## 7. Target Frontend Domain Model

Create `src/lib/studio/domain/connectorModel.ts`:

- `StudioTransformationRef`
  - `name: string`
  - `args: number[]`

- `StudioConnectorDimension`
  - `transformations: StudioTransformationRef[]`
  - `composite?: string`
  - `bindings: Record<string, string>` // canonical slot key -> connector name
  - `riStart?: number`
  - `riShift?: number`

- `StudioConnectorDef`
  - `name: string`
  - `dimensions: StudioConnectorDimension[]`
  - `conditionName?: string`
  - `conditionArgs?: number[]`

- `StudioRegistry`
  - `connectors: Record<string, StudioConnectorDef>`
  - `transformations: Record<string, { argc: number }>`
  - `conditions: Record<string, { argc: number }>`

Add `src/lib/studio/domain/slotProjection.ts`:

- computes projected open-slot ranges for a connector dimension
- supports DFS mapping needed by binding visualization and validation

## 8. Visual Authoring Model (Studio UX)

## 8.1 Primary graph node

Replace `feature/dimension/particle` node composition with one primary `connector` node:

- node header: connector name
- body: dimension rows
- each row contains:
  - transformations summary/edit affordance
  - composite target status
  - binding count/status
- output handles: one per dimension (`out-0`, `out-1`, ...)

## 8.2 Composite authoring

- User connects `ConnectorA.out-{dim}` -> `ConnectorB`
- This sets `ConnectorA.dimensions[dim].composite = ConnectorB.name`

## 8.3 Binding authoring

For selected connector + dimension in inspector:

- show computed slot table from `slotProjection`
- each slot row supports choosing/replacing binding target connector
- enforce canonical slot IDs in UI write path
- show validation errors inline before deploy

Do not expose raw JSON map as primary editor control.

## 9. API Layer Changes (`src/lib/chain/registryApi.ts`)

Add connector-first methods/types:

- `ChainConnectorResponse`
- `getChainConnector(name, version?)`
- `postChainConnector(payload)`
- `postChainConnectorDetailed(payload)`

Deprecate old feature/particle methods from active Studio path.

Transitional fallback may remain for one short cycle only in read adapters, not in deploy path.

## 10. Chain Sync Adapter Changes (`src/lib/studio/chainStudioAdapter.ts`)

Replace old sync pipeline with:

1. read account `owned_connectors`
2. fetch each connector payload
3. normalize to canonical `StudioConnectorDef`
4. infer registry transformation/condition arg expectations
5. build library items for connectors/transformations/conditions

Remove hard dependence on `owned_features` and `owned_particles`.

## 11. Runtime and Validation Changes (`src/lib/studio/studioRuntime.ts`)

- runtime registry becomes connector-centric
- root entity: `rootConnector`
- remove standalone dimension-node assumptions

Pre-deploy validations must enforce:

- every binding dimension has a composite
- slot keys numeric canonical
- no duplicate canonical slot keys
- slot index in projected range
- transformation args count matches chain registry
- condition args count matches chain registry
- all composite and binding targets resolvable

## 12. Deploy Pipeline Rewrite (`src/routes/studio/+page.svelte`)

Deterministic order:

1. transformations
2. conditions
3. connectors

Deploy preview schema:

- `requests.transformations[]`
- `requests.conditions[]`
- `requests.connectors[]`
- `root_connector`

No `/chain/feature` or `/chain/particle` calls in connector mode.

## 13. Implementation Sequence (Updated)

### Phase A: Contract and model foundation

1. Add `connectorModel.ts`
2. Add `slotProjection.ts`
3. Add connector API methods in `registryApi.ts`

Exit:

- connector payload round-trips into canonical frontend model

### Phase B: Sync migration

1. Refactor `chainStudioAdapter.ts` to connector-only snapshot
2. Remove feature/particle dependency from sync

Exit:

- Studio network/library can hydrate from account `owned_connectors`

### Phase C: Runtime migration

1. Refactor `studioRuntime.ts` to connector registry
2. Implement projected slot computation integration

Exit:

- runtime graph can evaluate connector-based structure without legacy nodes

### Phase D: Graph and inspector migration

1. Introduce `StudioConnectorNode.svelte`
2. Remove standalone dimension node rendering
3. Add inspector editors for:

- dimensions
- transformations per dimension
- composite target per dimension
- binding targets per projected slot

Exit:

- users can author composites and bindings visually in one connector-centered flow

### Phase E: Deploy + trace migration

1. Replace feature/particle publish path with connector publish path
2. Keep deploy trace endpoint-by-endpoint logging
3. Update deploy preview tab schema

Exit:

- deploy succeeds connector-first end-to-end

### Phase F: Cleanup

1. Remove obsolete legacy Studio components from active path
2. Remove old vocabulary from Studio UI copy

Exit:

- no active Studio path relies on feature/particle API contracts

## 14. Acceptance Tests (Updated)

1. Connector authoring

- create connector with N dimensions
- verify N output handles rendered

2. Composite wiring

- connect dimension to child connector
- preview payload includes `dimensions[dim].composite`

3. Binding validation

- reject scalar-dimension binding
- reject non-canonical slot keys (`"01"`)
- reject out-of-range slot IDs
- reject missing targets

4. Nested propagation

- create child with static binding, then bind parent into projected child range
- verify visual slot mapping and successful deploy

5. Round-trip

- deploy connector tree with bindings
- refresh and verify graph reconstructs exactly

6. Regression

- no `/chain/feature` or `/chain/particle` call in connector mode

## 15. Risks and Mitigations

1. Protocol complexity in slot addressing

- Mitigation: centralized `slotProjection.ts` used by both inspector and validator

2. Large Studio page complexity

- Mitigation: extract editor/domain modules from `src/routes/studio/+page.svelte`

3. Transitional data mismatch

- Mitigation: temporary read adapter only, connector-only deploy path

## 16. Decisions Required Before Coding

1. Keep one-release read fallback for old payloads, or hard cut to connector-only now?
2. Binding UX: slot table in inspector only (recommended) or additional edge-overlay editor?
3. Route terminology migration timing (`/p/[id]` etc.) relative to Studio refactor?

## 17. Definition of Done

- Studio is connector-centered end-to-end
- dimensions are internal to connector nodes
- composites and bindings are visually authorable and validated
- deploy/sync are connector-first and match current protocol semantics
- legacy feature/particle publish path is removed from active Studio flow

## 18. Phase A (PR#1) Exact Implementation Checklist

This section defines the first implementation PR only. It is intentionally narrow and should not include graph/runtime UI rewrites yet.

### 18.1 PR#1 Goal

Ship the connector-first domain/API foundation with zero behavioral migration in Studio UI.

Deliverables:

1. Canonical connector domain types.
2. Slot key canonicalization + projected-slot helper utilities.
3. Connector contract adapter for protocol payload.
4. Connector-first API methods added to chain client.
5. Legacy methods retained but marked deprecated in comments.

### 18.2 PR#1 File-by-File Tasks

### A) Create `src/lib/studio/domain/connectorModel.ts`

Add these exported types:

```ts
export type StudioTransformationRef = {
  name: string;
  args: number[];
};

export type StudioConnectorDimension = {
  transformations: StudioTransformationRef[];
  composite?: string;
  bindings: Record<string, string>; // canonical slot key -> connector name
  riStart?: number;
  riShift?: number;
};

export type StudioConnectorDef = {
  name: string;
  dimensions: StudioConnectorDimension[];
  conditionName?: string;
  conditionArgs?: number[];
};

export type StudioRegistry = {
  connectors: Record<string, StudioConnectorDef>;
  transformations: Record<string, { argc: number }>;
  conditions: Record<string, { argc: number }>;
};
```

Rules documented in file comments:

- `bindings` keys must be canonical numeric strings (`"0"`, `"1"`, ...).
- `bindings` are only meaningful when `composite` exists.

### B) Create `src/lib/studio/domain/slotProjection.ts`

Add exported utility types/functions:

```ts
export type CanonicalSlotKey = `${number}`;

export type NormalizedBinding = {
  slotId: number;
  slotKey: CanonicalSlotKey;
  targetConnector: string;
};

export type SlotProjectionRange = {
  childSlotId: number;
  projectedStart: number;
  projectedWidth: number;
  source: "unbound" | "static";
};

export type SlotLookupResult = {
  childSlotId: number;
  rangeStart: number;
};

export function parseCanonicalSlotKey(input: string): number | null;
export function toCanonicalSlotKey(slotId: number): CanonicalSlotKey | null;
export function normalizeBindingsMap(bindings: Record<string, string>): NormalizedBinding[];
export function projectChildSlots(args: {
  childOpenSlots: number;
  staticBindings: Array<{ slotId: number; targetOpenSlots: number }>;
}): SlotProjectionRange[];
export function findProjectedChildSlot(
  projectedSlotId: number,
  ranges: SlotProjectionRange[],
): SlotLookupResult | null;
```

Required behavior:

- reject non-canonical keys like `"01"`, `"1.0"`, `"-1"`, `"a"`.
- projection ranges sorted by `projectedStart`.
- binary-search-safe ordering guaranteed.

### C) Create `src/lib/chain/connectorContractAdapter.ts`

Add protocol adapter functions:

```ts
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import type { ChainConnectorResponse } from "$lib/chain/registryApi";

export function fromProtocolConnectorPayload(payload: ChainConnectorResponse): StudioConnectorDef;
export function toProtocolConnectorPayload(connector: StudioConnectorDef): {
  name: string;
  dimensions: Array<{
    transformations: Array<{ name: string; args: number[] }>;
    composite?: string;
    bindings?: Record<string, string>;
  }>;
  condition_name?: string;
  condition_args?: number[];
};
```

Behavior:

- Normalize missing arrays/maps to empty values.
- Trim connector/transformation/composite names.
- Keep slot keys canonical; throw on invalid keys.

Note: legacy adapter functions are not required in PR#1.

### D) Modify `src/lib/chain/registryApi.ts`

Add connector-first API types:

```ts
export type ChainConnectorResponse = {
  name?: string;
  owner?: string;
  dimensions?: Array<{
    transformations?: Array<{ name?: string; args?: number[] }>;
    composite?: string;
    bindings?: Record<string, string>;
  }>;
  condition_name?: string;
  condition_args?: number[];
};
```

Add methods:

```ts
export const getChainConnector: (name: string, version?: string) => Promise<ChainConnectorResponse>;
export const postChainConnector: (payload: {
  name: string;
  dimensions: Array<{
    transformations: Array<{ name: string; args: number[] }>;
    composite?: string;
    bindings?: Record<string, string>;
  }>;
  condition_name?: string;
  condition_args?: number[];
}) => Promise<ChainConnectorResponse>;
export const postChainConnectorDetailed: (payload: {
  name: string;
  dimensions: Array<{
    transformations: Array<{ name: string; args: number[] }>;
    composite?: string;
    bindings?: Record<string, string>;
  }>;
  condition_name?: string;
  condition_args?: number[];
}) => Promise<ChainApiPostResult<ChainConnectorResponse>>;
```

Legacy methods stay in place for now, but add `// TODO(connector-migration): remove after Phase E` comments above old feature/particle methods.

### E) Optional tests in PR#1 (recommended)

If test harness is available, add unit tests for `slotProjection.ts`:

- canonical key parsing (`"1"` pass, `"01"` fail)
- sorting + normalization behavior
- projected range construction
- `findProjectedChildSlot` lookup correctness

If no unit harness exists, include deterministic inline assertions in a dedicated dev-only test module under `src/lib/studio/domain/__tests__/` for follow-up integration.

### 18.3 Explicitly Out of Scope for PR#1

Do not include in PR#1:

- `src/routes/studio/+page.svelte` graph rewrite
- `studioRuntime.ts` connector migration
- `chainStudioAdapter.ts` migration
- new node components (`StudioConnectorNode.svelte`)
- deploy pipeline switch to connector endpoints

### 18.4 PR#1 Acceptance Checklist

All must pass before merge:

1. `registryApi.ts` exports connector methods and compiles.
2. New domain files compile with strict TS typing.
3. Slot helpers reject non-canonical slot keys.
4. No runtime/UI behavior changed yet.
5. Lint + format clean in changed files.

### 18.5 PR#1 Suggested Commit Partition

Use 3 commits in one PR:

1. `studio(domain): add connector model and slot projection utilities`
2. `chain(api): add connector endpoints and payload types`
3. `chain(adapter): add protocol connector payload adapter`
