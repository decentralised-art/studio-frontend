# Expressive Candidate Catalog

This document is the second-pass candidate catalog for velocity, dynamics, articulation, rests, and notation-control materials.

These concepts should become reusable optional dimensions in MusicXML/MIDI-compatible product connectors.

## Value Domains

```text
velocity_midi
  current numeric range: 0..127
  practical audible note range: 1..127

dynamic_code
  symbolic dynamic mark
  code map must be finalized before deployment

note_kind
  note/rest/grace/cue/unpitched behavior

articulation_code
  symbolic articulation mark
  not yet part of the active note-event scalar list

beam_group, stem_code, accidental_code
  notation-control metadata
```

## Complexity Order

Expressive value spaces should be sorted by:

```text
constant value
number of contour steps
maximum jump
mean value
range width
symmetry order
whether the stream needs a bounded/folded range
whether the stream is note-local or a spanner/event table
```

This keeps velocity and dynamics from becoming a flat list of named marks.

## Velocity Constant Candidates

Approximate conventional mapping:

```text
velocity_ppp
  value: 24
  precision: P2 connector archetype

velocity_pp
  value: 36
  precision: P2 connector archetype

velocity_p
  value: 48
  precision: P2 connector archetype

velocity_mp
  value: 64
  precision: P2 connector archetype

velocity_mf
  value: 80
  precision: P2 connector archetype

velocity_f
  value: 96
  precision: P2 connector archetype

velocity_ff
  value: 112
  precision: P2 connector archetype

velocity_fff
  value: 124
  precision: P2 connector archetype
```

Connector shape:

```text
velocity_mf
`- D1 -> velocity_midi
        transformations: add(0)
        static/default start_point = 80
```

## Velocity Contour Candidates

These are more important than constant dynamics because they let a product table behave musically.

```text
velocity_crescendo_step4
  start example: 48
  transformations: add(4)
  precision: P2 connector archetype

velocity_diminuendo_step4
  start example: 96
  transformations: subtract(4)
  caveat: avoid underflow by world/random bounds
  precision: P2 connector archetype

velocity_swell_48_64_80_64
  desired values: [48,64,80,64]
  start_point: 48
  transformations: add(16), add(16), subtract(16), subtract(16)
  precision: P2 connector archetype

velocity_accent_96_64_64_64
  desired values: [96,64,64,64]
  start_point: 96
  transformations: subtract(32), add(0), add(0), add(32)
  precision: P2 connector archetype

velocity_backbeat_64_96_64_96
  desired values: [64,96,64,96]
  start_point: 64
  transformations: add(32), subtract(32), add(32), subtract(32)
  precision: P2 connector archetype

velocity_terraced_48_48_80_80
  desired values: [48,48,80,80]
  start_point: 48
  transformations: add(0), add(32), add(0), subtract(32)
  precision: P2 connector archetype
```

Review rule:

```text
Always document desired values and delta transformations separately.
```

## Dynamic Code Candidates

MusicXML supports many dynamic markings. A compact internal `dynamic_code` map could begin with:

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
9 sf
10 sfz
11 fp
12 rfz
13 niente
14 crescendo_start
15 crescendo_stop
16 diminuendo_start
17 diminuendo_stop
```

This is not final. It must be aligned with the MusicXML world renderer before connector deployment.

Candidate materials:

```text
dynamic_none
dynamic_mf_constant
dynamic_terraced_p_mf_f
dynamic_sforzando_cycle
dynamic_wedge_crescendo_points
dynamic_wedge_diminuendo_points
```

Issue:

Spanners such as crescendo wedges are not simple note-local values. They may require separate event tables.

## Articulation Code Candidates

Candidate code map:

```text
0 none
1 accent
2 strong_accent / marcato
3 staccato
4 staccatissimo
5 tenuto
6 detached_legato / portato
7 fermata
8 breath_mark
9 caesura
10 spiccato
11 scoop
12 falloff
13 doit
14 plop
```

Candidate materials:

```text
articulation_none
articulation_staccato_constant
articulation_tenuto_constant
articulation_accent_downbeat_cycle
articulation_alternating_staccato_tenuto
articulation_euclidean_accent_mask
```

Current status:

```text
P1 taxonomy nodes until articulation_code is part of the active world contract and renderer.
```

## Note Kind Candidates

Candidate map:

```text
0 note
1 rest
2 grace
3 cue
4 unpitched
```

Materials:

```text
note_kind_all_notes
  values: [0]
  precision: P2 connector archetype

note_kind_all_rests
  values: [1]
  precision: P2 connector archetype, but not useful alone

note_kind_alternating_note_rest
  values: [0,1]
  precision: P1 until lookup/value-cycle operation is decided

note_kind_syncopated_3_3_2_mask
  values depend on pulse grid, not hit-only onset stream
  precision: P1 taxonomy node
```

Design rule:

```text
Use note_kind for rests. Do not encode rests by invalid pitch, zero duration, or zero velocity unless a world explicitly documents that interpretation.
```

## Beam, Stem, And Accidental Candidates

These are lower priority but should be present in the taxonomy.

```text
stem_auto
stem_up_constant
stem_down_constant
beam_group_eighth_pairs
beam_group_triplet
accidental_auto
accidental_sharp_preference
accidental_flat_preference
accidental_natural_forced
```

Most of these should wait until the MusicXML renderer has stable interpretation rules.

## Expressive Product Table Examples

```text
accented_diatonic_quarters
|- D1 -> quarter_tick_grid_v1
|- D2 -> quarter_duration_tick_v2
|- D3 -> diatonic_heptatonic_steps_v2
`- D4 -> velocity_accent_96_64_64_64

swelling_whole_tone_halves
|- D1 -> half_tick_grid_v1
|- D2 -> half_duration_tick_v2
|- D3 -> whole_tone_steps_v2
`- D4 -> velocity_swell_48_64_80_64
```

These are not deployment proposals yet. They show how expressive materials should stay modular.

## Expressive Candidate Precision Checklist

Before an expressive candidate becomes P3:

```text
1. Is the terminal scalar already interpreted by the world?
2. Is the code map final?
3. Is the value range documented?
4. For value cycles, are desired values and transformation deltas both written?
5. Should this be note-local or a separate score/spanner table?
6. Does it remain meaningful in MIDI and MusicXML?
7. Does it duplicate renderer default behavior?
```
