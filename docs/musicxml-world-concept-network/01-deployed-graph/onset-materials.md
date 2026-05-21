# Deployed Onset Materials

These are world-agnostic onset stream concepts. They are not complete notes by themselves.

Format hash:

```text
9c500f199ebf4695cb4e4bc28643aed1f5912fc393d0b6ce22dd2c8de52727e8
```

Owner:

```text
b530bf08d76015080c67d6b5f00cdee53b45bdda
```

## `quarter_tick_grid_v1`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: quarter-note onset grid
World ownership: world-agnostic
Terminal scalar(s): onset_tick
Dependencies: math_add_v1, onset_tick
```

Connector tree:

```text
quarter_tick_grid_v1
`- D1 -> onset_tick
        transformations: math_add_v1(2520)
```

Static RI:

```text
position 1 -> onset_tick terminal identity locked to 0
```

Smoke:

```text
0, 2520, 5040, 7560
```

Reuse:

```text
chromatic_ascending_quarters_v3
diatonic_mode_quarters_v3
octatonic_mode_quarters_v3
```

## `eighth_tick_grid_v1`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: eighth-note onset grid
World ownership: world-agnostic
Terminal scalar(s): onset_tick
Dependencies: math_add_v1, onset_tick
```

Connector tree:

```text
eighth_tick_grid_v1
`- D1 -> onset_tick
        transformations: math_add_v1(1260)
```

Smoke:

```text
0, 1260, 2520, 3780
```

Reuse:

```text
anhemitonic_pentatonic_eighths_v3
```

## `half_tick_grid_v1`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: half-note onset grid
World ownership: world-agnostic
Terminal scalar(s): onset_tick
Dependencies: math_add_v1, onset_tick
```

Connector tree:

```text
half_tick_grid_v1
`- D1 -> onset_tick
        transformations: math_add_v1(5040)
```

Smoke:

```text
0, 5040, 10080, 15120
```

Reuse:

```text
whole_tone_halves_v3
```
