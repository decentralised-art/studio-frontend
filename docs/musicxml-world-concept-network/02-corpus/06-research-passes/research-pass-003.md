# Research Pass 003

Date: 2026-05-19

Scope: make the concept corpus operational by separating immediately deployable connector ideas from concepts needing world contracts, future operations, or metadata decisions.

## Files Added

```text
../00-overview/readiness-matrix.md
../../03-deploy-candidates/README.md
../../03-deploy-candidates/01-pitch-materials/01-equal-division-generators/README.md
../../03-deploy-candidates/01-pitch-materials/02-ordered-interval-grammars/README.md
../../03-deploy-candidates/02-rhythm-materials/README.md
../../03-deploy-candidates/04-product-tables/01-minimal-note-tables/README.md
```

## Main Result

The corpus now has a bridge between broad music-theory exploration and concrete connector deployment.

The new matrix defines five readiness lanes:

```text
Lane A: deployable now
Lane B: deployable now, but needs local smoke verification first
Lane C: blocked by world contract/rendering support
Lane D: needs missing transformation, condition, scalar, or world support
Lane E: reference or metadata only
```

This should prevent future passes from treating every music-theory name as a connector.

The first deploy-candidate docs now give exact P3-style specs for:

```text
equal-division pitch generators
basic missing onset/duration grids
simple product-table sketches using those materials
```

## Pitch Clarifications

The pass reinforces that pitch materials should be circular grammars, not isolated interval objects.

Deployable-now pitch families include:

```text
add3_minor_third_cycle
add4_major_third_cycle
add5_circle_of_fourths_steps
add6_tritone_steps
add7_circle_of_fifths_steps
add12_octave_register_steps
harmonic_minor_heptatonic_steps
melodic_minor_heptatonic_steps
harmonic_major_heptatonic_steps
acoustic_heptatonic_steps
double_harmonic_heptatonic_steps
hungarian_minor_heptatonic_steps
messiaen_mode_3_steps
messiaen_mode_4_steps
messiaen_mode_5_steps
messiaen_mode_6_steps
messiaen_mode_7_steps
augmented_hexatonic_steps
blues_hexatonic_steps
```

But many named sonorities remain review candidates, not deploy candidates, because a historical/theoretical name does not uniquely define a cyclic traversal.

Examples:

```text
Prometheus collection
Petrushka collection
Tristan sonority
all-interval tetrachords
Forte set-class representatives
```

These need exact traversal, spelling, voicing, and metadata decisions before deployment.

## Rhythm Clarifications

The pass separates:

```text
onset distance streams
duration value streams
notation control streams
```

This matters because onset materials can use direct distance transformations:

```text
add(2520), add(1260), ...
```

while duration cycles need deltas between duration values:

```text
desired values: [1260, 2520, 1260, 5040]
transformations: add(1260), subtract(1260), add(3780), subtract(3780)
```

Deployable-now rhythm families include:

```text
whole_tick_grid
sixteenth_tick_grid
quarter_triplet_tick_grid
eighth_triplet_tick_grid
quintuplet_quarter_grid
septuplet_quarter_grid
matching constant duration materials
selected additive onset materials
selected Euclidean onset-distance materials
```

Duration cycles are Lane B because they need smoke tests and value-safety review.

## Expressive Clarifications

`velocity_midi` materials can already be designed, but they should be deployed carefully because rendering and MIDI behavior need practical verification.

Other expressive and notation scalars remain contract-bound:

```text
dynamic_code
articulation_code
note_kind
stem_code
beam_group
accidental_code
```

These should not become curated connector families until each scalar has an exact integer map.

## Operation Priorities

The matrix identifies the most important missing transformation:

```text
lookup/table or delta_table
```

This would simplify:

```text
finite duration cycles
note_kind masks
dynamic maps
articulation maps
pitch-class set representatives
```

The second most important missing transformation is:

```text
fold/bounce range
```

This would make generated pitch, velocity, and duration streams easier to keep inside useful ranges without relying on world-side hiding.

## Recommended Next Work

The next pass should create exact P3 concept nodes, not another broad catalog.

Recommended first P3 targets:

```text
add3_minor_third_cycle
add4_major_third_cycle
add5_circle_of_fourths_steps
add6_tritone_steps
add7_circle_of_fifths_steps
add12_octave_register_steps
sixteenth_tick_grid
sixteenth_duration_tick
quarter_triplet_tick_grid
quarter_triplet_duration_tick
harmonic_minor_heptatonic_steps
messiaen_mode_3_steps
```

Each P3 node should include:

```text
exact connector tree
dependencies
terminal scalar
RI roles
expected smoke output
known aliases
rotation/shift metadata
product connector examples
```

## Open Questions

```text
1. Should inverse equal-division generators add(8), add(9), add(10), add(11)
   be deployed separately, or documented as metadata over add(4), add(3),
   add(2), add(1)?

2. Should first product connectors prioritize educational clarity or reusable
   compositional usefulness?

3. How soon should velocity_midi be included in curated product tables?

4. Should lookup/table be designed as a general transformation, or should
   delta_table be introduced first because it better matches current connector
   execution semantics?
```
