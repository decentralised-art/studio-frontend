# Counterpoint, Form, And Grammar Systems

Date: 2026-05-20

This document expands the composition layer beyond product tables.

Product tables answer:

```text
Which scalar streams make note events?
```

Counterpoint and form ask harder questions:

```text
How do multiple streams relate?
How does material transform across sections?
What constraints make the result stylistically coherent?
```

## Counterpoint

Counterpoint is not simply "two pitch streams."

It depends on relationships between simultaneous and successive events:

```text
melodic contour
consonance and dissonance
independence of lines
beginning and ending intervals
preparation and resolution
voice crossing
parallel perfect intervals
species-specific rhythmic ratios
```

Current connector status:

```text
Can generate multiple voices: yes.
Can validate contrapuntal rules onchain: no.
```

Near-term product shape:

```text
two_voice_product
|- D1 -> voice_1_note_table
`- D2 -> voice_2_note_table
```

Better future shape:

```text
counterpoint_product
|- D1 -> cantus_firmus_table
|- D2 -> counterpoint_table
`- D3 -> counterpoint_rule_diagnostics
```

Validation and full notation are blocked by:

```text
voice/staff world support
interval-between-voices analysis
particle-aware conditions or diagnostics
validation layer
```

## Canon

Canon is more connector-friendly than general counterpoint because many canons are transformations of one source line.

Possible connector pattern:

```text
canon_product
|- D1 -> source_note_table
`- D2 -> transformed_note_table
```

Transform dimensions:

```text
onset delay
pitch transposition
rhythmic augmentation/diminution
retrograde
inversion
```

Deployable now:

```text
simple onset-delay, transposition, and precomputed row/line transformation
sketches are possible when each voice table is written as an exact product.
```

Future convenience or validation layers:

```text
automatic retrograde derivation
automatic inversion derivation
augmentation/diminution as generic source-line transformations
voice assignment
```

## Fugue / Imitation

Fugue-like systems need:

```text
subject
answer
countersubject
episode
stretto
sequence
voice-entry schedule
```

This is too high-level for immediate deployment.

Near-term representation:

```text
P1/P2 form-root metadata
```

Future connector idea:

```text
fugue_exposition_root
|- D1 -> subject_entry_voice_1
|- D2 -> answer_entry_voice_2
|- D3 -> countersubject_voice_1
`- D4 -> entry_schedule
```

## Phrase And Small Forms

Phrase-level forms should be represented as section grammars, not note materials.

Potential concepts:

```text
basic idea
contrasting idea
sentence
period
antecedent
consequent
cadential unit
presentation
continuation
fragmentation
```

Future scalar candidates:

```text
section_id
phrase_role
cadence_type
formal_function
section_start_tick
section_duration_tick
material_reference
```

## Large Forms

Large forms such as binary, ternary, rondo, sonata, theme-and-variations, and process forms should be modeled as form roots.

Potential shape:

```text
form_root
|- D1 -> section_A_product
|- D2 -> section_B_product
|- D3 -> return_or_variation_product
`- D4 -> section_schedule
```

Current blocker:

```text
No stable section/form scalar contract exists yet.
```

## Composition Readiness

The current corpus supports:

```text
material composition
product-table composition
process/phase composition
basic multi-layer texture sketches
```

It does not yet support:

```text
validated counterpoint
style-aware harmony
large formal grammar
automatic voice-leading correction
score-level section rendering
```

## References

```text
Open Music Theory, First Species Counterpoint:
https://openmusictheory.github.io/firstSpecies.html

Open Music Theory, Introduction to Species Counterpoint:
https://viva.pressbooks.pub/openmusictheory/chapter/species-counterpoint/

Open Music Theory, Phrase Archetypes:
https://viva.pressbooks.pub/openmusictheory/chapter/phrase-archetypes-unique-forms/

Open Music Theory, Sonata Theory:
https://openmusictheory.github.io/SonataTheory-intro.html
```
