# Connector Interconnection Patterns

This document defines how the musical concept library should become interconnected instead of a flat list of unrelated connectors.

The core principle:

```text
Deploy general reusable materials first.
Build specific musical objects by reusing them.
Use RI metadata and wrappers for named variants.
Use product connectors only when a world-compatible event table is needed.
```

## Runtime Dependency Vs Conceptual Ancestry

A concept has a runtime dependency only when the connector tree actually calls the child connector.

Example:

```text
diatonic_mode_quarters_v3
|- D1 -> quarter_tick_grid_v1
|- D2 -> quarter_duration_tick_v2
`- D3 -> diatonic_heptatonic_steps_v2
```

Runtime dependencies:

```text
quarter_tick_grid_v1
quarter_duration_tick_v2
diatonic_heptatonic_steps_v2
```

Conceptual ancestry:

```text
diatonic collection
ordered heptatonic interval grammar
modal rotation theory
```

Do not confuse these.

## The Dependency Pyramid

Recommended library structure:

```text
C0 terminal scalars
  onset_tick
  duration_tick
  pitch_midi
  velocity_midi

C1 primitive materials
  quarter_tick_grid
  quarter_duration
  chromatic_steps
  velocity_mf

C2 cyclic grammars
  diatonic_heptatonic_steps
  Euclidean onset pattern
  accent cycle

C3 product tables
  diatonic quarters
  isorhythmic note table
  accented chromatic table

C4 nested textures
  two-voice canon
  melody plus drone
  polymetric texture

C5 form roots
  section sequence
  score root
  world-specific performance root
```

## Material Connectors

Material connectors should normally expose one terminal scalar.

Examples:

```text
diatonic_heptatonic_steps_v2 -> pitch_midi
quarter_tick_grid_v1 -> onset_tick
quarter_duration_tick_v2 -> duration_tick
velocity_accent_cycle_v1 -> velocity_midi
```

They are not necessarily MusicXML-compatible alone.

## Product Connectors

Product connectors combine materials into a compatible event table.

Minimum MusicXML/MIDI note table:

```text
note_table
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

Extended table:

```text
note_table
|- D1 -> onset material
|- D2 -> duration material
|- D3 -> pitch material
|- D4 -> velocity material
|- D5 -> note_kind material
`- D6 -> voice material
```

This modularity is crucial. A pitch connector should not contain rhythm unless the concept is specifically a product table.

## Minimal Reuse Principle

If a product combines a pitch grammar and a rhythm grammar, it should reference existing child materials rather than copying their transformation sequences.

Good:

```text
diatonic_irregular_table
|- D1 -> rhythm_p10080_n4_2520_1260_1260_5040
|- D2 -> eighth_duration_tick_v2
`- D3 -> diatonic_heptatonic_steps_v2
```

Avoid in curated vocabulary:

```text
diatonic_irregular_table
|- D1 -> onset_tick
|       transformations copied from rhythm grammar
|- D2 -> duration_tick
`- D3 -> pitch_midi
        transformations copied from pitch grammar
```

Copying is acceptable only for deliberately flattened tests or temporary smoke connectors. Curated concepts should prefer real runtime child reuse.

## Runtime Derivation Rule

Some concepts are theoretically derived from others, but not every theoretical relation should become a connector dependency.

Use runtime child reuse when:

```text
the parent connector actually selects from the child output
the parent transforms the child output
the child stream remains visible in the final format
```

Use metadata ancestry when:

```text
the relation is historical or analytical
the child output is not actually executed
the derivation requires operations not present in PT yet
```

This distinction matters. A taxonomy can say that one pitch grammar is a refinement, complement, or rotation class of another, but the connector tree should only claim dependencies that the runtime actually uses.

## Wrapper Connectors

Wrapper connectors are allowed when they make a general material easier to use.

Valid wrapper reasons:

```text
freeze a mode/phase
freeze a register/base pitch
freeze a duration unit
name a culturally important object
provide a stable UX item
make a common product table easier to discover
```

Invalid wrapper reasons:

```text
duplicate every possible shift
hide the actual general material
create world-specific names for world-agnostic scalar concepts
```

## Equivalence Relations

Every cyclic concept should list equivalence relations.

### Rotation

Example:

```text
diatonic shift 0 -> Ionian
diatonic shift 1 -> Dorian
```

These are rotation-equivalent inside one connector.

### Transposition

Example:

```text
C major and D major
```

Usually represented by `pitch_midi start_point`, not a new connector.

### Inversion

Example:

```text
ascending interval grammar [2,2,1,2,2,2,1]
inverted grammar [10,10,11,10,10,10,11] modulo 12
```

With current absolute `pitch_midi`, inversion is deployable only when the exact
inverted interval grammar or value cycle is written down. A future reflect or
modular inversion operation would derive it automatically, but known finite
inversions can be materialized as their own exact connector trees.

### Complement

Example:

```text
pitch-class set complement
rhythmic hit/rest complement
```

Complement may require set/mask operations not yet present.

### Augmentation And Diminution

Example:

```text
rhythm [2,3,3] unit 420
augmented by 2 -> [2,3,3] unit 840
```

This can be metadata, wrapper, or actual transformed connector depending on current operation support.

## Hypermusic-Native Interconnections

These are important because they are not obvious in conventional music theory.

### RI As Concept Relation

An RI can encode:

```text
tonic/register
mode/phase
rhythmic rotation
dynamic phase
excerpt start
```

Therefore, docs should treat RI values as part of the concept graph.

### Compatible But Independent Materials

A scale, an onset pattern, and a velocity contour can be independent concepts:

```text
diatonic pitch material
Euclidean onset material
accent velocity material
```

They become one composition when a product connector combines them.

This is the key modular strength of the system.

### Conceptual Families As Reuse Maps

Instead of deploying:

```text
major_quarter_notes
dorian_quarter_notes
mixolydian_quarter_notes
```

prefer:

```text
diatonic_heptatonic_steps
quarter_tick_grid
quarter_duration
product table with RI controls
```

Named modes can be labels over RI values.

### Multiple Worlds, Same Connector

A connector exposing:

```text
onset_tick
duration_tick
pitch_midi
velocity_midi
```

can be used by:

```text
MusicXML World
MIDI World
visual particle world
analysis world
synthesis world
```

The connector is not owned by any one world.

## Relation Metadata Template

Every concept node should eventually include:

```text
relations:
  depends_on:
    - connector names actually used
  product_of:
    - material connector names
  wraps:
    - connector name plus static RI values
  rotation_of:
    - connector name / shift values
  transposition_of:
    - connector name / start-point values
  inversion_of:
    - connector name / transformation relation
  complement_of:
    - connector name
  augmentation_of:
    - connector name / ratio
  diminution_of:
    - connector name / ratio
  conceptual_ancestor:
    - theory/history labels
  compatible_worlds:
    - derived from format, not manually assigned where possible
```

## Product Connector Review Checklist

Before deploying a product connector:

```text
1. Does each child material already exist or need deployment?
2. Is every terminal scalar world-agnostic?
3. Does the output format satisfy the target world's required scalars?
4. Are optional scalars actually useful?
5. Are RI positions documented after tree projection?
6. Does random iteration use sensible world scalar limits?
7. Does the connector remain musically meaningful in MIDI and MusicXML?
8. Is there a simpler product using existing children?
```

## Material Connector Review Checklist

Before deploying a material connector:

```text
1. Does it expose exactly one semantic scalar unless there is a strong reason not to?
2. Is it reusable in many product tables?
3. Are rotations represented by shift instead of duplicated connectors?
4. Are transpositions represented by start_point instead of duplicated connectors?
5. Is the transformation list actually the intended value stream?
6. For value cycles, are transformations deltas between values?
7. For onset cycles, are transformations distances between onsets?
8. Are out-of-range renderer issues handled by world limits rather than hidden in the connector?
```

## Why This Makes The Network Logical

The connector network becomes coherent when:

```text
lower-level concepts are small and reusable
named objects are metadata/wrappers where possible
world-compatible tables are products of independent materials
conditions gate contexts rather than pretending to filter notes
relations are documented explicitly
```

This lets the network grow like a library of musical concepts rather than like a pile of one-off presets.
