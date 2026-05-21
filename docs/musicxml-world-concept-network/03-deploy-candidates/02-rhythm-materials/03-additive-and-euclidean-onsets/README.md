# Additive And Euclidean Onset Candidates

Status: mixed

Precision: P2/P3.

These are single-terminal `onset_tick` materials. They encode onset distances, not duration values.

Common shape:

```text
name
`- D1 -> onset_tick
        transformations: add(d1), add(d2), ..., add(dn)
```

Common format hash:

```text
9c500f199ebf4695cb4e4bc28643aed1f5912fc393d0b6ce22dd2c8de52727e8
```

## Additive Candidates

```text
additive_3_3_2_unit1260
`- D1 -> onset_tick
        transformations: add(3780), add(3780), add(2520)

additive_2_3_3_unit1260
`- D1 -> onset_tick
        transformations: add(2520), add(3780), add(3780)

additive_2_2_3_2_2_3_unit630
`- D1 -> onset_tick
        transformations: add(1260), add(1260), add(1890), add(1260), add(1260), add(1890)

additive_5_5_4_unit630
`- D1 -> onset_tick
        transformations: add(3150), add(3150), add(2520)
```

## Euclidean Onset-Distance Candidates

```text
euclidean_2_3_unit1260
`- D1 -> onset_tick
        transformations: add(2520), add(1260)

euclidean_2_5_unit1260
`- D1 -> onset_tick
        transformations: add(3780), add(2520)

euclidean_3_8_unit1260
`- D1 -> onset_tick
        transformations: add(3780), add(3780), add(2520)

euclidean_5_8_unit1260
`- D1 -> onset_tick
        transformations: add(2520), add(2520), add(1260), add(2520), add(1260)

euclidean_5_12_unit840
`- D1 -> onset_tick
        transformations: add(2520), add(1680), add(1680), add(2520), add(1680)

euclidean_7_12_unit840
`- D1 -> onset_tick
        transformations: add(1680), add(1680), add(840), add(1680), add(1680), add(840), add(1680)
```

## Deduplication Note

Some additive and Euclidean labels produce the same transformation grammar.

Example:

```text
additive_3_3_2_unit1260
euclidean_3_8_unit1260
```

These should not both be deployed as separate connectors unless the wrapper/metadata value is intentional.
