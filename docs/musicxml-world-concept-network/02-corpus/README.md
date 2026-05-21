# Music Theory Corpus Workspace

This folder is the working area for the long-term MusicXML World musical corpus.

The goal is to document a growing taxonomy of musical concepts as reusable connector-network ideas. Some concepts are already deployable with current PT/DCN primitives. Others are theoretical targets that require new transformations, new conditions, or richer world interpretation.

This is not a deployment batch. It is a reusable research workspace.

Before extending this corpus, read:

```text
../00-start-here/system-principles.md
../corpus-tree.md
```

That file is the core source-of-truth for connector circularity, dimensions, transformation shift, RI projection, material/product distinction, and common taxonomy mistakes.

## What The Corpus Should Become

The intended final shape is:

```text
music theory concept
  -> stable concept family
  -> exact connector-tree archetype
  -> exact terminal scalar contract
  -> exact RI interpretation
  -> exact dependencies
  -> exact equivalence metadata
  -> deploy candidate when mature
```

The corpus should include common-practice materials, post-tonal theory, modernist and spectral materials, rhythm/time systems, dynamics, articulation, texture, and Hypermusic-native connector logic.

## Precision Levels

Every concept should eventually be marked with one precision level:

```text
P0 reference
  The concept is listed as part of the intended corpus, but no connector shape is known yet.

P1 taxonomy node
  The concept is classified and related to other concepts, but the connector tree is not exact.

P2 connector archetype
  The connector shape is known abstractly, but names, RI projection, or dependency status still need review.

P3 deploy candidate
  Exact tree, dependencies, RI controls, smoke test, and expected format are documented.

P4 deployed curated
  Onchain, tested, and recommended for reuse.

P5 superseded
  Onchain or documented, but replaced by a better curated concept.
```

## Corpus Files

```text
00-overview/music-theory-corpus-plan.md
  Broad plan for building the music-theory corpus.

00-overview/readiness-matrix.md
  Third-pass bridge from broad taxonomy to deployable-now, smoke-test-needed,
  world-blocked, future-operation, and metadata-only candidates.

00-overview/operational-deployability-review.md
  Whole-corpus review from the connector/transformation/condition level.

00-overview/capability-assessment.md
  Assessment of what the current corpus can and cannot compose as DCN connector
  trees, and what architectural layers are still missing.

01-operations/operations-and-conditions.md
  Protocol-level operations and condition use cases.

01-operations/operation-gap-catalog.md
  Missing transformation and future condition candidates needed by the corpus.

02-pitch/pitch-and-sonority-space.md
  Pitch-class, interval, scale, row, chord, and sonority taxonomy.

02-pitch/pitch-candidate-catalog.md
  Second-pass pitch connector candidates, including heptatonic families,
  Messiaen modes, pentatonic/blues variants, synthetic collections, and
  named sonorities.

02-pitch/serial-set-and-tuning-systems.md
  Serial rows, set-class theory, microtonality, EDO, and spectral material gaps.

02-pitch/modal-and-cultural-systems.md
  Maqam/ajnas, raga/melakarta, gamelan pathet, and jazz chord-scale systems.

03-rhythm/rhythm-time-space.md
  Onset, duration, meter, rhythm, tempo, phase, and form-time taxonomy.

03-rhythm/rhythm-candidate-catalog.md
  Second-pass rhythm candidates with tick values, grids, additive rhythms,
  Euclidean rhythms, non-retrogradable rhythms, duration cycles, and
  note-kind masks.

03-rhythm/metric-cycle-systems.md
  Tala-like cycles, aksak/additive meter, clave/timeline patterns, hypermeter,
  and tuplet metadata.

04-expression/velocity-dynamics-articulation-space.md
  Velocity, dynamics, accent, articulation, note-kind, and expressive scalar taxonomy.

04-expression/expressive-candidate-catalog.md
  Second-pass candidates for velocity contours, dynamic codes, articulation
  codes, note-kind masks, and expressive product tables.

05-composition/connector-interconnection-patterns.md
  How concept connectors should depend on each other logically.

05-composition/texture-form-space.md
  Product-table texture, canons, hockets, drones, polyrhythms, form, and
  Hypermusic-native world/RI form concepts.

05-composition/counterpoint-form-and-grammar-systems.md
  Counterpoint, canon, fugue, phrase, and form grammar gaps.

06-research-passes/research-pass-001.md
  Notes and open questions from this exploratory pass.

06-research-passes/research-pass-002.md
  Candidate-level expansion pass with next-pass recommendations.

06-research-passes/research-pass-003.md
  Readiness classification pass that separates concrete deployment candidates
  from blocked or metadata-only concepts.

06-research-passes/research-pass-004.md
  Internet-backed corpus expansion pass and connector-composition capability
  assessment.
```

## Standard MusicXML/MIDI Terminal Scalars

The current worlds already interpret the following note-event scalars:

```text
required:
  onset_tick
  duration_tick
  pitch_midi

optional:
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

Future score-event scalar groups may include meter, tempo, clef, key, slurs, articulations, and spanners as documented in `../../musicxml-world-format-contract.md`.

## Hypermusic-Native Concepts

Some concepts should be standard in this system even if they are not standard textbook labels.

### Material Connector

A connector that produces one musical parameter stream, such as:

```text
pitch material -> pitch_midi
onset material -> onset_tick
duration material -> duration_tick
velocity material -> velocity_midi
```

These are world-agnostic and should usually not include other note properties.

### Product Connector

A connector that combines multiple material connectors into one note-event table:

```text
note table
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

Product connectors are what make the output directly compatible with MusicXML/MIDI worlds.

### Wrapper Connector

A connector that fixes RI values or narrows a general material into a named concept.

Example:

```text
diatonic_heptatonic_steps_v2
  shift 0 -> Ionian / major
  shift 1 -> Dorian
  ...
```

The mode does not need a separate connector unless a wrapper with static RI is useful for browsing, pedagogy, or composition.

### Phase As Musical Identity

In this system, `transformation_shift` is not just implementation detail. It is how modes, rhythmic rotations, accent rotations, cyclic permutation, and some serial row forms become navigable.

### N As A Lens

`particles_count` is not the composition itself. It is a runtime lens over the connector. The same connector can display a fragment, a phrase, or a longer excerpt depending on N.

### Format As Semantic Surface

A connector can have any internal structure. The world reads the semantic terminal scalar names exposed by the format.

This is why a connector can be world-agnostic and still render in multiple worlds.

## Research Pass Workflow

Each exploratory pass should:

1. Add or refine concept families.
2. Separate runtime dependency from conceptual ancestry.
3. Identify exact connector archetypes where possible.
4. Mark missing transformations or conditions.
5. Mark concepts that are only metadata, not deployment targets.
6. Add examples that can become future deploy candidates.
7. Avoid deploying until exact tree, RI positions, smoke output, and world compatibility are documented.

## Naming Policy

Names should remain world-agnostic unless the concept only makes sense inside one world.

Prefer:

```text
diatonic_heptatonic_steps_v2
nonretrograde_rhythm_3_2_3_v1
velocity_accent_cycle_v1
tristan_sonority_pcset_v1
```

Avoid:

```text
musicxml_major_scale
score_tristan_chord
plugin_velocity_curve
```

## Relation Fields

Every mature concept should document:

```text
depends_on:
  Runtime connector dependencies.

wraps:
  More general connector plus fixed RI values.

rotation_of:
  Cyclic phase relationship.

inversion_of:
  Pitch-class or contour inversion relationship.

complement_of:
  Pitch-class or rhythmic complement.

augmentation_of:
  Duration/time scaling relationship.

diminution_of:
  Duration/time compression relationship.

product_of:
  Materials combined into a MusicXML/MIDI-compatible table.

conceptual_ancestor:
  Historical or theoretical relation that is not a runtime dependency.
```

These fields are what will make the library feel interconnected instead of like a flat list of presets.
