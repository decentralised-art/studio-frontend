# Research Pass 001

Date: 2026-05-19

Scope: turn the initial broad music-theory corpus sketch into a repeatable taxonomy workspace with clearer axes, operation semantics, and connector interconnection rules.

## What Changed In This Pass

Added focused corpus documents:

```text
README.md
operations-and-conditions.md
pitch-and-sonority-space.md
rhythm-time-space.md
velocity-dynamics-articulation-space.md
connector-interconnection-patterns.md
```

The taxonomy is now organized around:

```text
protocol operations
pitch and sonority space
rhythm and time space
velocity/dynamics/articulation space
connector interconnection patterns
```

## Main Conclusions

### 1. Rhythm Needs Equal Status With Pitch

The previous broad plan mentioned rhythm, but not systematically enough.

Rhythm should include:

```text
fixed grids
ordered additive patterns
Euclidean rhythms
non-retrogradable rhythms
isorhythm
meter and metric accent
tuplets
proportional duration grammars
phase/polyrhythm
form-time connectors
```

### 2. Duration Streams Are Not Onset Streams

This is a critical implementation detail.

For onset:

```text
add(2520), add(1260), add(1260)
```

means distances between onsets.

For duration:

```text
add(2520), add(1260), add(1260)
```

does not mean output durations `[2520,1260,1260]`. It means cumulative duration values.

Exact duration cycles need deltas between desired values, or a future lookup/table operation.

### 3. Conditions Are Activation Gates

Current PT conditions decide whether a connector runs. They do not inspect generated particles.

Therefore:

```text
register filters
downbeat filters
scale membership filters
per-note rest masks
```

are not current condition use cases. They require transformations, note_kind streams, renderer handling, or future particle-aware logic.

### 4. Phase Is A First-Class Musical Relation

`transformation_shift` should be treated as a conceptual relation:

```text
mode
rotation
rhythmic phase
accent phase
row phase
```

This is a core abstraction specific to decentralised.art.

### 5. Named Concepts Should Not Always Be Separate Connectors

Examples:

```text
Ionian, Dorian, Phrygian...
```

are shift variants of one deployed diatonic connector.

Separate connectors are justified only when they:

```text
freeze useful RI values
improve UX discoverability
represent a distinct runtime tree
carry historically important spelling/voicing
become product tables
```

### 6. Product Connectors Are The Composition Layer

Pitch, rhythm, duration, and velocity should remain modular.

The MusicXML/MIDI-compatible layer is the product:

```text
onset material + duration material + pitch material + optional expressive material
```

This is how the concept network can grow without producing a combinatorial explosion of one-off connectors.

## Source Concepts Checked

This pass cross-checked standard theory categories including:

```text
pitch-class set theory
Forte numbers
interval vectors
Messiaen modes of limited transposition
Messiaen non-retrogradable rhythms
Euclidean rhythms
isorhythm
twelve-tone row operations
named sonorities such as Tristan and Prometheus/Mystic
```

Useful reference anchors:

```text
Open Music Theory / LibreTexts post-tonal glossary
Puget Sound set-class and Forte number references
Toussaint's Euclidean rhythm work
Open Music Theory / Puget Sound twelve-tone references
Messiaen mode and non-retrogradable rhythm references
```

## Open Questions For Next Pass

### Pitch

```text
Should we document the full Forte set-class list locally, or link to a canonical table and only document deployed candidates?
What naming scheme should set-class concepts use?
How should historical spelling be represented for named sonorities?
Do we need a separate accidental/spelling scalar before deploying historically spelled sonorities?
```

### Rhythm

```text
Should Euclidean rhythms be represented as onset-distance cycles first, or note_kind masks?
Do we need a table/lookup transformation before deploying many rest masks?
How should tuplets be notated in MusicXML when tick values are already correct?
Should meter be a separate score-event table before complex rhythm deployment?
```

### Dynamics And Articulation

```text
What is the official dynamic_code map?
What is the official articulation_code map?
Should velocity 0 mean silence, or should rests always use note_kind?
Can articulation be note-local, or do we need spanner/event tables first?
```

### Operations

```text
Which missing transformations are worth deploying before expanding the corpus?
Do we need modular add/multiply?
Do we need fold/bounce for bounded ranges?
Do we need lookup/table for masks and exact value cycles?
Do we need particle-aware conditions, or should that remain a transformation concern?
```

### Interconnection

```text
How much relation metadata should live in docs versus app data?
Should the frontend eventually show relation fields in connector pages?
Should the Worlds page recommend product connectors by relation graph, format, or both?
```

## Next Pass Recommendation

Do not plan Batch 2 yet.

The next research pass should choose one branch and make it exact:

```text
Option A: rhythm branch
  Euclidean, additive, non-retrogradable, tuplets, duration-value cycle rules.

Option B: pitch branch
  Messiaen modes 3-7, harmonic/melodic minor families, named sonorities.

Option C: expressive branch
  velocity, dynamic_code, articulation_code, note_kind masks.

Option D: operation branch
  missing transformation/condition candidates and their exact Solidity semantics.
```

Each pass should end with P2/P3 concept docs, not immediate deployment.
