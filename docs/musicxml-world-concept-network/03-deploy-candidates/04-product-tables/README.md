# Product Table Candidates

Product connectors combine reusable material connectors into event tables.

The minimal MusicXML/MIDI-compatible note-table shape is:

```text
product_name
|- D1 -> onset material
|- D2 -> duration material
`- D3 -> pitch material
```

The terminal scalar set must include:

```text
onset_tick
duration_tick
pitch_midi
```

## Families

```text
01-minimal-note-tables/
  Three-column onset/duration/pitch products.

02-extended-note-tables/
  Products with velocity, part, staff, voice, note_kind, dynamic_code,
  articulation, and notation-control scalars.
```
