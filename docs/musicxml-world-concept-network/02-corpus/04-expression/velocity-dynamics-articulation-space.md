# Velocity, Dynamics, Articulation, And Expressive Scalars

This document expands the corpus beyond pitch and rhythm.

The MusicXML and MIDI worlds should eventually treat dynamics, velocity, articulation, note kind, voice, staff, and notation properties as reusable musical materials.

## Terminal Scalars

Currently relevant optional note-event scalars:

```text
velocity_midi
dynamic_code
note_kind
accidental_code
stem_code
beam_group
part
staff
voice
```

Future scalar families:

```text
articulation_code
articulation_placement
slur_event_id
slur_type
spanner_kind
ornament_code
technique_code
```

## Velocity Space

### Value Range

MIDI velocity is normally:

```text
0..127
```

Interpretation policy:

```text
0 may mean silent/note-off in MIDI contexts.
For note rendering, prefer 1..127 as audible velocity unless note_kind says rest.
```

### Constant Dynamics

Approximate conventional bands:

```text
ppp -> 24
pp  -> 36
p   -> 48
mp  -> 64
mf  -> 80
f   -> 96
ff  -> 112
fff -> 124
```

Connector shape:

```text
velocity_mf_v1
`- D1 -> velocity_midi
        transformations: add(0)
        static/default velocity_midi start_point = 80
```

These are useful but should not dominate the corpus. The richer concepts are contours.

### Velocity Contours

Important contour families:

```text
constant
linear crescendo
linear diminuendo
terraced dynamics
accent cycle
arch
inverted arch
swell
fade-in
fade-out
pulse train
syncopated accent mask
Euclidean accent mask
random-like deterministic contour
```

Connector patterns:

```text
velocity_crescendo_step4_v1
`- D1 -> velocity_midi
        transformations: add(4)

velocity_accent_96_64_64_64_v1
`- D1 -> velocity_midi
        start_point = 96
        transformations: subtract(32), add(0), add(0), add(32)
```

As with durations, exact value cycles need deltas between values, not the values themselves.

### Bounded Velocity

Potential transformations:

```text
math_clamp_v1
fold
modulo
```

Musical difference:

```text
clamp -> values hit a ceiling/floor
fold  -> values reflect at boundaries
modulo -> values wrap around
```

For expressive contours, fold is often more musical than clamp, but it is not currently in the core operation set.

## Dynamic Code Space

`dynamic_code` should represent notated dynamics rather than playback velocity.

Potential code map:

```text
0 none
1 ppp
2 pp
3 p
4 mp
5 mf
6 f
7 ff
8 fff
9 sfz
10 fp
11 crescendo_start
12 crescendo_stop
13 diminuendo_start
14 diminuendo_stop
```

This map should be finalized in the world contract before deployment.

Connector families:

```text
dynamic_mark_constant
dynamic_mark_cycle
terraced_dynamic_cycle
dynamic_spanner_points
```

## Accent And Articulation Space

Articulations are not the same as dynamics. They shape attack, duration, and notation.

Candidate `articulation_code` map:

```text
0 none
1 accent
2 marcato
3 staccato
4 tenuto
5 staccatissimo
6 fermata
7 strong_accent
8 breath_mark
```

Connector families:

```text
staccato_every_note
accent_downbeat_cycle
marcato_talea
tenuto_long_notes
Euclidean accent mask
alternating articulation
```

Some articulations are event attributes. Some are spanners or phrase-level objects and should not be forced into a single note-event scalar.

## Note Kind And Rests

`note_kind` can distinguish:

```text
0 note
1 rest
2 grace
3 cue
4 unpitched
```

This becomes important for rhythm patterns that include rests.

Example:

```text
euclidean_3_8_note_kind_mask_v1
`- D1 -> note_kind
        value cycle: note, rest, rest, note, rest, rest, note, rest
```

Current challenge:

Value cycles require careful delta encoding or a future lookup/mask transformation.

## Voice, Staff, And Part Space

These are not expressive in the same way as pitch or rhythm, but they define score topology.

Scalars:

```text
part
staff
voice
```

Connector families:

```text
single_voice_v1
two_voice_alternation_v1
staff_split_by_register_v1
voice_cycle_1_2_v1
part_cycle_v1
```

Future richer logic:

```text
assign staff by pitch range
assign voice by density layer
assign part by connector branch
```

These likely need per-particle transformations or renderer-side interpretation.

## Accidentals, Stems, Beams

These are notation-control scalars.

They should be optional and used carefully because they can override reasonable renderer defaults.

Potential concepts:

```text
accidental_preference_cycle
stem_up_constant
stem_down_constant
beam_group_by_metric_unit
beam_group_manual_cycle
```

Do not prioritize these before pitch, rhythm, velocity, and note_kind are stable.

## Expressive Connector Precision Template

```text
Name:
Precision:
Role:
Terminal scalar:
Value range:
Value map:
Pattern kind:
Start-point meaning:
Shift meaning:
Transformations:
Dependencies:
Connector tree:
Smoke output:
World interpretation:
Notation caveats:
```

## Important Design Rule

Velocity, dynamics, articulation, and note_kind are all reusable materials.

They should usually be optional dimensions in product connectors:

```text
accented_note_table
|- D1 -> onset material
|- D2 -> duration material
|- D3 -> pitch material
`- D4 -> velocity/accent material
```

This keeps the same pitch and rhythm materials reusable across quiet, loud, accented, sparse, or heavily articulated variants.
