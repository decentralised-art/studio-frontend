# Onset Grid Candidates

Status: deploy-candidate

Precision: P3 deploy candidate

These are single-terminal `onset_tick` material connectors.

Common shape:

```text
name
`- D1 -> onset_tick
        transformations: add(distance_ticks)
```

Common format hash:

```text
9c500f199ebf4695cb4e4bc28643aed1f5912fc393d0b6ce22dd2c8de52727e8
```

## Deployed Reference

```text
half_tick_grid_v1
`- D1 -> onset_tick
        transformations: add(5040)

quarter_tick_grid_v1
`- D1 -> onset_tick
        transformations: add(2520)

eighth_tick_grid_v1
`- D1 -> onset_tick
        transformations: add(1260)
```

## Candidates

```text
same_onset_tick
`- D1 -> onset_tick
        transformations: add(0)

whole_tick_grid
`- D1 -> onset_tick
        transformations: add(10080)

sixteenth_tick_grid
`- D1 -> onset_tick
        transformations: add(630)

quarter_triplet_tick_grid
`- D1 -> onset_tick
        transformations: add(840)

eighth_triplet_tick_grid
`- D1 -> onset_tick
        transformations: add(420)

quintuplet_quarter_grid
`- D1 -> onset_tick
        transformations: add(504)

septuplet_quarter_grid
`- D1 -> onset_tick
        transformations: add(360)
```

Smoke convention:

```text
start_point: 0
N: 8
expected output: repeated cumulative distance from the transformation.
```

`same_onset_tick` is a special support material for simultaneous chord products.
With `start_point = 0`, its expected output is `0, 0, 0, ...`.
