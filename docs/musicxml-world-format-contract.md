# MusicXML World Format Contract

This document defines the format-based contract that the MusicXML World should use for connector compatibility and score rendering.

The current implementation should return to the backend-supported format model. A world is compatible with connectors whose `format_hash` is listed in the world's manifest/descriptor. The world then reads the executed connector output by semantic terminal scalar names and execution paths.

This is the active implementation direction for the MusicXML World. The older Music Score Position Schema remains useful as a design experiment, but it should not be the first compatibility mechanism for world discovery.

The scalar vocabulary should remain world-agnostic. Terminal scalar names describe reusable musical value types, not the specific world that consumes them. The same `pitch_midi`, `duration_tick`, or `velocity_midi` stream can be consumed by MusicXML, MIDI, visual-art, analysis, or synthesis worlds.

## Goal

The contract must support sparse musical event tables without requiring dense tick timelines.

For example, a quarter-note grid should be represented as note events:

```text
row 0: onset_tick = 0,    duration_tick = 2520, pitch_midi = 60
row 1: onset_tick = 2520, duration_tick = 2520, pitch_midi = 62
row 2: onset_tick = 5040, duration_tick = 2520, pitch_midi = 64
```

It must not require generating every tick between `0` and `2520` as separate particles.

## Compatibility

Compatibility is based on format scalar metadata.

```text
MusicXML World manifest
├─ requiredScalars: [...]
└─ acceptedScalars: [...]
```

The frontend can discover compatible formats through existing backend endpoints:

```text
GET /chain/formats
GET /chain/format/:formatHash
```

For each backend format, the world reads the `scalars` list, strips the `:tail_id` suffix, and accepts the format when:

```text
requiredScalars ⊆ formatScalars
formatScalars ⊆ acceptedScalars
```

Then the frontend fetches connectors for the accepted format hashes through `GET /chain/format/:formatHash`.

This keeps world discovery format-level and avoids scanning all connectors.

## Semantic Terminal Scalars

The scalar connectors at the bottom of a connector tree define the semantic meaning of each output stream.

For musical note events, required terminal scalar names are:

```text
onset_tick
duration_tick
pitch_midi
```

Optional note-event terminal scalar names are:

```text
event_id
part
staff
voice
velocity_midi
dynamic_code
note_kind
accidental_code
stem_code
beam_group
```

The connector names above are semantic output names, not generator names. Generator connectors such as `constant_value`, `counter`, `major_scale_steps`, or `quarter_note_tick_grid` may still be used inside the tree, but the terminal scalar names exposed by the final format must identify the reusable musical value type.

## Note Grouping

Without a positional schema, note properties are grouped by execution path and row index.

Rule:

```text
same parent execution path + same array index = same note event
```

The terminal scalar name identifies the property.

Example run output:

```text
melody/onset_tick:    [0, 2520, 5040]
melody/duration_tick: [2520, 2520, 1260]
melody/pitch_midi:    [60, 62, 64]

bass/onset_tick:      [0, 5040]
bass/duration_tick:   [5040, 5040]
bass/pitch_midi:      [48, 43]
```

The world reads this as:

```text
melody row 0: onset 0,    duration 2520, pitch 60
melody row 1: onset 2520, duration 2520, pitch 62
melody row 2: onset 5040, duration 1260, pitch 64

bass row 0:   onset 0,    duration 5040, pitch 48
bass row 1:   onset 5040, duration 5040, pitch 43
```

In table form:

```text
table    row   onset_tick   duration_tick   pitch_midi
melody   0     0            2520            60
melody   1     2520         2520            62
melody   2     5040         1260            64
bass     0     0            5040            48
bass     1     5040         5040            43
```

## Event ID Override

`event_id` is optional.

If present, it can be used to group properties by explicit event id instead of row index. This enables more advanced cases where streams are generated in different orders or where sparse joins are needed.

For the first implementation pass:

1. Prefer row-index grouping.
2. Accept `event_id` but do not require it.
3. Only use `event_id` for grouping once the adapter has explicit tests for it.

## Validation

A note table is valid only when the same execution path contains:

```text
onset_tick
duration_tick
pitch_midi
```

The required arrays must have the same length.

If required lengths differ, reject that event table and report a diagnostic. Do not silently truncate required streams.

Optional arrays may be shorter. Missing optional values use defaults.

## Defaults

Default score values:

```text
ticks_per_quarter = 2520
part = 1
staff = 1
voice = 1
dynamic_code = none
```

Default notation behavior:

```text
meter = 4/4 preview fallback if no meter streams are present
clef = renderer default unless explicit clef streams are present
key = no key signature unless explicit key streams are present
tempo = no tempo marking unless explicit tempo streams are present
```

## Optional Score Tables

The contract can be extended with additional semantic terminal scalar groups.

Meter:

```text
meter_time_tick
meter_beats
meter_beat_type
```

Clef:

```text
clef_time_tick
clef_part
clef_staff
clef_sign_code
clef_line
```

Tempo:

```text
tempo_time_tick
tempo_bpm
```

Key:

```text
key_time_tick
key_fifths
key_mode_code
key_part
```

Parts:

```text
part
staff_count
part_name_code
instrument_code
```

Articulations:

```text
articulation_event_id
articulation_code
articulation_placement
```

Slurs/spanners:

```text
slur_event_id
slur_number
slur_type
slur_placement
spanner_kind
```

Each table follows the same grouping rule:

```text
same parent execution path + same row index = same event row
```

## Execution Paths

Execution paths are important because they separate parallel event tables.

The same semantic terminal scalar names may appear under multiple paths:

```text
melody/pitch_midi
bass/pitch_midi
percussion/pitch_midi
```

These are separate event tables because their parent paths differ.

The world must not require path names such as `melody` or `bass`. Path names are grouping context only. The terminal scalar names define semantic meaning.

## Format Construction

A MusicXML-compatible format should be built from world-agnostic musical terminal scalar connectors.

Minimal note-event format:

```text
onset_tick
duration_tick
pitch_midi
```

Extended note-event format:

```text
onset_tick
duration_tick
pitch_midi
part
staff
voice
velocity_midi
dynamic_code
```

The resulting `format_hash` is the fetch key, but the compatibility rule is the scalar-set predicate above.

## Relationship To The Position Schema

The Music Score Position Schema gives meaning to connector positions:

```text
root.D1 -> notes
note_table.D1 -> onset
note_table.D2 -> duration
note_table.D3 -> pitch
```

This document instead gives reusable musical meaning to terminal scalar names:

```text
... -> onset_tick
... -> duration_tick
... -> pitch_midi
```

For the current MusicXML World implementation, use this format contract because it works with existing backend format indexing.

The positional schema is not a runtime compatibility fallback for the MusicXML World. A connector that does not expose the required semantic terminal scalars should not be discovered as compatible and should not render through positional inference.

## Implementation Notes

The MusicXML World adapter should:

1. Fetch backend format hashes.
2. Fetch each format's scalar metadata.
3. Keep formats whose scalar names satisfy the required/accepted scalar-set predicate.
4. Fetch compatible connector names by those accepted format hashes.
5. Execute the selected connector with the chosen RI inputs and particle count.
6. Group output streams by parent path.
7. Identify event properties by terminal scalar name.
8. Build note rows from required note-event streams.
9. Apply defaults for missing optional streams.
10. Convert valid rows to MusicXML.
11. Send MusicXML to the sandboxed world iframe.

The MusicXML World should not list legacy positional-score or `score_onset`/`score_pitch` formats as compatible unless those names are explicitly added to `acceptedScalars`, which they currently should not be.

The adapter should report diagnostics for invalid tables, unknown score scalar names, mismatched required lengths, and unrenderable note values.
