# Worlds MVP Loop Checklist

Status: Working acceptance checklist
Owner: Product / Frontend / Backend
Created: 2026-05-08

## Purpose

This document defines the first Worlds MVP loop we should make reliable before expanding into user-uploaded IPFS worlds, broader cartography, ownership features, or richer world stores.

The MVP is not "all possible worlds". The MVP is one boringly reliable path:

```text
open Worlds
  -> choose MusicXML Score World
  -> load a compatible connector
  -> explore a runtime coordinate
  -> see a valid rendered score
  -> inspect/edit the connector in Studio when needed
```

## Product Principle

The Worlds surface is output-first.

Users should see and explore generated results before they need to understand the full connector graph or protocol vocabulary. Studio remains the authoring and inspection environment. Worlds is the place where connector states become visible cultural objects.

## Primary User Loop

1. User opens `/worlds`.
2. User sees available worlds as browseable objects.
3. User opens `/worlds/musicxml-score`.
4. No connector is loaded by default.
5. User chooses a compatible connector from the connector list.
6. The page becomes `/worlds/musicxml-score/:connectorName`.
7. The world renders that connector with default runtime values.
8. User clicks random coordinate / random iteration.
9. The app selects connector-aware runtime values and particle count.
10. The score updates inside the same world frame.
11. User can open the same state in the standalone runtime tab.
12. User can open the connector in Studio for authoring or inspection.

## Non-Goals For This MVP

- User-created world upload.
- IPFS pinning.
- On-chain world registry.
- Stored iterations.
- World ownership / collecting.
- Cartographer UI.
- Full plugin marketplace.
- General compatibility inference for all connector formats.

These can follow only after the MusicXML world loop is stable.

## Required UX Guarantees

- The page always clearly identifies the world name.
- The page always clearly identifies the loaded connector, if any.
- Connector name links to its connector page.
- Connector author links to their user page when an author address is known.
- Runtime controls use semantic labels from the world/schema when available.
- Static RI values are visible but not editable.
- Open RI values are editable.
- Random coordinate generation avoids obvious non-renderable extremes.
- Errors explain what failed without exposing raw protocol dumps as the main UI.
- Debug diagnostics can go to console, not the primary user surface.

## MusicXML World Acceptance Criteria

- `/worlds` lists MusicXML Score World.
- `/worlds/musicxml-score` opens with no connector loaded.
- `/worlds/musicxml-score/test_score_root_0_version2_6052026` loads the test connector.
- The default particles count is `12`.
- The runtime settings show one RI row per connector occurrence, not per dimension.
- For `test_score_root_0_version2_6052026`, the RI rows are:

```text
test_score_root_0_version2_6052026 -> RI 0
test_note_table_version5_06052026  -> RI 2
score_quarter_note_tick_grid       -> RI 3
constant_value                     -> static RI 5
major_scale_steps                  -> RI 7
```

- The pitch row is labelled as Pitch when the Music Score schema resolves.
- Editing `major_scale_steps` sends dynamic RI values to position `7`.
- Setting pitch start to `60` maps back to the expected MIDI-note pitch range.
- The embedded world and standalone runtime render equivalent results for the same URL/runtime values.
- The score renderer does not show user-facing diagnostic clutter for normal fallback warnings.

## Studio Acceptance Criteria

- Studio still supports the Music Score / MusicXML rendering flow.
- The Studio UI uses "Worlds" terminology where the output is now a world.
- A compatible connector can be opened from Worlds into Studio.
- Studio remains the place to inspect the graph and edit connector structure.
- The sandboxed world iframe does not get direct graph, wallet, or session access.

## Backend Acceptance Criteria For The Next Phase

The next backend phase should add only the minimum necessary world index, not IPFS first:

```text
GET  /worlds
GET  /worlds/:id
POST /worlds/validate
```

The first backend model can store first-party/local world metadata before uploads exist.

## Branching Plan

Reviewable branches should stay narrow:

```text
frontend/worlds-musicxml-mvp
frontend/studio-worlds-integration
backend/worlds-index
frontend/world-manifest-runtime
backend/world-upload-ipfs
contracts/world-registry
```

The current branch should be treated as the MusicXML Worlds MVP branch until it is clean enough to split or review.

## Verification Commands

Before the MVP branch is considered reviewable:

```sh
npm run check
npm run lint
npm test
npm run build
```

Use browser smoke checks for:

- `/worlds`
- `/worlds/musicxml-score`
- `/worlds/musicxml-score/test_score_root_0_version2_6052026`
- `/world-runtimes/musicxml-score?...`
