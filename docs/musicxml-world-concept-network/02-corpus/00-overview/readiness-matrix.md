# Corpus Readiness Matrix

Date: 2026-05-19

This document bridges the broad MusicXML World concept corpus with actual connector deployment work.

It is not a deployment batch. It answers a narrower question:

```text
Given the current PT/DCN primitives and the current MusicXML/MIDI world contracts,
which documented musical concepts can become exact connector trees now, and
which ones are blocked?
```

Before changing this file, reread:

```text
../../00-start-here/system-principles.md
../../01-deployed-graph/dependency-graph.md
../../../musicxml-world-format-contract.md
```

## Readiness Lanes

Use these lanes when reviewing every candidate.

```text
Lane A: deployable now
  Exact connector tree can be written with current transformations,
  current terminal scalars, and current world interpretation.

Lane B: deployable now, but needs local smoke verification first
  Exact connector tree is known, but RI projection, generated values,
  or nested product behavior should be tested before deployment.

Lane C: blocked by world contract/rendering support
  Connector can exist, but MusicXML/MIDI worlds cannot yet interpret or
  display its semantic scalar reliably.

Lane D: blocked by missing transformation, condition, scalar, or world support
  Concept cannot be expressed precisely with the current runtime contract.
  Missing convenience operations alone do not block finite exact sequences;
  use add/subtract delta cycles first.

Lane E: reference or metadata only
  Concept should be documented for taxonomy/search/education, but is not
  itself a connector deployment target.
```

The same named musical concept can appear in more than one lane depending on representation. For example, a Tristan sonority can be:

```text
Lane A/B as a pitch_midi ordered interval material
Lane C as a spelled chord with accidentals and staff/voice semantics
Lane E as historical/theoretical metadata
```

## Current Deployed Base

The current curated graph already gives us:

```text
terminal scalars:
  onset_tick
  duration_tick
  pitch_midi
  velocity_midi

onset materials:
  quarter_tick_grid_v1
  eighth_tick_grid_v1
  half_tick_grid_v1

duration materials:
  quarter_duration_tick_v2
  eighth_duration_tick_v2
  half_duration_tick_v2

pitch materials:
  chromatic_steps_v2
  diatonic_heptatonic_steps_v2
  anhemitonic_pentatonic_steps_v2
  whole_tone_steps_v2
  octatonic_steps_v2

note-table products:
  chromatic_ascending_quarters_v3
  diatonic_mode_quarters_v3
  anhemitonic_pentatonic_eighths_v3
  whole_tone_halves_v3
  octatonic_mode_quarters_v3
```

This means the next work should usually extend one of three layers:

```text
1. single-scalar material connectors
2. product connectors combining reusable materials
3. world contract/rendering support for new terminal scalars
```

Do not deploy a product connector when the missing concept is only a reusable material.

## Pitch Readiness

### Lane A: Pitch Materials Deployable Now

These are single-terminal `pitch_midi` connectors using current `add` transformations.

```text
add3_minor_third_cycle
  shape: D1 -> pitch_midi, transformations: add(3)
  relation: diminished-seventh / fourfold pitch-class cycle
  note: pitch-class circularity is metadata over the emitted pitch_midi stream.

add4_major_third_cycle
  shape: D1 -> pitch_midi, transformations: add(4)
  relation: augmented-triad / threefold pitch-class cycle

add5_circle_of_fourths_steps
  shape: D1 -> pitch_midi, transformations: add(5)
  relation: all 12 pitch classes in fourth-cycle order

add6_tritone_steps
  shape: D1 -> pitch_midi, transformations: add(6)
  relation: tritone dyad cycle

add7_circle_of_fifths_steps
  shape: D1 -> pitch_midi, transformations: add(7)
  relation: all 12 pitch classes in fifth-cycle order

add12_octave_register_steps
  shape: D1 -> pitch_midi, transformations: add(12)
  relation: octave/register traversal with fixed pitch class
```

These should not be documented as isolated intervals. They are equal-division circular generators.

### Lane A: Ordered Pitch Grammars Deployable Now

These are also single-terminal `pitch_midi` materials. They should be deployed as one connector per circular grammar, not one connector per mode.

```text
harmonic_minor_heptatonic_steps
  transformations: add(2), add(1), add(2), add(2), add(1), add(3), add(1)

melodic_minor_heptatonic_steps
  transformations: add(2), add(1), add(2), add(2), add(2), add(2), add(1)

harmonic_major_heptatonic_steps
  transformations: add(2), add(2), add(1), add(2), add(1), add(3), add(1)

acoustic_heptatonic_steps
  transformations: add(2), add(2), add(2), add(1), add(2), add(1), add(2)

double_harmonic_heptatonic_steps
  transformations: add(1), add(3), add(1), add(2), add(1), add(3), add(1)

hungarian_minor_heptatonic_steps
  transformations: add(2), add(1), add(3), add(1), add(1), add(3), add(1)

messiaen_mode_3_steps
  transformations: add(2), add(1), add(1), add(2), add(1), add(1), add(2), add(1), add(1)

messiaen_mode_4_steps
  transformations: add(1), add(1), add(3), add(1), add(1), add(1), add(3), add(1)

messiaen_mode_5_steps
  transformations: add(1), add(4), add(1), add(1), add(4), add(1)

messiaen_mode_6_steps
  transformations: add(2), add(2), add(1), add(1), add(2), add(2), add(1), add(1)

messiaen_mode_7_steps
  transformations: add(1), add(1), add(1), add(2), add(1), add(1), add(1), add(1), add(2), add(1)

augmented_hexatonic_steps
  transformations: add(3), add(1), add(3), add(1), add(3), add(1)

blues_hexatonic_steps
  transformations: add(3), add(2), add(1), add(1), add(3), add(2)
```

Every one of these should document:

```text
mode/rotation map
known aliases
transpositional symmetry
smoke start_point
smoke N
expected pitch_midi prefix
```

### Lane B: Pitch Materials Needing Review Before Deployment

These are probably deployable as ordered pitch materials, but should not be deployed until we choose exact pitch-class order and naming.

```text
prometheus_collection_steps
petrushka_collection_steps
tristan_sonority_steps
all-interval tetrachord materials
selected Forte set-class representatives
selected synthetic collections from 20th century theory
```

Reason:

```text
The theory label often names a collection, sonority, or historical object,
not a unique cyclic traversal. We must decide which traversal the connector
actually generates.
```

### Lane C: Pitch Concepts Blocked By World Contract

These need more score semantics than `pitch_midi` alone:

```text
enharmonic spelling
accidental policy
microtonal pitch
staff-aware voicing
chord simultaneity as notation, not arpeggiated pitch stream
spectral partial notation
```

Potential terminal scalars:

```text
accidental_code
staff
voice
part
note_kind
microtone_cents
```

### Lane D: Pitch Concepts Needing Future Operations For General Derivation

Known finite representatives can still be deployed as exact grammars. The
general operations below should wait for better protocol support:

```text
pitch-class inversion
modular transposition
modular multiplication
normal-order set-class transforms
complement set transforms
folded register spaces
bounded ambitus traversal
nearest-neighbor voice-leading
```

Likely operations:

```text
modular add
modular multiply
fold/bounce range
reflect around axis
lookup/table
```

### Lane E: Pitch Metadata Only

These should be stored as relations around deployed connectors, not as connectors by default:

```text
mode names produced by transformation_shift
historical names for equivalent collections
pedagogical interval names
theoretical ancestry between scales
composer/style references
```

## Rhythm And Time Readiness

### Lane A: Onset Materials Deployable Now

These are single-terminal `onset_tick` connectors. Their transformation lists are distances between attacks.

```text
whole_tick_grid
  transformations: add(10080)

same_onset_tick
  transformations: add(0)
  relation: support material for simultaneous chord products

sixteenth_tick_grid
  transformations: add(630)

quarter_triplet_tick_grid
  transformations: add(840)

eighth_triplet_tick_grid
  transformations: add(420)

quintuplet_quarter_grid
  transformations: add(504)

septuplet_quarter_grid
  transformations: add(360)

additive_3_3_2_unit1260
  transformations: add(3780), add(3780), add(2520)

euclidean_3_8_unit1260
  transformations: add(3780), add(3780), add(2520)

euclidean_5_8_unit1260
  transformations: add(2520), add(2520), add(1260), add(2520), add(1260)

euclidean_5_12_unit840
  transformations: add(2520), add(1680), add(1680), add(2520), add(1680)

euclidean_7_12_unit840
  transformations: add(1680), add(1680), add(840), add(1680), add(1680), add(840), add(1680)
```

Important:

```text
Some named additive and Euclidean patterns collapse to the same onset-distance grammar.
Do not deploy duplicates unless their name wrapper adds real value.
```

### Lane A: Constant Duration Materials Deployable Now

These are single-terminal `duration_tick` connectors with `add(0)`.

```text
whole_duration_tick
  default/static start_point: 10080
  transformations: add(0)

sixteenth_duration_tick
  default/static start_point: 630
  transformations: add(0)

quarter_triplet_duration_tick
  default/static start_point: 840
  transformations: add(0)

eighth_triplet_duration_tick
  default/static start_point: 420
  transformations: add(0)

quintuplet_quarter_duration_tick
  default/static start_point: 504
  transformations: add(0)

septuplet_quarter_duration_tick
  default/static start_point: 360
  transformations: add(0)
```

### Lane B: Duration Cycles Needing Smoke Tests

Duration value cycles are not onset-distance patterns. Their transformations must be deltas between desired duration values.

Example:

```text
desired duration values: [1260, 2520, 1260, 5040]
start_point: 1260
delta transformations: add(1260), subtract(1260), add(3780), subtract(3780)
```

Before deployment, each duration cycle needs:

```text
expected values
minimum value check
negative/zero duration policy
world rendering smoke test
```

### Lane C: Rhythm Concepts Blocked By World Contract

These need richer score-event or note-event scalars:

```text
meter changes
tempo changes
beam grouping
tuplet notation brackets
rests as first-class notation
accent patterns
barline policy
polymeter display
multiple voices/staves
```

Potential terminal scalars:

```text
meter_numerator
meter_denominator
tempo_bpm
beam_group
note_kind
dynamic_code
voice
staff
```

### Lane D: Rhythm Concepts Needing Future Operations

These should wait unless a specific finite value/delta representation is written:

```text
full pulse-grid Euclidean masks
periodic rest masks
probabilistic density patterns
bounded accelerando/ritardando curves
ratio-space duration scaling that remains integer-safe
```

Likely operations:

```text
lookup/table
delta table
periodic mask
rational scale
fold/bounce range
```

## Expressive And Notation Readiness

### Lane A: Velocity Materials Deployable Now

Single-terminal `velocity_midi` materials can already exist.

```text
velocity_constant_64
  shape: D1 -> velocity_midi
  transformations: add(0)
  default/static start_point: 64

velocity_accent_two_level_96_64
  desired values: [96, 64]
  start_point: 96
  transformations: subtract(32), add(32)

velocity_crescendo_add4
  transformations: add(4)
```

Use caution:

```text
velocity_midi world rendering and MIDI export should be smoke-tested before
large deployment batches.
```

### Lane C: Dynamic, Articulation, And Note-Kind Materials

These need final world maps before curated deployment:

```text
dynamic_code
articulation_code
note_kind
stem_code
beam_group
accidental_code
```

They should not be treated as vague labels. Each scalar needs an exact integer map in the world contract.

### Lane D: Expressive Logic Needing Future Operations

```text
humanized velocity with bounded random-like contour
phrase arches that bounce within a range
conditional accents based on metric position
articulations tied to duration class
```

Likely operations:

```text
fold/bounce range
lookup/table
periodic mask
absolute distance
particle-aware conditions
```

## Product Connector Readiness

### Lane A: Simple Product Tables Deployable Now

Any combination of already deployed or Lane A materials can become a MusicXML/MIDI-compatible note table:

```text
product_name
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

Low-risk examples:

```text
chromatic_sixteenth_notes
|- sixteenth_tick_grid
|- sixteenth_duration_tick
`- chromatic_steps_v2

circle_of_fifths_quarter_notes
|- quarter_tick_grid_v1
|- quarter_duration_tick_v2
`- add7_circle_of_fifths_steps

messiaen_mode_3_triplet_notes
|- quarter_triplet_tick_grid
|- quarter_triplet_duration_tick
`- messiaen_mode_3_steps
```

### Lane B: Product Tables Needing Verification

These require local smoke tests before deployment:

```text
multiple sibling note tables under one root
polyrhythmic products with different stream lengths
duration cycles with nonconstant values
products with velocity_midi
products with note_kind/rest masks
```

Verification checklist:

```text
format hash is world-compatible
runtime N succeeds
open RI projection is understandable
MusicXML world renders expected notes
MIDI world renders expected notes if terminal set overlaps
random RI defaults do not make the world useless
```

## Operations Readiness

### Already Sufficient For Many P3 Concepts

The current transformation set is already enough for:

```text
constant grids
cyclic interval grammars
cyclic onset-distance grammars
constant duration values
simple velocity cycles
many product connectors
```

### Highest Priority Convenience Operation

The strongest missing convenience primitive is:

```text
lookup/table or delta_table
```

Reason:

```text
It would make finite cyclic materials more compact without encoding delta
chains manually, especially for duration values, note_kind masks, dynamic
maps, articulation maps, and pitch-class set representatives. It is not a
blocker for finite value cycles that can be written as add/subtract deltas.
```

### Second Priority Missing Operation

```text
fold/bounce range
```

Reason:

```text
It would allow long runs of generated material to stay within a musically
useful register, velocity range, or duration range without the world having
to hide most of the output.
```

## Recommended Next Documentation Targets

Do not deploy from this matrix directly. First create P3 concept nodes for a small set.

Recommended immediate P3 nodes:

```text
1. add3_minor_third_cycle
2. add4_major_third_cycle
3. add5_circle_of_fourths_steps
4. add6_tritone_steps
5. add7_circle_of_fifths_steps
6. add12_octave_register_steps
7. sixteenth_tick_grid
8. sixteenth_duration_tick
9. quarter_triplet_tick_grid
10. quarter_triplet_duration_tick
11. harmonic_minor_heptatonic_steps
12. messiaen_mode_3_steps
```

Initial P3 candidate docs have started in:

```text
../../03-deploy-candidates/
```

Recommended first product candidates after those P3 nodes:

```text
circle_of_fifths_quarter_notes
|- quarter_tick_grid_v1
|- quarter_duration_tick_v2
`- add7_circle_of_fifths_steps

harmonic_minor_eighth_notes
|- eighth_tick_grid_v1
|- eighth_duration_tick_v2
`- harmonic_minor_heptatonic_steps

messiaen_mode_3_triplets
|- quarter_triplet_tick_grid
|- quarter_triplet_duration_tick
`- messiaen_mode_3_steps
```

## Review Rules For Future Passes

Before adding a candidate to Lane A or B, answer:

```text
1. Is this actually a connector, or just a named RI coordinate?
2. Is it a material connector or a product connector?
3. What terminal scalar does it expose?
4. What is the exact transformation list?
5. Are modes/rotations handled by transformation_shift?
6. Does the connector duplicate an already deployed circular grammar?
7. What smoke output should we expect?
8. What makes this concept reusable outside MusicXML World?
```
