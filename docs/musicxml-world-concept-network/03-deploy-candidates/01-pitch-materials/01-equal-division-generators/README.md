# Pitch Equal-Division Generator Candidates

Status: deploy-candidate

Precision: P3 deploy candidate

These candidates extend the already deployed equal-division pitch materials:

```text
chromatic_steps_v2 -> add(1)
whole_tone_steps_v2 -> add(2)
```

They are single-scalar pitch materials. They are not complete MusicXML-compatible note tables until combined with onset and duration materials.

Important:

```text
These are circular generator families, not separate interval objects.
The interval label describes the repeated transformation argument.
```

## Common Shape

```text
candidate_name
`- D1 -> pitch_midi
        transformations: add(n)
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
  pitch_midi transformation_shift -> no audible effect while grammar length is 1
Static RI: none unless deployed as a pedagogical wrapper
Compatible worlds: any world accepting pitch_midi as a terminal scalar
```

Smoke convention:

```text
pitch_midi start_point = 60
material root start_point = 0
transformation_shift = 0
N = 8
```

## add3_minor_third_cycle

```text
Name: add3_minor_third_cycle
Complexity: C1 one-dimensional stream with one repeated operation
Musical role: repeated minor-third traversal; diminished-seventh pitch-class cycle
```

Tree:

```text
add3_minor_third_cycle
`- D1 -> pitch_midi
        transformations: add(3)
```

Expected smoke output:

```text
60, 63, 66, 69, 72, 75, 78, 81
```

Relations:

```text
inverse-equivalent modulo 12: add9_minor_third_inverse_cycle
named pitch-class relation: diminished seventh
```

Notes:

```text
With current pitch_midi this is an upward absolute traversal. The pitch-class
cycle relation is conceptual until a modulo pitch-class scalar/operation exists.
```

## add4_major_third_cycle

```text
Name: add4_major_third_cycle
Complexity: C1
Musical role: repeated major-third traversal; augmented-triad pitch-class cycle
```

Tree:

```text
add4_major_third_cycle
`- D1 -> pitch_midi
        transformations: add(4)
```

Expected smoke output:

```text
60, 64, 68, 72, 76, 80, 84, 88
```

Relations:

```text
inverse-equivalent modulo 12: add8_major_third_inverse_cycle
named pitch-class relation: augmented triad
```

## add5_circle_of_fourths_steps

```text
Name: add5_circle_of_fourths_steps
Complexity: C1
Musical role: repeated fourth traversal through all 12 pitch classes modulo octave
```

Tree:

```text
add5_circle_of_fourths_steps
`- D1 -> pitch_midi
        transformations: add(5)
```

Expected smoke output:

```text
60, 65, 70, 75, 80, 85, 90, 95
```

Relations:

```text
inverse-equivalent modulo 12: add7_circle_of_fifths_steps
named pitch-class relation: circle of fourths
```

Notes:

```text
This is often musically useful as an ordering system rather than a register-safe melody.
World random limits may hide high values if N/start_point pushes the output beyond range.
```

## add6_tritone_steps

```text
Name: add6_tritone_steps
Complexity: C1
Musical role: repeated tritone traversal; twofold pitch-class cycle
```

Tree:

```text
add6_tritone_steps
`- D1 -> pitch_midi
        transformations: add(6)
```

Expected smoke output:

```text
60, 66, 72, 78, 84, 90, 96, 102
```

Relations:

```text
self-inverse modulo 12
named pitch-class relation: tritone dyad
```

## add7_circle_of_fifths_steps

```text
Name: add7_circle_of_fifths_steps
Complexity: C1
Musical role: repeated fifth traversal through all 12 pitch classes modulo octave
```

Tree:

```text
add7_circle_of_fifths_steps
`- D1 -> pitch_midi
        transformations: add(7)
```

Expected smoke output:

```text
60, 67, 74, 81, 88, 95, 102, 109
```

Relations:

```text
inverse-equivalent modulo 12: add5_circle_of_fourths_steps
named pitch-class relation: circle of fifths
```

## add12_octave_register_steps

```text
Name: add12_octave_register_steps
Complexity: C1
Musical role: octave/register traversal with fixed pitch class
```

Tree:

```text
add12_octave_register_steps
`- D1 -> pitch_midi
        transformations: add(12)
```

Expected smoke output:

```text
60, 72, 84, 96, 108, 120, 132, 144
```

Relations:

```text
named pitch-class relation: register displacement
```

Notes:

```text
This can exceed MusicXML/MIDI useful display ranges quickly. It is still a valid
material, but products should use small N, low start values, or future bounded
operations when available.
```

## Not Proposed As Separate Deployments Yet

```text
add8_major_third_inverse_cycle
add9_minor_third_inverse_cycle
add10_whole_tone_inverse_steps
add11_chromatic_inverse_steps
```

Reason:

```text
With current absolute pitch_midi, these are not just metadata over add(4), add(3),
add(2), and add(1), because they traverse upward by different absolute intervals.
But conceptually, modulo 12, they are inverse pitch-class generators. Keep them
documented as P1/P2 until we decide whether absolute upward traversal is valuable
enough to deploy.
```
