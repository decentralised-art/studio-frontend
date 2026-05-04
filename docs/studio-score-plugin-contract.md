# Studio Music Score Plugin Contract

The Music Score plugin renders connector output as MusicXML 4.0 through OSMD. It does not require metadata connectors: every semantic score element is supplied through numeric connector streams and interpreted by the plugin codebook.

## Accepted Subformats

The plugin accepts subformats from most specific to broadest:

1. `musicxml-tree-v1`
   - Canonical MusicXML tree rows.
   - Best for full scores, multiple parts, text, articulations, directions, lyrics, and notation details.
2. `music-measured-notes-v1`
   - Layered score-template streams. Inside `score_notes_v1`, notes use global tick coordinates: `score_onset`, `score_duration`, `score_pitch`, plus optional `score_event_id`, `score_dynamic_code`, `score_part`, `score_voice`, and `score_staff`.
   - Full score drafts should also include explicit global layers: `score_parts_v2`, `score_meter_v2`, `score_clefs_v2`, `score_tempo_v2`, and `score_key_v2`.
   - `score_articulations_v1` and `score_slurs_v1` attach to notes by matching `score_event_id`.
   - Legacy standalone measure-local streams (`score_measure`, `score_onset`, `score_duration`) are still accepted for compatibility outside `score_notes_v1`, but they are not the preferred composition model.
3. `music-note-events-v1`
   - Pitch/time/duration/velocity streams, currently shared with the MIDI plugin format.
   - Best for quick rendering of existing PTDV-compatible connectors.

## Studio Templates

Templates are local editable arrangements of deployed connector archetypes. They insert ordinary on-chain connectors into the Studio flow; the arrangement itself remains a draft until the user deploys it.

- `score_full_v2`: slots `score_parts_v2`, `score_meter_v2`, `score_clefs_v2`, `score_tempo_v2`, `score_key_v2`, `score_notes_v1`, `score_articulations_v1`, and `score_slurs_v1`
- `score_notes_v1`: slots `score_event_id`, `score_onset`, `score_duration`, `score_pitch`, `score_dynamic_code`, `score_part`, `score_staff`, and `score_voice`
- `score_meter_v2`: slots `score_meter_time_tick`, `score_beats`, and `score_beat_type`
- `score_parts_v2`: slots `score_part` and `score_staff_count`
- `score_clefs_v2`: slots `score_clef_time_tick`, `score_part`, `score_staff`, `score_clef_sign_code`, and `score_clef_line`
- `score_tempo_v2`: slots `score_tempo_time_tick` and `score_tempo_bpm`
- `score_key_v2`: slots `score_key_time_tick`, `score_key_fifths`, `score_key_mode_code`, and `score_part`
- `score_articulations_v1`: slots `score_event_id`, `score_articulation_code`, and `score_placement`
- `score_slurs_v1`: slots `score_event_id`, `score_slur_number`, `score_slur_type`, and `score_placement`

Within `score_notes_v1`, `score_onset` and `score_duration` are interpreted as global ticks. The score-template adapter uses `2520` ticks per quarter note. This gives exact integer positions for common binary rhythms, triplets, quintuplets, septuplets, and grids such as 36 positions in a 4/4 bar. The renderer derives MusicXML measures from `score_meter_v2`; users should compose with global tick time, not with measure-local note coordinates.

Semantic pass-through slot connectors canonically use the `add` transformation with argument `1`.
Collector archetypes with semantic child slots also use `add(1)` on each dimension so every dimension advances through the child stream.

## Tree Tables

`musicxml-tree-v1` is represented by three numeric row tables:

- `score_nodes`: `node_id`, `parent_id`, `child_index`, `element_code`, optional `custom_element_text_id`, optional `text_id`
- `score_attrs`: `node_id`, `attr_index`, `attr_code`, `value_kind`, optional `number_value`, `enum_code`, `text_id`, `custom_attr_text_id`
- `score_text`: `text_id`, `item_index`, `text_kind`, `value`

Text is connector-derived by codepoint or token mapping. For example, dynamics are numeric values mapped to `ppp`, `pp`, `p`, `mp`, `mf`, `f`, `ff`, and `fff`.

`score_articulation_code` maps currently support `0=accent`, `1=staccato`, `2=tenuto`, and `3=strong-accent`. `score_slur_type` uses MusicXML enum codes `1=start`, `2=stop`, and `3=continue`; `score_placement` uses `6=above` and `7=below`.

`score_clef_sign_code` supports `0=G`, `1=F`, `2=C`, and `3=percussion`. `score_key_mode_code` supports `0=major`, `1=minor`, `2=none`, and church-mode labels from `3=dorian` through `9=locrian`.

## Renderer Behavior

- The renderer targets MusicXML 4.0 partwise scores.
- PTDV streams are interpreted as MIDI note numbers, beat positions, beat durations, and MIDI velocities.
- Score-template streams are interpreted as global ticks plus explicit score layers; if no meter layer is present, the renderer emits a diagnostic and uses 4/4 only as a preview fallback.
- Invalid note values are skipped with diagnostics rather than normalized silently.
- Long notes crossing meter-derived measure boundaries are split and tied.
- Simultaneous notes with the same onset and duration are emitted as chords.
- Multi-staff note streams emit MusicXML `staves`, numbered clefs, and per-note `staff` elements.
