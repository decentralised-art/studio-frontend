# Metric Cycle Systems

Date: 2026-05-20

This document expands rhythm beyond simple grids and onset-distance patterns.

The key insight:

```text
meter is not only onset spacing.
meter is also cyclic position, accent, grouping, and sometimes performance grammar.
```

## Tala-Like Metric Cycles

Tala is a strong conceptual match for DCN because it is cyclic.

Possible connector layers:

```text
tala_onset_material
`- D1 -> onset_tick
        transformations: add(d1), add(d2), ..., add(dn)

tala_accent_material
`- D1 -> accent_level
        transformations: delta or lookup cycle

tala_position_material
`- D1 -> cycle_position
        transformations: add(1) or lookup/table
```

Near-term:

```text
onset-distance skeletons can be represented now.
```

Richer metric representation needs:

```text
accent_level scalar
cycle_position scalar
lookup/table transformation for compact value maps, or explicit delta cycles
world rendering of metric cycles
```

## Aksak / Additive Meter

Additive meters can already be represented as onset-distance grammars:

```text
aksak_2_2_3_unit630
`- D1 -> onset_tick
        transformations: add(1260), add(1260), add(1890)
```

But a full meter representation also needs:

```text
bar length
accent pattern
subdivision grouping
beam grouping
cycle position
```

## Clave / Timeline Patterns

Timeline patterns such as clave-like structures can be represented two ways:

```text
1. hit-only onset-distance stream
2. full pulse grid plus note_kind/rest mask
```

The first is deployable now.

The second needs:

```text
note_kind scalar map
lookup/table or periodic mask
```

## Hypermeter

Hypermeter extends metrical grouping above the measure level.

Connector idea:

```text
hypermetric_accent_cycle
`- D1 -> accent_level
        transformations: ...
```

Richer representation needs:

```text
accent_level / dynamic_code map
section or measure-position scalar
```

## Tuplet Rendering

Integer ticks can already represent many tuplets.

But notated tuplets require more than tick values.

Future scalar candidates:

```text
tuplet_id
tuplet_actual
tuplet_normal
tuplet_start_stop
beam_group
```

These are world-contract issues, not onset material issues.

## References

```text
Britannica, Tala:
https://www.britannica.com/art/tala

MusicXML 4.0, tuplet element:
https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/tuplet/

Open Music Theory, Hypermeter:
https://viva.pressbooks.pub/openmusictheory/chapter/hypermeter/
```
