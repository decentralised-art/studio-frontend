# Operations And Conditions Corpus

This document describes the operation vocabulary that the musical corpus can use.

In PT/DCN, transformations and conditions are not merely implementation details. They define the available grammar for musical thought.

## Current Protocol Semantics

### Transformations

A transformation maps one `uint32` particle value to another:

```text
run(x, args) -> y
```

Transformations are attached to connector dimensions. The dimension's transformation list is cyclic, and `transformation_shift` chooses the phase of that list.

Musical consequence:

```text
add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

is not merely arithmetic. It is an ordered cyclic interval grammar.

### Conditions

A condition currently checks connector activation:

```text
check(args) -> bool
```

It does not currently inspect each generated particle value. Therefore, a condition is a gate over whether a connector runs, not a per-note filter.

This matters for musical design. Concepts like "only play notes inside register" should usually be represented by renderer behavior, transformations, or future particle-aware logic, not by current conditions.

## Existing Core Operation Families

The local DCN core collection draft documents these primitives:

```text
util_identity_v1
math_add_v1
math_subtract_v1
math_multiply_v1
math_divide_v1
math_modulo_v1
math_power_v1
math_min_v1
math_max_v1
math_clamp_v1
math_quantize_step_v1
```

The current deployed musical connectors also use legacy/simple names such as:

```text
add
```

The taxonomy should document concepts by operation semantics first, and deployment names second.

## Existing Core Condition Families

The local DCN core collection draft documents:

```text
logic_always_true_v1
logic_equals_v1
logic_greater_than_v1
logic_less_than_v1
logic_between_inclusive_v1
```

These are useful for connector activation but should not be confused with musical stream filters.

## Transformation Roles In Musical Concepts

### Identity

Semantic meaning:

```text
pass-through
hold current value
delegate meaning to child connector
```

Use cases:

```text
semantic wrapper
static table layer
fixed event-id stream
fixed part/staff/voice stream
```

### Addition

Semantic meaning:

```text
absolute displacement
interval motion
time advance
velocity contour step
register shift
```

Use cases:

```text
pitch intervals in semitones
onset distances in ticks
dynamic contour deltas
accent pattern jumps
serial ordered intervals
```

### Subtraction

Semantic meaning:

```text
descending interval
negative contour
decrescendo step
retrograde-like displacement when combined with ordered cycles
```

Current caveat:

```text
uint32 underflow can revert.
```

For pitch-class concepts, prefer modular arithmetic or start values that cannot underflow.

### Multiplication

Semantic meaning:

```text
augmentation
proportional expansion
geometric contour
tempo/duration scaling
set multiplication when used modulo a space
```

Use cases:

```text
duration doubles
tempo ratios
velocity expansion around a base, if bounded later
pitch-class multiplication modulo 12, if composed with modulo
```

### Division

Semantic meaning:

```text
diminution
proportional compression
integer ratio reduction
```

Caveat:

```text
integer division loses remainders.
```

For musically exact tuplets, it is often better to encode tick values directly when possible.

### Modulo

Semantic meaning:

```text
cycle closure
pitch-class reduction
periodic time wrapping
bounded index space
```

Use cases:

```text
pitch_class = pitch % 12
bar_position = onset_tick % bar_ticks
cyclic velocity index
```

Potential issue:

```text
MusicXML/MIDI pitch_midi needs absolute register, so modulo should usually live in an intermediate connector, not directly at terminal pitch_midi.
```

### Min, Max, Clamp

Semantic meaning:

```text
floor
ceiling
renderable range
instrument range
velocity range
```

Use cases:

```text
keep velocity in 1..127
limit note register for an instrument
limit duration to readable values
```

Conceptual caveat:

The world already skips out-of-range rows at render time. A clamp transformation changes the composition; render skipping only changes visibility.

### Quantize Step

Semantic meaning:

```text
grid snapping
metric quantization
register quantization
velocity banding
```

Use cases:

```text
snap onset_tick to 1260
snap velocity_midi to dynamic bands
snap pitch_midi to octave grid before adding pitch-class material
```

## Missing Transformation Families To Consider

These are not a deployment request. They are operation families that would make the taxonomy more complete.

Important:

```text
Missing convenience transformations are not blockers for finite concepts whose
exact delta sequence can be written with current operations.
```

For deployable finite value cycles, use:

```text
positive delta -> add(delta)
zero delta     -> add(0)
negative delta -> subtract(abs(delta))
```

### Modular Add

```text
mod_add(x, step, modulus) = (x + step) % modulus
```

Music uses:

```text
pitch-class cycles
rhythmic cyclic indices
accent cycles
form-section rotation
```

### Modular Multiply

```text
mod_multiply(x, factor, modulus) = (x * factor) % modulus
```

Music uses:

```text
pitch-class multiplication
serial multiplication
nonlinear permutation of cyclic spaces
```

### Reflect Around Axis

```text
reflect(x, axis) = axis - (x - axis)
```

Music uses:

```text
melodic inversion
registral mirroring
velocity inversion
rhythmic complement around a center
```

Needs careful unsigned handling.

### Absolute Difference

```text
abs_diff(x, center)
```

Music uses:

```text
distance from center pitch
distance from metric center
dynamic arch contours
```

### Lookup Table / Step Table

```text
lookup(index, table)
```

Current PT connectors often simulate tables with cyclic transformation lists. A real lookup transformation would make set-class, tala, contour, and articulation vocabularies much cheaper to document and deploy.

Potential issue:

Arbitrary-length args can become expensive or awkward in Solidity. This might be better as a connector pattern than as one transformation.

### Conditional Transform

```text
if x < threshold then a else b
```

Music uses:

```text
range-dependent register folding
accent only on metric positions
voice split by pitch/register
```

This is a transformation, not a current connector condition, because it acts per particle.

### Fold / Bounce

```text
fold x into [min, max] by reflection
```

Music uses:

```text
melodies that bounce inside an instrument range
velocity contours that reflect at boundaries
```

This is preferable to clamp when the composer wants values beyond the boundary to remain musically active.

### Mask / Gate Value

```text
mask x by periodic pattern
```

Music uses:

```text
rests
accent masks
articulation masks
Euclidean hit/rest structures
```

Could output `note_kind`, `velocity_midi`, or an event activity scalar.

## Musical Condition Use Cases

Because current conditions are connector activation gates, their strongest musical roles are at the level of form, ownership, permission, and context.

### Always True

Use for normal reusable materials.

### Static Range Gate

Use case:

```text
connector activates only if a configured value is within range
```

This can document a concept like:

```text
only deploy/render this section for tempo class 60..90
```

But it does not inspect generated notes.

### Version / Mode Gate

Use case:

```text
activate one branch when condition_arg mode == 3
```

This can turn a connector into a conditional form switch if the runtime exposes condition args.

### Time / Block Gate

Future use:

```text
activate after a date
activate during a performance window
activate during an exhibition
```

This is musically meaningful for worlds as live environments.

### Ownership / Token Gate

Future use:

```text
activate a voice only for a collector
activate extra layers when a group owns a token
```

This is not music theory in the old sense, but it is native to decentralised.art as collective composition.

### External Signal Gate

Future use:

```text
weather
oracle state
governance state
live sensor
```

This should be handled carefully because it can undermine deterministic reproducibility if the signal is not committed.

## What Conditions Should Not Do Yet

Do not document current conditions as if they can:

```text
remove every pitch outside a scale
skip every note above a register
accent every downbeat
filter every nth particle
```

Those are per-particle operations. They require transformations, renderer interpretation, product-table structure, or future particle-aware conditions.

## Operation Completeness Checklist

Before a concept becomes a deploy candidate, ask:

```text
1. Is the concept a stream map, a connector gate, or a renderer interpretation?
2. Can current transformations express it exactly?
3. If not, can a connector tree express it without a new transformation?
4. Does it need a new terminal scalar?
5. Does it need a future per-particle operation?
6. Does it need a condition only for activation, not note filtering?
7. Does the concept remain useful outside the MusicXML world?
```
