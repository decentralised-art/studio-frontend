# Studio Music Score Plugin Contract

The Music Score plugin renders connector output as MusicXML 4.0 through OSMD. It does not require metadata connectors: every semantic score element is supplied through numeric connector streams and interpreted by the plugin codebook.

## Accepted Subformats

The plugin accepts subformats from most specific to broadest:

1. `musicxml-tree-v1`
   - Canonical MusicXML tree rows.
   - Best for full scores, multiple parts, text, articulations, directions, lyrics, and notation details.
2. `music-measured-notes-v1`
   - Current Studio-authored scores use the positional schema rooted at the connector target: root D1 is notes, D2 parts, D3 meter, D4 clefs, D5 tempo, D6 key, D7 articulations, and D8 slurs.
   - Inside a notes table, D1 is onset tick, D2 duration tick, D3 pitch, D4 event id, D5 part, D6 staff, D7 voice, and D8 dynamic code. Connector names under those slots are reusable value generators and do not define score meaning.
   - Legacy terminal score-field streams are still accepted for compatibility. The minimal legacy note layer is any shared parent containing `score_onset`, `score_duration`, and `score_pitch`.
   - Legacy `score_notes_v1` and `score_notes_v2` collectors remain accepted when their slots contain connected shapers or terminal score-field connectors.
   - Legacy measure-local streams (`measure`, `onset`, `duration`, without the `score_` terminal prefix) are still accepted for compatibility, but they are not the preferred composition model.
3. `music-note-events-v1`
   - Pitch/time/duration/velocity streams, currently shared with the MIDI plugin format.
   - Best for quick rendering of existing PTDV-compatible connectors.

## Studio Position Schema

Studio no longer has score templates. The visible connector flow is the deploy source of truth, and the Music Score plugin interprets output with the position schema documented in
[`studio-music-score-position-schema.md`](./studio-music-score-position-schema.md).

Existing on-chain connectors stay reusable references. If a score uses already-deployed generators such as `constant_value`, `counter`, `score_quarter_note_tick_grid`, or `major_scale_steps`, Studio should reference them by name and store usage-specific static RI values in the deployed root connector's `static_ri` map.

The plugin reads connected score subtrees and ignores bare unconnected collector dimensions. For example, a root D1 notes branch only yields note rows when it contains connected D1 onset, D2 duration, and D3 pitch streams.

`score_onset` and `score_duration` terminal connectors are interpreted as global ticks in legacy flows. The current positional adapter also uses global ticks, with `2520` ticks per quarter note. This gives exact integer positions for common binary rhythms, triplets, quintuplets, septuplets, and grids such as 36 positions in a 4/4 bar. Users should compose with global tick time, not with measure-local note coordinates.

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
- Positional score streams are interpreted as global ticks plus explicit score layers; if no meter layer is present, the renderer emits a diagnostic and uses 4/4 only as a preview fallback.
- Invalid note values are skipped with diagnostics rather than normalized silently.
- Long notes crossing meter-derived measure boundaries are split and tied.
- Simultaneous notes with the same onset and duration are emitted as chords.
- Multi-staff note streams emit MusicXML `staves`, numbered clefs, and per-note `staff` elements.
