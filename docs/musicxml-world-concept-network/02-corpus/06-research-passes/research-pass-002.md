# Research Pass 002

Date: 2026-05-19

Scope: expand the first-pass taxonomy into candidate catalogs with more precise connector archetypes, value maps, tick values, and operation gaps.

## Files Added

```text
pitch-candidate-catalog.md
rhythm-candidate-catalog.md
expressive-candidate-catalog.md
operation-gap-catalog.md
texture-form-space.md
```

## Main Improvements

### 1. Pitch Candidates Are More Concrete

The pitch catalog now lists near-term cyclic grammars:

```text
harmonic minor
melodic minor
harmonic major
acoustic
double harmonic
Hungarian minor
Messiaen modes 3-7
augmented hexatonic
blues hexatonic
Prometheus collection
Petrushka collection
```

It also separates:

```text
pitch stream
pitch-class set
named sonority
ordered voicing
simultaneous note table
```

This prevents premature deployment of sonorities whose spelling or voicing matters.

### 2. Rhythm Candidates Now Have Tick Values

The rhythm catalog now documents useful tick values:

```text
quarter = 2520
eighth = 1260
sixteenth = 630
quarter triplet = 840
eighth triplet = 420
quintuplet quarter = 504
septuplet quarter = 360
```

It also gives candidate onset grammars for:

```text
fixed grids
additive rhythms
Euclidean rhythms
non-retrogradable rhythms
duration value cycles
note_kind masks
metric accents
tempo materials
isorhythmic products
```

### 3. Duration Cycles Are Treated Carefully

Duration cycles now document:

```text
desired values
start_point
delta transformations
```

This avoids the common mistake of treating duration transformations like onset distances.

### 4. Expressive Materials Are Candidate-Level

The expressive catalog now includes:

```text
velocity constants
velocity contours
candidate dynamic_code map
candidate articulation_code map
note_kind candidates
beam/stem/accidental placeholders
expressive product-table examples
```

### 5. Operation Gaps Are Named

The operation gap catalog now identifies high-value missing transformations:

```text
lookup/table
delta table
modular add
modular multiply
fold/bounce range
reflect around axis
absolute distance
periodic mask
affine transform
rational scale
```

It also clarifies which musical ideas are future per-particle logic rather than current connector conditions.

### 6. Texture And Form Are Now In The Corpus

The new texture/form doc adds:

```text
single voice products
accent products
rest-mask products
isorhythm
drone/pedal textures
canon/delay textures
hocket
polyrhythm/polymeter
register split
density
form patterns
Hypermusic-native form
```

## Strongest New Conceptual Insight

The taxonomy should not only copy existing music theory. It should also name system-native concepts:

```text
RI as concept relation
N as density/time lens
format as semantic surface
world-compatible product table
compatible connector set as repertoire
condition-gated branch as social/event form
```

These are not standard conservatory categories, but they are standard for this system.

## What Is Still Too Weak

### Pitch

```text
The set-class corpus is still not enumerated locally.
Named sonorities still need source-reviewed pitch-class/spelling cards.
Neo-Riemannian and voice-leading spaces are only rough future concepts.
Spectral pitch is only approximate while pitch_midi is the only pitch scalar.
```

### Rhythm

```text
Euclidean rotations need a canonical normalization policy.
Rest-mask patterns need lookup/table or another value-cycle solution.
Tuplet notation needs renderer support beyond correct ticks.
Meter tables are not implemented yet.
```

### Expressive Scalars

```text
dynamic_code is not finalized.
articulation_code is not yet active in the world contract.
Spanners need separate event-table design.
Velocity 0 policy needs a final decision.
```

### Operations

```text
Lookup/table is probably the most important missing transformation.
Fold/bounce is probably the most musically useful bounded-range operation.
Particle-aware filtering should not be confused with current conditions.
```

### Texture/Form

```text
Multiple product tables under one root need exact tested PT shapes.
Canon/delay semantics need smoke tests.
Voice/staff assignment needs stronger world support.
```

## Recommended Next Research Passes

Do not deploy yet.

Recommended pass order:

```text
Pass 003A: operation pass
  decide which missing transformations are worth implementing/deploying first.

Pass 003B: rhythm pass
  make Euclidean/additive/non-retrograde candidates exact P3 docs.

Pass 003C: pitch-sonority pass
  make Messiaen 3-7 and selected named sonorities exact P3 docs.

Pass 003D: expressive scalar pass
  finalize dynamic_code, articulation_code, note_kind, and velocity policy.
```

## References Used In This Pass

Reference anchors checked while expanding the catalog:

```text
Open Music Theory / LibreTexts post-tonal and twelve-tone materials
Puget Sound set-class and Forte-number references
Toussaint's Euclidean rhythm work
MusicXML 4.0 dynamics reference
MusicXML articulation reference material
Open Music Theory neo-Riemannian transformation material
Tymoczko / chord-space and voice-leading geometry references
```
