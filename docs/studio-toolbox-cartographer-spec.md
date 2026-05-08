# Studio Toolbox Cartographer Spec

Status: Proposal
Owner: Frontend / Assistant
Created: 2026-05-08

## Goal

Add a **Cartographer** tab to the right-side panel of `/studio`.

The Cartographer reuses the existing Studio assistant's knowledge of connector construction, Music Score positional schemas, RI semantics, and Studio actions. Instead of responding with chat text and immediately editing the flow, it generates a coordinate map of possible connector structures that can be built from the user's current toolbox.

The user navigates that map and chooses coordinates. A selected coordinate can then spawn a connector scaffold into the Studio flow.

## Non-Goals

The first version should not:

- search the whole network;
- suggest missing toolbox elements;
- rank one musical element as better than another;
- deploy connectors;
- remove or disconnect existing graph content;
- require Cartography for Studio or Gallery workflows.

Cartography is optional. It is one creative tool for exploring the user's current materials.

## Core Principle

```text
Cartography never invents ingredients.
It only arranges, combines, and explains the user's toolbox.
```

The LLM can infer possible roles for toolbox elements, but the deterministic app layer must validate every coordinate before it becomes actionable.

## Current Assistant Reuse

The current Studio assistant already knows how to:

- inspect the flow;
- add connectors;
- connect connectors;
- add transformations to connector dimensions;
- set RI values;
- run connectors;
- reason about the Music Score positional schema.

The Cartographer should reuse:

- assistant API/model settings;
- structured model calls;
- existing assistant tool-call types where possible;
- existing dispatcher for applying safe actions.

The interaction surface changes:

```text
Assistant chat
  prompt -> one plan -> text/actions

Cartographer
  toolbox context -> many candidate coordinates -> user selects one -> actions
```

## Right Panel Placement

Extend the Studio right panel mode:

```ts
type RightPanelMode = "assistant" | "inspector" | "runner" | "cartographer" | "hidden";
```

Add a Cartographer icon beside Assistant, Inspector, and Runner.

The Cartographer panel should include:

- target selector, initially Music Score only;
- generate map button;
- coordinate grid;
- selected coordinate detail;
- action preview;
- spawn into flow button;
- validation/error state.

## Cartographer Context

The context sent to the model should be toolbox-bounded:

```ts
type CartographerContextSnapshot = {
  source: "toolbox_only";
  activeTab: {
    id: string;
    label: string;
    readOnly: boolean;
    rootConnector: string | null;
  } | null;
  currentFlow: {
    connectors: ConnectorSummary[];
    links: LinkSummary[];
  };
  toolbox: {
    connectors: ConnectorSummary[];
    transformations: TransformationSummary[];
    conditions: ConditionSummary[];
  };
  targetPlugin: {
    id: string;
    name: string;
    formatHashes: string[];
  };
  pluginSchemaSummary: {
    kind: "music-score-v1";
    requiredSlots: string[];
    optionalSlots: string[];
  };
};
```

The context should not include a broad network catalog in the first version. If a toolbox item needs hydration from chain metadata, Studio can hydrate that item before calling the model, but the model should only see the user's toolbox subset.

## Cartography Manifest

The model should return strict JSON:

```ts
type CartographyManifest = {
  source: "toolbox_only";
  targetPlugin: string;
  axes: CartographyAxis[];
  coordinates: CartographyCoordinate[];
};

type CartographyAxis = {
  id: string;
  label: string;
  description: string;
};

type CartographyCoordinate = {
  id: string;
  x: number;
  y: number;
  title: string;
  structureSummary: string;
  uses: {
    connectors: string[];
    transformations: string[];
    conditions: string[];
  };
  status: "spawnable" | "partial" | "invalid";
  validationNotes: string[];
  toolCalls: AssistantToolCall[];
};
```

Coordinate status is structural, not aesthetic:

- `spawnable`: can be applied to the current editable flow after validation;
- `partial`: describes a valid partial structure, but not enough to spawn a complete target output;
- `invalid`: not actionable after validation.

Avoid labels like "recommended" or "best".

## Model Prompt Rules

The Cartographer prompt should state:

```text
You are DCN Studio Cartographer.
Use only current toolbox elements.
Do not suggest missing elements.
Do not rank elements by aesthetic quality.
Create a map of structurally different possible connector arrangements.
Each coordinate is a possible build intent.
Return strict JSON only.
```

For Music Score, include the positional schema summary:

```text
SCORE_ROOT D1 = Notes
NOTE_TABLE D1 = onset_tick
NOTE_TABLE D2 = duration_tick
NOTE_TABLE D3 = pitch
NOTE_TABLE D5 = part
NOTE_TABLE D6 = staff
NOTE_TABLE D7 = voice
NOTE_TABLE D8 = dynamic_code
```

## Deterministic Validation

Before showing a coordinate as spawnable, validate:

- every referenced connector is in the toolbox or current flow;
- every referenced transformation is in the toolbox or current flow;
- every referenced condition is in the toolbox or current flow;
- every tool call matches the existing assistant tool schema;
- the tool-call list excludes destructive and deploy actions in v1;
- the current tab is editable;
- target connector names can be resolved without ambiguity;
- flow edits do not violate obvious Studio graph constraints.

If validation fails, downgrade the coordinate to `invalid` or `partial` and show the reason.

## Allowed Actions In V1

Allow:

- `add_connector_to_flow`
- `connect_connectors`
- `set_connector_ri_mode`
- `set_connector_ri_values`
- `add_transformation_to_dimension`
- `run_connector` only as an explicit optional follow-up

Disallow:

- `deploy_connector`
- `disconnect_connectors`
- `remove_transformation_from_dimension`
- arbitrary file/network actions

## Frontend Modules

Add:

```text
src/lib/studio/cartographer/types.ts
src/lib/studio/cartographer/schema.ts
src/lib/studio/cartographer/orchestrator.ts
src/lib/studio/cartographer/validate.ts
src/lib/components/studio/StudioCartographerPanel.svelte
```

Update:

```text
src/routes/studio/+page.svelte
```

Integration state:

```ts
let cartographerManifest = $state<CartographyManifest | null>(null);
let cartographerBusy = $state(false);
let cartographerError = $state<string | null>(null);
let selectedCartographyCoordinateId = $state<string | null>(null);
```

## Backend Requirements

No backend change is required for the first local Cartographer implementation if it uses the same assistant endpoint/settings as the current Studio assistant.

Potential later backend support:

- persist user-generated cartography manifests;
- cache model output for the same toolbox/context hash;
- share cartography maps between users/groups;
- optionally record which coordinate was used to configure a saved static connector state, if the user chooses to make the result permanent at the protocol level.

## Test Plan

Unit tests:

- parse valid cartography manifest;
- reject external toolbox references;
- reject destructive tool calls;
- downgrade invalid coordinates;
- handle empty toolbox;
- preserve partial coordinates without presenting them as spawnable.

E2E smoke test:

1. Open Studio.
2. Open right-panel Cartographer.
3. Mock a structured model response.
4. Generate a map.
5. Select a coordinate.
6. Spawn into flow.
7. Verify expected connectors/actions appear.

## Open Questions

- Should coordinates be shown as a two-dimensional grid, list, or hybrid graph?
- Should partial coordinates be spawnable as incomplete scaffolds, or only inspectable?
- Should Cartographer ever call `run_connector`, or should running remain a separate Runner action?
- Should a generated cartography map be saved in local Studio session state?
