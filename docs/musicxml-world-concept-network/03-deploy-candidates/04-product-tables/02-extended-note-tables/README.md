# Extended Note Table Candidates

Status: mixed.

Precision: P2/P3 for velocity extension; P1/P2 for other optional scalars.

Extended products add optional note-event scalars to the minimal product table.

Potential shape:

```text
extended_product_name
|- D1 -> onset material
|- D2 -> duration material
|- D3 -> pitch material
|- D4 -> velocity material
|- D5 -> part material
|- D6 -> staff material
|- D7 -> voice material
`- D8 -> note_kind / dynamic_code / articulation_code material
```

Current status:

```text
velocity_midi products are operationally deployable but need world smoke tests
dynamic_code needs integer map
articulation_code needs integer map
note_kind needs integer map and rest policy
staff/voice/part need renderer smoke tests
beam_group/stem/accidental need world support
```

First realistic extended product:

```text
accented_diatonic_eighths
|- D1 -> eighth_tick_grid_v1
|- D2 -> eighth_duration_tick_v2
|- D3 -> diatonic_heptatonic_steps_v2
`- D4 -> velocity_accent_two_level_96_64
```

This should only move to P3 after `velocity_midi` behavior is confirmed in both MusicXML and MIDI worlds.
