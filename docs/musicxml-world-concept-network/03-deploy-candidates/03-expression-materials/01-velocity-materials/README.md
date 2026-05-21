# Velocity Material Candidates

Status: candidate, but needs world/MIDI smoke verification.

Precision: P2/P3.

Common shape:

```text
name
`- D1 -> velocity_midi
        transformations: ...
```

## Candidates

```text
velocity_constant_64
`- D1 -> velocity_midi
        transformations: add(0)
  velocity_midi start_point: 64

velocity_constant_96
`- D1 -> velocity_midi
        transformations: add(0)
  velocity_midi start_point: 96

velocity_accent_two_level_96_64
`- D1 -> velocity_midi
        transformations: subtract(32), add(32)
  velocity_midi start_point: 96

velocity_crescendo_add4
`- D1 -> velocity_midi
        transformations: add(4)
  velocity_midi start_point: 64
```

Before large deployment:

```text
Confirm how velocity_midi is rendered in MusicXML World and MIDI World products.
```
