# Worlds Architecture

Status: Proposal
Owner: Product / Frontend / Backend
Created: 2026-05-08

## Summary

decentralised.art should model user-created generative environments as **Worlds**, not merely plugins.

A world is:

```text
a published visualizer for DCN connector states
```

A world render is:

```text
compatible connector + runtime coordinate / RI input -> generated visual result
```

This is inspired by fxhash only at the level of loading a self-contained web visualizer from content-addressed storage and rendering it in an iframe. The decentralised.art version does not copy the collected-iteration storage model. It replaces the fxhash random seed with DCN connector/RIs runtime values.

```text
fxhash:
  generator code + deterministic hash -> collected iteration

decentralised.art:
  world visualizer + connector + RI coordinate -> world render
```

The world is the renderer, not the owner of the RI space. RIs are already a runnable space: the user can insert a number or coordinate, run the connector, and immediately display the resulting world. The system does not need to store specific iterations in order to render worlds.

If all RIs are static, there may be only one possible render for a connector. If one or more RIs are open/dynamic, every valid input coordinate can produce a render on demand.

## Protocol Boundary

Worlds should not be part of `chain-backend`.

PT and `chain-backend` should remain world-agnostic:

```text
connectors
transformations
conditions
formats
execute
```

The vocabulary of worlds belongs to the decentralised.art application/social layer:

```text
services-backend
studio-frontend
IPFS
optional separate world registry contract
```

This preserves DCN as a general protocol for composing heterogeneous connectors and formats.

## Core Objects

### World

```ts
type World = {
  id: string;
  name: string;
  version: string;
  creator: string;
  manifestCid: string;
  manifestHash: string;
  runtimeCid: string;
  runtimeHash: string;
  acceptedFormatHashes: string[];
  createdAt: string;
  updatedAt: string;
};
```

### World Manifest

Stored on IPFS:

```ts
type WorldManifest = {
  id: string;
  name: string;
  version: string;
  entry: string;
  runtime: "iframe";
  acceptedFormatHashes: string[];
  surfaces: Array<"world-page" | "studio-plugin">;
  permissions: string[];
  description?: string;
  preview?: string;
};
```

The first version should support sandboxed iframe worlds only.

### World Render Input

The core object is not a saved iteration. It is a runtime input that tells the host which connector to run and which RI coordinate to use.

```ts
type WorldRenderInput = {
  worldId: string;
  connectorName: string;
  connectorAddress?: string;
  connectorFormatHash: string;
  particlesCount: number;
  riCoordinate?: number | number[] | Record<string, number>;
  dynamicRiInput?: Record<
    string,
    {
      start_point: number;
      transformation_shift: number;
    }
  >;
};
```

A render can be addressed deterministically when useful:

```text
connectorName or connectorAddress
connectorFormatHash
particlesCount
RI coordinate / inserted input number(s)
RI normalization/schema version
```

This address is useful for deterministic reruns, URLs, and preview caches, but it is not a stored iteration object.

decentralised.art should not store user-selected RI iterations. If a result must be fixed permanently, the right protocol-level object is a connector/configuration with static RI values. The world then renders that static connector state like any other connector state.

## Storage Model

Use IPFS for:

- world bundle/code/assets;
- world manifest;
- preview images/videos for worlds.

Use `services-backend` for:

- upload flow;
- validation;
- pinning;
- indexing;
- user/group authorship;
- search and world browsing queries;
- preview cache;
- social activity feed.

Use an optional on-chain world registry for:

- world provenance;
- manifest/runtime CIDs and hashes;
- creator identity;
- published version history.

The chain should store references and hashes, not large runtime bundles.

## Frontend Runtime

Worlds should render in sandboxed iframes.

```text
studio-frontend
  loads world iframe from IPFS/gateway URL
  sends connector/RI render input by postMessage
  receives ready/preview/error events
```

The iframe host should be a shared frontend component, not a worlds-only implementation. The same sandboxed runtime must be embeddable in:

```text
/worlds/:slug
  choose compatible connector/RI coordinates and render them

/studio
  act as a world node with inlet connections, receive connector output, and render the run result
```

For Studio, the graph/world node remains the trusted host boundary. A connector connects to the world's inlet just like it connected to the previous Music Score plugin. The host runs the connector, converts the result into the world input payload, and sends that payload into the sandboxed iframe. The iframe never receives direct graph access, wallet/session access, or unrestricted application APIs.

Do not send large connector/RIs state only through URL parameters. URLs can contain IDs or CIDs, but runtime data should be passed by `postMessage`.

Example runtime input:

```ts
type WorldRuntimeInput = {
  worldId: string;
  requestId?: string;
  connectorName: string;
  particlesCount: number;
  riCoordinate?: number | number[] | Record<string, number>;
  dynamicRiInput?: Record<
    string,
    {
      start_point: number;
      transformation_shift: number;
    }
  >;
  executeOutput?: Array<{
    path: string;
    data: number[];
  }>;
};
```

The iframe runtime should expose a minimal world API:

```ts
window.hypermusicWorld = {
  onState(callback) {},
  requestPreview() {},
  emitReady() {},
  emitError(error) {},
};
```

The exact API can evolve, but the world should be isolated from the host app.

## Worlds Surface

Add routes:

```text
/worlds
/worlds/:slug
```

Worlds capabilities:

- browse worlds;
- open a world;
- choose a compatible connector;
- enter or randomize RI runtime values;
- render the connector state in iframe;
- open the same connector/RI runtime values in Studio later.

The worlds surface is output-oriented. It is not the primary connector editor.

## Studio Integration

Studio should provide:

```text
Run connector
  -> choose compatible world
  -> render current connector/RIs in world iframe
```

Studio should also support worlds as graph nodes:

```text
compatible connector
  -> world inlet
  -> Studio executes connector
  -> host builds WorldRuntimeInput
  -> sandboxed world iframe renders the result
```

For the first MusicXML world, this means:

```text
compatible connector output
  -> existing Music Score runtime adapter builds MusicXML
  -> MusicXML payload is sent to the iframe world
  -> OSMD renders the score inside the sandbox
```

Worlds-to-Studio should pass connector reference plus runtime RI values. It should not restore a stored iteration record.

Compatibility is based on world-declared accepted format hashes and available connector execution output.

## Backend API Plan

Add to `services-backend`:

```text
POST /worlds/upload
POST /worlds/validate
POST /worlds/publish
GET  /worlds
GET  /worlds/:id
POST /worlds/:id/render-preview
```

Backend responsibilities:

- validate world manifest schema;
- validate bundle shape;
- pin bundle and manifest to IPFS;
- store world metadata;
- index worlds for browsing/search;
- verify connector compatibility;
- optionally execute connector for preview;
- cache previews;
- connect world publication events to social feed.

## On-Chain Registry

If decentralised.art wants fxhash-like permanence, create a separate world registry contract. Do not put this into PT or `chain-backend`.

World registry fields:

```text
world_id
creator
manifest_cid
manifest_hash
runtime_cid
runtime_hash
accepted_format_hashes
version
```

The backend can index these events and expose them through decentralised.art APIs.

## Security

User worlds are untrusted code.

Initial runtime policy:

- sandboxed iframe only;
- signed/validated manifest;
- content hash verification;
- strict CSP where possible;
- permission manifest;
- no direct ESM import for user worlds;
- no direct access to app internals;
- postMessage bridge with origin/source checks.

Trusted direct imports should be first-party only and are not part of the world MVP.

## MVP Sequence

1. Define `WorldManifest` and `WorldRuntimeInput` schemas.
2. Build frontend sandboxed world renderer with local/mock worlds.
3. Add `/worlds` and `/worlds/:slug` with local/mock worlds and runtime RI controls.
4. Add Studio "Open in World" from current connector execution state.
5. Add backend world upload/validation/index APIs.
6. Add IPFS pinning and gateway handling.
7. Add preview cache.
8. Add optional on-chain world registry after the IPFS/backend flow is stable.

## Open Questions

- Should world compatibility be declared only by format hash, or also by connector name/address allowlists?
- Should previews be generated client-side, backend-side, or both?
- How should a world expose editable controls without becoming a Studio replacement?
