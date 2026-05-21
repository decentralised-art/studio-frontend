# Current Deployed Dependency Graph

This graph documents the current curated MusicXML concept network. It does not plan the next batch.

## Terminal Layer

```text
onset_tick
duration_tick
pitch_midi
velocity_midi
```

`velocity_midi` is part of the terminal scalar vocabulary but is not used by the current curated note tables.

## Onset Layer

```text
quarter_tick_grid_v1
`- onset_tick

eighth_tick_grid_v1
`- onset_tick

half_tick_grid_v1
`- onset_tick
```

## Duration Layer

```text
quarter_duration_tick_v2
`- duration_tick

eighth_duration_tick_v2
`- duration_tick

half_duration_tick_v2
`- duration_tick
```

## Pitch Layer

```text
chromatic_steps_v2
`- pitch_midi

diatonic_heptatonic_steps_v2
`- pitch_midi

anhemitonic_pentatonic_steps_v2
`- pitch_midi

whole_tone_steps_v2
`- pitch_midi

octatonic_steps_v2
`- pitch_midi
```

## MusicXML-Compatible Product Layer

```text
chromatic_ascending_quarters_v3
|- quarter_tick_grid_v1
|- quarter_duration_tick_v2
`- chromatic_steps_v2

diatonic_mode_quarters_v3
|- quarter_tick_grid_v1
|- quarter_duration_tick_v2
`- diatonic_heptatonic_steps_v2

anhemitonic_pentatonic_eighths_v3
|- eighth_tick_grid_v1
|- eighth_duration_tick_v2
`- anhemitonic_pentatonic_steps_v2

whole_tone_halves_v3
|- half_tick_grid_v1
|- half_duration_tick_v2
`- whole_tone_steps_v2

octatonic_mode_quarters_v3
|- quarter_tick_grid_v1
|- quarter_duration_tick_v2
`- octatonic_steps_v2
```

## Reuse Summary

`quarter_tick_grid_v1` is reused by:

```text
chromatic_ascending_quarters_v3
diatonic_mode_quarters_v3
octatonic_mode_quarters_v3
```

`quarter_duration_tick_v2` is reused by:

```text
chromatic_ascending_quarters_v3
diatonic_mode_quarters_v3
octatonic_mode_quarters_v3
```

Each pitch material currently has one deployed product-table reuse:

```text
chromatic_steps_v2 -> chromatic_ascending_quarters_v3
diatonic_heptatonic_steps_v2 -> diatonic_mode_quarters_v3
anhemitonic_pentatonic_steps_v2 -> anhemitonic_pentatonic_eighths_v3
whole_tone_steps_v2 -> whole_tone_halves_v3
octatonic_steps_v2 -> octatonic_mode_quarters_v3
```

## Format Hash Layers

Single-terminal onset materials:

```text
9c500f199ebf4695cb4e4bc28643aed1f5912fc393d0b6ce22dd2c8de52727e8
```

Single-terminal duration materials:

```text
a7841810e18e653f4a7a2560606d3aa7ff406515899f0e2c10bdb93b175c1783
```

Single-terminal pitch materials:

```text
f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797
```

MusicXML-compatible note tables:

```text
3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702
```
