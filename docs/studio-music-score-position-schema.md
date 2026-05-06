# Music Score Position Schema

```text
Music Score plugin
└─ SCORE_ROOT
   ├─ D1  NOTES
   ├─ D2  PARTS
   ├─ D3  METER
   ├─ D4  CLEFS
   ├─ D5  TEMPO
   ├─ D6  KEY
   ├─ D7  ARTICULATIONS
   ├─ D8  SLURS / SPANNERS
   ├─ D9  DIRECTIONS / TEXT
   ├─ D10 BARLINES / REPEATS
   ├─ D11 SETTINGS
   └─ D12 RAW MUSICXML TREE
```

Semantic meaning is positional. Connector names under these slots do not define
MusicXML meaning.

## Root

| Slot | Layer              | Status   | Default if omitted                 |
| ---- | ------------------ | -------- | ---------------------------------- |
| D1   | Notes              | Required | No notation                        |
| D2   | Parts              | Optional | One part, one staff                |
| D3   | Meter              | Optional | 4/4 preview meter                  |
| D4   | Clefs              | Optional | Treble clef, part 1, staff 1       |
| D5   | Tempo              | Optional | No tempo marking                   |
| D6   | Key                | Optional | No key signature / C major display |
| D7   | Articulations      | Optional | No articulations                   |
| D8   | Slurs / spanners   | Optional | No slurs                           |
| D9   | Directions / text  | Future   | None                               |
| D10  | Barlines / repeats | Future   | Regular barlines                   |
| D11  | Settings           | Optional | `ticks_per_quarter = 2520`         |
| D12  | Raw MusicXML tree  | Advanced | None                               |

## Layer Pattern

Each root layer can connect directly to one table:

```text
SCORE_ROOT
└─ D1 NOTES -> NOTE_TABLE
```

or to an event set containing many tables:

```text
SCORE_ROOT
└─ D1 NOTES -> NOTE_SET
              ├─ D1 -> MELODY_NOTE_TABLE
              ├─ D2 -> BASS_NOTE_TABLE
              └─ D3 -> PERCUSSION_NOTE_TABLE
```

Every connected dimension of an event set is interpreted as another table of
the same layer type.

## Notes

Required fields are on the left.

```text
NOTE_TABLE
├─ D1 onset_tick      REQUIRED
├─ D2 duration_tick   REQUIRED
├─ D3 pitch           REQUIRED for pitched notes
├─ D4 event_id        optional
├─ D5 part            optional
├─ D6 staff           optional
├─ D7 voice           optional
├─ D8 dynamic_code    optional
├─ D9 note_kind       future
├─ D10 accidental     future
├─ D11 stem           future
└─ D12 beam_group     future
```

| Slot | Field         | Status   | Default if omitted                          |
| ---- | ------------- | -------- | ------------------------------------------- |
| D1   | onset_tick    | Required | Invalid row                                 |
| D2   | duration_tick | Required | Invalid row                                 |
| D3   | pitch         | Required | Invalid row, unless future `note_kind=rest` |
| D4   | event_id      | Optional | Row index                                   |
| D5   | part          | Optional | Default part                                |
| D6   | staff         | Optional | Default staff                               |
| D7   | voice         | Optional | Voice 1                                     |
| D8   | dynamic_code  | Optional | No dynamic marking                          |
| D9   | note_kind     | Future   | Pitched note                                |
| D10  | accidental    | Future   | Renderer spelling                           |
| D11  | stem          | Future   | Renderer choice                             |
| D12  | beam_group    | Future   | Renderer grouping                           |

Minimal note table:

```text
NOTE_TABLE
├─ D1 -> onset generator
├─ D2 -> duration generator
└─ D3 -> pitch generator
```

Major scale example:

```text
SCORE_ROOT
└─ D1 NOTES -> NOTE_SET
              └─ D1 -> NOTE_TABLE
                       ├─ D1 onset_tick    -> quarter_tick_grid      // 0, 2520, 5040...
                       ├─ D2 duration_tick -> constant_duration      // 2520, 2520...
                       └─ D3 pitch         -> major_scale_generator  // 60, 62, 64...
```

## Parts

```text
PART_TABLE
├─ D1 part          REQUIRED
├─ D2 staff_count   REQUIRED
├─ D3 part_name     optional / future
└─ D4 instrument    optional / future
```

| Slot | Field       | Status   | Default if omitted     |
| ---- | ----------- | -------- | ---------------------- |
| D1   | part        | Required | Invalid row            |
| D2   | staff_count | Required | Invalid row            |
| D3   | part_name   | Future   | Generated part name    |
| D4   | instrument  | Future   | No playback instrument |

## Meter

```text
METER_TABLE
├─ D1 time_tick   REQUIRED
├─ D2 beats       REQUIRED
└─ D3 beat_type   REQUIRED
```

| Slot | Field     | Status   | Default if omitted |
| ---- | --------- | -------- | ------------------ |
| D1   | time_tick | Required | Invalid row        |
| D2   | beats     | Required | Invalid row        |
| D3   | beat_type | Required | Invalid row        |

## Clefs

```text
CLEF_TABLE
├─ D1 time_tick        REQUIRED
├─ D2 part             REQUIRED
├─ D3 staff            REQUIRED
├─ D4 clef_sign_code   REQUIRED
└─ D5 clef_line        REQUIRED
```

| Slot | Field          | Status   | Values                              |
| ---- | -------------- | -------- | ----------------------------------- |
| D1   | time_tick      | Required | Global tick                         |
| D2   | part           | Required | Part id                             |
| D3   | staff          | Required | Staff id                            |
| D4   | clef_sign_code | Required | `0=G`, `1=F`, `2=C`, `3=percussion` |
| D5   | clef_line      | Required | Common: `2` for G, `4` for F        |

## Tempo

```text
TEMPO_TABLE
├─ D1 time_tick   REQUIRED
└─ D2 bpm         REQUIRED
```

| Slot | Field     | Status   |
| ---- | --------- | -------- |
| D1   | time_tick | Required |
| D2   | bpm       | Required |

## Key

```text
KEY_TABLE
├─ D1 time_tick    REQUIRED
├─ D2 fifths       REQUIRED
├─ D3 mode_code    optional
└─ D4 part         optional
```

| Slot | Field     | Status   | Default if omitted |
| ---- | --------- | -------- | ------------------ |
| D1   | time_tick | Required | Invalid row        |
| D2   | fifths    | Required | Invalid row        |
| D3   | mode_code | Optional | Major              |
| D4   | part      | Optional | All parts          |

## Articulations

```text
ARTICULATION_TABLE
├─ D1 event_id            REQUIRED
├─ D2 articulation_code   REQUIRED
└─ D3 placement           optional
```

| Slot | Field             | Status   | Values                                                  |
| ---- | ----------------- | -------- | ------------------------------------------------------- |
| D1   | event_id          | Required | Matches note event id                                   |
| D2   | articulation_code | Required | `0=accent`, `1=staccato`, `2=tenuto`, `3=strong-accent` |
| D3   | placement         | Optional | `0=above`, `1=below`                                    |

## Slurs / Spanners

```text
SLUR_TABLE
├─ D1 event_id       REQUIRED
├─ D2 number         REQUIRED
├─ D3 type_code      REQUIRED
├─ D4 placement      optional
└─ D5 spanner_kind   future
```

| Slot | Field        | Status   | Values                            |
| ---- | ------------ | -------- | --------------------------------- |
| D1   | event_id     | Required | Matches note event id             |
| D2   | number       | Required | Slur number                       |
| D3   | type_code    | Required | `0=start`, `1=stop`, `2=continue` |
| D4   | placement    | Optional | `0=above`, `1=below`              |
| D5   | spanner_kind | Future   | Slur, tie, tuplet, hairpin        |

## Directions / Text

```text
DIRECTION_TABLE
├─ D1 time_tick        REQUIRED
├─ D2 direction_kind   REQUIRED
├─ D3 direction_id     optional
├─ D4 part             optional
├─ D5 staff            optional
├─ D6 placement        optional
├─ D7 value_code       optional
└─ D8 text_id          optional
```

## Barlines / Repeats

```text
BARLINE_TABLE
├─ D1 time_tick      REQUIRED
├─ D2 barline_kind   REQUIRED
├─ D3 part           optional
├─ D4 repeat_code    optional
└─ D5 ending_code    optional
```

## Settings

```text
SETTINGS_TABLE
├─ D1 ticks_per_quarter   optional
├─ D2 default_part        optional
├─ D3 default_staff       optional
├─ D4 default_voice       optional
├─ D5 default_beats       optional
└─ D6 default_beat_type   optional
```

Defaults:

```text
ticks_per_quarter = 2520
default_part = first available part, or 1
default_staff = 1
default_voice = 1
default_beats = 4
default_beat_type = 4
```

## Raw MusicXML Tree

```text
RAW_MUSICXML_TREE
├─ D1 nodes_table
├─ D2 attrs_table
└─ D3 text_table
```

If complete, raw MusicXML tree tables take precedence over positional score
layers.

## Rules

```text
1. Meaning comes from slot position.
2. Names under field slots are value-generator names only.
3. Dense tick values are final data, not child indexes.
4. Required fields are leftmost.
5. Optional fields are to the right.
6. Missing required fields make that table/row invalid.
7. Missing optional fields use the explicit defaults above.
```

Bad:

```text
tick_grid(add 2520) -> score_onset
```

Good:

```text
NOTE_TABLE D1 onset_tick -> tick_grid(add 2520)
```
