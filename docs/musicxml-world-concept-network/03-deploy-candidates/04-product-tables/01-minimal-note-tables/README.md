# Product Table Candidate Sketches

Status: draft

Precision: P2/P3 mixed

This file sketches MusicXML/MIDI-compatible product connectors that can be built after their material dependencies are deployed and smoke-tested.

The product shape is:

```text
product_name
|- D1 -> onset material
|       transformations: add(1)
|- D2 -> duration material
|       transformations: add(1)
`- D3 -> pitch material
        transformations: add(1)
```

The terminal scalar set must include:

```text
onset_tick
duration_tick
pitch_midi
```

Expected MusicXML-compatible note-table format hash:

```text
3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702
```

## circle_of_fifths_quarter_notes

Dependencies:

```text
quarter_tick_grid_v1
quarter_duration_tick_v2
add7_circle_of_fifths_steps
```

Tree:

```text
circle_of_fifths_quarter_notes
|- D1 -> quarter_tick_grid_v1
|       transformations: add(1)
|- D2 -> quarter_duration_tick_v2
|       transformations: add(1)
`- D3 -> add7_circle_of_fifths_steps
        transformations: add(1)
```

Smoke convention:

```text
N: 8
onset_tick base: 0
duration_tick base/static: 2520
pitch_midi base: 60
expected note prefix:
  0,    2520, 60
  2520, 2520, 67
  5040, 2520, 74
  7560, 2520, 81
```

Status:

```text
blocked until add7_circle_of_fifths_steps is deployed.
```

## harmonic_minor_eighth_notes

Dependencies:

```text
eighth_tick_grid_v1
eighth_duration_tick_v2
harmonic_minor_heptatonic_steps
```

Tree:

```text
harmonic_minor_eighth_notes
|- D1 -> eighth_tick_grid_v1
|       transformations: add(1)
|- D2 -> eighth_duration_tick_v2
|       transformations: add(1)
`- D3 -> harmonic_minor_heptatonic_steps
        transformations: add(1)
```

Smoke convention:

```text
N: 8
onset_tick base: 0
duration_tick base/static: 1260
pitch_midi base: 60
pitch_midi transformation_shift: 0
expected pitch prefix: 60, 62, 63, 65, 67, 68, 71, 72
```

Status:

```text
blocked until harmonic_minor_heptatonic_steps is documented as P3 and deployed.
```

## messiaen_mode_3_triplets

Dependencies:

```text
quarter_triplet_tick_grid
quarter_triplet_duration_tick
messiaen_mode_3_steps
```

Tree:

```text
messiaen_mode_3_triplets
|- D1 -> quarter_triplet_tick_grid
|       transformations: add(1)
|- D2 -> quarter_triplet_duration_tick
|       transformations: add(1)
`- D3 -> messiaen_mode_3_steps
        transformations: add(1)
```

Smoke convention:

```text
N: 9
onset_tick base: 0
duration_tick base/static: 840
pitch_midi base: 60
pitch_midi transformation_shift: 0
expected onset prefix: 0, 840, 1680, 2520, 3360
expected pitch prefix: 60, 62, 63, 64, 66, 67, 68, 70, 71
```

Status:

```text
blocked until quarter_triplet materials and messiaen_mode_3_steps are deployed.
```

## chromatic_sixteenth_notes

Dependencies:

```text
sixteenth_tick_grid
sixteenth_duration_tick
chromatic_steps_v2
```

Tree:

```text
chromatic_sixteenth_notes
|- D1 -> sixteenth_tick_grid
|       transformations: add(1)
|- D2 -> sixteenth_duration_tick
|       transformations: add(1)
`- D3 -> chromatic_steps_v2
        transformations: add(1)
```

Smoke convention:

```text
N: 8
onset_tick base: 0
duration_tick base/static: 630
pitch_midi base: 60
expected note prefix:
  0,    630, 60
  630,  630, 61
  1260, 630, 62
  1890, 630, 63
```

Status:

```text
blocked until sixteenth_tick_grid and sixteenth_duration_tick are deployed.
```
