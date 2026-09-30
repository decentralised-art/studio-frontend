# Rhythm And Time Space

This document organizes onset, duration, meter, tempo, rhythmic pattern, and form-time concepts.

The corpus should treat rhythm as a first-class mathematical domain, not as secondary support for pitch.

## Terminal Scalars

Current note-event terminal scalars:

```text
onset_tick
duration_tick
```

Potential score-event scalars:

```text
tempo_time_tick
tempo_bpm
meter_time_tick
meter_beats
meter_beat_type
```

Current convention:

```text
2520 ticks = one quarter note
```

This is useful because 2520 has many divisors. It can represent many common tuplets exactly.

## Two Different Kinds Of Time Stream

### Onset Distance Grammar

An onset stream is cumulative time. A transformation `add(d)` means:

```text
next onset = previous onset + d
```

So an ordered rhythm `[2520, 1260, 1260, 5040]` can be encoded directly:

```text
onset_pattern
`- D1 -> onset_tick
        transformations: add(2520), add(1260), add(1260), add(5040)
```

### Duration Value Cycle

A duration stream is not cumulative time. It is a value per note.

To output exact duration values:

```text
[2520, 1260, 1260, 5040]
```

the transformation deltas must move between values:

```text
start_point = 2520
transformations:
  subtract(1260) reaches 1260
  add(0) keeps 1260
  add(3780) reaches 5040
  subtract(2520) reaches 2520
```

Because current values are `uint32`, downward movement needs `subtract` and careful start values. This means many duration cycles are less trivial than onset cycles.

For now, constant duration connectors are safer:

```text
quarter_duration_tick_v2
`- D1 -> duration_tick
        transformations: add(0)
        static/default start_point = 2520
```

## Rhythm Taxonomy

### R1: Fixed Grids

```text
quarter grid
eighth grid
sixteenth grid
half-note grid
dotted-quarter grid
triplet grid
quintuplet grid
septuplet grid
```

Connector shape:

```text
grid_name
`- D1 -> onset_tick
        transformations: add(step_ticks)
```

Precision target:

```text
P3 when tick value and smoke output are documented.
```

### R2: Ordered Additive Patterns

Additive rhythms are ordered onset distances.

Examples:

```text
[3,3,2]
[2,3,2,3]
[2,2,3,2,2,3]
[5,5,4]
```

Tick conversion:

```text
unit_ticks * each value
```

Connector shape:

```text
additive_3_3_2_unit1260_v1
`- D1 -> onset_tick
        transformations: add(3780), add(3780), add(2520)
```

Relations:

```text
rotation_of
augmentation_of
diminution_of
same necklace class
```

### R3: Euclidean Rhythms

Euclidean rhythms distribute `k` attacks as evenly as possible over `n` pulses.

Concept representation choices:

```text
binary hit/rest mask
onset-distance sequence
note_kind stream
accent stream
```

With current MusicXML note-event grouping, onset-distance sequence is the most immediately renderable:

```text
E(k,n) -> distances between hits in pulse units
```

Example:

```text
E(3,8) as hit positions: 0, 3, 6
distance pattern: [3,3,2]
```

Connector shape:

```text
euclidean_3_8_unit1260_v1
`- D1 -> onset_tick
        transformations: add(3780), add(3780), add(2520)
```

Future richer representation:

```text
note_kind mask over all n pulses
velocity accent mask over all n pulses
```

### R4: Non-Retrogradable Rhythms

A non-retrogradable rhythm is palindromic:

```text
[a,b,c,b,a]
[a,b,b,a]
[a,b,c,d,c,b,a]
```

This maps well to ordered onset-distance cycles.

Connector shape:

```text
nonretrograde_2_3_5_3_2_unit420_v1
`- D1 -> onset_tick
        transformations: add(840), add(1260), add(2100), add(1260), add(840)
```

Relations:

```text
retrograde_equivalent
rotation variants may not preserve audible palindrome from arbitrary start
```

Important: if a user changes transformation shift, the cycle is still the same cyclic material, but the perceived palindrome may be displaced.

### R5: Talea And Color / Isorhythm

Isorhythm combines:

```text
talea = repeating rhythm pattern
color = repeating pitch pattern
```

The patterns may have different lengths.

Connector pattern:

```text
isorhythmic_note_table
|- D1 -> talea_onset_material
|- D2 -> talea_duration_material
`- D3 -> color_pitch_material
```

The product table naturally creates phase drift when the child cycles have different periods.

This is one of the most important examples native to decentralised.art because it shows why independent child connectors are better than flattened note presets.

### R6: Meter And Metric Accent

Meter is not the same as onset rhythm.

Potential scalars:

```text
meter_time_tick
meter_beats
meter_beat_type
beam_group
velocity_midi
dynamic_code
```

Patterns:

```text
simple duple
simple triple
simple quadruple
compound duple
compound triple
compound quadruple
asymmetrical meters
mixed meter cycles
polymeter
hemiola
metric modulation
```

Current practical approach:

```text
Represent metric accent as velocity/dynamic material.
Represent meter display later through meter scalar tables.
```

### R7: Tuplets And Irrational Subdivision

With `2520` ticks per quarter:

```text
quarter triplet = 840
eighth triplet = 420
quintuplet quarter subdivision = 504
septuplet quarter subdivision = 360
```

Useful connector families:

```text
triplet_grid_v1
quintuplet_grid_v1
septuplet_grid_v1
```

Tuplet notation itself may require extra MusicXML scalar metadata later. The onset/duration values can exist before notation is perfect.

### R8: Proportional Duration Grammars

Multiplication and division are musically meaningful for duration:

```text
augmentation: multiply(2)
diminution: divide(2)
dot-like expansion: multiply(3), divide(2) if ratio support exists
```

Current limitation:

`math_multiply_v1` and `math_divide_v1` are integer operations. Ratios such as 3/2 require either a composed operation or exact tick constants.

### R9: Phase, Rotation, And Polyrhythm

Rhythmic phase should be explicitly documented.

Concepts:

```text
same pattern, different transformation_shift
same pattern, different onset_tick start_point
same pattern, different N
same pattern, different unit_ticks
```

Polyrhythm and polymeter can be product or multi-voice structures:

```text
voice A onset grid 3 over period
voice B onset grid 4 over same period
```

Requires part/staff/voice handling for clean notation.

### R10: Form-Time Connectors

Higher-level rhythm concepts should include:

```text
ostinato
loop
phrase length
cycle length
section boundary
canon delay
process acceleration
process deceleration
N-limited excerpt
```

These can be expressed through onset materials, duration materials, and product connectors before we need a special "form" scalar.

## Rhythm Connector Precision Template

```text
Name:
Precision:
Role:
Terminal scalar:
Time unit:
Pattern:
Pattern kind:
Period:
Start-point meaning:
Shift meaning:
Transformations:
Equivalent rotations:
Augmentation/diminution relations:
Dependencies:
Connector tree:
Smoke output:
Notation caveats:
```

## Important Design Rule

For onset streams:

```text
transformations are distances.
```

For duration streams:

```text
transformations are transitions between duration values.
```

This difference must be documented in every duration concept or we will accidentally deploy connectors that generate cumulative durations instead of repeated duration values.
