# Texture And Form Space

This document expands the corpus beyond single-stream materials.

Texture and form are where connector interconnection becomes musically meaningful. The goal is to document how multiple material connectors can become voices, layers, canons, sections, and world-like processes.

## Texture Is Product Structure

A note table is already a texture decision:

```text
onset material + duration material + pitch material
```

Adding more dimensions creates richer texture:

```text
onset + duration + pitch + velocity + note_kind + voice + staff + part
```

## Single-Voice Product

Canonical shape:

```text
single_voice_table
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

This is the smallest MusicXML/MIDI-compatible texture.

## Accent-Texture Product

```text
accented_single_voice_table
|- D1 -> onset material
|- D2 -> duration material
|- D3 -> pitch material
`- D4 -> velocity material
```

This should become a standard product pattern.

## Rest-Mask Product

```text
masked_single_voice_table
|- D1 -> onset grid
|- D2 -> duration material
|- D3 -> pitch material
`- D4 -> note_kind mask
```

This pattern is necessary for Euclidean rhythms represented as hit/rest masks instead of hit-only onset-distance streams.

## Isorhythmic Product

```text
isorhythmic_table
|- D1 -> talea onset material
|- D2 -> talea duration material
`- D3 -> color pitch material
```

If the child cycles have different periods, their alignment changes as N increases.

This is one of the best models for Hypermusic composition because it makes independent connectors audible as a relation.

## Drone And Pedal Textures

```text
drone_table
|- D1 -> long_onset_or_grid
|- D2 -> long_duration
`- D3 -> fixed_pitch_or_small_cycle
```

Potential materials:

```text
single_pitch_constant
perfect_fifth_drone
octave_drone
pedal_point_with_moving_upper_voice
```

Multi-layer drone plus melody probably needs either:

```text
two product tables under a root
or part/voice scalar streams in one product table
```

## Canon And Delay Textures

Conceptual pattern:

```text
voice A: original product table
voice B: same pitch/duration material with onset offset
```

Potential connector shape:

```text
canon_second_voice_onsets
`- D1 -> original_onset_material
        transformations: add(delay_ticks)
```

Caveat:

Whether a parent transformation over a child onset material produces the intended constant delay must be checked against actual PT execution semantics before deployment.

Canon variants:

```text
strict canon
canon at interval
canon by inversion
canon by augmentation
canon by diminution
phase canon
mensuration canon
```

Most of these need exact product/tree specs before deployment.

## Hocket

Hocket is a distribution of one line across voices.

Possible representation:

```text
hocket_table
|- D1 -> shared onset material
|- D2 -> shared duration material
|- D3 -> pitch material
`- D4 -> voice_cycle_1_2
```

This requires reliable `voice` interpretation.

## Polyrhythm And Polymeter

Polyrhythm:

```text
same total period, different attack subdivisions
```

Polymeter:

```text
different metric cycles proceed simultaneously
```

Connector strategy:

```text
separate product tables per voice
or one table with voice/part scalar
```

Examples:

```text
three_against_two_table
  voice A onset: quarter_triplet grid
  voice B onset: eighth/quarter grid

five_against_four_table
  voice A onset: quintuplet grid
  voice B onset: sixteenth grid
```

The MusicXML notation may need tuplets or multiple voices to render cleanly.

## Register-Split Texture

Concept:

```text
same pitch material routed to different staff/voice by register
```

Current issue:

This is per-particle logic. It likely needs renderer-side staff assignment or a future particle-aware transformation.

Near-term simpler version:

```text
manual staff cycle
manual voice cycle
```

## Density Textures

Density can be controlled by:

```text
N
note_kind masks
onset period
duration overlap
number of product tables
number of voices
```

Hypermusic-native insight:

```text
N is a density/time lens.
```

For some worlds, increasing N is like revealing more of the process rather than making the connector "longer".

## Form Patterns

Current connectors can represent local materials better than large form. Still, the taxonomy should include form concepts.

```text
loop
ostinato
period
phrase
section
variation
process
accumulation
subtraction
rotation form
palindromic form
arch form
phase form
open form
conditional form
```

Potential future scalar groups:

```text
section_id
section_start_tick
section_duration_tick
section_label_code
```

For now, form may be represented as:

```text
different product connectors
different RI presets
different N values
condition-gated branches
```

## World-Native Form

Hypermusic has form concepts that do not map cleanly to traditional notation.

```text
connector run as an iteration
RI coordinate as performance state
world randomizer as traversal
compatible connector set as repertoire
condition-gated branch as social/event form
onchain deployment history as evolving corpus
```

These should be part of the taxonomy because they are musically real in this system.

## Texture/Form Precision Checklist

Before a texture or form concept becomes P3:

```text
1. Is it one product table or multiple product tables?
2. Does it require part/staff/voice scalars?
3. Does it need event_id grouping?
4. Does it need renderer interpretation beyond current worlds?
5. Are child materials independent and reusable?
6. Does any relation depend on exact PT parent-child semantics that must be smoke-tested?
7. Can the same texture work in both MusicXML and MIDI worlds?
8. Is the concept traditional, Hypermusic-native, or both?
```
