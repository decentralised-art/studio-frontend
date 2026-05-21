# Serial, Set-Class, And Tuning Systems

Date: 2026-05-20

This document extends the pitch corpus beyond scale-like ordered interval grammars.

It covers:

```text
serial rows
pitch-class set theory
microtonality and EDO systems
spectral / harmonic-series materials
```

## Serial Rows

Twelve-tone theory treats a row as an ordered collection of the twelve pitch classes. Row forms are generated through operations such as:

```text
prime
transposition
inversion
retrograde
retrograde inversion
```

Connector implication:

```text
Rows are ordered materials, not unordered pitch sets.
```

Possible connector representation:

```text
row_name_interval_grammar
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(i11), add(closing_interval)
```

This represents the row as a cyclic interval grammar.

Important system interpretation:

```text
Serial logic is not blocked by pitch_midi being absolute.

The connector tree can encode the pitch-class idea above pitch_midi.
RI startingValues choose the actual transposition/register at runtime.
The final world-readable result is still actual pitch_midi, exactly as a
composition ultimately resolves abstract pitch relations into sounding notes.
```

Therefore, twelve-tone rows should be treated as deployable pitch materials:

```text
row connector:
  circular interval grammar over pitch_midi

RI startingValue:
  row transposition / starting pitch / register

transformationShift:
  row rotation

N:
  row length, repeated row traversal, or longer compositional continuation
```

Useful future transformations:

```text
modular add
modular inversion / reflect
reverse / retrograde
lookup/table
```

These are not conceptual blockers. They would make row-form construction more
compact and explicit, but equivalent musical procedures can be built as layered
connector trees on top of `pitch_midi`.

P3 deployment pattern:

```text
../../03-deploy-candidates/01-pitch-materials/04-serial-row-materials/
```

Needed metadata:

```text
row prime form
row interval succession
P/I/R/RI relation
hexachordal combinatoriality
invariance relations
source/composer/work references
```

## Pitch-Class Set Theory

Set-class theory is not naturally the same as connector execution.

Set-class concepts often ignore:

```text
ordering
register
doubling
rhythm
voicing
```

A connector, by contrast, emits ordered scalar streams.

So the generic set-class label should initially be:

```text
metadata around ordered representatives
```

not directly deployed as a connector.

Deployable current representation:

```text
set_class_3_11_representative_a
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(in)
```

This is exact when the representative policy is exact:

```text
chosen prime/normal form
chosen ordering
chosen voicing/register policy if simultaneity matters
expected smoke output
```

Optional future representation:

```text
set_class_3_11_representative_a
`- D1 -> pitch_class
        transformations: lookup/table(...)
```

That future form is a convenience layer for analysis and pitch-class-specific
worlds. It is not required for current MusicXML/MIDI deployment.

Do not deploy vague Forte/set-class names as pitch_midi materials. Deploy exact
representatives and attach the Forte/set-class identity as metadata.

## Microtonality And EDO Systems

Equal divisions of the octave generalize the current 12-TET assumption.

Our current `pitch_midi` layer can only represent:

```text
integer semitone positions in 12-TET-like space
```

To support EDO or other xenharmonic systems, the corpus needs future tuning scalars:

```text
tuning_divisions
tuning_period_ratio
pitch_step
pitch_cents
microtone_cents
accidental_code
```

Possible EDO material shape:

```text
edo_n_step_k_material
`- D1 -> pitch_step
        transformations: add(k)
```

Example:

```text
19edo_step_11_circle_like_generator
`- D1 -> pitch_step
        transformations: add(11)
```

Richer EDO rendering needs:

```text
world support for non-pitch_midi terminal scalars
MusicXML accidental/spelling strategy
audio/MIDI tuning strategy
```

## Maqam, Raga, And Gamelan As Tuning-Aware Systems

Many modal traditions cannot be reduced to 12-TET scale lists.

They often include:

```text
non-12-TET tuning
ascending/descending asymmetry
important tones
phrase formulas
ornaments
modulation points
performance-time associations
```

The corpus should support them, but mark 12-TET pitch_midi versions as approximations.

## Spectral And Harmonic-Series Materials

Spectral materials are based on partials and frequency relationships.

A future connector family could use:

```text
partial_index
frequency_ratio
pitch_cents
amplitude
instrument/timbre metadata
```

Possible shape:

```text
harmonic_series_partials_v1
|- D1 -> partial_index
|       transformations: add(1)
`- D2 -> amplitude
        transformations: ...
```

Richer spectral rendering needs:

```text
ratio/log transformations
pitch_cents support
world rendering of microtonal pitch
timbre/instrument interpretation
```

## References

```text
Open Music Theory, Twelve-Tone Operations:
https://openmusictheory.github.io/twelveToneOperations.html

Open Music Theory, Analyzing 12-tone music:
https://openmusictheory.github.io/twelveTone.html

Xenharmonic Wiki, EDO:
https://en.xen.wiki/w/Edo

MusicXML 4.0 elements:
https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/
```
