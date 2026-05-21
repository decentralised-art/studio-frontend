# Named Collections And Sonorities

Status: mixed

Precision: P3 for exact representative materials below; P1/P2 for broader
historical/theoretical metadata.

Named collections and sonorities become deployable only after the name is reduced
to an exact runtime object:

```text
ordered pitch material
simultaneous chord product
metadata wrapper over RI/static values
```

A historical name alone is not a connector tree.

## Operational Policies

### Collection Policy

Use this when the concept is a pitch-class collection or scale-like resource.

```text
collection_name_steps
`- D1 -> pitch_midi
        transformations: add(i1), add(i2), ..., add(in)
```

The interval list is the sorted ascending pitch-class traversal unless another
order is explicitly part of the concept.

### Voicing/Arpeggiation Policy

Use this when an exact ordered/register-specific sonority is intended.

```text
voicing_name_arpeggio
`- D1 -> pitch_midi
        transformations: add/subtract exact pitch deltas
```

The emitted stream is melodic/arpeggiated unless a product table gives all rows
the same onset.

### Simultaneous Chord Product Policy

Use this when simultaneity matters in MusicXML/MIDI output.

```text
same_onset_tick
`- D1 -> onset_tick
        transformations: add(0)

sonority_product
|- D1 -> same_onset_tick
|       transformations: add(1)
|- D2 -> duration material
|       transformations: add(1)
`- D3 -> pitch collection or voicing material
        transformations: add(1)
```

Run with `N` equal to the number of chord tones.

## same_onset_tick

This support material is required by simultaneous sonority products.

Tree:

```text
same_onset_tick
`- D1 -> onset_tick
        transformations: add(0)
```

Smoke:

```text
onset_tick start_point = 0
N = 6
expected output = 0, 0, 0, 0, 0, 0
```

## Prometheus Collection

Reading:

```text
sorted pitch-class collection, C form: C D E F# A Bb
pitch classes: [0, 2, 4, 6, 9, 10]
interval grammar: [2, 2, 2, 3, 1, 2]
```

Tree:

```text
prometheus_collection_steps
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(2), add(3), add(1), add(2)
```

Smoke:

```text
pitch_midi start_point = 60
shift = 0
N = 7
expected output = 60, 62, 64, 66, 69, 70, 72
```

Notes:

```text
Scriabin-specific voicing, spelling, and harmonic function are metadata or a
separate voicing/chord-product node.
```

## Petrushka Collection

Reading:

```text
two major triads a tritone apart, C and F# form:
C E G + F# A# C#
sorted pitch classes: [0, 1, 4, 6, 7, 10]
interval grammar: [1, 3, 2, 1, 3, 2]
```

Tree:

```text
petrushka_collection_steps
`- D1 -> pitch_midi
        transformations: add(1), add(3), add(2), add(1), add(3), add(2)
```

Smoke:

```text
pitch_midi start_point = 60
shift = 0
N = 7
expected output = 60, 61, 64, 66, 67, 70, 72
```

## Tristan Sonority

The Tristan name has historical spelling and voicing implications. Therefore the
corpus should keep at least two deployable variants.

### tristan_sonority_set_steps

Reading:

```text
ordered representative of pitch-class set [3, 5, 8, 11]
interval grammar from first element: [2, 3, 3, 4]
```

Tree:

```text
tristan_sonority_set_steps
`- D1 -> pitch_midi
        transformations: add(2), add(3), add(3), add(4)
```

Smoke:

```text
pitch_midi start_point = 63
shift = 0
N = 5
expected output = 63, 65, 68, 71, 75
```

### tristan_wagner_f_b_ds_gs_arpeggio

Reading:

```text
register-specific arpeggiated spelling approximation:
F4, B4, D#5, G#5, F6
MIDI: 65, 71, 75, 80, 89
delta grammar: [6, 4, 5, 9]
```

Tree:

```text
tristan_wagner_f_b_ds_gs_arpeggio
`- D1 -> pitch_midi
        transformations: add(6), add(4), add(5), add(9)
```

Smoke:

```text
pitch_midi start_point = 65
shift = 0
N = 5
expected output = 65, 71, 75, 80, 89
```

Spelling remains metadata until `accidental_code` is part of the active world
contract.

## Quartal Stack

Reading:

```text
repeated perfect-fourth stack
```

Tree:

```text
quartal_stack_fourths
`- D1 -> pitch_midi
        transformations: add(5)
```

This is operationally the same step grammar as `add5_circle_of_fourths_steps`.
Prefer reusing that connector when deployed; keep `quartal_stack_fourths` as a
metadata alias or wrapper only if the UX needs the chord-stack name.

## Chromatic Cluster

Reading:

```text
consecutive semitone collection
```

Tree:

```text
cluster_chromatic_steps
`- D1 -> pitch_midi
        transformations: add(1)
```

This is operationally `chromatic_steps_v2`. A cluster product should use:

```text
same_onset_tick
constant duration
chromatic_steps_v2
N = cluster cardinality
```

## All-Interval Tetrachord Representatives

Set-class labels are metadata. Exact representatives are deployable.

Required node shape:

```text
all_interval_tetrachord_<id>_representative_<letter>
`- D1 -> pitch_midi
        transformations: add(a), add(b), add(c), add(d)
```

Before adding a P3 candidate, document:

```text
prime form
chosen ordered representative
interval vector
whether simultaneity matters
smoke output
```

Do not deploy a generic "all interval tetrachord" connector without choosing a
representative.

## Forte Set-Class Representatives

Generic set-class theory is a metadata layer. Individual representative streams
are deployable.

Pattern:

```text
forte_<cardinality>_<number>_representative_<letter>
`- D1 -> pitch_midi
        transformations: add(...)
```

Optional product:

```text
forte_<cardinality>_<number>_chord_<letter>
|- D1 -> same_onset_tick
|- D2 -> duration material
`- D3 -> forte_<cardinality>_<number>_representative_<letter>
```

Deployment requires exact representative policy. It does not require a
`pitch_class` scalar.
