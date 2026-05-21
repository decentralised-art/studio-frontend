# MusicXML World Musical Vocabulary Plan

Status: historical first-deployment/vocabulary planning document.

For current work, read first:

```text
musicxml-world-concept-network/00-start-here/system-principles.md
musicxml-world-concept-network/00-start-here/documentation-map.md
musicxml-world-format-contract.md
musicxml-world-concept-network/02-corpus/
```

This file remains useful because it records the first deployed vocabulary batch and the reasoning that led to the circular-material approach. New corpus expansion should happen in `musicxml-world-concept-network/02-corpus/`.

This document plans the first curated musical vocabulary for the MusicXML World.

For the current deployed musical concept graph, see `musicxml-world-concept-network/`.

For broader mathematical grouping of musical materials before they become deployed graph nodes, see `musicxml-world-concept-network/02-corpus/`.

It is intentionally not an implementation spec for a new timing model. For now, MusicXML and MIDI worlds should keep the current tick-based timing contract:

```text
onset_tick
duration_tick
pitch_midi
```

The alternative contextual onset/duration model, such as bar-relative or beat-relative time fields, is deferred.

## Current Network Primitive Baseline

On May 17, 2026, the live DCN API was checked against the `dcn-website` tutorial Core Collection manifests.

Before deployment, all versioned Core Collection transformation and condition names returned `404`.

The following tutorial transformations were deployed to the network and verified with `GET /chain/transformation/:name`:

```text
util_identity_v1
math_add_v1
math_subtract_v1
math_multiply_v1
math_divide_v1
math_modulo_v1
math_power_v1
math_min_v1
math_max_v1
math_clamp_v1
math_quantize_step_v1
```

The following tutorial conditions were deployed to the network and verified with `GET /chain/condition/:name`:

```text
logic_always_true_v1
logic_equals_v1
logic_greater_than_v1
logic_less_than_v1
logic_between_inclusive_v1
```

The deployment responses reported owner:

```text
0xb530bf08d76015080c67d6b5f00cdee53b45bdda
```

These are general protocol primitives, not MusicXML-specific objects. They are the numeric vocabulary from which musical connectors can be composed.

## Design Principle

The MusicXML World should not own the ontology of musical connectors.

It should interpret connector output through world-agnostic terminal scalar names. A connector that exposes `pitch_midi` can be rendered by MusicXML, MIDI, visual, synthesis, analysis, or future worlds. The connector is musical, but not owned by one world.

For the curated database, use this division:

```text
transformations  = small reusable numeric operations
conditions       = small reusable logical predicates
terminal scalars = semantic output value types
connectors       = musical spaces, patterns, tables, and compositions
worlds           = interpreters/renderers of compatible connector output
```

Most music-theory concepts should be connectors, not custom transformations. For example, a diatonic scale family does not require a Solidity transformation called `major_scale`. It can be a connector whose dimension uses the cyclic shift pattern:

```text
add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

The RI start value chooses the first emitted value, usually tonic/register. The RI `transformation_shift` chooses the phase of the circular interval pattern, which means it chooses the mode/rotation of the material.

For the sequence above, with start value `60`:

```text
shift 0 -> C Ionian / C major:     60, 62, 64, 65, 67, 69, 71
shift 1 -> C Dorian:               60, 62, 63, 65, 67, 69, 70
shift 2 -> C Phrygian:             60, 61, 63, 65, 67, 68, 70
shift 5 -> C Aeolian / C natural minor
```

This is the same connector material, not four different scale connectors.

## Role Of Transformation Shift

`transformation_shift` is a crucial musical coordinate.

For each connector dimension, PT execution can be understood as:

```text
x = running_instance.start_point
for each output index:
  output x
  x = transformations[(index + transformation_shift) % transformations.length](x)
```

That means:

```text
start_point          -> selects the initial value in the space
transformation_shift -> rotates the circular grammar of the space
particles_count      -> selects how long a traversal to extract
```

Consequences for the MusicXML vocabulary:

1. Do not duplicate circular variants as separate base connectors when they differ only by rotation.
2. Treat modes, phases, and rhythmic rotations as RI coordinates wherever possible.
3. Use separate connector names for different circular grammars, not for every named rotation of the same grammar.
4. Named musical presets can still exist as wrappers with static RI values, but the lower-level material should stay reusable.
5. Connector collection metadata should eventually document phase labels and useful shift ranges, because worlds cannot infer those meanings from terminal scalar names alone.

The octatonic example is the cleanest case:

```text
octatonic_steps_v1 = add(1), add(2)
shift 0 -> half-whole
shift 1 -> whole-half
```

So `octatonic_half_whole_steps_v1` and `octatonic_whole_half_steps_v1` should not be separate base materials. They are two `transformation_shift` variants of the same circular material.

The same applies to pentatonic material:

```text
anhemitonic_pentatonic_steps_v1 = add(2), add(2), add(3), add(2), add(3)
shift 0 -> major pentatonic phase
shift 4 -> minor pentatonic phase
```

And to diatonic material:

```text
diatonic_heptatonic_steps_v1 = add(2), add(2), add(1), add(2), add(2), add(2), add(1)
shift 0 -> Ionian / major phase
shift 5 -> Aeolian / natural minor phase
```

This changes the vocabulary design from a list of scale names to a smaller set of circular materials plus documented phase meanings.

## Transformation Semantics

Choose transformations by the musical relation being modeled.

`add` and `subtract` express absolute offsets. They are the natural fit for:

```text
pitch intervals in semitones
absolute tick grids
fixed transpositions
linear counters
```

Examples:

```text
chromatic_steps_v1           add(1)
quarter_tick_grid_v1         add(2520)
diatonic_heptatonic_steps_v1 add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

`multiply` and `divide` express proportions. They are often more musically meaningful for:

```text
duration augmentation and diminution
tempo ratios
rhythmic density
proportional spacing
register or amplitude-like scaling where a ratio is the concept
```

Examples:

```text
duration_augmentation_v1     multiply(2)
duration_diminution_v1       divide(2)
duration_ratio_cycle_v1      multiply(2), divide(3), multiply(4)
tempo_ratio_cycle_v1         multiply(3), divide(2)
```

The choice is case by case. A quarter-note onset grid is additive because each onset is exactly 2520 ticks after the previous onset. A duration sequence that doubles from eighth to quarter to half is multiplicative because the concept is proportional lengthening.

Avoid modeling proportional musical concepts with arbitrary additive tables just because `add` is familiar. Also avoid using multiplication where an absolute musical unit is the point. The connector's transformation grammar should explain the music, not merely produce the right numbers.

Runtime and UI consequences:

1. World manifests should keep describing renderable scalar value ranges, not musical shift meanings.
2. Random `start_point` can be bounded by world scalar limits, but random `transformation_shift` should come from connector or collection metadata when that exists.
3. If no shift metadata exists, `transformation_shift = 0` is the safest default.
4. Studio and Worlds should eventually display connector-provided phase labels, such as "Dorian" or "whole-half", next to the shift control.
5. Format compatibility still comes from terminal scalars; shift semantics are a higher-level musical vocabulary concern.

## MusicXML Terminal Scalars

The current minimal note-event contract requires:

```text
onset_tick
duration_tick
pitch_midi
```

Optional terminal scalars currently planned or already accepted by the MusicXML World include:

```text
event_id
part
staff
voice
velocity_midi
dynamic_code
note_kind
accidental_code
stem_code
beam_group
meter_time_tick
meter_beats
meter_beat_type
staff_count
part_name_code
instrument_code
clef_time_tick
clef_part
clef_staff
clef_sign_code
clef_line
tempo_time_tick
tempo_bpm
key_time_tick
key_fifths
key_mode_code
key_part
articulation_event_id
articulation_code
articulation_placement
slur_event_id
slur_number
slur_type
slur_placement
spanner_kind
```

These scalar names are not generator names. They describe what the final stream means.

## Vocabulary Levels

The database should be built in layers.

### Level 0: Terminal Scalars

Terminal scalar connectors should be the leaves that define output meaning.

Examples:

```text
onset_tick
duration_tick
pitch_midi
velocity_midi
part
staff
voice
tempo_bpm
meter_beats
meter_beat_type
key_fifths
```

These should stay simple. They do not need to encode complex musical behavior.

### Level 1: Value Streams

Value-stream connectors produce one musical parameter stream.

These are deliberately modular and do not need to be MusicXML-compatible by themselves. A pitch material such as `diatonic_heptatonic_steps_v1` should first exist as a connector that ultimately exposes `pitch_midi`. It should not also bake in `onset_tick` or `duration_tick`.

That means:

```text
diatonic_heptatonic_steps_v1 -> pitch_midi
quarter_tick_grid_v1        -> onset_tick
quarter_duration_tick_v1    -> duration_tick
```

Each of those connectors is reusable on its own. Only a higher-level table that combines the required terminal scalar streams becomes compatible with the MusicXML World.

Examples:

```text
constant_value_v1
counter_v1
quarter_tick_grid_v1
eighth_tick_grid_v1
sixteenth_tick_grid_v1
chromatic_steps_v1
diatonic_heptatonic_steps_v1
harmonic_minor_family_steps_v1
melodic_minor_family_steps_v1
anhemitonic_pentatonic_steps_v1
whole_tone_steps_v1
octatonic_steps_v1
velocity_constant_v1
velocity_accent_cycle_v1
```

These should generally expose one terminal scalar at the bottom of the tree, such as `pitch_midi` or `onset_tick`.

A single-parameter connector's format is still valuable even if it is not directly renderable as a MusicXML score. It becomes score-renderable when another connector uses it as a child alongside complementary timing/duration materials.

### Level 2: Note Tables

Note-table connectors group required note properties under one parent execution path.

The minimal table shape is:

```text
NOTE_TABLE
|- D1 -> onset_tick stream
|- D2 -> duration_tick stream
`- D3 -> pitch_midi stream
```

Example modular construction:

```text
diatonic_mode_quarters_v1
|- D1 -> quarter_tick_grid_v1        -> onset_tick
|- D2 -> quarter_duration_tick_v1    -> duration_tick
`- D3 -> diatonic_heptatonic_steps_v1 -> pitch_midi
```

The parent table is MusicXML-compatible because its full format includes `onset_tick`, `duration_tick`, and `pitch_midi`. The child pitch material remains reusable with any other compatible onset and duration material.

This should be the default pattern for curated musical vocabulary. Deploy reusable scalar-family materials first, then deploy compatible note-table connectors that compose them.

Useful starter note tables:

```text
chromatic_ascending_quarters_v1
diatonic_mode_quarters_v1
anhemitonic_pentatonic_eighths_v1
whole_tone_halves_v1
octatonic_mode_quarters_v1
static_pitch_rhythm_table_v1
```

Optional dimensions can add:

```text
velocity_midi
part
staff
voice
dynamic_code
note_kind
```

### Level 3: Voice And Texture Tables

Voice connectors combine multiple note tables.

Examples:

```text
single_voice_melody_v1
two_voice_counterpoint_v1
melody_with_bass_v1
melody_with_drone_v1
parallel_thirds_v1
parallel_sixths_v1
canon_offset_voice_v1
```

These are still world-agnostic. They produce musical streams, not MusicXML documents.

### Level 4: Score Roots

Score-root connectors combine voices, meter, tempo, key, clef, and optional notation metadata.

Examples:

```text
score_root_single_voice_v1
score_root_piano_grand_staff_v1
score_root_melody_bass_v1
score_root_polyphonic_study_v1
```

The `score_root_*` prefix is acceptable here only because it describes a structural role in a score-like musical object, not ownership by the MusicXML World. For reusable lower-level musical concepts, avoid world-specific names.

## Music-Theory Connector Families

### Pitch

Pitch families should start with interval logic and keep tonic/register controlled by RI values.

Initial pitch materials should be defined as circular families. Named scales and modes are usually `transformation_shift` positions inside those families.

```text
chromatic_steps_v1                 add(1)
whole_tone_steps_v1                add(2)
diatonic_heptatonic_steps_v1       add(2), add(2), add(1), add(2), add(2), add(2), add(1)
harmonic_minor_family_steps_v1     add(2), add(1), add(2), add(2), add(1), add(3), add(1)
melodic_minor_family_steps_v1      add(2), add(1), add(2), add(2), add(2), add(2), add(1)
anhemitonic_pentatonic_steps_v1    add(2), add(2), add(3), add(2), add(3)
octatonic_steps_v1                 add(1), add(2)
augmented_hexatonic_steps_v1       add(3), add(1), add(3), add(1), add(3), add(1)
```

For `diatonic_heptatonic_steps_v1`, the phase table is:

```text
shift 0 -> Ionian / major
shift 1 -> Dorian
shift 2 -> Phrygian
shift 3 -> Lydian
shift 4 -> Mixolydian
shift 5 -> Aeolian / natural minor
shift 6 -> Locrian
```

For `anhemitonic_pentatonic_steps_v1`, useful phases include:

```text
shift 0 -> major pentatonic phase
shift 4 -> minor pentatonic phase
```

For `octatonic_steps_v1`, useful phases are:

```text
shift 0 -> half-whole phase
shift 1 -> whole-half phase
```

This keeps the network smaller and conceptually cleaner. If a user wants a fixed C major or C natural minor connector, that should be a wrapper or saved/static RI configuration of `diatonic_heptatonic_steps_v1`, not a new base interval material.

Later pitch materials:

```text
pitch_class_set_cycle_v1
twelve_tone_row_cycle_v1
inversion_axis_v1
register_fold_v1
voice_leading_nearest_v1
```

Some of these may require careful connector composition or new generic transformations. Do not deploy speculative music-specific transformations before proving that existing numeric primitives cannot express the concept.

### Rhythm And Time

For now, all time is still tick-based. `2520` ticks equals one quarter note.

Initial onset materials:

```text
whole_note_tick_grid_v1       add(10080)
half_note_tick_grid_v1        add(5040)
quarter_tick_grid_v1          add(2520)
eighth_tick_grid_v1           add(1260)
sixteenth_tick_grid_v1        add(630)
thirty_second_tick_grid_v1    add(315)
```

Initial duration materials:

```text
whole_duration_tick_v1        add(0), start 10080
half_duration_tick_v1         add(0), start 5040
quarter_duration_tick_v1      add(0), start 2520
eighth_duration_tick_v1       add(0), start 1260
sixteenth_duration_tick_v1    add(0), start 630
dotted_quarter_duration_v1    add(0), start 3780
dotted_eighth_duration_v1     add(0), start 1890
```

Proportional duration materials should use multiplicative grammar when the musical idea is augmentation or diminution:

```text
duration_augmentation_v1      multiply(2)
duration_diminution_v1        divide(2)
duration_halving_cycle_v1     divide(2), divide(2), multiply(4)
duration_doubling_cycle_v1    multiply(2), multiply(2), divide(4)
```

These are different from fixed duration constants. For example, `quarter_duration_tick_v1` says "always a quarter note"; `duration_augmentation_v1` says "the next value is twice the previous value."

Later rhythm materials:

```text
additive_rhythm_cycle_v1
euclidean_rhythm_onsets_v1
syncopation_offset_grid_v1
rest_pattern_note_kind_v1
```

Rhythm materials should follow the same circular rule as pitch materials. A rotated rhythmic pattern should normally be a `transformation_shift` variant, not a new connector.

For example:

```text
additive_rhythm_cycle_v1 = add(2520), add(1260), add(1260), add(5040)
shift 0 -> long-short-short-long phase as written
shift 1 -> starts from the first short value
shift 2 -> starts from the second short value
shift 3 -> starts from the long value at the end of the written cycle
```

The connector name identifies the circular grammar. The RI shift identifies the rotation selected for a specific run.

### Dynamics And Articulation

Initial dynamics should use `velocity_midi` because both MusicXML and MIDI can interpret it.

Examples:

```text
velocity_pp_v1
velocity_p_v1
velocity_mp_v1
velocity_mf_v1
velocity_f_v1
velocity_ff_v1
velocity_crescendo_v1
velocity_accent_cycle_v1
```

Later notation-specific streams can add:

```text
dynamic_code_cycle_v1
articulation_staccato_v1
articulation_accent_cycle_v1
slur_pair_cycle_v1
```

### Meter, Tempo, Key, Clef

These can be represented as optional metadata tables.

Initial useful constants:

```text
meter_four_four_v1
meter_three_four_v1
meter_six_eight_v1
tempo_60_bpm_v1
tempo_90_bpm_v1
tempo_120_bpm_v1
key_c_major_v1
key_a_minor_v1
treble_clef_v1
bass_clef_v1
grand_staff_clefs_v1
```

These should be optional. A note table should remain renderable without explicit meter/key/clef metadata.

### Harmony And Form

Harmony should not be forced into the first pass. The first pass should make good note events and reusable pitch/rhythm/dynamic generators.

Later harmonic families:

```text
triad_quality_cycle_v1
diatonic_triads_major_v1
circle_of_fifths_roots_v1
functional_harmony_degrees_v1
seventh_chord_quality_cycle_v1
chord_tone_arpeggio_v1
```

Later form families:

```text
phrase_length_grid_v1
call_response_voice_pair_v1
sequence_transposition_v1
variation_register_cycle_v1
```

## Naming Policy

Use names that describe reusable musical concepts.

Prefer:

```text
diatonic_heptatonic_steps_v1
quarter_tick_grid_v1
chromatic_ascending_quarters_v1
melody_with_bass_v1
```

Avoid:

```text
musicxml_major_scale_v1
osmd_pitch_stream_v1
world_musicxml_notes_v1
octatonic_half_whole_steps_v1
octatonic_whole_half_steps_v1
```

Terminal scalar names should stay stable and minimal. Connector names can be musical and descriptive.

For curated canonical items, use `_v1`. For one-off tests, continue using unique date/test names.

Names for fixed musical presets are allowed when they clearly mean "this wrapper fixes RI values" rather than "this is a separate base material." For example, `c_major_quarters_v1` can be a convenient wrapper around `diatonic_heptatonic_steps_v1` with static pitch start `60` and shift `0`, but it should not replace the reusable diatonic family connector.

## Exact Deployable Connector Catalog: Batch 1

This section is the deployment checklist for the first curated connector batch. Anything not specified here should be treated as conceptual vocabulary, not deployment-ready.

### Live Deployment Correction

The first live deployment on May 17, 2026 surfaced two protocol details that were not captured correctly in the initial draft payloads below:

1. Constant duration values must be fixed on the terminal `duration_tick` occurrence, not on the parent duration material root. The deployed `*_duration_tick_v1` connectors therefore exist onchain but should be treated as superseded for curated MusicXML vocabulary. Use the deployed `*_duration_tick_v2` connectors instead.
2. Pitch materials should not lock the terminal `pitch_midi` occurrence if the user should be able to choose a tonic/register at runtime. The deployed `*_steps_v1` pitch connectors therefore exist onchain but should be treated as superseded for curated MusicXML vocabulary. Use the deployed `*_steps_v2` connectors instead.

The curated MusicXML-compatible note tables from this batch are the deployed `*_v3` note-table connectors. They use:

```text
onset material  -> *_tick_grid_v1
duration material -> *_duration_tick_v2
pitch material  -> *_steps_v2
```

For the deployed three-stream v3 note tables, the relevant open runtime RI positions are:

```text
7 -> pitch material scale-degree offset
8 -> pitch_midi tonic/register and transformation phase
```

The initial v1/v2 onchain artifacts are not deleted, because onchain objects are persistent, but they should not be presented as the curated canonical MusicXML vocabulary.

### Payload Conventions

Use the versioned Core Collection transformations for new curated connectors:

```text
add(n)      -> { "name": "math_add_v1", "args": [n] }
multiply(n) -> { "name": "math_multiply_v1", "args": [n] }
divide(n)   -> { "name": "math_divide_v1", "args": [n] }
```

Every connector in this batch uses:

```json
{
  "condition_name": "",
  "condition_args": []
}
```

Every dimension uses empty bindings unless explicitly stated:

```json
{ "bindings": {} }
```

`static_ri` keys below are protocol DFS-local positions for the exact connector structure shown. If the structure changes, recompute these positions before deployment.

### Existing Terminal Scalar Dependencies

These terminal connectors already exist onchain and are dependencies of the batch. They are not redeployed in this batch.

```text
onset_tick
duration_tick
pitch_midi
velocity_midi
```

Current live structure for each one:

```json
{
  "dimensions": [
    {
      "transformations": [{ "name": "add", "args": [1] }],
      "composite": "",
      "bindings": {}
    }
  ],
  "static_ri": {}
}
```

These are identity-like scalar streams. Parent materials select indexes from them.

### Reusable Onset Materials

#### `quarter_tick_grid_v1`

Purpose: reusable quarter-note onset grid.

Dependencies:

```text
math_add_v1
onset_tick
```

Structure:

```text
quarter_tick_grid_v1
`- D1 -> onset_tick
        transformations: add(2520)
```

Payload body:

```json
{
  "name": "quarter_tick_grid_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [2520] }],
      "composite": "onset_tick",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

RI semantics:

```text
position 0 start_point          -> first onset tick
position 0 transformation_shift -> phase, musically irrelevant while there is only one transformation
position 1                      -> locked terminal onset_tick identity
```

#### `eighth_tick_grid_v1`

Purpose: reusable eighth-note onset grid.

Dependencies:

```text
math_add_v1
onset_tick
```

Structure:

```text
eighth_tick_grid_v1
`- D1 -> onset_tick
        transformations: add(1260)
```

Payload body:

```json
{
  "name": "eighth_tick_grid_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [1260] }],
      "composite": "onset_tick",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

#### `half_tick_grid_v1`

Purpose: reusable half-note onset grid.

Dependencies:

```text
math_add_v1
onset_tick
```

Structure:

```text
half_tick_grid_v1
`- D1 -> onset_tick
        transformations: add(5040)
```

Payload body:

```json
{
  "name": "half_tick_grid_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [5040] }],
      "composite": "onset_tick",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

### Reusable Duration Materials

Duration constants need one extra rule. The fixed value belongs on the terminal `duration_tick` occurrence. A parent/root `static_ri["0"]` does not produce the intended constant duration stream in live execution.

The deployment-ready pattern is:

```json
{
  "name": "quarter_duration_tick_v2",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [0] }],
      "composite": "duration_tick",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 2520, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

The v1 duration payloads below were deployed before this was verified and are superseded.

#### `quarter_duration_tick_v1`

Purpose: reusable constant quarter-note duration.

Dependencies:

```text
math_add_v1
duration_tick
```

Structure:

```text
quarter_duration_tick_v1
`- D1 -> duration_tick
        transformations: add(0)
```

Payload body:

```json
{
  "name": "quarter_duration_tick_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [0] }],
      "composite": "duration_tick",
      "bindings": {}
    }
  ],
  "static_ri": {
    "0": { "start_point": 2520, "transformation_shift": 0 },
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

RI semantics:

```text
position 0 -> locked to 2520 ticks when this connector is run directly
position 1 -> locked terminal duration_tick identity
```

#### `eighth_duration_tick_v1`

Purpose: reusable constant eighth-note duration.

Dependencies:

```text
math_add_v1
duration_tick
```

Structure:

```text
eighth_duration_tick_v1
`- D1 -> duration_tick
        transformations: add(0)
```

Payload body:

```json
{
  "name": "eighth_duration_tick_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [0] }],
      "composite": "duration_tick",
      "bindings": {}
    }
  ],
  "static_ri": {
    "0": { "start_point": 1260, "transformation_shift": 0 },
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

#### `half_duration_tick_v1`

Purpose: reusable constant half-note duration.

Dependencies:

```text
math_add_v1
duration_tick
```

Structure:

```text
half_duration_tick_v1
`- D1 -> duration_tick
        transformations: add(0)
```

Payload body:

```json
{
  "name": "half_duration_tick_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [0] }],
      "composite": "duration_tick",
      "bindings": {}
    }
  ],
  "static_ri": {
    "0": { "start_point": 5040, "transformation_shift": 0 },
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

### Reusable Pitch Materials

All pitch materials expose `pitch_midi`.

The live deployment showed that the terminal `pitch_midi` occurrence must remain open when the material is intended to be reusable with arbitrary tonic/register. The corrected v2 pitch materials therefore omit `static_ri`.

The deployment-ready pattern is:

```json
{
  "name": "diatonic_heptatonic_steps_v2",
  "dimensions": [
    {
      "transformations": [
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [1] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [1] }
      ],
      "composite": "pitch_midi",
      "bindings": {}
    }
  ],
  "condition_name": "",
  "condition_args": []
}
```

For a standalone v2 pitch material:

```text
dynamic_ri["0"].start_point -> scale-degree offset
dynamic_ri["1"].start_point -> pitch_midi tonic/register
dynamic_ri["1"].transformation_shift -> circular phase/mode
```

For example, `diatonic_heptatonic_steps_v2` with `dynamic_ri["0"] = 0` and `dynamic_ri["1"] = 60` returns `60, 62, 64, 65, 67, 69, 71, 72`.

The v1 pitch payloads below were deployed before this was verified and are superseded.

#### `chromatic_steps_v1`

Purpose: chromatic semitone stream.

Dependencies:

```text
math_add_v1
pitch_midi
```

Structure:

```text
chromatic_steps_v1
`- D1 -> pitch_midi
        transformations: add(1)
```

Payload body:

```json
{
  "name": "chromatic_steps_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "pitch_midi",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

#### `diatonic_heptatonic_steps_v1`

Purpose: diatonic seven-note circular material. Modes are selected with `transformation_shift`.

Dependencies:

```text
math_add_v1
pitch_midi
```

Structure:

```text
diatonic_heptatonic_steps_v1
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(1), add(2), add(2), add(2), add(1)
```

Payload body:

```json
{
  "name": "diatonic_heptatonic_steps_v1",
  "dimensions": [
    {
      "transformations": [
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [1] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [1] }
      ],
      "composite": "pitch_midi",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

Phase labels:

```text
shift 0 -> Ionian / major
shift 1 -> Dorian
shift 2 -> Phrygian
shift 3 -> Lydian
shift 4 -> Mixolydian
shift 5 -> Aeolian / natural minor
shift 6 -> Locrian
```

#### `anhemitonic_pentatonic_steps_v1`

Purpose: five-note anhemitonic pentatonic circular material.

Dependencies:

```text
math_add_v1
pitch_midi
```

Structure:

```text
anhemitonic_pentatonic_steps_v1
`- D1 -> pitch_midi
        transformations: add(2), add(2), add(3), add(2), add(3)
```

Payload body:

```json
{
  "name": "anhemitonic_pentatonic_steps_v1",
  "dimensions": [
    {
      "transformations": [
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [3] },
        { "name": "math_add_v1", "args": [2] },
        { "name": "math_add_v1", "args": [3] }
      ],
      "composite": "pitch_midi",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

Phase labels:

```text
shift 0 -> major pentatonic phase
shift 4 -> minor pentatonic phase
```

#### `whole_tone_steps_v1`

Purpose: whole-tone pitch stream.

Dependencies:

```text
math_add_v1
pitch_midi
```

Structure:

```text
whole_tone_steps_v1
`- D1 -> pitch_midi
        transformations: add(2)
```

Payload body:

```json
{
  "name": "whole_tone_steps_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [2] }],
      "composite": "pitch_midi",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

#### `octatonic_steps_v1`

Purpose: octatonic circular material. Half-whole and whole-half are selected with `transformation_shift`.

Dependencies:

```text
math_add_v1
pitch_midi
```

Structure:

```text
octatonic_steps_v1
`- D1 -> pitch_midi
        transformations: add(1), add(2)
```

Payload body:

```json
{
  "name": "octatonic_steps_v1",
  "dimensions": [
    {
      "transformations": [
        { "name": "math_add_v1", "args": [1] },
        { "name": "math_add_v1", "args": [2] }
      ],
      "composite": "pitch_midi",
      "bindings": {}
    }
  ],
  "static_ri": {
    "1": { "start_point": 0, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

Phase labels:

```text
shift 0 -> half-whole
shift 1 -> whole-half
```

### MusicXML-Compatible Note Tables

Every note table in this batch has the same three required dimensions:

```text
D1 -> onset material
D2 -> duration material
D3 -> pitch material
```

Each note table dimension uses `add(1)` because the parent table walks row indexes through each child stream.

For the deployed v3 three-child note table shape, the controls that should be exposed to users are:

```text
7 -> pitch material scale-degree offset
8 -> pitch_midi tonic/register and transformation phase
```

The fixed duration value is supplied by the selected `*_duration_tick_v2` child material. The v3 note table should not use `static_ri["4"]`.

The v1 note-table payloads below remain as historical draft payloads. The live curated connectors are the v3 note tables recorded in the deployment audit.

#### `chromatic_ascending_quarters_v1`

Purpose: MusicXML-compatible chromatic quarter-note table.

Dependencies:

```text
math_add_v1
quarter_tick_grid_v1
quarter_duration_tick_v1
chromatic_steps_v1
```

Structure:

```text
chromatic_ascending_quarters_v1
|- D1 -> quarter_tick_grid_v1
|       transformations: add(1)
|- D2 -> quarter_duration_tick_v1
|       transformations: add(1)
`- D3 -> chromatic_steps_v1
        transformations: add(1)
```

Payload body:

```json
{
  "name": "chromatic_ascending_quarters_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "quarter_tick_grid_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "quarter_duration_tick_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "chromatic_steps_v1",
      "bindings": {}
    }
  ],
  "static_ri": {
    "4": { "start_point": 2520, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

MusicXML compatibility:

```text
format includes onset_tick, duration_tick, pitch_midi
```

#### `diatonic_mode_quarters_v1`

Purpose: MusicXML-compatible quarter-note table using the modular diatonic pitch family.

Dependencies:

```text
math_add_v1
quarter_tick_grid_v1
quarter_duration_tick_v1
diatonic_heptatonic_steps_v1
```

Structure:

```text
diatonic_mode_quarters_v1
|- D1 -> quarter_tick_grid_v1
|       transformations: add(1)
|- D2 -> quarter_duration_tick_v1
|       transformations: add(1)
`- D3 -> diatonic_heptatonic_steps_v1
        transformations: add(1)
```

Payload body:

```json
{
  "name": "diatonic_mode_quarters_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "quarter_tick_grid_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "quarter_duration_tick_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "diatonic_heptatonic_steps_v1",
      "bindings": {}
    }
  ],
  "static_ri": {
    "4": { "start_point": 2520, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

Open musical controls:

```text
position 7 start_point          -> scale-degree offset
position 8 start_point          -> tonic/register, for example 60 for C
position 8 transformation_shift -> mode, using the diatonic phase table
```

#### `anhemitonic_pentatonic_eighths_v1`

Purpose: MusicXML-compatible eighth-note table using the modular pentatonic pitch family.

Dependencies:

```text
math_add_v1
eighth_tick_grid_v1
eighth_duration_tick_v1
anhemitonic_pentatonic_steps_v1
```

Structure:

```text
anhemitonic_pentatonic_eighths_v1
|- D1 -> eighth_tick_grid_v1
|       transformations: add(1)
|- D2 -> eighth_duration_tick_v1
|       transformations: add(1)
`- D3 -> anhemitonic_pentatonic_steps_v1
        transformations: add(1)
```

Payload body:

```json
{
  "name": "anhemitonic_pentatonic_eighths_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "eighth_tick_grid_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "eighth_duration_tick_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "anhemitonic_pentatonic_steps_v1",
      "bindings": {}
    }
  ],
  "static_ri": {
    "4": { "start_point": 1260, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

#### `whole_tone_halves_v1`

Purpose: MusicXML-compatible half-note table using the modular whole-tone pitch stream.

Dependencies:

```text
math_add_v1
half_tick_grid_v1
half_duration_tick_v1
whole_tone_steps_v1
```

Structure:

```text
whole_tone_halves_v1
|- D1 -> half_tick_grid_v1
|       transformations: add(1)
|- D2 -> half_duration_tick_v1
|       transformations: add(1)
`- D3 -> whole_tone_steps_v1
        transformations: add(1)
```

Payload body:

```json
{
  "name": "whole_tone_halves_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "half_tick_grid_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "half_duration_tick_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "whole_tone_steps_v1",
      "bindings": {}
    }
  ],
  "static_ri": {
    "4": { "start_point": 5040, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

#### `octatonic_mode_quarters_v1`

Purpose: MusicXML-compatible quarter-note table using the modular octatonic pitch family.

Dependencies:

```text
math_add_v1
quarter_tick_grid_v1
quarter_duration_tick_v1
octatonic_steps_v1
```

Structure:

```text
octatonic_mode_quarters_v1
|- D1 -> quarter_tick_grid_v1
|       transformations: add(1)
|- D2 -> quarter_duration_tick_v1
|       transformations: add(1)
`- D3 -> octatonic_steps_v1
        transformations: add(1)
```

Payload body:

```json
{
  "name": "octatonic_mode_quarters_v1",
  "dimensions": [
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "quarter_tick_grid_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "quarter_duration_tick_v1",
      "bindings": {}
    },
    {
      "transformations": [{ "name": "math_add_v1", "args": [1] }],
      "composite": "octatonic_steps_v1",
      "bindings": {}
    }
  ],
  "static_ri": {
    "4": { "start_point": 2520, "transformation_shift": 0 }
  },
  "condition_name": "",
  "condition_args": []
}
```

Open musical controls:

```text
position 7 start_point          -> scale-degree offset
position 8 start_point          -> tonic/register
position 8 transformation_shift -> 0 half-whole, 1 whole-half
```

### Explicitly Deferred From Batch 1

These names remain useful vocabulary ideas but are not deployment-ready in this document:

```text
melody_with_bass_quarters_v1
single_voice_melody_v1
two_voice_counterpoint_v1
score_root_piano_grand_staff_v1
duration_augmentation_v1
duration_diminution_v1
duration_ratio_cycle_v1
tempo_ratio_cycle_v1
```

Reasons:

1. Multi-voice and score-root connectors require exact static RI materialization across deeper nested trees.
2. Proportional duration connectors need a policy for zero/too-small starts and renderable limits.
3. Tempo connectors need a clear MusicXML metadata table contract before deployment.

Do not deploy these until their exact structures and static RI positions are added to this document.

## Batch 1 Deployment Order

Deploy Batch 1 in dependency order. Do not deploy a parent connector until every composite it references exists and has been verified by `GET /chain/connector/:name`.

### Stage 0: Preflight

Verify these transformations exist:

```text
math_add_v1
math_multiply_v1
math_divide_v1
```

For Batch 1, only `math_add_v1` is required by the deployable connector payloads. `math_multiply_v1` and `math_divide_v1` are checked because they are part of the Core Collection and will be needed for the next proportional-duration batch.

Verify these terminal scalar connectors exist:

```text
onset_tick
duration_tick
pitch_midi
velocity_midi
```

Expected result:

```text
all preflight items return 200
```

If any item is missing, stop. Do not deploy the higher-level catalog until the missing primitive or scalar connector has been explicitly deployed or replaced in this document.

### Stage 1: Reusable Onset Materials

Deploy in this order:

```text
1. quarter_tick_grid_v1
2. eighth_tick_grid_v1
3. half_tick_grid_v1
```

Why first:

```text
all MusicXML-compatible note tables depend on an onset material
these only depend on math_add_v1 + onset_tick
```

After each deploy:

```text
GET /chain/connector/:name
confirm status 200
confirm format contains onset_tick
run a small execute smoke with N=4 if needed
```

Expected sample behavior:

```text
quarter_tick_grid_v1 -> 0, 2520, 5040, 7560
eighth_tick_grid_v1  -> 0, 1260, 2520, 3780
half_tick_grid_v1    -> 0, 5040, 10080, 15120
```

### Stage 2: Reusable Duration Materials

Deploy in this order:

```text
4. quarter_duration_tick_v2
5. eighth_duration_tick_v2
6. half_duration_tick_v2
```

Why second:

```text
note tables depend on duration materials
these only depend on math_add_v1 + duration_tick
```

After each deploy:

```text
GET /chain/connector/:name
confirm status 200
confirm format contains duration_tick
run a small execute smoke with N=4 if needed
```

Expected direct-run behavior:

```text
quarter_duration_tick_v2 -> 2520, 2520, 2520, 2520
eighth_duration_tick_v2  -> 1260, 1260, 1260, 1260
half_duration_tick_v2    -> 5040, 5040, 5040, 5040
```

Important static RI check:

```text
static_ri["1"] locks the terminal duration_tick occurrence to the fixed duration value
do not use the superseded v1 duration materials in curated note tables
```

### Stage 3: Reusable Pitch Materials

Deploy in this order:

```text
7. chromatic_steps_v2
8. diatonic_heptatonic_steps_v2
9. anhemitonic_pentatonic_steps_v2
10. whole_tone_steps_v2
11. octatonic_steps_v2
```

Why third:

```text
note tables depend on pitch materials
these only depend on math_add_v1 + pitch_midi
```

After each deploy:

```text
GET /chain/connector/:name
confirm status 200
confirm format contains pitch_midi
run a small execute smoke with N=8 if needed
```

Suggested execute smoke values:

```text
chromatic_steps_v2:
  dynamic_ri["0"] = { start_point: 0, transformation_shift: 0 }
  dynamic_ri["1"] = { start_point: 60, transformation_shift: 0 }
  expected pitch values: 60, 61, 62, 63, ...

diatonic_heptatonic_steps_v2:
  dynamic_ri["0"] = { start_point: 0, transformation_shift: 0 }
  dynamic_ri["1"] = { start_point: 60, transformation_shift: 0 }
  expected pitch values: 60, 62, 64, 65, 67, 69, 71, 72

anhemitonic_pentatonic_steps_v2:
  dynamic_ri["0"] = { start_point: 0, transformation_shift: 0 }
  dynamic_ri["1"] = { start_point: 60, transformation_shift: 0 }
  expected pitch values: 60, 62, 64, 67, 69, 72

whole_tone_steps_v2:
  dynamic_ri["0"] = { start_point: 0, transformation_shift: 0 }
  dynamic_ri["1"] = { start_point: 60, transformation_shift: 0 }
  expected pitch values: 60, 62, 64, 66, ...

octatonic_steps_v2:
  dynamic_ri["0"] = { start_point: 0, transformation_shift: 0 }
  dynamic_ri["1"] = { start_point: 60, transformation_shift: 0 }
  expected pitch values: 60, 61, 63, 64, 66, 67, 69, 70
```

Also verify at least one shift variant:

```text
diatonic_heptatonic_steps_v2 dynamic_ri["1"].transformation_shift = 5 -> natural-minor/Aeolian interval phase
octatonic_steps_v2 dynamic_ri["1"].transformation_shift = 1 -> whole-half phase
```

### Stage 4: MusicXML-Compatible Note Tables

Deploy only after Stages 1-3 are fully verified.

Deploy in this order:

```text
12. chromatic_ascending_quarters_v3
13. diatonic_mode_quarters_v3
14. anhemitonic_pentatonic_eighths_v3
15. whole_tone_halves_v3
16. octatonic_mode_quarters_v3
```

Why last:

```text
these are the first directly MusicXML-compatible connectors
each depends on one onset material, one duration material, and one pitch material
```

After each deploy:

```text
GET /chain/connector/:name
confirm status 200
confirm format contains onset_tick, duration_tick, pitch_midi
confirm the connector appears under /worlds/musicxml-score after format indexing/fetch
run with N=8 or N=12 in the MusicXML World
download MusicXML once to confirm export still works
```

Suggested execute smoke:

```text
particles_count = 8
dynamic_ri:
  "7": { "start_point": 0, "transformation_shift": 0 }
  "8": { "start_point": 60, "transformation_shift": 0 }
```

For the deployed v3 note tables, position `7` is the pitch-material scale-degree offset and position `8` is the `pitch_midi` tonic/register plus transformation phase for the exact three-child shape documented above.

Expected result:

```text
score renders without "not MusicXML-compatible" diagnostics
onset stream advances according to the table's onset material
duration stream stays fixed according to the selected `*_duration_tick_v2` material
pitch stream follows the selected pitch material and phase
```

### Stage 5: Post-Deployment Audit

After the curated batch connectors are deployed:

1. Record live owner and response body for each connector.
2. Record each connector's `format_hash`.
3. Confirm reusable submaterials are not expected to appear as MusicXML World posts unless their formats independently satisfy the world contract.
4. Confirm note tables do appear as compatible MusicXML World posts.
5. Add any discovered format hashes to a temporary audit table if the frontend still needs manual accepted-format coverage.
6. Run one MusicXML render and one MusicXML download for every deployed note table.
7. Keep deployment notes in this document or a follow-up collection manifest.

### May 17, 2026 Live Deployment Audit

Deployment owner reported by DCN:

```text
b530bf08d76015080c67d6b5f00cdee53b45bdda
```

Preflight passed for:

```text
math_add_v1
math_multiply_v1
math_divide_v1
onset_tick
duration_tick
pitch_midi
velocity_midi
```

Curated onset materials deployed and smoke-tested:

| Connector              | Format hash                                                        | Smoke result            |
| ---------------------- | ------------------------------------------------------------------ | ----------------------- |
| `quarter_tick_grid_v1` | `9c500f199ebf4695cb4e4bc28643aed1f5912fc393d0b6ce22dd2c8de52727e8` | `0, 2520, 5040, 7560`   |
| `eighth_tick_grid_v1`  | `9c500f199ebf4695cb4e4bc28643aed1f5912fc393d0b6ce22dd2c8de52727e8` | `0, 1260, 2520, 3780`   |
| `half_tick_grid_v1`    | `9c500f199ebf4695cb4e4bc28643aed1f5912fc393d0b6ce22dd2c8de52727e8` | `0, 5040, 10080, 15120` |

Superseded duration materials deployed before correction:

```text
quarter_duration_tick_v1
eighth_duration_tick_v1
half_duration_tick_v1
```

These v1 duration materials returned zero-valued direct runs and should not be used in curated note tables.

Curated duration materials deployed and smoke-tested:

| Connector                  | Format hash                                                        | Smoke result             |
| -------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `quarter_duration_tick_v2` | `a7841810e18e653f4a7a2560606d3aa7ff406515899f0e2c10bdb93b175c1783` | `2520, 2520, 2520, 2520` |
| `eighth_duration_tick_v2`  | `a7841810e18e653f4a7a2560606d3aa7ff406515899f0e2c10bdb93b175c1783` | `1260, 1260, 1260, 1260` |
| `half_duration_tick_v2`    | `a7841810e18e653f4a7a2560606d3aa7ff406515899f0e2c10bdb93b175c1783` | `5040, 5040, 5040, 5040` |

Superseded pitch materials deployed before correction:

```text
chromatic_steps_v1
diatonic_heptatonic_steps_v1
anhemitonic_pentatonic_steps_v1
whole_tone_steps_v1
octatonic_steps_v1
```

These v1 pitch materials lock the terminal `pitch_midi` occurrence, so tonic/register cannot be controlled correctly in curated note tables.

Curated pitch materials deployed and smoke-tested:

| Connector                         | Format hash                                                        | Smoke result with phase `0` and tonic `60` |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `chromatic_steps_v2`              | `f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797` | `60, 61, 62, 63, 64, 65, 66, 67`           |
| `diatonic_heptatonic_steps_v2`    | `f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797` | `60, 62, 64, 65, 67, 69, 71, 72`           |
| `anhemitonic_pentatonic_steps_v2` | `f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797` | `60, 62, 64, 67, 69, 72, 74, 76`           |
| `whole_tone_steps_v2`             | `f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797` | `60, 62, 64, 66, 68, 70, 72, 74`           |
| `octatonic_steps_v2`              | `f8d709ba114de2c12f0292720fff1249bd965e5d9bd2b6e13011b4abbfb10797` | `60, 61, 63, 64, 66, 67, 69, 70`           |

Superseded note table deployed before the duration correction:

```text
chromatic_ascending_quarters_v2
```

This connector has the MusicXML-compatible format hash but uses the superseded duration material and returned zero durations in smoke testing.

Curated MusicXML-compatible note tables deployed and smoke-tested:

| Connector                           | Format hash                                                        | Smoke result summary                                            |
| ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `chromatic_ascending_quarters_v3`   | `3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702` | quarters, constant quarter durations, chromatic pitches from 60 |
| `diatonic_mode_quarters_v3`         | `3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702` | quarters, constant quarter durations, diatonic pitches from 60  |
| `anhemitonic_pentatonic_eighths_v3` | `3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702` | eighths, constant eighth durations, pentatonic pitches from 60  |
| `whole_tone_halves_v3`              | `3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702` | halves, constant half durations, whole-tone pitches from 60     |
| `octatonic_mode_quarters_v3`        | `3cab30e4919b8e9544cb0394f6affbc1b267f336b9427bdb63ac9a74bc344702` | quarters, constant quarter durations, octatonic pitches from 60 |

For the v3 note tables, smoke execution used:

```json
{
  "7": { "start_point": 0, "transformation_shift": 0 },
  "8": { "start_point": 60, "transformation_shift": 0 }
}
```

Shift smoke:

```text
octatonic_mode_quarters_v3 with dynamic_ri["8"].transformation_shift = 1 returned 60, 62, 63, 65, 66, 68, 69, 71 for the pitch stream.
```

### Stop Conditions

Stop deployment immediately if:

```text
a primitive dependency returns 404
a connector deploy returns an error
a deployed connector response differs from the payload in this document
a static_ri map is missing or has unexpected keys
a note table format does not include all required MusicXML scalars
the MusicXML World cannot render any note table after a successful connector execute
```

Fix the document first, then continue. Do not patch around mistakes with ad hoc connector names.

Let me answer these found in the docs:

## Open Questions (Answered)

1. Should the curated connector database be owned by one canonical project account, or by multiple authors with a collection manifest?

Yes, for now you can just deploy them with the account that you use via the dcn-mcp. In the future that doesn't matter so much, what matters is that prople create various connectors collectivelly.

2. Should terminal scalar connectors eventually get versioned replacements that use `math_add_v1`, or should the existing legacy `add`-based terminal scalars remain canonical?

The already deployed add works exactly the same way, so there is no need to replace these connectors. They can be further used when needed.

3. Should the website Core Collection deploy report be regenerated now that the live network has the versioned primitives under a newer owner?

Yes, but after we will actually add all the planned new connectors onchain.

4. How much harmonic vocabulary should be deployed before users can already compose useful material through worlds?

We will need to come up with much more interesting material. We will think together later.

5. Should Studio expose a "curated musical vocabulary" browser separate from the general toolbox?

No.
