# Notation Code Candidates

Status: blocked.

These concepts need exact scalar maps in the MusicXML World contract before deployment.

## Blocked Terminal Scalars

```text
dynamic_code
articulation_code
note_kind
accidental_code
stem_code
beam_group
```

For each scalar, define:

```text
integer value map
default value
rendering behavior
MusicXML export behavior
MIDI behavior if any
random RI value range
fallback behavior for out-of-range values
```

Do not deploy curated materials for these scalars until those maps exist.
