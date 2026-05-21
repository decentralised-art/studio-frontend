# Deploy Candidates

This folder contains exact connector specs that are ready, or nearly ready, for review before onchain deployment.

It mirrors the proposed corpus tree:

```text
01-pitch-materials/
  Single-terminal `pitch_midi` materials.

02-rhythm-materials/
  Single-terminal `onset_tick` and `duration_tick` materials.

03-expression-materials/
  Single-terminal `velocity_midi` materials and future expressive/notation scalars.

04-product-tables/
  MusicXML/MIDI-compatible note tables that combine reusable materials.
```

Read before editing:

```text
../00-start-here/system-principles.md
../00-start-here/deployable-connector-recipes.md
../00-start-here/connector-tree-notation.md
../02-corpus/00-overview/readiness-matrix.md
../02-corpus/00-overview/operational-deployability-review.md
../corpus-tree.md
```

## Promotion Rule

After deployment, move the deployed concept into:

```text
../01-deployed-graph/pitch-materials.md
../01-deployed-graph/onset-materials.md
../01-deployed-graph/duration-materials.md
../01-deployed-graph/note-tables.md
../01-deployed-graph/dependency-graph.md
```

Keep the candidate folder only if it still documents useful draft reasoning.
