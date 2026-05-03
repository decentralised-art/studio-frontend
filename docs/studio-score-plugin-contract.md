# Studio Music Score Plugin Contract

The Music Score plugin renders connector output as MusicXML 4.0 through OSMD. It does not require metadata connectors: every semantic score element is supplied through numeric connector streams and interpreted by the plugin codebook.

## Accepted Subformats

The plugin accepts subformats from most specific to broadest:

1. `musicxml-tree-v1`
   - Canonical MusicXML tree rows.
   - Best for full scores, multiple parts, text, articulations, directions, lyrics, and notation details.
2. `music-measured-notes-v1`
   - Measure-local notes: `measure`, `onset`, `duration`, `pitch`, plus optional `event_id`, `velocity`, `dynamic_code`, `part`, `voice`, and `staff`.
   - Deployed score slot connector names with the `score_` prefix are accepted as the same fields, for example `score_measure`, `score_onset`, `score_duration`, `score_pitch`, and `score_dynamic_code`.
   - `score_articulations_v1` and `score_slurs_v1` attach to notes by matching `score_event_id`.
   - Best when a connector already thinks in score coordinates.
3. `music-note-events-v1`
   - Pitch/time/duration/velocity streams, currently shared with the MIDI plugin format.
   - Best for quick rendering of existing PTDV-compatible connectors.

## Studio Templates

Templates are local editable arrangements of deployed connector archetypes. They insert ordinary on-chain connectors into the Studio flow; the arrangement itself remains a draft until the user deploys it.

- `score_notes_v1`: slots `score_event_id`, `score_measure`, `score_onset`, `score_duration`, `score_pitch`, `score_dynamic_code`, `score_part`, `score_staff`, and `score_voice`
- `score_articulations_v1`: slots `score_event_id`, `score_articulation_code`, and `score_placement`
- `score_slurs_v1`: slots `score_event_id`, `score_slur_number`, `score_slur_type`, and `score_placement`

## Tree Tables

`musicxml-tree-v1` is represented by three numeric row tables:

- `score_nodes`: `node_id`, `parent_id`, `child_index`, `element_code`, optional `custom_element_text_id`, optional `text_id`
- `score_attrs`: `node_id`, `attr_index`, `attr_code`, `value_kind`, optional `number_value`, `enum_code`, `text_id`, `custom_attr_text_id`
- `score_text`: `text_id`, `item_index`, `text_kind`, `value`

Text is connector-derived by codepoint or token mapping. For example, dynamics are numeric values mapped to `ppp`, `pp`, `p`, `mp`, `mf`, `f`, `ff`, and `fff`.

`score_articulation_code` maps currently support `0=accent`, `1=staccato`, `2=tenuto`, and `3=strong-accent`. `score_slur_type` uses MusicXML enum codes `1=start`, `2=stop`, and `3=continue`; `score_placement` uses `6=above` and `7=below`.

## Renderer Behavior

- The renderer targets MusicXML 4.0 partwise scores.
- PTDV streams are interpreted as MIDI note numbers, beat positions, beat durations, and MIDI velocities.
- Invalid note values are skipped with diagnostics rather than normalized silently.
- Long notes crossing measure boundaries are split and tied.
- Simultaneous notes with the same onset and duration are emitted as chords.
- Multi-staff note streams emit MusicXML `staves`, numbered clefs, and per-note `staff` elements.
