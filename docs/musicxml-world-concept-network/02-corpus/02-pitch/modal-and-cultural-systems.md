# Modal And Cultural Systems

Date: 2026-05-20

This document expands the pitch corpus toward modal systems that are not reducible to simple Western scale names.

The purpose is not to appropriate or flatten these traditions into generic scales. The purpose is to identify which parts of their theory can be represented as connectors, and which require metadata, tuning support, performance grammar, or future world features.

## General Rule

For cultural modal systems:

```text
scale skeleton is only one layer
```

A proper corpus entry may also need:

```text
ascending path
descending path
important tones
modulation point
characteristic motives
ornament behavior
cadential formulas
time/occasion associations
tuning reference
performance practice notes
```

## Maqam / Ajnas

Maqam theory is promising for connector trees because maqam scales can be understood as combinations of smaller scale fragments.

Connector intuition:

```text
maqam_product
|- D1 -> lower_jins_material
`- D2 -> upper_jins_material
```

But this is not yet exact.

Needed layers:

```text
jins interval grammar
ghammaz / modulation point
microtonal interval support
melodic behavior metadata
cadential formulas
```

Near-term deployable representation:

```text
explicit 12-TET pitch_midi skeleton only, when the approximation is named as such
```

Example shape:

```text
maqam_or_jins_skeleton_steps_12tet_approx
`- D1 -> pitch_midi
        transformations: add(...)
```

Future richer representation:

```text
jins_as_pitch_cents_material
maqam_as_jins_product
maqam_behavior_metadata
```

Richer representation needs:

```text
pitch_cents or microtone support
maqam-specific accidental/spelling map
metadata layer for behavior and modulation
```

## Raga / Melakarta / Janya

The 72 Melakarta system is attractive as a finite parent-scale grid.

However, raga is not equivalent to scale.

A raga entry may need:

```text
arohana / ascending path
avarohana / descending path
vadi / important tone metadata where applicable
gamaka / ornament behavior
characteristic phrases
permitted and avoided movements
tala relationship if composition-specific
```

Near-term deployable connector idea:

```text
melakarta_parent_scale_as_pitch_midi_approximation
`- D1 -> pitch_midi
        transformations: add(...)
```

But that should be marked as:

```text
approximate skeleton only
```

Better future connector idea:

```text
raga_material
|- D1 -> ascending_pitch_material
|- D2 -> descending_pitch_material
|- D3 -> phrase_formula_selector
`- D4 -> ornament/gamaka scalar
```

Richer raga representation needs:

```text
direction-aware selection
ornament/gamaka representation
microtonal/tuning support
metadata layer
```

## Tala Interaction

Raga and tala are conceptually distinct but compositionally intertwined.

Do not embed tala inside a pitch connector.

Represent this through product/composition connectors:

```text
composition_product
|- D1 -> raga/pitch material
|- D2 -> tala/onset material
|- D3 -> duration material
`- D4 -> accent/section metadata
```

## Gamelan: Slendro, Pelog, Pathet

Gamelan systems expose a problem with assuming 12-TET.

Corpus implications:

```text
slendro-like systems need non-12 tuning support
pelog-like systems need nonuniform tuning support
pathet should be metadata/mode over a tuning and melodic behavior system
```

Near-term representation:

```text
P1/P2 metadata, or explicit 12-TET/pitch_step approximation if a skeleton is chosen
```

Future deployable representation:

```text
slendro_pitch_step_material
pelog_pitch_step_material
pathet_metadata_or_wrapper
```

Richer representation needs:

```text
tuning system support
pitch_step or pitch_cents scalar
world rendering/audio support
```

## Jazz Modal / Chord-Scale Systems

Chord-scale theory maps harmonic context to pitch resources.

Connector implication:

```text
The pitch material is not enough.
The composition needs a harmonic-context stream that selects or colors pitch material.
```

Possible future shape:

```text
chord_scale_product
|- D1 -> harmony_context_material
|- D2 -> pitch_material_selector
|- D3 -> onset material
`- D4 -> duration material
```

Richer representation needs:

```text
selector/lookup transformation
chord/harmony scalar vocabulary
world-side harmonic labels
```

## References

```text
MaqamWorld, Arabic Maqam:
https://www.maqamworld.com/en/maqam.php

Britannica, Tala:
https://www.britannica.com/art/tala

Britannica, Pathet:
https://www.britannica.com/art/pathet

Open Music Theory, Chord-Scale Theory:
https://viva.pressbooks.pub/openmusictheory/chapter/chord-scale-theory/
```
