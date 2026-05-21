# Pitch And Sonority Space

This document organizes pitch materials, pitch-class systems, scales, rows, and named sonorities as a systematic connector corpus.

The goal is not to privilege tonal harmony. The goal is to document the musical spaces that can generate `pitch_midi`, and to distinguish reusable pitch materials from MusicXML-compatible product tables.

## Terminal Scalar

Current terminal scalar:

```text
pitch_midi
```

Current renderable range is world-defined. The connector itself should stay world-agnostic.

## Core Connector Archetypes

### A. Absolute Pitch Stream

```text
material_name
`- D1 -> pitch_midi
        transformations: add(a), add(b), add(c), ...
```

This outputs a pitch stream directly.

Interpretation:

```text
terminal pitch_midi start_point -> base pitch/register
terminal pitch_midi shift       -> phase of interval grammar
```

### B. Pitch-Class Grammar With Register Base

In the current simple model, pitch-class and register are combined through `pitch_midi` start value.

Example:

```text
diatonic_heptatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

`start_point = 60` makes C4 the base. `transformation_shift = 5` changes the grammar phase to Aeolian/natural minor behavior.

### C. Named Wrapper

Wrappers may freeze RI values for pedagogy, browsing, or reuse.

```text
dorian_on_c_v1
`- D1 -> diatonic_heptatonic_steps_v2
        transformations: identity
        static child pitch_midi start_point = 60
        static child pitch_midi shift = 1
```

Do not deploy wrappers for every rotation unless they solve a real UX or compositional need.

### D. Pitch Material Product

A pitch material becomes directly renderable only when combined with onset and duration:

```text
note_table_name
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

## Taxonomic Strata

### P1: Equal-Division Cyclic Generators

The primitive pitch concepts are not standalone interval connectors. Connectors are circular materials. A semitone, for example, is not its own connector; it is one step of `chromatic_steps_v2`.

The first pitch layer should therefore be equal-division cyclic generators:

```text
add(1)  -> chromatic traversal
add(2)  -> whole-tone traversal
add(3)  -> minor-third / diminished-seventh traversal
add(4)  -> major-third / augmented-triad traversal
add(5)  -> circle-of-fourths traversal through all 12 pitch classes
add(6)  -> tritone dyad traversal
add(7)  -> circle-of-fifths traversal through all 12 pitch classes
add(8)  -> major-third traversal, inverse phase of add(4)
add(9)  -> minor-third traversal, inverse phase of add(3)
add(10) -> whole-tone traversal, inverse phase of add(2)
add(11) -> chromatic traversal, descending pitch-class phase of add(1)
add(12) -> octave/register traversal, no pitch-class change
```

In `pitch_midi`, these are absolute upward movements. Their pitch-class circularity is conceptual unless a later pitch-class/modulo layer is introduced. Still, they are the correct connector-level primitives because they define reusable circular transformation materials.

Deployment policy:

```text
Do not deploy "semitone" or "perfect fifth" as separate concept connectors.
Deploy or document cyclic generators such as chromatic_steps, whole_tone_steps, add3_cycle, add4_cycle, and add5_circle when they are useful as reusable materials.
```

### P2: Ordered Interval Cycles

An ordered interval cycle is:

```text
[i1, i2, ..., in]
```

where each interval is a transformation step.

These are mixes of equal-division steps. They are not built by composing separate interval connectors. They are one circular connector whose dimension contains an ordered transformation list.

Important relation types:

```text
rotation-equivalent
transposition-equivalent
inversion-equivalent
complement-related
same interval multiset
same period sum
```

Already deployed:

```text
chromatic_steps_v2              [1]
whole_tone_steps_v2             [2]
diatonic_heptatonic_steps_v2    [2,2,1,2,2,2,1]
anhemitonic_pentatonic_steps_v2 [2,2,3,2,3]
octatonic_steps_v2              [1,2]
```

Future ordered-cycle families:

```text
harmonic_minor_heptatonic_steps
melodic_minor_heptatonic_steps
acoustic_heptatonic_steps
double_harmonic_heptatonic_steps
hexatonic_augmented_steps
tritone_scale_steps
prometheus_collection_steps
all period-12 ordered interval partitions by complexity
```

### P3: Equal Divisions And Symmetric Collections

These are important because they map cleanly to transformation repetition:

```text
chromatic:       [1] 12 notes
whole-tone:      [2] 6 notes
augmented triad: [4] 3 notes
diminished 7th:  [3] 4 notes
tritone dyad:    [6] 2 notes
```

They also expose transpositional symmetry, which should be documented.

### P4: Modes Of Limited Transposition

Messiaen's modes should be represented as cyclic interval grammars and metadata.

Candidate grammars:

```text
mode_1_whole_tone: [2,2,2,2,2,2]
mode_2_octatonic:  [1,2,1,2,1,2,1,2]
mode_3:            [2,1,1,2,1,1,2,1,1]
mode_4:            [1,1,3,1,1,1,3,1]
mode_5:            [1,4,1,1,4,1]
mode_6:            [2,2,1,1,2,2,1,1]
mode_7:            [1,1,1,2,1,1,1,1,2,1]
```

Connector policy:

```text
Mode 1 points to whole_tone_steps_v2.
Mode 2 points to octatonic_steps_v2.
Modes 3-7 need exact deploy-candidate docs before deployment.
```

For each mode document:

```text
distinct transpositions
rotation behavior
contained common triads
complement relation
interval vector
recommended start values
```

### P5: 12-TET Set-Class Corpus

The set-class corpus is the neutral post-tonal backbone.

Each node should document:

```text
cardinality
prime form
Forte number when applicable
interval vector
complement
Z-relation if any
inversional symmetry
transpositional symmetry
named uses
connector representation
```

Deployment policy:

Do not deploy every set class blindly. First document the full reference map, then deploy high-reuse classes or wrappers that support larger concepts.

Set classes can become:

```text
pitch materials
named sonorities
harmonic fields
source sets for row construction
```

### P6: Named Scale Families

World-agnostic scale families should be represented through cyclic interval grammars.

Include:

```text
diatonic church modes
harmonic minor modes
melodic minor modes
double harmonic / Byzantine family
Hungarian minor family
acoustic / Lydian dominant family
altered / super-Locrian family
bebop scale variants
blues scale variants
augmented scale
hexatonic systems
octatonic system
whole-tone system
synthetic modernist scales
```

Non-12-TET or culturally specific materials:

```text
maqam-inspired approximations
raga-inspired approximations
pelog/slendro-inspired approximations
microtonal EDO systems
```

Caveat:

`pitch_midi` cannot represent intonation, hierarchy, ornament, or performance practice. These concepts should be marked as approximate until the worlds support richer pitch semantics.

### P7: Named Sonorities

Named sonorities should be included as cultural/theoretical nodes.

Important candidates:

```text
Tristan chord
Prometheus / Mystic chord
Petrushka chord
Elektra chord
all-interval tetrachords
Viennese trichord
quartal stacks
quintal stacks
tone clusters
French sixth
German sixth
Italian sixth
added-sixth sonority
added-second sonority
suspended fourth
suspended second
hexatonic poles
augmented-triad cycles
```

For every named sonority document:

```text
historical spelling
pitch-class set
ordered voicing if relevant
set class
possible rotations/inversions
whether it is a chord, collection, voicing, or progression object
whether it should be a pitch material or a simultaneous note table
```

### P8: Serial And Row Materials

Serial concepts:

```text
twelve-tone row
prime form
retrograde
inversion
retrograde inversion
row matrix
hexachordal combinatoriality
derived row
aggregate completion
partition
all-combinatorial hexachord
```

Connector policy:

Rows can be represented as ordered interval cycles when their pitch succession is known.

Full row transformations need either:

```text
wrapper metadata
precomputed connector variants with exact interval grammars
or future inversion/retrograde transformations for automatic derivation
```

Do not pretend that a matrix is a single simple connector unless exact runtime semantics are documented.

### P9: Spectral And Timbre-Derived Pitch

Future concepts:

```text
harmonic series approximation
subharmonic series approximation
spectral chord approximations
combination-tone collections
inharmonic partial fields
```

With current `pitch_midi`, these are approximations. Later worlds could use frequency or cents scalars.

## Pitch-Space Connector Precision Template

```text
Name:
Precision:
Role:
Terminal scalar:
Pitch universe:
Interval grammar:
Period:
Start-point meaning:
Shift meaning:
Equivalent rotations:
Inversion/complement:
Named concepts represented:
Dependencies:
Connector tree:
Missing transformations:
Smoke output:
Notes:
```

## Example: Diatonic Family As One Connector

```text
Name: diatonic_heptatonic_steps_v2
Precision: P4 deployed curated
Role: seven-note diatonic cyclic pitch grammar
Terminal scalar: pitch_midi
Interval grammar: [2,2,1,2,2,2,1]
Start-point meaning: pitch base/register
Shift meaning: modal phase
```

Named concepts represented by shift:

```text
0 Ionian / major
1 Dorian
2 Phrygian
3 Lydian
4 Mixolydian
5 Aeolian / natural minor
6 Locrian
```

Runtime dependency:

```text
pitch_midi
```

Conceptual dependency:

```text
diatonic collection theory
ordered interval cycle
```

## Example: Tristan Chord As Sonority Node

Current precision: P3 when using an exact representative or simultaneous chord
product; historical spelling remains metadata until `accidental_code` is active.

It should not be forced into one universal connector. It needs a chosen reading.

Possible representations:

```text
1. pitch-class set node
2. named voicing node with historical spelling
3. simultaneous-note product table
4. progression object in a later harmonic/process layer
```

Required documentation before deployment:

```text
exact pitch-class representation chosen
voicing policy
whether enharmonic spelling matters for MusicXML
whether it is reusable outside the historical context
```

Current deployable readings are documented in:

```text
../../03-deploy-candidates/01-pitch-materials/03-named-collections-and-sonorities/
```

## Example: Prometheus / Mystic Chord

Current precision: P3 as sorted collection representative; Scriabin-specific
voicing/order remains metadata or a separate voicing product.

Common C-form:

```text
C F# Bb E A D
```

Sorted collection interval grammar:

```text
[2,2,2,3,1,2]
```

The concept doc must still say whether a usage means:

```text
synthetic scale
six-note chord voicing
pitch-class set
Scriabin-associated sonority
```

before deployment.
