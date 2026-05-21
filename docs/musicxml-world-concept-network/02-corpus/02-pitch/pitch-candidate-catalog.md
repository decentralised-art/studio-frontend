# Pitch Candidate Catalog

This document is the second-pass candidate catalog for pitch concepts.

It turns broad pitch-space categories into more precise connector candidates. It is still not a deployment batch.

## Current Deployable Pattern

Most current pitch materials use this shape:

```text
name
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(in)
```

where the ordered interval grammar is a cyclic sequence.

RI interpretation:

```text
pitch_midi start_point       -> absolute MIDI base/register
pitch_midi transformation_shift -> phase of the cyclic interval grammar
```

This means that transposition and modal rotation normally do not require new connectors.

## Equal-Division Generator Candidates

Primitive pitch materials should be circular generators, not separate interval connectors.

```text
add1_chromatic_steps
  grammar: [1]
  deployed: chromatic_steps_v2
  meaning: chromatic traversal

add2_whole_tone_steps
  grammar: [2]
  deployed: whole_tone_steps_v2
  meaning: whole-tone traversal

add3_minor_third_cycle
  grammar: [3]
  precision: P2 connector archetype
  meaning: diminished-seventh / fourfold pitch-class cycle

add4_major_third_cycle
  grammar: [4]
  precision: P2 connector archetype
  meaning: augmented-triad / threefold pitch-class cycle

add5_circle_of_fourths_steps
  grammar: [5]
  precision: P2 connector archetype
  meaning: all 12 pitch classes in fourth-cycle order

add6_tritone_steps
  grammar: [6]
  precision: P2 connector archetype
  meaning: tritone dyad cycle

add7_circle_of_fifths_steps
  grammar: [7]
  precision: P2 connector archetype
  meaning: all 12 pitch classes in fifth-cycle order

add8_major_third_inverse_cycle
  grammar: [8]
  relation: inverse phase of add4 modulo 12
  precision: P1 taxonomy node

add9_minor_third_inverse_cycle
  grammar: [9]
  relation: inverse phase of add3 modulo 12
  precision: P1 taxonomy node

add10_whole_tone_inverse_steps
  grammar: [10]
  relation: inverse phase of add2 modulo 12
  precision: P1 taxonomy node

add11_chromatic_inverse_steps
  grammar: [11]
  relation: inverse phase of add1 modulo 12
  precision: P1 taxonomy node

add12_octave_register_steps
  grammar: [12]
  precision: P2 connector archetype
  meaning: octave/register traversal with fixed pitch class
```

Review rule:

```text
The interval name is metadata on the transformation argument. The connector concept is the circular generator.
```

## Already Curated Pitch Materials

```text
chromatic_steps_v2
  grammar: [1]
  status: P4 deployed curated

whole_tone_steps_v2
  grammar: [2]
  status: P4 deployed curated
  relations: Messiaen mode 1

diatonic_heptatonic_steps_v2
  grammar: [2,2,1,2,2,2,1]
  status: P4 deployed curated
  relations: church modes by shift

anhemitonic_pentatonic_steps_v2
  grammar: [2,2,3,2,3]
  status: P4 deployed curated

octatonic_steps_v2
  grammar: [1,2]
  status: P4 deployed curated
  relations: Messiaen mode 2; half-whole / whole-half by shift
```

## Near-Term Heptatonic Families

These are straightforward cyclic interval grammars. They are good candidates for exact P2/P3 concept docs later.

```text
harmonic_minor_heptatonic_steps
  grammar: [2,1,2,2,1,3,1]
  represented modes: harmonic minor modes by shift
  precision: P2 connector archetype

melodic_minor_heptatonic_steps
  grammar: [2,1,2,2,2,2,1]
  represented modes: melodic minor / jazz minor modes by shift
  precision: P2 connector archetype

harmonic_major_heptatonic_steps
  grammar: [2,2,1,2,1,3,1]
  precision: P2 connector archetype

acoustic_heptatonic_steps
  grammar: [2,2,2,1,2,1,2]
  common labels: acoustic scale, Lydian dominant collection
  precision: P2 connector archetype

double_harmonic_heptatonic_steps
  grammar: [1,3,1,2,1,3,1]
  common labels: double harmonic, Byzantine approximation
  precision: P2 connector archetype

hungarian_minor_heptatonic_steps
  grammar: [2,1,3,1,1,3,1]
  precision: P2 connector archetype
```

Important relation rule:

```text
Do not deploy separate connectors for each mode of these families unless a wrapper is needed.
```

## Symmetric And Limited-Transposition Families

These are strong fits for PT because they are periodic, phaseable, and reusable.

```text
messiaen_mode_1_steps
  grammar: [2]
  use deployed: whole_tone_steps_v2

messiaen_mode_2_steps
  grammar: [1,2]
  use deployed: octatonic_steps_v2

messiaen_mode_3_steps
  grammar: [2,1,1,2,1,1,2,1,1]
  precision: P2 connector archetype

messiaen_mode_4_steps
  grammar: [1,1,3,1,1,1,3,1]
  precision: P2 connector archetype

messiaen_mode_5_steps
  grammar: [1,4,1,1,4,1]
  precision: P2 connector archetype

messiaen_mode_6_steps
  grammar: [2,2,1,1,2,2,1,1]
  precision: P2 connector archetype

messiaen_mode_7_steps
  grammar: [1,1,1,2,1,1,1,1,2,1]
  precision: P2 connector archetype

augmented_hexatonic_steps
  grammar: [3,1,3,1,3,1]
  precision: P2 connector archetype

diminished_seventh_steps
  grammar: [3]
  precision: P2 connector archetype

augmented_triad_steps
  grammar: [4]
  precision: P2 connector archetype

tritone_dyad_steps
  grammar: [6]
  precision: P2 connector archetype
```

The Messiaen concepts should also document:

```text
number of distinct transpositions
rotation equivalences
transpositional symmetry
contained triads / familiar subsets
```

## Pentatonic And Blues Families

The existing `anhemitonic_pentatonic_steps_v2` is only one pentatonic family.

Candidate families:

```text
anhemitonic_pentatonic_steps
  grammar: [2,2,3,2,3]
  deployed: anhemitonic_pentatonic_steps_v2

minor_pentatonic_steps
  grammar from C: C Eb F G Bb
  cyclic grammar: [3,2,2,3,2]
  relation: rotation/variant of anhemitonic pentatonic depending on ordering
  precision: P1 until equivalence is reviewed

major_pentatonic_steps
  grammar from C: C D E G A
  cyclic grammar: [2,2,3,2,3]
  relation: deployed anhemitonic pentatonic shift
  precision: P4 via deployed connector

blues_hexatonic_steps
  grammar from C: C Eb F Gb G Bb
  cyclic grammar: [3,2,1,1,3,2]
  precision: P2 connector archetype
```

Do not duplicate pentatonic connectors until the rotation/equivalence map is written.

## Named Synthetic Collections

These can be pitch materials if represented as cyclic collections, or named sonorities if represented as voicings.

```text
prometheus_collection_steps
  common C pitch classes: C D E F# A Bb
  sorted pc grammar: [2,2,2,3,1,2]
  caveat: Scriabin's voicing/order matters historically
  precision: P3 as sorted representative; voicing metadata remains separate

enigmatic_scale_steps
  needs exact source-reviewed grammar
  precision: P0 reference

petrushka_collection
  common representation: two major triads a tritone apart
  C/F# pc set: [0,1,4,6,7,10]
  sorted pc grammar: [1,3,2,1,3,2]
  precision: P3 as sorted representative; bitonal reading remains metadata/product
```

## Named Sonority Candidates

Named sonorities need more care than scales because spelling, voicing, and simultaneity can matter.

```text
tristan_sonority
  common pitch spelling in Wagner context: F B D# G#
  possible pc set if C=0: [3,5,8,11]
  status: P3 when using exact set representative or exact arpeggio product
  needs: spelling metadata until accidental_code is supported

prometheus_mystic_sonority
  common C form: C F# Bb E A D
  possible pc set: [0,2,4,6,9,10]
  status: P1 taxonomy node
  needs: chord-order policy vs collection policy

petrushka_sonority
  common C/F# bitonal triads: C E G + F# A# C#
  possible pc set: [0,1,4,6,7,10]
  status: P1 taxonomy node

all_interval_tetrachord_4_Z15
  needs exact prime form and set-class policy
  status: P0 reference

all_interval_tetrachord_4_Z29
  needs exact prime form and set-class policy
  status: P0 reference

quartal_stack_n4
  grammar by fourths, e.g. [5,5,5,?]
  status: P1 taxonomy node

cluster_chromatic_nK
  consecutive pitch-class set
  status: P1 taxonomy node
```

Policy:

```text
Named sonorities should first become documentation nodes.
Only deploy when we know whether the concept is:
  - ordered voicing,
  - pitch-class set,
  - pitch material,
  - simultaneous note-event table,
  - or historical/progression object.
```

Current P3 operational policies are documented in:

```text
../../03-deploy-candidates/01-pitch-materials/03-named-collections-and-sonorities/
```

## Set-Class Backbone

The full 12-TET set-class universe should be part of the reference corpus, but not deployed all at once.

Candidate documentation structure:

```text
set-classes/
  cardinality-2.md
  cardinality-3.md
  cardinality-4.md
  ...
```

Each set-class entry should eventually include:

```text
prime_form
Forte_number
interval_vector
complement
Z_relation
symmetry
named_examples
deployment_status
```

Deployment selection criteria:

```text
1. high reuse in named sonorities or scale families
2. strong symmetry or transformational relevance
3. clear connector representation
4. useful as a source set for product tables
```

## Finite Ordered Partition Policy

A useful mathematical backbone for pitch materials is the finite catalog of ordered partitions of a pitch period.

For current `pitch_midi` work, the practical period is:

```text
P = 12 semitones
```

An ordered interval partition is:

```text
[a1, a2, ..., an]
sum(ai) = 12
ai > 0
```

The connector grammar is:

```text
add(a1), add(a2), ..., add(an)
```

Equivalence reductions:

```text
rotation
  Usually one connector; `transformation_shift` selects the rotation.

transposition
  Usually one connector; terminal `pitch_midi start_point` selects base pitch/register.

inversion
  Related concept, but not automatically one connector unless runtime structure actually derives it.
```

Complexity order:

```text
P12_N1  one interval summing to 12
P12_N2  two intervals summing to 12
P12_N3  three intervals summing to 12
...
P12_N12 twelve intervals summing to 12
```

Within each `N`, sort by:

```text
alphabet size
max interval
symmetry order
interval variance
chromatic density
```

Initial families to study:

```text
P12_N1
  [12]

P12_N2
  [1,11], [2,10], [3,9], [4,8], [5,7], [6,6]

P12_N3
  all ordered partitions of 12 into 3 intervals, modulo rotation

P12_N4
  includes [3,3,3,3]

P12_N5
  includes [2,2,3,2,3]

P12_N6
  includes [2,2,2,2,2,2]

P12_N7
  includes [2,2,1,2,2,2,1]

P12_N8
  includes [1,2,1,2,1,2,1,2]

P12_N12
  [1,1,1,1,1,1,1,1,1,1,1,1]
```

Naming policy:

```text
Human-readable names are fine for curated connectors.
Mathematical names are useful for exhaustive catalogs.
One connector name should represent one grammar, not one rotation or tonic.
```

Example mathematical name style:

```text
pitch_p12_n7_2212221_v1
pitch_p12_n5_22323_v1
pitch_p12_n8_12121212_v1
```

The current curated names stay more readable:

```text
diatonic_heptatonic_steps_v2
anhemitonic_pentatonic_steps_v2
octatonic_steps_v2
```

## Transformational Pitch Operations

These are not just materials; they are operations over materials.

```text
transposition
  current representation: pitch_midi start_point

rotation
  current representation: transformation_shift

inversion
  current status: needs modular / reflect operation

retrograde
  current status: needs ordered-sequence reversal or precomputed wrapper

complement
  current status: needs set/mask representation

pitch-class multiplication
  current status: needs modular multiply

parsimonious voice leading
  current status: needs chord/voice-event model

neo-Riemannian P/L/R/S/N/H
  current status: useful future chord-space operations, not deployable as simple pitch_midi streams yet
```

## Pitch Candidate Precision Checklist

Before any pitch candidate becomes P3:

```text
1. Is it a linear pitch stream, pitch-class set, voicing, or simultaneous chord?
2. Does order matter?
3. Does spelling matter?
4. Can shift represent modes/rotations?
5. Can start_point represent transposition/register?
6. Does it expose only pitch_midi, or does it require event_id/voice/staff?
7. Does it need a new transformation?
8. Does it need a product connector to become visible in MusicXML?
```
