# Rhythm Material Candidates

Rhythm material connectors expose either:

```text
onset_tick
duration_tick
```

They are not complete MusicXML-compatible note tables until a product connector combines them with `pitch_midi`.

## Families

```text
01-onset-grids/
  Fixed onset-distance grids.

02-duration-grids/
  Fixed duration value streams.

03-additive-and-euclidean-onsets/
  Cyclic onset-distance grammars for additive and Euclidean patterns.

04-duration-cycles/
  Cyclic duration value streams encoded as exact add/subtract deltas.
```

Reminder:

```text
onset transformations are distances between attacks.
duration transformations are deltas between duration values.
```
