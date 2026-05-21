# Rhythm Candidate Catalog

This document is the second-pass candidate catalog for rhythm and time concepts.

It makes concrete onset, duration, rest-mask, tempo, and metric-accent families that can later become P2/P3 concept docs.

## Tick Reference

Current convention:

```text
2520 ticks = one quarter note
```

Useful exact values:

```text
whole note          10080
half note            5040
dotted half          7560
quarter note         2520
dotted quarter       3780
eighth note          1260
dotted eighth        1890
sixteenth             630
quarter triplet       840
eighth triplet        420
quarter quintuplet    504
quarter septuplet     360
```

This grid supports many common tuplets without floating point values.

## Period Enumeration Policy

Rhythm and onset materials can be organized as ordered partitions of a time period.

An onset grammar is:

```text
[d1, d2, ..., dn]
sum(di) = period
di > 0
```

Connector shape:

```text
rhythm_p10080_n4_2520_1260_1260_5040
`- D1 -> onset_tick
        transformations: add(2520), add(1260), add(1260), add(5040)
```

Rotations are rhythmic phase:

```text
transformation_shift 0 -> starts from d1
transformation_shift 1 -> starts from d2
```

Complexity order for period `T`:

```text
T_N1
T_N2
T_N3
...
```

Within each `N`, sort by:

```text
smallest tick unit
alphabet size
symmetry order
ratio complexity
number of distinct attacks per period
```

This gives a finite mathematical map of onset possibilities without starting from named styles.

Smoke example:

```text
connector: rhythm_p10080_n4_2520_1260_1260_5040
start: 0
shift: 0
N: 8
expected onsets: 0, 2520, 3780, 5040, 10080, 12600, 13860, 15120
```

Do not copy this onset grammar directly into a duration connector. Durations are value streams and need the duration-cycle rules below.

## Fixed Onset Grid Candidates

```text
whole_tick_grid
  onset grammar: [10080]
  precision: P2 connector archetype

half_tick_grid
  onset grammar: [5040]
  deployed: half_tick_grid_v1

quarter_tick_grid
  onset grammar: [2520]
  deployed: quarter_tick_grid_v1

eighth_tick_grid
  onset grammar: [1260]
  deployed: eighth_tick_grid_v1

sixteenth_tick_grid
  onset grammar: [630]
  precision: P2 connector archetype

quarter_triplet_tick_grid
  onset grammar: [840]
  precision: P2 connector archetype

eighth_triplet_tick_grid
  onset grammar: [420]
  precision: P2 connector archetype

quintuplet_quarter_grid
  onset grammar: [504]
  precision: P2 connector archetype

septuplet_quarter_grid
  onset grammar: [360]
  precision: P2 connector archetype
```

## Constant Duration Candidates

Constant durations use:

```text
duration material
`- D1 -> duration_tick
        transformations: add(0)
        static/default start_point = duration_ticks
```

Candidates:

```text
whole_duration_tick
  value: 10080
  precision: P2 connector archetype

half_duration_tick
  value: 5040
  deployed: half_duration_tick_v2

quarter_duration_tick
  value: 2520
  deployed: quarter_duration_tick_v2

eighth_duration_tick
  value: 1260
  deployed: eighth_duration_tick_v2

sixteenth_duration_tick
  value: 630
  precision: P2 connector archetype

quarter_triplet_duration_tick
  value: 840
  precision: P2 connector archetype

eighth_triplet_duration_tick
  value: 420
  precision: P2 connector archetype

quintuplet_quarter_duration_tick
  value: 504
  precision: P2 connector archetype

septuplet_quarter_duration_tick
  value: 360
  precision: P2 connector archetype
```

## Additive Onset Patterns

Additive patterns should first be onset materials.

```text
additive_3_3_2_unit1260
  durations in units: [3,3,2]
  onset grammar ticks: [3780,3780,2520]
  period: 10080
  precision: P2 connector archetype

additive_2_3_3_unit1260
  durations in units: [2,3,3]
  onset grammar ticks: [2520,3780,3780]
  relation: rotation_of additive_3_3_2_unit1260
  precision: P2 connector archetype

additive_2_2_3_2_2_3_unit630
  durations in units: [2,2,3,2,2,3]
  onset grammar ticks: [1260,1260,1890,1260,1260,1890]
  period: 8820
  precision: P2 connector archetype

additive_5_5_4_unit630
  durations in units: [5,5,4]
  onset grammar ticks: [3150,3150,2520]
  period: 8820
  precision: P2 connector archetype
```

The period does not need to equal a 4/4 bar. Avoid forcing everything into 10080 ticks.

## Euclidean Rhythm Candidates

Represent Euclidean rhythms first as onset-distance sequences between hits.

The rotations below are canonical candidates, not the only musically valid rotations.

```text
euclidean_2_3_unit1260
  hit distances in pulses: [2,1]
  onset grammar ticks: [2520,1260]
  precision: P2 connector archetype

euclidean_2_5_unit1260
  hit distances in pulses: [3,2]
  onset grammar ticks: [3780,2520]
  precision: P2 connector archetype

euclidean_3_8_unit1260
  hit distances in pulses: [3,3,2]
  onset grammar ticks: [3780,3780,2520]
  precision: P2 connector archetype

euclidean_5_8_unit1260
  hit distances in pulses: [2,2,1,2,1]
  onset grammar ticks: [2520,2520,1260,2520,1260]
  precision: P2 connector archetype

euclidean_5_12_unit840
  hit distances in pulses: [3,2,2,3,2]
  onset grammar ticks: [2520,1680,1680,2520,1680]
  period: 10080
  precision: P2 connector archetype

euclidean_7_12_unit840
  hit distances in pulses: [2,2,1,2,2,1,2]
  onset grammar ticks: [1680,1680,840,1680,1680,840,1680]
  period: 10080
  precision: P2 connector archetype
```

Future richer Euclidean representation:

```text
note_kind mask over all pulses
velocity accent mask over all pulses
beam_group mask over all pulses
```

That likely needs a lookup/table or mask transformation.

## Non-Retrogradable Rhythm Candidates

These are palindromic onset-distance patterns.

```text
nonretrograde_1_2_1_unit840
  onset grammar ticks: [840,1680,840]
  precision: P2 connector archetype

nonretrograde_2_3_2_unit840
  onset grammar ticks: [1680,2520,1680]
  precision: P2 connector archetype

nonretrograde_1_2_3_2_1_unit420
  onset grammar ticks: [420,840,1260,840,420]
  precision: P2 connector archetype

nonretrograde_3_2_1_2_3_unit420
  onset grammar ticks: [1260,840,420,840,1260]
  precision: P2 connector archetype
```

Rotation caveat:

```text
The cyclic material remains the same under shift, but the perceived palindrome may move away from the phrase boundary.
```

## Duration Value Cycle Candidates

Unlike onset patterns, duration cycles need transitions between duration values.

Example:

```text
duration_cycle_2520_1260
  desired values: [2520,1260]
  start_point: 2520
  transformations: subtract(1260), add(1260)
  precision: P2 connector archetype

duration_cycle_1260_2520_1260_5040
  desired values: [1260,2520,1260,5040]
  start_point: 1260
  transformations: add(1260), subtract(1260), add(3780), subtract(3780)
  precision: P2 connector archetype

duration_cycle_840_840_1680
  desired values: [840,840,1680]
  start_point: 840
  transformations: add(0), add(840), subtract(840)
  precision: P2 connector archetype
```

Review rule:

```text
Always document desired values and delta transformations separately.
```

## Rest And Note-Kind Masks

Rests should not be faked with zero duration unless the world explicitly supports that interpretation.

Prefer:

```text
note_kind = 0 note
note_kind = 1 rest
```

Candidates:

```text
note_kind_all_notes
  values: [0]
  precision: P2 connector archetype

note_kind_alternating_note_rest
  values: [0,1]
  current issue: value cycle needs lookup or careful delta encoding
  precision: P1 taxonomy node

note_kind_euclidean_3_8
  values over 8 pulses: [0,1,1,0,1,1,0,1]
  current issue: requires full pulse grid, not hit-distance onset sequence
  precision: P1 taxonomy node
```

## Metric Accent Candidates

Metric accent can be a velocity or dynamic material rather than a separate rhythm stream.

```text
accent_simple_quadruple_velocity
  desired velocity cycle: [96,64,80,64]
  terminal: velocity_midi
  precision: P2 connector archetype

accent_compound_duple_velocity
  desired velocity cycle: [96,64,64,80,64,64]
  terminal: velocity_midi
  precision: P2 connector archetype

accent_3_3_2_velocity
  desired velocity cycle over attacks: [96,64,64]
  terminal: velocity_midi
  precision: P2 connector archetype
```

## Tempo-Time Candidates

Tempo is not currently required for note-event compatibility, but it is musically important.

Potential terminal scalars:

```text
tempo_time_tick
tempo_bpm
```

Candidate concepts:

```text
tempo_constant_60
tempo_constant_90
tempo_constant_120
tempo_accelerando_step2
tempo_ritardando_step2
tempo_terraced_90_120_72
```

These need the world contract and renderer behavior finalized before deployment.

## Isorhythm Product Candidate

Isorhythm is a strong model for connector interconnection.

```text
isorhythm_talea_3_3_2_color_diatonic_v1
|- D1 -> euclidean_3_8_unit1260
|- D2 -> eighth_duration_tick_v2
`- D3 -> diatonic_heptatonic_steps_v2
```

The important point is not this exact candidate. The important point is:

```text
talea and color stay independent child connectors.
```

Their different periods become musically meaningful through the product connector.

## Rhythm Candidate Precision Checklist

Before a rhythm candidate becomes P3:

```text
1. Is it an onset stream, duration stream, note_kind mask, velocity accent, or meter table?
2. Is the tick unit documented?
3. Is the period documented?
4. Are rotations meaningful and documented?
5. For durations, are desired values and transformation deltas both written?
6. Does it require lookup/mask transformations?
7. Does it require notation scalars beyond onset/duration?
8. Does the product table preserve rhythm as an independent reusable child?
```
