# Duration Cycle Candidates

Status: deploy-candidate

Precision: P3 deploy candidate

These are single-terminal `duration_tick` material connectors.

Unlike onset materials, duration cycles are not distances between attacks. They
are value streams. Therefore the transformation list must encode deltas between
the desired duration values.

Common shape:

```text
name
`- D1 -> duration_tick
        transformations: add/subtract deltas
```

Common dependency set:

```text
duration_tick
math_add_v1
math_subtract_v1 where negative deltas are needed
```

Common RI:

```text
duration_tick start_point = first desired duration value
duration_tick transformation_shift = phase of the duration cycle
N = number of duration values to emit
```

## Delta Encoding Rule

Given desired values:

```text
v0, v1, ..., v(n-1)
```

Write transformations:

```text
v0 -> v1
v1 -> v2
...
v(n-1) -> v0
```

Using:

```text
positive delta -> add(delta)
zero delta     -> add(0)
negative delta -> subtract(abs(delta))
```

Do not write `add(-n)`.

## duration_cycle_eighth_quarter

Desired values:

```text
1260, 2520
```

Tree:

```text
duration_cycle_eighth_quarter
`- D1 -> duration_tick
        transformations: add(1260), subtract(1260)
```

Smoke:

```text
duration_tick start_point = 1260
shift = 0
N = 6
expected output = 1260, 2520, 1260, 2520, 1260, 2520
```

## duration_cycle_eighth_quarter_eighth_half

Desired values:

```text
1260, 2520, 1260, 5040
```

Tree:

```text
duration_cycle_eighth_quarter_eighth_half
`- D1 -> duration_tick
        transformations: add(1260), subtract(1260), add(3780), subtract(3780)
```

Smoke:

```text
duration_tick start_point = 1260
shift = 0
N = 8
expected output = 1260, 2520, 1260, 5040, 1260, 2520, 1260, 5040
```

## duration_cycle_triplet_triplet_duplet

Desired values:

```text
840, 840, 1680
```

Tree:

```text
duration_cycle_triplet_triplet_duplet
`- D1 -> duration_tick
        transformations: add(0), add(840), subtract(840)
```

Smoke:

```text
duration_tick start_point = 840
shift = 0
N = 6
expected output = 840, 840, 1680, 840, 840, 1680
```

## duration_cycle_dotted_eighth_sixteenth

Desired values:

```text
1890, 630
```

Tree:

```text
duration_cycle_dotted_eighth_sixteenth
`- D1 -> duration_tick
        transformations: subtract(1260), add(1260)
```

Smoke:

```text
duration_tick start_point = 1890
shift = 0
N = 6
expected output = 1890, 630, 1890, 630, 1890, 630
```

## Product Use

Duration cycles become MusicXML/MIDI-compatible only inside a product table:

```text
syncopated_chromatic_duration_cycle
|- D1 -> eighth_tick_grid_v1
|       transformations: add(1)
|- D2 -> duration_cycle_eighth_quarter
|       transformations: add(1)
`- D3 -> chromatic_steps_v2
        transformations: add(1)
```

Smoke:

```text
N = 6
onsets    = 0, 1260, 2520, 3780, 5040, 6300
durations = 1260, 2520, 1260, 2520, 1260, 2520
pitches   = 60, 61, 62, 63, 64, 65
```

## Safety Notes

Every subtract step must be safe for the documented cycle. If a future open RI
start value is allowed to move outside the documented value cycle, subtract
steps can underflow. For curated use, duration-cycle materials should either:

```text
use static/default start_point equal to the first documented value
or document random bounds that keep every subtract step safe
```
