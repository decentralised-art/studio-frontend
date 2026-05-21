# Deployable Connector Recipes

Date: 2026-05-20

This document is the operational test for every MusicXML World corpus idea.

A concept is deployable only when it can be reduced to one of these connector
recipes, with exact dimensions, transformations, child connectors, RI behavior,
and expected output.

## Operation Names

Use semantic shorthand in theory docs only when the deploy name is unambiguous:

```text
add(n)      -> math_add_v1(n)
subtract(n) -> math_subtract_v1(n)
multiply(n) -> math_multiply_v1(n)
divide(n)   -> math_divide_v1(n)
```

Do not write `add(-n)` in deploy candidates. Use `subtract(n)`.

Legacy deployed terminal scalar connectors currently use `add`, but new curated
connectors should prefer the versioned Core Collection names.

## Recipe 1: Constant Scalar Stream

Use this for a repeated value.

```text
constant_material_name
`- D1 -> terminal_scalar
        transformations: add(0)
```

RI:

```text
terminal_scalar start_point = intended constant value
terminal_scalar transformation_shift = 0
N = any positive count
```

Expected output:

```text
value, value, value, ...
```

Examples:

```text
quarter_duration_tick_v2
`- D1 -> duration_tick
        transformations: add(0)
  duration_tick start_point = 2520

velocity_constant_80
`- D1 -> velocity_midi
        transformations: add(0)
  velocity_midi start_point = 80
```

## Recipe 2: Equal-Step Generator

Use this for repeated movement through a value space.

```text
step_material_name
`- D1 -> terminal_scalar
        transformations: add(step)
```

RI:

```text
terminal_scalar start_point = initial value
terminal_scalar transformation_shift = 0
N = traversal length
```

Expected output:

```text
start, start + step, start + 2*step, ...
```

Examples:

```text
chromatic_steps_v2
`- D1 -> pitch_midi
        transformations: add(1)

quarter_tick_grid_v1
`- D1 -> onset_tick
        transformations: add(2520)
```

This recipe is also how equal-division pitch generators work:

```text
add7_circle_of_fifths_steps
`- D1 -> pitch_midi
        transformations: add(7)
```

The pitch-class interpretation is conceptual metadata over the emitted absolute
`pitch_midi` stream. That is not a system problem. Music eventually resolves
abstract pitch relations into actual pitches.

## Recipe 3: Ordered Ascending Interval Grammar

Use this for scales, modes, Messiaen modes, serial rows represented as ascending
interval successions, and any ordered pitch collection where the traversal should
continue upward into the next period.

```text
ordered_pitch_material
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(in)
```

RI:

```text
pitch_midi start_point = first emitted pitch / transposition / register
pitch_midi transformation_shift = rotation of the grammar
N = desired number of emitted pitches
```

The interval list is cyclic. If the concept is a 12-TET pitch-class collection,
the intervals usually sum to `12`.

Example:

```text
diatonic_heptatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

Smoke:

```text
pitch_midi start_point = 60
shift = 0
N = 8
output = 60, 62, 64, 65, 67, 69, 71, 72
```

## Recipe 4: Exact Bounded Value Cycle

Use this for velocity cycles, duration cycles, code cycles, and exact repeated
finite value lists.

Given desired values:

```text
v0, v1, v2, ..., v(n-1)
```

Set:

```text
terminal_scalar start_point = v0
```

For each adjacent pair, write a transformation from the current value to the
next value. Include the closing transformation from `v(n-1)` back to `v0`.

Rule:

```text
next - current > 0  -> add(next - current)
next - current = 0  -> add(0)
next - current < 0  -> subtract(current - next)
```

Example:

```text
velocity_accent_96_64_64_64
`- D1 -> velocity_midi
        transformations: subtract(32), add(0), add(0), add(32)
  velocity_midi start_point = 96
```

Output:

```text
96, 64, 64, 64, 96, 64, ...
```

Deployability condition:

```text
No subtract step may underflow for the documented start point and cycle.
```

## Recipe 5: Onset-Distance Rhythm

Use this for onset grids, additive rhythms, Euclidean hit-distance rhythms,
non-retrogradable rhythms, tala skeletons, and timeline skeletons.

```text
onset_material
`- D1 -> onset_tick
        transformations: add(d1), add(d2), ..., add(dn)
```

RI:

```text
onset_tick start_point = first onset, usually 0
onset_tick transformation_shift = rhythmic phase
N = number of attacks to emit
```

Important:

```text
d1, d2, ... are distances between attacks.
They are not duration_tick values.
```

Example:

```text
additive_3_3_2_unit1260
`- D1 -> onset_tick
        transformations: add(3780), add(3780), add(2520)
```

Smoke:

```text
start = 0
N = 6
output = 0, 3780, 7560, 10080, 13860, 17640
```

## Recipe 6: Product Note Table

Use this when a world-compatible note event table is needed.

Minimum MusicXML/MIDI product:

```text
product_name
|- D1 -> onset_material
|       transformations: add(1)
|- D2 -> duration_material
|       transformations: add(1)
`- D3 -> pitch_material
        transformations: add(1)
```

The parent dimensions use `add(1)` so each product row advances through the
corresponding child material.

Required terminal scalars:

```text
onset_tick
duration_tick
pitch_midi
```

Optional extension:

```text
product_name
|- D1 -> onset_material
|- D2 -> duration_material
|- D3 -> pitch_material
`- D4 -> velocity_material
```

The output rows are grouped by:

```text
same parent execution path + same row index
```

## Recipe 7: Simultaneous Collection / Chord Product

Use this for a sonority that should render as simultaneous notes instead of as a
melodic/arpeggiated stream.

First define a constant onset material:

```text
same_onset_tick
`- D1 -> onset_tick
        transformations: add(0)
  onset_tick start_point = 0
```

Then combine it with a constant duration and a pitch material:

```text
sonority_product
|- D1 -> same_onset_tick
|       transformations: add(1)
|- D2 -> duration_material
|       transformations: add(1)
`- D3 -> pitch_collection_material
        transformations: add(1)
```

Run with:

```text
N = number of pitches in the sonority
```

Expected result:

```text
row 0: onset 0, duration D, pitch p0
row 1: onset 0, duration D, pitch p1
row 2: onset 0, duration D, pitch p2
...
```

This is a deployable way to represent chords with the current scalar contract.
Spelling, stem direction, chord-symbol names, and historical labels remain
metadata unless the world consumes additional scalars.

## Recipe 8: Wrapper Connector

A wrapper is deployable only when it has an actual runtime purpose.

Valid purposes:

```text
freeze a useful child material under a stable name
freeze a common product structure
make a sonority/chord product discoverable
provide a pedagogical alias with exact static RI values documented
```

Invalid purpose:

```text
duplicating every tonic, mode, or rotation that RI values already express
```

## Recipe 9: Condition-Gated Connector

Current conditions are connector gates, not per-particle filters.

Deployable shape:

```text
connector_name
condition_name: logic_between_inclusive_v1
condition_args: [...]
dimensions:
  ...
```

Correct uses:

```text
enable or disable a connector branch
select whether a material participates in a larger flow
gate a social/protocol context
```

Incorrect uses:

```text
filter only high notes
remove only dissonant particles
drop every third note
validate counterpoint event by event
```

Those require transformations, world rendering policy, diagnostics, or future
particle-aware conditions.

## Non-Deployable Until Further Spec

A named musical concept is not deployable when it lacks one of these:

```text
exact terminal scalar
exact child connectors
exact transformation list
exact value cycle or interval grammar
exact RI defaults/static values
exact product grouping
exact expected smoke output
```

When in doubt, first reduce the concept to one of the recipes above.
