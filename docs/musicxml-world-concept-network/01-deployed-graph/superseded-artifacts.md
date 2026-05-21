# Superseded Onchain Artifacts

These connectors exist onchain but should not be used as curated vocabulary.

They remain part of network history, but future concept nodes and composition connectors should depend on the curated replacements instead.

## Duration v1 Materials

```text
quarter_duration_tick_v1
eighth_duration_tick_v1
half_duration_tick_v1
```

Reason:

```text
These returned zero-valued direct runs because the fixed duration was not locked on the terminal duration_tick occurrence.
```

Use instead:

```text
quarter_duration_tick_v2
eighth_duration_tick_v2
half_duration_tick_v2
```

## Pitch v1 Materials

```text
chromatic_steps_v1
diatonic_heptatonic_steps_v1
anhemitonic_pentatonic_steps_v1
whole_tone_steps_v1
octatonic_steps_v1
```

Reason:

```text
These lock the terminal pitch_midi occurrence, so tonic/register cannot be controlled correctly in curated note-table use.
```

Use instead:

```text
chromatic_steps_v2
diatonic_heptatonic_steps_v2
anhemitonic_pentatonic_steps_v2
whole_tone_steps_v2
octatonic_steps_v2
```

## Note Table v2 Artifact

```text
chromatic_ascending_quarters_v2
```

Reason:

```text
This has the MusicXML-compatible format hash but uses the superseded duration material and returned zero durations in smoke testing.
```

Use instead:

```text
chromatic_ascending_quarters_v3
```
