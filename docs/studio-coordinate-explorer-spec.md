# Studio Coordinate Explorer Spec

Status: Proposal
Owner: Frontend
Created: 2026-05-06

## Goal

Create a Studio component inspired by the original Shepard app idea: a musical work can be explored as a space of possible outputs, where specific coordinates generate specific musical progressions.

In Shepard, the coordinate space was built from linear rotation parameters. In PT, that idea is more general: connector dimensions, running-instance positions, transformation shifts, transformation arguments, and score slots can all act as coordinates. The frontend should expose that space without adding a Shepard-specific generator or bypassing PT.

The proposed component is a **Coordinate Explorer** inside Studio. It lets the user inspect and manipulate a selected region of PT coordinate space, then immediately hear and see the resulting output through the existing plugin runtime, MIDI path, and Music Score plugin.

## Core Idea

The component should make this relationship visible:

```text
coordinate selection
  -> runtime RI / connector parameter overrides
  -> Studio execution output streams
  -> plugin runtime data
  -> MIDI playback and/or MusicXML score preview
```

This preserves the useful part of Shepard:

- music material is not edited note by note first;
- a user navigates a structured possibility space;
- a selected coordinate or path through the space creates a concrete musical result.

It updates the old assumption:

- Shepard only had linear rotations;
- PT can use arbitrary transformation logic;
- the UI still needs a legible map so arbitrary transformations can become musically navigable.

## Existing Surfaces

The implementation should reuse current Studio runtime surfaces:

- `src/lib/studio/runtimeRiOverrides.ts`
  - Supports projected runtime RI fields: `riPosition`, `riTargetPosition`, `riStart`, `riShift`, `riLocked`.
- `src/lib/studio/riPositioning.ts`
  - Computes protocol-facing DFS RI positions for connector trees.
- `src/lib/studio/riProjectionMapping.ts`
  - Projects RI positions to visible Studio graph nodes.
- `src/routes/studio/+page.svelte`
  - Already builds Studio runtime snapshots, execute previews, node selections, plugin data, and inspector state.
- `src/lib/studio/plugins/runtime.ts`
  - Groups connector output streams into plugin runtime data.
- `src/lib/studio/plugins/scoreRuntime.ts`
  - Converts plugin runtime data into MusicXML through the score adapters.
- `src/lib/score/adapters/*`
  - Converts PT stream outputs to score trees and serialized MusicXML.

No new backend contract is required for the first version.

## Recommended MVP

Build a local Studio side-panel view called **Coordinate Explorer**.

It should operate on the current active root connector and the currently selected connector, dimension, or plugin target.

Initial axes:

```text
X axis: riStart
Y axis: riShift
```

Initial target:

```text
selected projected RI position
```

Initial behavior:

1. User selects a connector/dimension node in Studio.
2. Coordinate Explorer identifies the projected RI position for that node.
3. The panel shows a small 2D grid of candidate `(riStart, riShift)` values.
4. Hovering a cell shows the override that would be applied.
5. Clicking a cell applies `riStart` and `riShift` to the selected node state.
6. Existing Studio runtime/output/plugin preview reacts exactly as if the user edited those values manually in the inspector.

The MVP should not execute every visible grid cell against the network. It should apply one selected coordinate at a time. Batch preview can come later.

## UI Placement

Prefer Studio over the `/map` route.

The `/map` route is useful as a network ontology view, but this component is about authoring and auditioning a musical/protocol state. It needs the selected graph node, active root, execute preview, plugin targets, score preview, and runtime override controls that already live in Studio.

Suggested placement:

- Add a new right-panel mode or inspector tab: `Coordinate`.
- Keep it near the current node inspector because it edits the same RI fields.
- When no compatible node is selected, show a compact unavailable state.
- When a Music Score plugin is attached, show score-preview status and adapter statistics.
- When MIDI-compatible streams exist, show playback/export status through existing plugin data.

The first version should be utility-first and compact. This is an authoring tool, not a landing page.

## State Model

Introduce a small pure model before building UI:

```ts
export type CoordinateExplorerAxis = {
  id: "riStart" | "riShift";
  label: string;
  min: number;
  max: number;
  step: number;
  center: number;
};

export type CoordinateExplorerTarget = {
  nodeId: string;
  label: string;
  riPosition: number;
  riTargetPosition: number;
  locked: boolean;
};

export type CoordinateExplorerPoint = {
  x: number;
  y: number;
  riStart: number;
  riShift: number;
};

export type CoordinateExplorerSelection = {
  target: CoordinateExplorerTarget;
  point: CoordinateExplorerPoint;
};
```

The model should be able to answer these questions without Svelte:

- Which selected nodes are explorable?
- Which RI position is the selected target controlling?
- What grid points should be shown for the current axis settings?
- What patch should clicking a grid point apply?
- Is the target locked or read-only?

## Data Flow

The component should not create an alternate execution path.

Use the current Studio state flow:

```text
Studio graph selection
  -> CoordinateExplorerTarget
  -> user chooses CoordinateExplorerPoint
  -> patch selected node data: riStart, riShift
  -> existing dynamic_ri preview updates
  -> executeActiveGraph uses existing request planner
  -> plugin runtime consumes returned streams
  -> score/MIDI plugins update normally
```

This keeps the component protocol-native. A coordinate is not stored as special UI-only musical state; it becomes RI state already understood by PT.

## Later Axes

After the RI MVP, axes can become more interesting.

Possible axis types:

- `riStart`
  - Offset into a running instance stream.
- `riShift`
  - Transformation shift through a connector's output space.
- `dimensionIndex`
  - Choose which dimension is being explored.
- `transformationArg`
  - Explore a specific Solidity transformation argument.
- `connectorSlot`
  - Explore static or forwarded binding slot choices.
- `scorePosition`
  - Explore positional score-tree slots, especially onset, duration, pitch, part, staff, voice.
- `pluginTarget`
  - Explore which connector output is routed to a score/MIDI plugin.

Do not implement all of these first. The correct sequence is:

1. Runtime RI axes.
2. Selected transformation argument axes for draft connectors.
3. Score-specific axes for Music Score plugin authoring.
4. Saved coordinate maps or paths.

## Path Mode

The Shepard app produced progressions from structured rotations. The PT version should eventually support paths through coordinate space.

Path mode would let a user create a sequence:

```text
(start=0, shift=0)
(start=4, shift=1)
(start=8, shift=2)
(start=12, shift=3)
```

Each point can be interpreted as:

- a manual audition preset;
- a sequence of execute states;
- a score-generating traversal;
- a future saved PT object or connector preset.

Path mode should come after the single-coordinate MVP because it raises harder questions about execution cost, timing, caching, and persistence.

## Preview Strategy

There are three useful preview levels.

### Level 1: State Preview

Show what the selected coordinate would do:

```json
{
  "position": 12,
  "start_point": 4,
  "transformation_shift": 2
}
```

This is cheap and should be part of the MVP.

### Level 2: Current Output Preview

After a selected coordinate is applied and the graph is executed, reuse existing output:

- stream count;
- note count;
- score adapter id;
- score diagnostics;
- MIDI group readiness.

This is also MVP-compatible because it uses existing execution result state.

### Level 3: Grid Cell Preview

Render a miniature statistic or glyph for many cells at once. For example:

- active stream count;
- note count;
- pitch range;
- duration range;
- diagnostic status;
- tiny sparkline.

This should not be part of the first pass unless it can be computed locally from already available data. Network-backed batch execute would need explicit throttling, cancellation, and cache invalidation.

## Persistence

Initial version:

- no persistence;
- the chosen coordinate only updates current Studio node state;
- saving/deploying follows existing connector/static RI flows.

Later versions:

- save named coordinate presets in local Studio state;
- export coordinate paths as JSON;
- attach coordinate maps to toolbox entries;
- eventually encode useful coordinate traversals as protocol-native connectors or static RI presets.

## Non-Goals

The first implementation should not:

- port Shepard_4 generator code into `hypermusic-frontend`;
- add a new backend API;
- create a second score renderer;
- replace the existing inspector RI controls;
- batch execute a whole grid by default;
- make `/map` responsible for musical authoring;
- invent a frontend-only musical format that cannot map back to PT.

## Risks

### Too Abstract

The component could become another protocol debugging panel. It needs to stay musically grounded through score/playback status and plugin output.

Mitigation:

- always show the selected target;
- always show the exact RI patch;
- when plugin output exists, show musical summary stats;
- prefer immediate audition over large explanations.

### Too Expensive

A grid of possible coordinates can tempt batch execution.

Mitigation:

- first version applies one point at a time;
- previews for non-selected cells are visual placeholders or cached local summaries;
- network execution remains explicit.

### Wrong Storage Layer

If coordinate maps become UI-only artifacts, they may drift away from PT.

Mitigation:

- MVP writes normal RI fields only;
- later persistence should compile to existing `static_ri`, `dynamic_ri`, transformation args, or connector definitions.

### Confusing Static And Dynamic RI

The component edits runtime exploration state. Static RI authoring has different deploy semantics.

Mitigation:

- first version should edit dynamic/runtime node data only;
- locked/static positions must be visibly read-only;
- promotion from explored coordinate to static connector state should be a separate explicit action later.

## Implementation Plan

### Step 1: Pure Model

Add:

```text
src/lib/studio/coordinateExplorer.ts
```

Responsibilities:

- identify explorable graph nodes;
- normalize selected node target metadata;
- build grid points around current `riStart` and `riShift`;
- create patch objects for selected cells;
- enforce locked/read-only state.

Tests:

```text
tests/studio/coordinateExplorer.test.ts
```

### Step 2: Svelte Component

Add:

```text
src/lib/components/studio/StudioCoordinateExplorer.svelte
```

Responsibilities:

- render compact grid;
- render selected target metadata;
- render coordinate patch preview;
- emit `selectPoint` event with `{ riStart, riShift }`;
- remain presentational where practical.

### Step 3: Studio Integration

Update:

```text
src/routes/studio/+page.svelte
```

Responsibilities:

- add Coordinate Explorer panel/tab;
- pass selected node and RI projection metadata into the component;
- reuse existing node patch/update functions;
- do not duplicate execute/plugin runtime logic.

### Step 4: Plugin-Aware Summary

Use existing plugin data to show:

- MIDI group count;
- score adapter id;
- note count;
- diagnostics count;
- whether MusicXML is available.

This should read existing runtime/plugin state only.

### Step 5: E2E Smoke Coverage

Add a Studio test that:

- opens Studio;
- selects an explorable connector node;
- opens Coordinate Explorer;
- clicks a coordinate cell;
- verifies `riStart` / `riShift` update;
- verifies execute preview `dynamic_ri` changes;
- verifies existing score/MIDI plugin state does not break.

## Acceptance Criteria

- Coordinate Explorer can apply `riStart` and `riShift` to a selected projected RI node.
- Locked/read-only targets cannot be modified.
- Existing inspector controls and execute preview stay in sync with Coordinate Explorer edits.
- Existing plugin runtime and score/MIDI paths are reused.
- No backend API changes are introduced.
- Unit tests cover the pure coordinate model.
- Studio E2E smoke test covers the main UI path.

## Longer-Term Direction

The deeper version of this idea is a **composition-space authoring layer** for PT:

```text
connector graph = transformation topology
coordinate explorer = navigable performance space
score/playback plugins = musical observability
saved paths = reusable compositional gestures
```

This would make PT less like a hidden execution engine and more like an instrument: the protocol still defines the transformations, but the frontend gives musicians a map they can navigate, audition, save, and eventually publish.
