# MusicXML World System Principles

This is the core source-of-truth for future MusicXML World corpus passes.

Read this before extending the taxonomy, planning connector batches, or translating music-theory concepts into connector trees.

For exact deployable tree recipes, also read:

```text
deployable-connector-recipes.md
```

The main rule:

```text
Do not start from conventional music-theory object names.
Start from how PT/DCN connectors actually generate circular materials.
```

This avoids mistakes such as treating a semitone, whole tone, or perfect fifth as a separate connector. In this system, those are transformation arguments inside circular connector materials.

## PT Connector Execution Model

A connector has dimensions. Each dimension has:

```text
1. a cyclic list of transformations
2. optional child/composite connector
3. a running-instance position
```

A simplified one-dimensional execution intuition:

```text
x = running_instance.start_point

for output index i:
  emit x
  op = transformations[(i + running_instance.transformation_shift) % transformations.length]
  x = op(x)
```

Consequences:

```text
start_point
  chooses the initial value in the generated material.

transformation_shift
  rotates the circular transformation grammar.

particles_count / N
  chooses how much of the traversal to extract.

transformation list
  defines the reusable circular grammar.
```

## Circularity Is The Primitive

The reusable object is a circular transformation material, not an isolated interval or named preset.

Correct:

```text
chromatic_steps_v2
`- D1 -> pitch_midi
        transformations: add(1)
```

This one connector can produce any semitone traversal by choosing:

```text
start_point
transformation_shift
N
```

Incorrect:

```text
semitone_connector
whole_tone_connector
perfect_fifth_connector
```

Those names describe interval ideas, but they do not match the connector ontology. The connector ontology is circular traversal through a value space.

## Equal-Division Generators

For 12-TET pitch materials, the first primitive family is equal-division cyclic generators:

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

With current `pitch_midi`, these are absolute upward transformations. Their pitch-class circularity is conceptual unless or until we add pitch-class/modulo layers. They are still the right primitives because they define circular generator families.

## Ordered Interval Mixtures

Scales and modes should usually be represented as ordered cyclic transformation lists:

```text
diatonic_heptatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

This is one circular material. It should not be split into separate interval connectors.

The same material can expose named concepts through `transformation_shift`:

```text
shift 0 -> Ionian / major
shift 1 -> Dorian
shift 2 -> Phrygian
shift 3 -> Lydian
shift 4 -> Mixolydian
shift 5 -> Aeolian / natural minor
shift 6 -> Locrian
```

Do not deploy one base connector per mode when shift is enough.

## Named Concepts Are Often RI Coordinates

Many named musical concepts are metadata over a connector and RI values.

Examples:

```text
C major
  connector: diatonic_heptatonic_steps_v2
  pitch_midi start_point: 60
  pitch_midi transformation_shift: 0

C Dorian
  connector: diatonic_heptatonic_steps_v2
  pitch_midi start_point: 60
  pitch_midi transformation_shift: 1

octatonic half-whole
  connector: octatonic_steps_v2
  pitch_midi transformation_shift: 0

octatonic whole-half
  connector: octatonic_steps_v2
  pitch_midi transformation_shift: 1
```

Separate wrapper connectors may still be useful, but only when they freeze RI values for real reuse, UX clarity, or pedagogy.

## Materials Vs Product Connectors

A material connector should usually expose one semantic scalar:

```text
pitch material    -> pitch_midi
onset material    -> onset_tick
duration material -> duration_tick
velocity material -> velocity_midi
note-kind material -> note_kind
```

A product connector combines materials into an event table:

```text
note_table
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

This is the minimum MusicXML/MIDI-compatible note table.

Extended product tables may add:

```text
velocity_midi
dynamic_code
note_kind
part
staff
voice
beam_group
```

The pitch material should not include rhythm unless the connector is explicitly a product/composition connector.

## Format-Based World Compatibility

MusicXML World compatibility is based on terminal scalar names exposed by the connector format, not on positional schema or connector names.

Required terminal scalars:

```text
onset_tick
duration_tick
pitch_midi
```

Optional terminal scalars:

```text
event_id
part
staff
voice
velocity_midi
dynamic_code
note_kind
accidental_code
stem_code
beam_group
```

Rule:

```text
requiredScalars subset of formatScalars
formatScalars subset of acceptedScalars
```

The world reads semantic terminal scalar names. Internal connector names such as `diatonic_heptatonic_steps_v2` or `quarter_tick_grid_v1` are reusable musical generators, not world-specific output names.

## Note Grouping

Without the older positional schema, note properties group by:

```text
same parent execution path + same row index = same note event
```

Example:

```text
melody/onset_tick:    [0, 2520, 5040]
melody/duration_tick: [2520, 2520, 1260]
melody/pitch_midi:    [60, 62, 64]
```

means:

```text
melody row 0: onset 0,    duration 2520, pitch 60
melody row 1: onset 2520, duration 2520, pitch 62
melody row 2: onset 5040, duration 1260, pitch 64
```

Path names group streams; terminal scalar names define musical meaning.

## RI Projection In Nested Trees

Running-instance positions are projected through the full connector tree. A child connector's RI positions change when it is nested under a parent.

Therefore:

```text
Never assume a standalone material's RI position stays the same inside a product connector.
Recompute or inspect projected RI positions for each exact tree.
Document projected RI controls on every deploy candidate.
```

## Onset Streams Vs Duration Streams

Onset streams are cumulative time. A transformation `add(d)` means:

```text
next onset = previous onset + d
```

Example:

```text
onset pattern values: 0, 2520, 3780, 5040
transformations: add(2520), add(1260), add(1260)
```

Duration streams are value streams. A transformation changes the duration value itself.

To output:

```text
[2520, 1260, 1260, 5040]
```

the transformations must be deltas between duration values, not the values themselves.

Example:

```text
start_point = 2520
transformations:
  subtract(1260) -> 1260
  add(0)         -> 1260
  add(3780)      -> 5040
  subtract(2520) -> 2520
```

This is why constant duration connectors are currently safer and clearer:

```text
quarter_duration_tick_v2
`- D1 -> duration_tick
        transformations: add(0)
        static/default start_point = 2520
```

## Transformation Semantics Must Match Musical Meaning

Choose operations by musical relation:

```text
add/subtract
  absolute offsets, pitch intervals, onset distances, linear contours.

multiply/divide
  augmentation, diminution, ratios, proportional duration/tempo concepts.

modulo
  cyclic reduction, pitch-class-like spaces, periodic phase.

clamp/min/max
  explicit value limiting, but note that this changes the generated composition.

quantize
  snapping to grids or bands.
```

Do not use `add` just because it is familiar. Do not use multiplication where an absolute unit is the concept.

## Conditions Are Activation Gates

Current PT conditions decide whether a connector runs.

They do not inspect each generated particle.

Good current condition concepts:

```text
activate this section during a performance window
activate this layer for an owner/token/group
activate this branch for a selected mode/configuration
activate this connector when a static condition argument is true
```

Not current condition concepts:

```text
filter every pitch outside a register
skip every downbeat
remove every note outside a scale
turn every nth particle into a rest
```

Those are per-particle operations. They need transformations, masks, terminal scalars such as `note_kind`, renderer behavior, or future particle-aware logic.

## N Is A Lens

`particles_count` is not a stored composition by itself. It is a runtime lens over the connector's generated space.

The same connector can behave as:

```text
short motif
phrase
loop
long process
world iteration
```

depending on N.

World manifests can limit random N for rendering practicality, but N does not belong to the connector ontology.

## World Limits Do Not Define Transformations

World manifests may declare scalar render limits:

```text
pitch_midi min/max
duration_tick min/max
velocity_midi min/max
particlesCount min/max
```

These limits guide random RI generation and renderer visibility.

They do not define:

```text
connector step sizes
transformation arguments
mode shifts
musical grammar
```

If a connector begins inside a world range and later generates values outside it, the world should skip unrenderable rows rather than treating the whole connector as invalid.

## Naming Principles

Prefer names for reusable circular materials:

```text
chromatic_steps_v2
whole_tone_steps_v2
diatonic_heptatonic_steps_v2
euclidean_3_8_unit1260
velocity_accent_96_64_64_64
```

Avoid names that make reusable material world-specific:

```text
musicxml_major_scale
score_tristan_chord
plugin_velocity_curve
```

Avoid names that imply standalone interval connectors:

```text
semitone_connector
perfect_fifth_connector
```

## Red Flags In Future Passes

Stop and re-check this document if a proposed taxonomy pass suggests:

```text
one connector per interval
one connector per mode when shift is enough
one connector per tonic/register when start_point is enough
pitch connectors that already include rhythm without being product tables
duration cycles where transformations are listed as desired duration values
conditions used as per-note filters
MusicXML-specific names for world-agnostic scalars
compatibility based on positional schema instead of terminal scalar format
RI positions copied from a standalone connector into a nested tree without recomputation
```

## Future Pass Checklist

Before adding or deploying a concept:

```text
1. Is this a material, product, wrapper, texture, or form connector?
2. What terminal scalar(s) does it expose?
3. Is the transformation list a circular grammar?
4. Are named variants represented by start_point or transformation_shift?
5. Does it duplicate an existing material under a different music-theory name?
6. Are runtime dependencies actual connector dependencies?
7. Are conceptual relations documented separately from runtime dependencies?
8. Are projected RI controls documented for the exact tree?
9. Does the format satisfy MusicXML/MIDI compatibility if it is meant to render?
10. Are conditions used only as connector gates?
```
