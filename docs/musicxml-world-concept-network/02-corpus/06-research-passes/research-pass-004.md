# Research Pass 004

Date: 2026-05-20

Scope: compare the current corpus against broader music-theory and notation references, then identify whether the current connector ontology can support intricate composition.

## Sources Checked

```text
Open Music Theory:
  twelve-tone operations
  analyzing twelve-tone music
  species counterpoint
  first-species counterpoint
  chord-scale theory
  phrase/form materials
  hypermeter

MusicXML 4.0:
  element reference
  tuplet reference

MaqamWorld:
  maqam and ajnas structure

Britannica:
  tala
  pathet

Xenharmonic Wiki:
  EDO
```

## Main Conclusion

The current approach is correct as a corpus of reusable connector materials and product tables.

It is not yet a complete compositional system.

We can already build:

```text
cyclic pitch materials
cyclic rhythm materials
phase/process pieces
simple note-table products
isorhythmic textures
basic multi-layer products
```

We cannot yet fully build:

```text
strict serial row systems
set-class transformations
validated counterpoint
formal section grammars
microtonal modal systems
notation-complete MusicXML output
culturally specific performance systems
```

## Files Added

```text
../00-overview/capability-assessment.md
../02-pitch/serial-set-and-tuning-systems.md
../02-pitch/modal-and-cultural-systems.md
../03-rhythm/metric-cycle-systems.md
../05-composition/counterpoint-form-and-grammar-systems.md
```

## Extensions Needed In The Corpus Tree

### Pitch

Add:

```text
serial rows
set-class systems
microtonal / EDO systems
maqam / ajnas
raga / melakarta / janya
gamelan slendro/pelog/pathet
spectral / harmonic-series materials
jazz chord-scale systems
```

### Rhythm

Add:

```text
tala-like metric cycles
aksak/additive meter
clave/timeline patterns
hypermeter
tuplet rendering metadata
metric accent cycles
```

### Composition

Add:

```text
counterpoint
canon
fugue / imitation
phrase forms
large forms
formal section roots
validation/diagnostic layers
```

### Operations

Prioritize:

```text
lookup/table
delta_table
modular add
modular inversion / reflect
retrograde / reverse
fold/bounce range
selector
periodic mask
```

## Answer To The Compositional Question

With the current corpus, I can design connector compositions that are intricate in the sense of:

```text
cyclic material interaction
mode/phase control
rhythmic process
layered product tables
formal sketches through repeated products
```

But I would not yet claim the system can compose intricate music across the full historical/theoretical range of music theory.

To reach that point, the next necessary layer is:

```text
metadata + selectors + validation + tuning + form/section contracts
```

This preserves the onchain connector ontology while allowing higher musical intelligence to live in:

```text
curated corpus metadata
world interpretation
diagnostics
assistant-guided composition workflows
```

## Practical Next Step

Before more deployment, document one exact P3 path for each of these four categories:

```text
1. ordered pitch grammar
2. additive/metric rhythm
3. product table with velocity
4. two-voice texture or canon sketch
```

That will test whether the corpus can move from material lists into actual compositional connector design.
