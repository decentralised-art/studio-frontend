# Connector Tree Notation

Use this notation for active MusicXML World concept-network and corpus docs.

Read `system-principles.md` first. This file only defines the compact notation used to write exact connector trees.

## Basic Shape

```text
connector_name
|- D1 -> child_connector
|       transformations: add(a), add(b), ...
|- D2 -> another_child
|       transformations: multiply(r)
`- D3 -> terminal_scalar
        transformations: add(n)
```

Each `D` line is one connector dimension.

The transformations listed on that dimension are applied cyclically by PT execution. `transformation_shift` rotates the transformation list.

## Material Connector

A material connector usually exposes one semantic terminal scalar:

```text
diatonic_heptatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

This is a pitch material, not a complete note table.

## Product Connector

A product connector combines materials into a compatible event table:

```text
diatonic_mode_quarters_v3
|- D1 -> quarter_tick_grid_v1
|       transformations: add(1)
|- D2 -> quarter_duration_tick_v2
|       transformations: add(1)
`- D3 -> diatonic_heptatonic_steps_v2
        transformations: add(1)
```

If the terminal scalar set exposed through the full tree includes:

```text
onset_tick
duration_tick
pitch_midi
```

then the product can be MusicXML/MIDI-compatible under the format contract.

## RI Roles

Use these labels in every proposed connector spec:

```text
open RI
  The user or randomizer can set this at runtime.

static RI
  The connector fixes this value in `static_ri`.

derived RI
  The value is not directly controlled; it is produced by an upstream connector.
```

For single-dimensional materials that composite into a terminal scalar, current live behavior is:

```text
material root RI start_point
  offset into the material traversal.

terminal scalar RI start_point
  base value / tonic / register / initial scalar value.

terminal scalar transformation_shift
  phase of the material transformation cycle.
```

Example:

```text
diatonic_heptatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

For the standalone connector:

```text
position 0 start_point -> material traversal offset
position 1 start_point -> MIDI pitch base, for example 60
position 1 shift       -> modal phase
```

For a note table using this as a child, positions are projected into the parent tree. The exact projected positions must be recomputed per exact tree.

## Complexity Labels

Each concept node should include one complexity label:

```text
C0 terminal scalar
C1 one-dimensional stream with one repeated operation
C2 cyclic finite grammar
C3 product table combining several streams
C4 nested product / multi-voice texture
C5 score/form root
```

## Equivalence Metadata

Every cyclic grammar should document:

```text
rotation-equivalent concepts
inversion-equivalent concepts
transposition-equivalent concepts
duration-scaling-equivalent concepts
named concepts represented by RI values
```

Do not create a separate connector for a concept that is already represented by an RI value inside an existing connector unless a wrapper with static RI is useful.

## Draft Spec Template

```text
Name:
Status:
Precision:
Complexity:
Terminal scalar(s):
Period:
Grammar:
Dependencies:
Tree:
Open RI:
Static RI:
Equivalent concepts represented by RI:
Relations:
Smoke test:
Notes:
```
