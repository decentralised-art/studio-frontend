# Operational Deployability Review

Date: 2026-05-20

This review checks the whole current corpus from the connector/transformation/
condition level.

Read first:

```text
../../00-start-here/system-principles.md
../../00-start-here/deployable-connector-recipes.md
readiness-matrix.md
../../../musicxml-world-format-contract.md
```

## Main Correction

Do not describe a musical concept as blocked merely because the final terminal
scalar is absolute.

For the current MusicXML and MIDI worlds, `pitch_midi`, `onset_tick`,
`duration_tick`, and `velocity_midi` are the actualized output space. Abstract
relations such as pitch class, row form, scale degree, rhythmic phase, and
dynamic contour are built by connector trees above those terminal scalars.

The useful distinction is:

```text
deployable as exact generated stream
deployable as product table
metadata/alias over RI coordinates
future world scalar required
future operation only for convenience or validation
```

## Current Operation Floor

The current network can already deploy:

```text
constant scalar streams
equal-step streams
ordered interval grammars
onset-distance grammars
duration value cycles
velocity value cycles
minimal note-table products
simultaneous chord products
simple condition-gated connectors
```

Using:

```text
math_add_v1
math_subtract_v1
math_multiply_v1
math_divide_v1
math_modulo_v1
math_min_v1
math_max_v1
math_clamp_v1
math_quantize_step_v1
logic_* conditions as connector gates
```

Missing operations such as lookup/table, fold/bounce, and modular reflection are
important, but they are not blockers for finite concepts whose exact value or
delta sequence is known.

## Pitch Corpus Review

### Equal-Division Generators

Operational status:

```text
deployable now
```

Recipe:

```text
name
`- D1 -> pitch_midi
        transformations: add(step)
```

This covers:

```text
chromatic_steps_v2
whole_tone_steps_v2
add3_minor_third_cycle
add4_major_third_cycle
add5_circle_of_fourths_steps
add6_tritone_steps
add7_circle_of_fifths_steps
add12_octave_register_steps
```

No separate interval connectors are needed. Interval names are metadata over the
step argument and over RI traversal.

### Ordered Interval Grammars

Operational status:

```text
deployable now
```

Recipe:

```text
name
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(in)
```

This covers:

```text
diatonic_heptatonic_steps_v2
harmonic_minor_heptatonic_steps
melodic_minor_heptatonic_steps
harmonic_major_heptatonic_steps
acoustic_heptatonic_steps
double_harmonic_heptatonic_steps
hungarian_minor_heptatonic_steps
messiaen_mode_3_steps
messiaen_mode_4_steps
messiaen_mode_5_steps
messiaen_mode_6_steps
messiaen_mode_7_steps
augmented_hexatonic_steps
blues_hexatonic_steps
```

Required P3 fields:

```text
exact interval list
expected smoke output
rotation/shift interpretation
known aliases
first product-table reuse
```

### Serial Rows

Operational status:

```text
deployable now when the row is written as an exact ordered interval grammar
```

A twelve-tone row is a pitch material:

```text
row_name_interval_grammar
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(i12)
```

RI interpretation:

```text
pitch_midi start_point = row transposition/register
pitch_midi transformation_shift = row rotation
N = row length or repeated traversal
```

Retrograde and inversion are also deployable as separate exact grammars when
their interval sequence is written down. A future `reverse` or `reflect`
operation would make them easier to derive automatically, but it is not required
to deploy a known row form.

### Set Classes

Operational status:

```text
generic set-class theory = metadata
chosen ordered representative = deployable now
simultaneous chord product = deployable now
```

Set-class names are not themselves connector trees because they describe
equivalence classes. The deployable objects are exact representatives:

```text
setclass_4z15_representative_a
`- D1 -> pitch_midi
        transformations: add(...), add(...), ...
```

or simultaneous products:

```text
setclass_4z15_chord_product
|- D1 -> same_onset_tick
|- D2 -> duration material
`- D3 -> setclass_4z15_representative_a
```

The metadata entry should preserve:

```text
prime form
Forte number
interval vector
Z relation
all selected representatives
```

### Named Collections And Sonorities

Operational status:

```text
deployable when reduced to exact ordered pitch material or chord product
```

Rules:

```text
collection -> ordered pitch_midi material
voicing/arpeggiation -> ordered pitch_midi material with exact register policy
simultaneous chord -> same_onset product
historical name/theory role -> metadata
```

This solves objects such as:

```text
Prometheus collection
Petrushka collection
Tristan sonority
quartal stacks
clusters
all-interval tetrachord representatives
```

They are not blocked by `pitch_midi`. They are blocked only when the docs do not
yet choose a precise representative or product policy.

### Modal/Cultural Systems

Operational status:

```text
12-TET pitch skeletons = deployable now as exact pitch_midi grammars
full tuning/performance practice = future world/scalar/metadata work
```

For maqam, raga, gamelan, and similar systems:

```text
Do deploy exact approximated skeletons only when the approximation is explicit.
Do not claim the skeleton is the full musical tradition.
```

Deployable near-term shape:

```text
named_skeleton_steps
`- D1 -> pitch_midi
        transformations: add(...)
```

Future layers:

```text
pitch_cents
pitch_step
ornament/gamaka scalar
melodic behavior metadata
tuning system metadata
```

## Rhythm Corpus Review

### Onset Grids

Operational status:

```text
deployable now
```

Recipe:

```text
name
`- D1 -> onset_tick
        transformations: add(distance_ticks)
```

### Additive, Euclidean, Non-Retrogradable, Tala Skeletons

Operational status:

```text
deployable now as onset-distance materials
```

Recipe:

```text
name
`- D1 -> onset_tick
        transformations: add(d1), add(d2), ..., add(dn)
```

This is exact for hit-only onset streams. It is not the same as full meter,
accent, rest-mask, or tala performance grammar.

### Constant Durations

Operational status:

```text
deployable now
```

Recipe:

```text
name
`- D1 -> duration_tick
        transformations: add(0)
```

with `duration_tick start_point` set to the intended duration.

### Duration Cycles

Operational status:

```text
deployable now when written as exact value cycles
```

Recipe:

```text
duration_cycle_name
`- D1 -> duration_tick
        transformations: add/subtract deltas between desired values
```

Do not copy onset-distance grammars into duration streams. Durations are values,
not distances.

### Rests, Masks, Meter, Tuplets

Operational status:

```text
note_kind masks = future world scalar map unless approximated by hit-only onsets
meter/tempo/tuplet notation = future world scalar support
```

Exact tick values can already represent many tuplets. Notated tuplet brackets,
beam groups, and meter labels are separate world-rendering concerns.

## Expression Corpus Review

### Velocity Materials

Operational status:

```text
deployable now as velocity_midi streams
```

Constants use `add(0)`. Contours use exact deltas:

```text
velocity_accent_96_64_64_64
`- D1 -> velocity_midi
        transformations: subtract(32), add(0), add(0), add(32)
```

### Dynamic, Articulation, Note Kind, Beam, Stem, Accidental

Operational status:

```text
not deployable as curated MusicXML World materials until integer maps and world
rendering semantics are finalized
```

They can be documented as candidate scalar maps, but not P3 deploy candidates.

## Composition Corpus Review

### Minimal Product Tables

Operational status:

```text
deployable now
```

Recipe:

```text
product_name
|- D1 -> onset material
|       transformations: add(1)
|- D2 -> duration material
|       transformations: add(1)
`- D3 -> pitch material
        transformations: add(1)
```

### Extended Product Tables

Operational status:

```text
velocity extension = deployable but needs world smoke tests
other optional scalars = blocked until scalar maps/world support
```

### Chords And Sonorities

Operational status:

```text
deployable now with same_onset_tick + pitch material + duration material
```

This is the correct current representation for Tristan-like or Prometheus-like
sonorities when simultaneity matters.

### Multi-Voice Textures

Operational status:

```text
possible, but Lane B until world smoke tests prove path grouping and rendering
```

Two safe approaches:

```text
multiple product tables under a root
one product table with future voice/staff/part scalars
```

The first may already work by path grouping. The second needs world scalar
support.

### Counterpoint, Canon, Fugue, Form

Operational status:

```text
generative sketches = deployable as products when exact child tables are known
stylistic validation = not deployable with current conditions
large form rendering = future section/form world contract
```

Conditions can gate branches. They do not validate per-note counterpoint.

## Corpus-Wide Fixes Required

Any file that says a concept is blocked only because the terminal value is
absolute should be corrected.

Any deploy candidate that uses:

```text
add(-n)
```

must be rewritten as:

```text
subtract(n)
```

Any P2/P3 candidate must include:

```text
1. connector name
2. terminal scalar set
3. exact tree
4. exact transformations
5. exact RI interpretation
6. smoke input
7. expected output prefix
8. dependency list
9. world compatibility path
```

If those are missing, the concept remains a taxonomy node, not a deploy
candidate.
