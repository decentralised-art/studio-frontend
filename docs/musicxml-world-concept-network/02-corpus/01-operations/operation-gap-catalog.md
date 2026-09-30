# Operation Gap Catalog

This document lists transformations and conditions that would make the musical corpus more expressive.

It separates:

```text
available operations
operations we can emulate with current connector patterns
operations that probably need new transformations
operations that sound like conditions but are actually per-particle transformations
```

## Available Or Near-Available Primitives

The local core collection draft already describes:

```text
identity
add
subtract
multiply
divide
modulo
power
min
max
clamp
quantize_step
```

Current musical connectors often use the legacy name:

```text
add
```

The taxonomy should gradually normalize documentation around semantic operation names while preserving deployed names where relevant.

## Highest-Value Convenience Transformations

The transformations below would make the corpus more compact and easier to
author. They are not blockers for finite musical materials whose exact value or
delta sequence is already known. Those should be documented with current
`add`/`subtract`/`multiply`/`divide` recipes first.

### 1. Lookup / Table

Semantics:

```text
table_lookup(x, table[]) = table[x % table.length]
```

Use cases:

```text
duration value cycles
velocity value cycles
note_kind masks
articulation masks
pitch-class set membership output
tala / rhythmic pattern tables
dynamic code cycles
```

Why it matters:

Current cyclic transformation lists represent deltas. Many musical concepts are easier to document as values.

Current deployable workaround:

```text
encode finite value lists as delta cycles:
positive delta -> add(delta)
negative delta -> subtract(abs(delta))
```

Risk:

Large argument arrays may be expensive or awkward.

Precision: P1 operation candidate.

### 2. Delta From Table

Semantics:

```text
delta_table(x, deltas[]) = x + deltas[opIndex % deltas.length]
```

Use cases:

```text
ordered interval cycles
onset-distance patterns
velocity contours
duration transitions
```

This is close to how current transformation lists already behave, but one operation with table args could reduce connector size.

Current deployable workaround:

```text
write each delta as a separate transformation in the dimension.
```

Precision: P1 operation candidate.

### 3. Modular Add

Semantics:

```text
mod_add(x, step, modulus) = (x + step) % modulus
```

Use cases:

```text
pitch-class transposition
phase index cycles
accent cycles
form cycles
```

Precision: P1 operation candidate.

### 4. Modular Multiply

Semantics:

```text
mod_multiply(x, factor, modulus) = (x * factor) % modulus
```

Use cases:

```text
pitch-class multiplication
serial multiplication
cyclic permutation
nonlinear phase remapping
```

Precision: P1 operation candidate.

### 5. Fold / Bounce Range

Semantics:

```text
fold x into [min, max] by reflecting at boundaries
```

Use cases:

```text
melody within instrument range
velocity contour within 1..127
tempo contour within playable range
register-bounded arpeggiation
```

Why not clamp:

Clamp kills excess motion at the boundary. Fold keeps the motion active.

Precision: P1 operation candidate.

### 6. Reflect Around Axis

Semantics:

```text
reflect_axis(x, axis) = 2 * axis - x
```

Needs unsigned-safe implementation.

Use cases:

```text
melodic inversion
velocity inversion
register mirroring
axis-based harmony
```

Precision: P1 operation candidate.

### 7. Absolute Distance

Semantics:

```text
abs_distance(x, center)
```

Use cases:

```text
arch contours
distance from tonic/axis
metric distance from downbeat
velocity profile by distance
```

Precision: P1 operation candidate.

### 8. Every N / Periodic Mask

Semantics:

```text
is_hit = (x % period) in selected positions
```

Output variants:

```text
note_kind
velocity_midi
dynamic_code
generic mask scalar
```

Use cases:

```text
rests
accent patterns
metric accents
articulation cycles
Euclidean masks
```

This is a transformation if it outputs values per particle. It is not a current connector condition.

Precision: P1 operation candidate.

### 9. Affine Transform

Semantics:

```text
affine(x, a, b) = a*x + b
```

Use cases:

```text
register expansion
time scaling plus offset
velocity scaling
mapping local index to global coordinate
```

Precision: P1 operation candidate.

### 10. Rational Scale

Semantics:

```text
rational_scale(x, numerator, denominator)
```

Use cases:

```text
dotted durations
metric modulation
tempo proportional change
augmentation by 3/2
```

Current integer multiply/divide can emulate some cases when ordered carefully, but a named operation would make concept docs clearer.

Precision: P1 operation candidate.

## Future Particle-Aware Conditions

These are not current PT conditions. They would require a different condition model or per-particle operation semantics.

```text
only notes inside register
only downbeats
only every nth particle
only pitches in set class
only events with duration above threshold
only voices with density below threshold
```

For now, document these as:

```text
future particle-aware logic
```

or model them with transformations and renderer behavior.

## Connector-Level Conditions Worth Keeping

Current activation-gate conditions are still musically powerful.

```text
section unlocks after time/block
voice activates for specific owner/token
layer activates for performance context
branch activates when configured mode is selected
world-specific layer activates during exhibition
collective/governance event activates a new section
```

These compositional conditions are native to decentralised.art.

## Operation Candidate Review Checklist

Before proposing a new transformation:

```text
1. Can current add/subtract/multiply/divide/modulo express it clearly?
2. Would it reduce connector size or only rename existing behavior?
3. Does it act per particle?
4. Does it need op index / phase access?
5. Does it need arbitrary-length args?
6. Can it be implemented safely with uint32?
7. Is it useful outside MusicXML?
8. Does it preserve deterministic onchain execution?
```
