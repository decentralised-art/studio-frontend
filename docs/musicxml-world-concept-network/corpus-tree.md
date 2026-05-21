# MusicXML World Corpus Tree

This is the top-level map of the proposed MusicXML World corpus.

It shows:

```text
what is already deployed
what is already an exact deploy candidate
what is only a corpus proposal
what is still missing or blocked
```

Use this file as the bird's-eye view before entering the detailed folders.

## Legend

```text
P4 deployed
  Onchain and documented in 01-deployed-graph/.

P3 deploy candidate
  Exact connector tree is documented in 03-deploy-candidates/.

P2 connector archetype
  Tree shape is known, but needs exact P3 spec or smoke output.

P1/P0 corpus proposal
  Concept belongs in the corpus but is not deploy-ready.

blocked
  Requires new world contract support, transformation, condition, or scalar map.
```

## Whole Corpus Tree

```text
MusicXML World Concept Network
|
|- 00-start-here
|  |- system-principles.md                         P4 source-of-truth
|  |- deployable-connector-recipes.md              P4 operational recipes
|  |- connector-tree-notation.md                   P4 notation guide
|  |- concept-node-template.md                     P4 documentation template
|  `- documentation-map.md                         P4 documentation map
|
|- 01-deployed-graph
|  |- terminal-scalars                             P4
|  |  |- onset_tick
|  |  |- duration_tick
|  |  |- pitch_midi
|  |  `- velocity_midi
|  |
|  |- onset materials                              P4
|  |  |- half_tick_grid_v1
|  |  |- quarter_tick_grid_v1
|  |  `- eighth_tick_grid_v1
|  |
|  |- duration materials                           P4
|  |  |- half_duration_tick_v2
|  |  |- quarter_duration_tick_v2
|  |  `- eighth_duration_tick_v2
|  |
|  |- pitch materials                              P4
|  |  |- chromatic_steps_v2
|  |  |- whole_tone_steps_v2
|  |  |- diatonic_heptatonic_steps_v2
|  |  |- anhemitonic_pentatonic_steps_v2
|  |  `- octatonic_steps_v2
|  |
|  `- note-table products                          P4
|     |- chromatic_ascending_quarters_v3
|     |- diatonic_mode_quarters_v3
|     |- anhemitonic_pentatonic_eighths_v3
|     |- whole_tone_halves_v3
|     `- octatonic_mode_quarters_v3
|
|- 02-corpus
|  |- 00-overview
|  |  |- music-theory-corpus-plan.md               P1/P2 overview
|  |  |- readiness-matrix.md                       P2/P3 classification
|  |  `- operational-deployability-review.md       P4 viability review
|  |
|  |- 01-operations
|  |  |- current transformations and conditions     P4/P2
|  |  `- missing operation gaps                     future convenience / scalar support
|  |     |- lookup/table
|  |     |- delta_table
|  |     |- modular add/multiply
|  |     |- fold/bounce range
|  |     |- periodic mask
|  |     `- particle-aware conditions
|  |
|  |- 02-pitch
|  |  |- equal-division generators                  P3/P4
|  |  |- ordered interval grammars                  P2/P3
|  |  |- heptatonic families                        P2/P3
|  |  |- Messiaen / limited-transposition modes     P2/P3
|  |  |- pentatonic and blues families              P2/P3
|  |  |- named collections and sonorities            P3/P1 mixed
|  |  |- set-class backbone                          P1 metadata / P3 representatives
|  |  |- serial row systems                          P2/P3 as exact interval grammars
|  |  |- microtonal / EDO systems                    blocked by tuning scalars
|  |  |- maqam / ajnas systems                       P1/P2 / richer forms need microtonality
|  |  |- raga / melakarta systems                    P1/P2 / needs performance metadata
|  |  |- gamelan slendro/pelog/pathet                P1 / blocked by tuning support
|  |  |- spectral / harmonic-series materials        blocked by pitch_cents/ratio ops
|  |  `- voice-leading / inversion spaces           P2 exact grammars / validation blocked
|  |
|  |- 03-rhythm
|  |  |- fixed onset grids                           P3/P4
|  |  |- fixed duration values                       P3/P4
|  |  |- additive onset patterns                     P2/P3
|  |  |- Euclidean onset-distance patterns           P2/P3
|  |  |- non-retrogradable rhythms                   P2
|  |  |- duration cycles                             P3 / needs smoke tests
|  |  |- tala-like metric cycles                     P1/P2
|  |  |- aksak/additive meter                         P2
|  |  |- clave/timeline patterns                      P1/P2
|  |  |- hypermeter and metric accent cycles          blocked by accent scalars
|  |  |- tuplet rendering metadata                    blocked by world support
|  |  |- rest/note-kind masks                         blocked by scalar maps/tables
|  |  `- meter/tempo tables                          blocked by world support
|  |
|  |- 04-expression
|  |  |- velocity materials                           P2/P3
|  |  |- dynamic_code materials                       blocked by scalar map
|  |  |- articulation_code materials                  blocked by scalar map
|  |  |- note_kind materials                          blocked by scalar map
|  |  `- notation controls                           blocked by world support
|  |
|  |- 05-composition
|  |  |- minimal note tables                          P3/P4
|  |  |- extended note tables                         P2 / blocked by optional scalars
|  |  |- multi-voice products                         P2 / needs smoke tests
|  |  |- canon, hocket, drone, texture products       P1/P2
|  |  |- counterpoint                                 P1/P2 / blocked by validation
|  |  |- canon / imitation / fugue                    P1/P2
|  |  |- phrase forms                                 P1 / needs section scalars
|  |  |- large forms                                  P1 / needs form roots
|  |  `- form roots                                  P1 / future
|  |
|  `- 06-research-passes
|     |- research-pass-001.md
|     |- research-pass-002.md
|     |- research-pass-003.md
|     `- research-pass-004.md
|
`- 03-deploy-candidates
   |- 01-pitch-materials
   |  |- 01-equal-division-generators               P3
   |  |  |- add3_minor_third_cycle
   |  |  |- add4_major_third_cycle
   |  |  |- add5_circle_of_fourths_steps
   |  |  |- add6_tritone_steps
   |  |  |- add7_circle_of_fifths_steps
   |  |  `- add12_octave_register_steps
   |  |
   |  |- 02-ordered-interval-grammars               P3
   |  |  |- harmonic_minor_heptatonic_steps
   |  |  |- melodic_minor_heptatonic_steps
   |  |  |- harmonic_major_heptatonic_steps
   |  |  |- acoustic_heptatonic_steps
   |  |  |- double_harmonic_heptatonic_steps
   |  |  |- hungarian_minor_heptatonic_steps
   |  |  |- messiaen_mode_3_steps
   |  |  |- messiaen_mode_4_steps
   |  |  |- messiaen_mode_5_steps
   |  |  |- messiaen_mode_6_steps
   |  |  |- messiaen_mode_7_steps
   |  |  |- augmented_hexatonic_steps
   |  |  `- blues_hexatonic_steps
   |  |
   |  |- 03-named-collections-and-sonorities        P3/P1 mixed
   |  |  |- Prometheus collection                    P3 sorted representative
   |  |  |- Petrushka collection                     P3 sorted representative
   |  |  |- Tristan sonority                         P3 representative + voicing
   |  |  |- all-interval tetrachords                 P1 until representative chosen
   |  |  `- Forte set-class representatives          P1/P3 per representative
   |  |
   |  `- 04-serial-row-materials                    P3 pattern
   |     `- finite row forms as exact interval grammars
   |
   |- 02-rhythm-materials
   |  |- 01-onset-grids                             P3
   |  |- 02-duration-grids                          P3
   |  |- 03-additive-and-euclidean-onsets           P3/P2
   |  `- 04-duration-cycles                         P3
   |
   |- 03-expression-materials
   |  |- 01-velocity-materials                      P2/P3
   |  `- 02-notation-codes                          blocked
   |
   `- 04-product-tables
      |- 01-minimal-note-tables                     P3
      `- 02-extended-note-tables                    P2 / blocked by optional scalars
```

## What Is Missing Most

The largest missing areas are:

```text
1. P3 specs for named collections and sonorities as exact representatives or chord products.
2. Smoke-tested P3 specs for duration cycles, not just constant durations.
3. Final scalar maps for dynamic_code, articulation_code, note_kind, and notation controls.
4. World support and smoke tests for extended note tables.
5. Convenience transformations: lookup/table, delta_table, fold/bounce range, modular operations.
6. A deployed metadata layer for aliases, rotations, historical names, and equivalence classes.
7. Tuning/microtonal support for maqam, gamelan, EDO, and spectral materials.
8. Section/form scalar contracts for phrase, counterpoint, canon, and large-form roots.
9. Validation/diagnostic layers for counterpoint, voice-leading, and style-specific constraints.
```

## Current Deployment Direction

The safest next deployment direction is:

```text
1. Finish material-layer candidates:
   pitch equal-division generators
   ordered pitch grammars
   missing onset/duration grids

2. Deploy a small number of product tables that reuse those materials.

3. Only then expand expression, rests, articulation, and notation-specific scalars.
```
