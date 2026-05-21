# Deployed Duration Materials

These are world-agnostic constant duration stream concepts. They are not complete notes by themselves.

Use the v2 duration materials. The v1 duration materials are superseded.

Format hash:

```text
a7841810e18e653f4a7a2560606d3aa7ff406515899f0e2c10bdb93b175c1783
```

Owner:

```text
b530bf08d76015080c67d6b5f00cdee53b45bdda
```

## Shared Tree Pattern

```text
*_duration_tick_v2
`- D1 -> duration_tick
        transformations: math_add_v1(0)
```

Static RI:

```text
position 1 -> terminal duration_tick start value
```

Live deployment showed that the fixed duration must be locked on the terminal `duration_tick` occurrence, not on the material root.

## `quarter_duration_tick_v2`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: constant quarter-note duration
World ownership: world-agnostic
Terminal scalar(s): duration_tick
Dependencies: math_add_v1, duration_tick
Static RI: position 1 = 2520
```

Smoke:

```text
2520, 2520, 2520, 2520
```

Reuse:

```text
chromatic_ascending_quarters_v3
diatonic_mode_quarters_v3
octatonic_mode_quarters_v3
```

## `eighth_duration_tick_v2`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: constant eighth-note duration
World ownership: world-agnostic
Terminal scalar(s): duration_tick
Dependencies: math_add_v1, duration_tick
Static RI: position 1 = 1260
```

Smoke:

```text
1260, 1260, 1260, 1260
```

Reuse:

```text
anhemitonic_pentatonic_eighths_v3
```

## `half_duration_tick_v2`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: constant half-note duration
World ownership: world-agnostic
Terminal scalar(s): duration_tick
Dependencies: math_add_v1, duration_tick
Static RI: position 1 = 5040
```

Smoke:

```text
5040, 5040, 5040, 5040
```

Reuse:

```text
whole_tone_halves_v3
```
