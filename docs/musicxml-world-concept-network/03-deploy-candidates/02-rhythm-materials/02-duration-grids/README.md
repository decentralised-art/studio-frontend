# Duration Grid Candidates

Status: deploy-candidate

Precision: P3 deploy candidate

These are single-terminal `duration_tick` material connectors.

Common shape:

```text
name
`- D1 -> duration_tick
        transformations: add(0)
```

Common format hash:

```text
a7841810e18e653f4a7a2560606d3aa7ff406515899f0e2c10bdb93b175c1783
```

Important:

```text
The intended duration value is the duration_tick start_point.
The transformation stays add(0), because this is a constant value stream.
```

## Deployed Reference

```text
half_duration_tick_v2
  duration_tick start_point: 5040

quarter_duration_tick_v2
  duration_tick start_point: 2520

eighth_duration_tick_v2
  duration_tick start_point: 1260
```

## Candidates

```text
whole_duration_tick
  duration_tick start_point: 10080

sixteenth_duration_tick
  duration_tick start_point: 630

quarter_triplet_duration_tick
  duration_tick start_point: 840

eighth_triplet_duration_tick
  duration_tick start_point: 420

quintuplet_quarter_duration_tick
  duration_tick start_point: 504

septuplet_quarter_duration_tick
  duration_tick start_point: 360
```

Each candidate uses the same tree:

```text
candidate_name
`- D1 -> duration_tick
        transformations: add(0)
```

Smoke convention:

```text
N: 8
expected output: the same duration value repeated eight times.
```
