# Studio Circular Material Connector Spec

Status: Proposal
Owner: Frontend / Protocol
Created: 2026-05-06

## Goal

Design a single developed DCN/PT connector that carries the useful musical idea from Shepard: circular musical materials can be explored by changing coordinates. The connector should output Music Score plugin-compatible streams, so the result renders as MusicXML through the existing Studio score pipeline.

This is different from the Coordinate Explorer proposal. The Coordinate Explorer is a general Studio UI for RI-space navigation. This proposal is a concrete musical generator connector.

## Summary

Build a top-level connector such as:

```text
circular_material_score_v1
```

It should declare a Music Score-compatible format hash and output positional score streams:

```text
onset_tick
duration_tick
pitch
part
staff
voice
meter
clef
tempo
key
```

The musical material is shaped by circular transformation sequences. The user-facing controls are not stored as app-only state. They map to PT-native coordinates:

```text
particles_count
dynamic_ri[position].start_point
dynamic_ri[position].transformation_shift
static_ri[position].start_point
static_ri[position].transformation_shift
```

The connector can then be run in Studio and attached to the Music Score plugin like any other score-producing connector.

## Why This Matches Shepard

The PT runner already has the core circular mechanism Shepard needed.

For each dimension, execution does this:

```text
x = running_instance.start_point
for each output index:
  output x
  x = transformations[(index + transformation_shift) % transformations.length](x)
```

That means:

- `start_point` selects the coordinate inside the material space.
- `transformation_shift` rotates the transformation loop.
- the transformation list defines the circular material grammar.
- `particles_count` defines how long the extracted progression is.

Shepard implemented this manually in JavaScript. PT can express it directly as connector execution.

## Connector Shape

The top-level connector should use the Music Score positional schema:

```text
SCORE_ROOT circular_material_score_v1
├─ D1 NOTES
│  └─ NOTE_SET
│     ├─ D1 TREBLE_NOTE_TABLE
│     │  ├─ D1 onset_tick
│     │  ├─ D2 duration_tick
│     │  ├─ D3 pitch
│     │  ├─ D5 part
│     │  ├─ D6 staff
│     │  └─ D7 voice
│     └─ D2 BASS_NOTE_TABLE
│        ├─ D1 onset_tick
│        ├─ D2 duration_tick
│        ├─ D3 pitch
│        ├─ D5 part
│        ├─ D6 staff
│        └─ D7 voice
├─ D2 PARTS
├─ D3 METER
├─ D4 CLEFS
├─ D5 TEMPO
└─ D6 KEY
```

The exact internal connector names do not define the score meaning. The positional slots do. The names should still be readable in Studio because users need to understand the generated tree.

From the user's perspective this can still be one developed connector: `circular_material_score_v1`. Internally it may reference reusable child connectors or collector archetypes because PT connector trees are built through named composites.

## Musical Dimensions

### Pitch

Pitch should be a circular interval walk.

Example major-mode interval loop:

```text
+2, +2, +1, +2, +2, +2, +1
```

With:

```text
start_point = 60
transformation_shift = 0
```

the output starts around C. With:

```text
start_point = 62
transformation_shift = 3
```

the same connector explores a different coordinate of the material.

For robust score output, this should use a wrapping pitch transformation rather than unbounded addition:

```text
wrap_add_range(step, floor, size)
```

Example:

```text
floor = 48
size = 36
```

keeps output in a playable three-octave region. Different staff registers can use different floors and ranges.

### Onset

Onset should be a cumulative circular rhythm walk.

Example:

```text
start_point = 0
transformations = add(2520), add(1260), add(1260), add(5040)
```

This emits global score ticks:

```text
0, 2520, 3780, 5040, 10080, ...
```

`transformation_shift` rotates the rhythmic phase.

### Duration

Duration should emit the current value of a duration cycle.

This is easier with a transformation like:

```text
set_value(value)
```

Example:

```text
start_point = 2520
transformations = set_value(1260), set_value(1260), set_value(5040), set_value(2520)
```

This keeps duration values explicit instead of deriving them from onset differences in the frontend.

### Part, Staff, Voice

For the first connector version:

```text
part = 1
staff = 1 or 2
voice = 1
```

These can be constant streams using current reusable constant patterns.

The treble note table should use staff `1`.

The bass note table should use staff `2`.

Later versions can make staff/voice circular too, but the first version should keep them stable so the score is readable.

### Meter, Clef, Tempo, Key

These should be short constant score layers:

```text
parts:
  part = 1
  staff_count = 2

clefs:
  staff 1 -> G clef, line 2
  staff 2 -> F clef, line 4

tempo:
  time_tick = 0
  bpm = 120

key:
  time_tick = 0
  fifths = 0
  mode = major
```

Meter can be included for MusicXML compatibility even if the UI chooses not to emphasize bar lines. The Music Score plugin currently expects measured output for full notation behavior.

## Minimal Transformation Vocabulary

This connector becomes much easier if the protocol corpus has a small set of reusable transformations:

```text
add(value)
set_value(value)
wrap_add_range(step, floor, size)
clamp(min, max)
mod(value)
```

The most important additions for this design are:

- `set_value`
  - Lets a stream cycle through explicit values such as durations, staffs, voices, or dynamics.
- `wrap_add_range`
  - Lets pitch and register stay circular without drifting out of score/playback range.

The connector should avoid needing custom frontend logic for these calculations.

## User-Facing Parameters

A simple UI for this connector could expose musical controls while storing them as RI values.

| UI Parameter                | PT Mapping                                              |
| --------------------------- | ------------------------------------------------------- |
| Length                      | `particles_count`                                       |
| Pitch root / register       | pitch stream `start_point`                              |
| Pitch rotation / mode phase | pitch stream `transformation_shift`                     |
| Rhythm start                | onset stream `start_point`                              |
| Rhythm phase                | onset and duration stream `transformation_shift`        |
| Treble material phase       | treble pitch RI                                         |
| Bass material phase         | bass pitch RI                                           |
| Density                     | selected rhythm connector or transformation args, later |
| Tempo                       | tempo layer static RI or connector specialization       |

The UI does not need to show a pyramid. It can still feel like a map because every meaningful control is a coordinate into a circular material space.

## Example Execute Payload

An execution request might look like:

```json
{
  "connector_name": "circular_material_score_v1",
  "particles_count": 64,
  "dynamic_ri": {
    "8": {
      "start_point": 60,
      "transformation_shift": 0
    },
    "12": {
      "start_point": 0,
      "transformation_shift": 2
    },
    "16": {
      "start_point": 2520,
      "transformation_shift": 2
    },
    "24": {
      "start_point": 36,
      "transformation_shift": 4
    }
  }
}
```

The exact RI positions must come from Studio's DFS RI positioning engine for the final connector tree. The important point is that the musical controls compile to ordinary `dynamic_ri`.

## Expected Output

The connector returns normal execute streams:

```text
/circular_material_score_v1:0/.../onset_tick:0      [0, 2520, 3780, ...]
/circular_material_score_v1:0/.../duration_tick:1   [2520, 1260, 1260, ...]
/circular_material_score_v1:0/.../pitch:2           [60, 62, 64, ...]
/circular_material_score_v1:0/.../part:4            [1, 1, 1, ...]
/circular_material_score_v1:0/.../staff:5           [1, 1, 1, ...]
/circular_material_score_v1:0/.../voice:6           [1, 1, 1, ...]
```

The Music Score plugin then interprets these streams through the positional schema and serializes MusicXML. No Shepard-specific adapter is needed.

## Frontend Integration

The first frontend layer should be a connector-specific control panel, not a general coordinate map.

When Studio sees this connector attached to the Music Score plugin, it can offer:

- length control;
- pitch root control;
- pitch phase control;
- rhythm phase control;
- treble/bass phase controls;
- run button;
- score preview;
- MusicXML export through the existing plugin.

Every control should show or be able to reveal its underlying RI mapping. This keeps the UI musical while remaining protocol-native.

## Implementation Sequence

### Step 1: Local Prototype

Prototype the connector in Studio's local registry using existing transformations where possible.

Acceptance:

- executing the connector returns score-compatible streams;
- Music Score plugin renders a two-staff score;
- changing pitch/rhythm RI changes the score without code changes.

### Step 2: Transformation Gaps

Identify whether current corpus transformations are enough.

Likely missing:

- `set_value`
- `wrap_add_range`

If missing, publish these as small reusable transformations before publishing the final connector.

### Step 3: Developed Connector

Build and publish `circular_material_score_v1` as a top-level connector with Music Score-compatible format hash.

Acceptance:

- the connector appears in Studio as compatible with Music Score;
- `particles_count` controls score length;
- dynamic RI controls circular pitch and rhythm phases;
- output streams pass score diagnostics.

### Step 4: Connector-Specific Controls

Add optional frontend metadata or name-based support so Studio can present this connector with musical controls instead of raw RI fields.

This is optional for protocol correctness. The connector should work even with generic Studio RI controls.

## Non-Goals

The first version should not:

- port Shepard's JavaScript generator;
- generate raw MusicXML tree rows directly;
- require a pyramid UI;
- require a backend API change;
- depend on frontend-only score generation;
- solve arbitrary counterpoint or voice-leading.

## Open Questions

- Should the first connector output one note table with staff defaults, or two note tables for treble and bass?
- Should meter be generated as 4/4 for MusicXML compatibility, or should the score plugin better support ametric output?
- Should the connector expose phases independently for treble and bass, or keep them linked through static RI?
- Do we want this as one general `circular_material_score_v1`, or several musical specializations such as `circular_piano_material_v1`, `circular_modal_material_v1`, and `circular_rhythm_material_v1`?

## Recommendation

Start with a two-staff `circular_material_score_v1` connector that emits measured-note positional streams, not raw MusicXML tree rows.

Use PT's native cyclic transformation execution as the engine:

```text
RI start = coordinate
RI shift = circular phase
transformation sequence = material grammar
particles_count = progression length
```

This gives us the core Shepard idea in a form that belongs to DCN/PT and works with the existing Music Score plugin.
