# Deployed Terminal Scalars

These connectors already existed before the May 17, 2026 MusicXML vocabulary deployment. They are terminal meanings used by higher-level musical concepts.

Owner observed for the curated deployment account:

```text
b530bf08d76015080c67d6b5f00cdee53b45bdda
```

## `onset_tick`

```text
Status: deployed-curated dependency
Complexity: C0 terminal scalar
Musical role: absolute note onset position in score ticks
World ownership: world-agnostic
Terminal scalar(s): onset_tick
Dependencies: legacy add transformation
```

Current live structure:

```text
onset_tick
`- D1 -> terminal slot
        transformations: add(1)
```

Reuse:

```text
quarter_tick_grid_v1
eighth_tick_grid_v1
half_tick_grid_v1
```

## `duration_tick`

```text
Status: deployed-curated dependency
Complexity: C0 terminal scalar
Musical role: note duration in score ticks
World ownership: world-agnostic
Terminal scalar(s): duration_tick
Dependencies: legacy add transformation
```

Reuse:

```text
quarter_duration_tick_v2
eighth_duration_tick_v2
half_duration_tick_v2
```

## `pitch_midi`

```text
Status: deployed-curated dependency
Complexity: C0 terminal scalar
Musical role: MIDI pitch number interpreted as notated pitch by MusicXML/MIDI worlds
World ownership: world-agnostic
Terminal scalar(s): pitch_midi
Dependencies: legacy add transformation
```

Reuse:

```text
chromatic_steps_v2
diatonic_heptatonic_steps_v2
anhemitonic_pentatonic_steps_v2
whole_tone_steps_v2
octatonic_steps_v2
```

## `velocity_midi`

```text
Status: deployed-curated dependency
Complexity: C0 terminal scalar
Musical role: MIDI velocity / dynamic intensity value
World ownership: world-agnostic
Terminal scalar(s): velocity_midi
Dependencies: legacy add transformation
```

Reuse:

```text
not yet used by the curated note-table batch
```
