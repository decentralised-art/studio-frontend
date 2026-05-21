# Serial Row Material Candidates

Status: deploy-candidate pattern

Precision: P3 when a row's exact pitch-class order and interval grammar are
written down.

Serial rows are operationally viable in the current connector system. They are
not blocked by `pitch_midi` being absolute. The row's abstract pitch-class order
is encoded by a circular interval grammar; RI `start_point` chooses the actual
transposition/register.

## Common Shape

```text
row_name_interval_grammar
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(i12)
```

RI:

```text
pitch_midi start_point = transposition/register
pitch_midi transformation_shift = row rotation
N = 12 for one row, 13 to include octave closure, or longer for repetition
```

The interval list should include the closing interval if the row is documented
as a pitch-class cycle.

## From Pitch-Class Row To Connector

Given row pitch classes:

```text
p0, p1, p2, ..., p11
```

Compute deltas to the next row element in ascending absolute traversal:

```text
delta_i = p(i+1) - p(i)
if delta_i <= 0, add 12 until positive
```

Then add the closing delta from `p11` to the next occurrence of `p0` above the
current absolute pitch.

This produces an upward `pitch_midi` stream while preserving the row's cyclic
pitch-class order.

If the desired serial material is an exact bounded registral row rather than an
upward pitch-class traversal, use the bounded value-cycle recipe instead:

```text
positive pitch delta -> add(delta)
negative pitch delta -> subtract(abs(delta))
```

That version must document a start register that keeps every subtract step safe.

## Example: chromatic_prime_row_steps

This is a trivial row used only to document the mechanism.

Pitch-class row:

```text
0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
```

Tree:

```text
chromatic_prime_row_steps
`- D1 -> pitch_midi
        transformations: add(1), add(1), add(1), add(1), add(1), add(1),
                         add(1), add(1), add(1), add(1), add(1), add(1)
```

Smoke:

```text
pitch_midi start_point = 60
shift = 0
N = 13
expected output = 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72
```

This is operationally the same as `chromatic_steps_v2`, so it should not be
deployed separately. It exists here as a recipe.

## Row Forms

Prime row:

```text
deploy the exact interval grammar of the selected prime row
```

Rotation:

```text
use transformation_shift
```

Transposition:

```text
use pitch_midi start_point
```

Retrograde:

```text
deploy a separate exact interval grammar derived from the reversed pitch-class
order, unless/until a reverse operation exists
```

Inversion:

```text
deploy a separate exact interval grammar derived from the inverted pitch-class
order, unless/until a reflect/modular operation exists
```

Retrograde inversion:

```text
deploy a separate exact interval grammar derived from the reversed inverted
pitch-class order
```

These separate row-form connectors are not conceptual failures. They are exact
materializations of finite row forms with the current operation set.

## Required Metadata

Every deployed serial row material must document:

```text
source row pitch classes
interval grammar
P/I/R/RI relation if relevant
row-form derivation policy
hexachordal combinatoriality if known
expected smoke output
first product-table reuse
```
