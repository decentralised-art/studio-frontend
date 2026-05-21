# Deployed MusicXML-Compatible Note Tables

These are C3 product concepts. They combine onset, duration, and pitch streams into MusicXML-compatible note material.

Format hash:

```text
3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702
```

Owner:

```text
b530bf08d76015080c67d6b5f00cdee53b45bdda
```

## Shared Product Pattern

```text
note_table
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

Terminal scalars:

```text
onset_tick
duration_tick
pitch_midi
```

Open RI for deployed v3 note tables:

```text
position 7 start_point          -> pitch-material scale-degree offset
position 8 start_point          -> pitch_midi base / register
position 8 transformation_shift -> pitch grammar phase
```

Smoke baseline used:

```json
{
  "7": { "start_point": 0, "transformation_shift": 0 },
  "8": { "start_point": 60, "transformation_shift": 0 }
}
```

## `chromatic_ascending_quarters_v3`

```text
Status: deployed-curated
Complexity: C3 product table
Musical role: chromatic quarter-note note table
World ownership: world-agnostic concept, MusicXML-compatible output
Terminal scalar(s): onset_tick, duration_tick, pitch_midi
```

Tree:

```text
chromatic_ascending_quarters_v3
|- D1 -> quarter_tick_grid_v1
|- D2 -> quarter_duration_tick_v2
`- D3 -> chromatic_steps_v2
```

Smoke summary:

```text
quarters, constant quarter durations, chromatic pitches from 60
```

## `diatonic_mode_quarters_v3`

```text
Status: deployed-curated
Complexity: C3 product table
Musical role: diatonic cyclic pitch material on quarter-note grid
World ownership: world-agnostic concept, MusicXML-compatible output
Terminal scalar(s): onset_tick, duration_tick, pitch_midi
```

Tree:

```text
diatonic_mode_quarters_v3
|- D1 -> quarter_tick_grid_v1
|- D2 -> quarter_duration_tick_v2
`- D3 -> diatonic_heptatonic_steps_v2
```

Smoke summary:

```text
quarters, constant quarter durations, diatonic pitches from 60
```

## `anhemitonic_pentatonic_eighths_v3`

```text
Status: deployed-curated
Complexity: C3 product table
Musical role: pentatonic cyclic pitch material on eighth-note grid
World ownership: world-agnostic concept, MusicXML-compatible output
Terminal scalar(s): onset_tick, duration_tick, pitch_midi
```

Tree:

```text
anhemitonic_pentatonic_eighths_v3
|- D1 -> eighth_tick_grid_v1
|- D2 -> eighth_duration_tick_v2
`- D3 -> anhemitonic_pentatonic_steps_v2
```

Smoke summary:

```text
eighths, constant eighth durations, pentatonic pitches from 60
```

## `whole_tone_halves_v3`

```text
Status: deployed-curated
Complexity: C3 product table
Musical role: whole-tone pitch material on half-note grid
World ownership: world-agnostic concept, MusicXML-compatible output
Terminal scalar(s): onset_tick, duration_tick, pitch_midi
```

Tree:

```text
whole_tone_halves_v3
|- D1 -> half_tick_grid_v1
|- D2 -> half_duration_tick_v2
`- D3 -> whole_tone_steps_v2
```

Smoke summary:

```text
halves, constant half durations, whole-tone pitches from 60
```

## `octatonic_mode_quarters_v3`

```text
Status: deployed-curated
Complexity: C3 product table
Musical role: octatonic cyclic pitch material on quarter-note grid
World ownership: world-agnostic concept, MusicXML-compatible output
Terminal scalar(s): onset_tick, duration_tick, pitch_midi
```

Tree:

```text
octatonic_mode_quarters_v3
|- D1 -> quarter_tick_grid_v1
|- D2 -> quarter_duration_tick_v2
`- D3 -> octatonic_steps_v2
```

Smoke summary:

```text
quarters, constant quarter durations, octatonic pitches from 60
```

Shift smoke:

```text
position 8 shift 1 -> pitch stream 60, 62, 63, 65, 66, 68, 69, 71
```
