# Ordered Interval Grammar Candidates

Status: deploy-candidate

Precision: P3 deploy candidate for listed grammars, except where noted.

These are single-terminal `pitch_midi` material connectors.

Common shape:

```text
name
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(in)
```

Common metadata:

```text
World ownership: world-agnostic
Terminal scalar(s): pitch_midi
Format hash: f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797
Dependencies: pitch_midi, add transformation
Open RI:
  material root start_point -> traversal offset
  pitch_midi start_point -> absolute MIDI base/register
  pitch_midi transformation_shift -> phase/mode of the cyclic grammar
Static RI: none by default
```

Smoke convention:

```text
pitch_midi start_point = 60
material root start_point = 0
transformation_shift = 0
N = grammar length + 1
```

## Heptatonic Families

### harmonic_minor_heptatonic_steps

Tree:

```text
harmonic_minor_heptatonic_steps
`- D1 -> pitch_midi
        transformations: add(2), add(1), add(2), add(2), add(1), add(3), add(1)
```

Expected pitch prefix:

```text
60, 62, 63, 65, 67, 68, 71, 72
```

### melodic_minor_heptatonic_steps

Tree:

```text
melodic_minor_heptatonic_steps
`- D1 -> pitch_midi
        transformations: add(2), add(1), add(2), add(2), add(2), add(2), add(1)
```

Expected pitch prefix:

```text
60, 62, 63, 65, 67, 69, 71, 72
```

### harmonic_major_heptatonic_steps

Tree:

```text
harmonic_major_heptatonic_steps
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(1), add(3), add(1)
```

Expected pitch prefix:

```text
60, 62, 64, 65, 67, 68, 71, 72
```

### acoustic_heptatonic_steps

Tree:

```text
acoustic_heptatonic_steps
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(2), add(1), add(2), add(1), add(2)
```

Expected pitch prefix:

```text
60, 62, 64, 66, 67, 69, 70, 72
```

### double_harmonic_heptatonic_steps

Tree:

```text
double_harmonic_heptatonic_steps
`- D1 -> pitch_midi
        transformations: add(1), add(3), add(1), add(2), add(1), add(3), add(1)
```

Expected pitch prefix:

```text
60, 61, 64, 65, 67, 68, 71, 72
```

### hungarian_minor_heptatonic_steps

Tree:

```text
hungarian_minor_heptatonic_steps
`- D1 -> pitch_midi
        transformations: add(2), add(1), add(3), add(1), add(1), add(3), add(1)
```

Expected pitch prefix:

```text
60, 62, 63, 66, 67, 68, 71, 72
```

## Limited-Transposition And Symmetric Families

### messiaen_mode_3_steps

Tree:

```text
messiaen_mode_3_steps
`- D1 -> pitch_midi
        transformations: add(2), add(1), add(1), add(2), add(1), add(1), add(2), add(1), add(1)
```

Expected pitch prefix:

```text
60, 62, 63, 64, 66, 67, 68, 70, 71, 72
```

### messiaen_mode_4_steps

Tree:

```text
messiaen_mode_4_steps
`- D1 -> pitch_midi
        transformations: add(1), add(1), add(3), add(1), add(1), add(1), add(3), add(1)
```

Expected pitch prefix:

```text
60, 61, 62, 65, 66, 67, 68, 71, 72
```

### messiaen_mode_5_steps

Tree:

```text
messiaen_mode_5_steps
`- D1 -> pitch_midi
        transformations: add(1), add(4), add(1), add(1), add(4), add(1)
```

Expected pitch prefix:

```text
60, 61, 65, 66, 67, 71, 72
```

### messiaen_mode_6_steps

Tree:

```text
messiaen_mode_6_steps
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(1), add(2), add(2), add(1), add(1)
```

Expected pitch prefix:

```text
60, 62, 64, 65, 66, 68, 70, 71, 72
```

### messiaen_mode_7_steps

Tree:

```text
messiaen_mode_7_steps
`- D1 -> pitch_midi
        transformations: add(1), add(1), add(1), add(2), add(1), add(1), add(1), add(1), add(2), add(1)
```

Expected pitch prefix:

```text
60, 61, 62, 63, 65, 66, 67, 68, 69, 71, 72
```

### augmented_hexatonic_steps

Tree:

```text
augmented_hexatonic_steps
`- D1 -> pitch_midi
        transformations: add(3), add(1), add(3), add(1), add(3), add(1)
```

Expected pitch prefix:

```text
60, 63, 64, 67, 68, 71, 72
```

## Pentatonic / Blues Family

### blues_hexatonic_steps

Tree:

```text
blues_hexatonic_steps
`- D1 -> pitch_midi
        transformations: add(3), add(2), add(1), add(1), add(3), add(2)
```

Expected pitch prefix:

```text
60, 63, 65, 66, 67, 70, 72
```

## Deployment Notes

Do not deploy separate connectors for modes of these families unless a wrapper with static RI is intentionally useful.

For each deployed grammar, document:

```text
rotation/mode map
known aliases
expected format hash
smoke output
first product-table reuse
```
