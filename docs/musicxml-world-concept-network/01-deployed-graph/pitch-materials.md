# Deployed Pitch Materials

These are world-agnostic pitch stream concepts. They expose `pitch_midi` and are not complete note events by themselves.

Use the v2 pitch materials. The v1 pitch materials are superseded.

Format hash:

```text
f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797
```

Owner:

```text
b530bf08d76015080c67d6b5f00cdee53b45bdda
```

## Shared RI Semantics

For standalone v2 pitch materials:

```text
position 0 start_point              -> scale-degree offset
position 1 start_point              -> pitch_midi base / register
position 1 transformation_shift     -> circular phase
```

For v3 note tables, these project to:

```text
position 7 start_point              -> scale-degree offset
position 8 start_point              -> pitch_midi base / register
position 8 transformation_shift     -> circular phase
```

## `chromatic_steps_v2`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: chromatic semitone pitch stream
World ownership: world-agnostic
Terminal scalar(s): pitch_midi
Dependencies: math_add_v1, pitch_midi
```

Tree:

```text
chromatic_steps_v2
`- D1 -> pitch_midi
        transformations: math_add_v1(1)
```

Smoke with phase `0` and base `60`:

```text
60, 61, 62, 63, 64, 65, 66, 67
```

## `diatonic_heptatonic_steps_v2`

```text
Status: deployed-curated
Complexity: C2 cyclic grammar
Musical role: seven-step diatonic interval cycle
World ownership: world-agnostic
Terminal scalar(s): pitch_midi
Dependencies: math_add_v1, pitch_midi
```

Tree:

```text
diatonic_heptatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

Equivalent concepts represented by RI shift:

```text
shift 0 -> Ionian / major phase
shift 1 -> Dorian phase
shift 2 -> Phrygian phase
shift 3 -> Lydian phase
shift 4 -> Mixolydian phase
shift 5 -> Aeolian / natural minor phase
shift 6 -> Locrian phase
```

Smoke with phase `0` and base `60`:

```text
60, 62, 64, 65, 67, 69, 71, 72
```

Reuse:

```text
diatonic_mode_quarters_v3
```

## `anhemitonic_pentatonic_steps_v2`

```text
Status: deployed-curated
Complexity: C2 cyclic grammar
Musical role: five-step anhemitonic pentatonic interval cycle
World ownership: world-agnostic
Terminal scalar(s): pitch_midi
Dependencies: math_add_v1, pitch_midi
```

Tree:

```text
anhemitonic_pentatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(3), add(2), add(3)
```

Equivalent concepts represented by RI shift:

```text
shift 0 -> major pentatonic phase
shift 4 -> minor pentatonic phase
```

Smoke with phase `0` and base `60`:

```text
60, 62, 64, 67, 69, 72, 74, 76
```

Reuse:

```text
anhemitonic_pentatonic_eighths_v3
```

## `whole_tone_steps_v2`

```text
Status: deployed-curated
Complexity: C1 single repeated operation
Musical role: whole-tone pitch stream
World ownership: world-agnostic
Terminal scalar(s): pitch_midi
Dependencies: math_add_v1, pitch_midi
```

Tree:

```text
whole_tone_steps_v2
`- D1 -> pitch_midi
        transformations: math_add_v1(2)
```

Smoke with phase `0` and base `60`:

```text
60, 62, 64, 66, 68, 70, 72, 74
```

Reuse:

```text
whole_tone_halves_v3
```

## `octatonic_steps_v2`

```text
Status: deployed-curated
Complexity: C2 cyclic grammar
Musical role: alternating one/two semitone octatonic interval cycle
World ownership: world-agnostic
Terminal scalar(s): pitch_midi
Dependencies: math_add_v1, pitch_midi
```

Tree:

```text
octatonic_steps_v2
`- D1 -> pitch_midi
        transformations: add(1), add(2)
```

Equivalent concepts represented by RI shift:

```text
shift 0 -> half-whole phase
shift 1 -> whole-half phase
```

Smoke with phase `0` and base `60`:

```text
60, 61, 63, 64, 66, 67, 69, 70
```

Shift smoke:

```text
shift 1, base 60 -> 60, 62, 63, 65, 66, 68, 69, 71
```

Reuse:

```text
octatonic_mode_quarters_v3
```
