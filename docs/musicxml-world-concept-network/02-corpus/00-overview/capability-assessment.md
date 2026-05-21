# Capability Assessment

Date: 2026-05-20

Question:

```text
Does the current corpus make us capable of composing intricate music compositions
as DCN connectors by reusing lower-level musical concepts?
```

Short answer:

```text
It makes us capable of building intricate material-based and product-based
connector compositions, but not yet a complete compositional grammar.
```

The system is strongest when music can be expressed as:

```text
circular material streams
RI-controlled phases and starts
product tables combining terminal scalar streams
multiple reusable materials combined into higher-level connectors
```

It is weakest where composition depends on:

```text
per-particle constraints
voice-leading validation
context-sensitive selection
formal section logic
notation-specific rendering semantics
microtonal spelling/tuning
culturally specific performance grammar
```

## What We Can Compose Well Already

### Cyclic Pitch Materials

The current ontology is strong for:

```text
equal-division generators
diatonic and modal rotations
pentatonic rotations
octatonic rotations
whole-tone and symmetric collections
ordered interval grammars
register traversals
phase-based modal identity
```

This can produce musically coherent pitch materials because `transformation_shift` directly maps to rotation, mode, and phase.

### Cyclic Onset And Duration Materials

The current system is strong for:

```text
fixed onset grids
fixed duration streams
additive onset patterns
Euclidean onset-distance patterns
non-retrogradable onset grammars
phase canons over onset streams
isorhythmic alignment of independent cycles
```

The important distinction is already in the corpus:

```text
onset streams use distances between attacks
duration streams use value streams and need deltas between values
```

### Product Tables

The system is strong for product connectors such as:

```text
onset + duration + pitch
onset + duration + pitch + velocity
multiple product tables under one root
voice/staff/part assignment once those scalars are stable
```

This is where compositions start becoming real musical objects instead of isolated materials.

### Phase-Based Composition

The system is naturally good at:

```text
rotation
phase shift
isorhythm
process music
cyclic variation
mode selection
rhythmic displacement
```

This is not an accident. It is one of the deepest matches between PT/DCN and music theory.

## What Is Not Yet Good Enough

### Counterpoint And Voice Leading

Counterpoint requires constraints over relationships between simultaneous lines.

Current connectors can generate multiple voices, but they do not yet validate:

```text
parallel fifths/octaves
voice crossing
dissonance preparation/resolution
independent melodic contour
cadential goals
species-specific rules
```

This needs one of:

```text
world-side diagnostics
future particle-aware conditions
future relation-checking transformations
offchain analysis tools that do not replace onchain execution
```

### Serial And Set-Theory Operations

Twelve-tone and post-tonal theory need operations such as:

```text
modular transposition
inversion
retrograde
retrograde inversion
normal order
set-class equivalence
row-matrix generation
```

Current `pitch_midi` materials can approximate ordered interval rows, but real pitch-class row logic needs modular pitch-class support or transformations.

### Harmonic Progression And Context

Jazz chord-scale theory, tonal harmony, and many modal practices require:

```text
a harmonic context stream
pitch material selected by that context
voice-leading from one sonority to the next
optional chord/scale compatibility metadata
```

Current product tables can place multiple streams together, but they do not yet have a clean selector mechanism where one stream chooses which child material is active.

### Form

The current system handles local material better than large form.

Formal concepts such as:

```text
period
sentence
binary
ternary
rondo
sonata
theme and variations
fugue exposition
process form
```

need section-level or score-event connectors:

```text
section_id
section_start_tick
section_duration_tick
material_id
variation_id
cadence_type
return_marker
```

Without these, the system can make long processes, but not explicit large-scale form.

### Microtonality And Tuning

The current `pitch_midi` scalar is 12-TET/MIDI-centered.

To represent maqam intonation, gamelan tunings, just intonation, EDO systems, or spectral partials, we need future scalars such as:

```text
pitch_cents
pitch_class_step
tuning_divisions
tuning_reference
accidental_code
microtone_cents
```

Until then, many non-12-TET theories can only be represented as approximate pitch_midi skeletons plus metadata.

### Performance Practice

Raga, maqam, gamelan pathet, jazz language, and many oral/performative systems are not reducible to scale collections.

They require metadata and future performance/phrase layers:

```text
ascending path
descending path
characteristic motives
important tones
ornament/gamaka behavior
modulation points
cadential formulas
time/occasion associations
style-specific phrase behavior
```

The corpus should include them, but should mark them carefully as incomplete if represented only as pitch collections.

## Architecture We Still Need

### 1. Metadata / Equivalence Layer

Many concepts should not become separate connectors.

Examples:

```text
Ionian = diatonic_heptatonic_steps_v2, shift 0
Dorian = diatonic_heptatonic_steps_v2, shift 1
whole-half octatonic = octatonic_steps_v2, shift 1
Messiaen mode 1 = whole_tone_steps_v2
major pentatonic = anhemitonic_pentatonic_steps_v2 with a named RI coordinate
```

We need a durable metadata layer for:

```text
aliases
RI coordinate names
rotation equivalences
transposition equivalences
historical/cultural names
recommended random ranges
compatible product examples
```

### 2. Selector / Lookup Transformations

The most important missing transformation family remains:

```text
lookup/table
delta_table
selector
periodic mask
```

These would make finite cyclic materials much easier:

```text
duration cycles
dynamic maps
articulation maps
note_kind masks
row forms
formal section maps
```

### 3. Score-Event Tables

MusicXML-compatible note tables are only the first layer.

The next major world contract expansion should distinguish:

```text
note-event tables
score-event tables
section/form tables
metadata/equivalence tables
```

### 4. Validation And Diagnostics

To compose intricate music with confidence, worlds need diagnostics such as:

```text
this connector produces compatible terminal scalars
these values are out of render range
these streams have mismatched row counts
this product has no pitch stream
this note_kind mask hides all notes
this voice-leading rule failed
```

This should not replace the protocol. It should make connector outputs legible.

## Verdict

The current approach is right if we understand it as:

```text
a reusable material and product-connector ontology
```

It is not sufficient if we mistake it for:

```text
a complete automated composer
```

The next realistic target is:

```text
Build a rich corpus of reusable materials and product patterns first.
Then add metadata, selection, validation, tuning, and form layers.
```

Once those layers exist, it becomes realistic to compose intricate connector compositions by assembling:

```text
material connectors
product connectors
voice/texture connectors
form roots
metadata-defined RI coordinates
world-side diagnostics
```
