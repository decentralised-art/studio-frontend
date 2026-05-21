# MusicXML World Documentation Map

This file explains where MusicXML World and musical-corpus knowledge lives.

Use it to avoid scattering future planning across older drafts.

## Canonical Reading Order

```text
1. ../README.md
   Folder-level map.

2. system-principles.md
   Core PT/DCN connector ontology, circularity, RI semantics, product/material
   rules, and red flags.

3. deployable-connector-recipes.md
   Operational recipes that every P3/P4 concept must reduce to before
   deployment.

4. ../../musicxml-world-format-contract.md
   Active world compatibility and rendering contract.

5. concept-node-template.md
   Required structure for documenting concept nodes.

6. connector-tree-notation.md
   Compact notation for exact connector trees and RI roles.

7. ../01-deployed-graph/dependency-graph.md
   Current deployed curated graph.

8. ../corpus-tree.md
   Bird's-eye tree of the whole proposed corpus.

9. ../02-corpus/README.md
   Active exploratory corpus workspace.

10. ../02-corpus/00-overview/readiness-matrix.md
   Bridge from corpus to deployable/blocked candidates.

11. ../02-corpus/00-overview/operational-deployability-review.md
   Corpus-wide connector/transformation/condition-level viability review.

12. ../03-deploy-candidates/README.md
   Exact pre-deployment candidate specs.
```

## Folder Structure

```text
00-start-here/
  README.md
  system-principles.md
  deployable-connector-recipes.md
  documentation-map.md
  concept-node-template.md
  connector-tree-notation.md

01-deployed-graph/
  README.md
  terminal-scalars.md
  onset-materials.md
  duration-materials.md
  pitch-materials.md
  note-tables.md
  dependency-graph.md
  superseded-artifacts.md

02-corpus/
  README.md
  00-overview/
  01-operations/
  02-pitch/
  03-rhythm/
  04-expression/
  05-composition/
  06-research-passes/

03-deploy-candidates/
  README.md
  01-pitch-materials/
  02-rhythm-materials/
  03-expression-materials/
  04-product-tables/

corpus-tree.md
  Whole-corpus tree and missing-area map.
```

## Active Top-Level Contract

```text
../../musicxml-world-format-contract.md
```

This is the active implementation contract for MusicXML World compatibility:

```text
format scalar metadata
required/accepted terminal scalar sets
row/path grouping
world value limits
optional score tables
implementation notes
```

It supersedes positional-schema discovery for the current MusicXML World.

## Historical Docs

```text
../../musicxml-world-musical-vocabulary-plan.md
```

First deployment/vocabulary planning document. It contains important history and the first deployed batch narrative, but new planning should happen through:

```text
00-start-here/
01-deployed-graph/
02-corpus/
03-deploy-candidates/
```

```text
../../studio-circular-material-connector-spec.md
```

Useful proposal for a Shepard-like circular material connector and a clear explanation of PT circular execution. Its durable system rules have been folded into `system-principles.md`.

```text
../../studio-music-score-position-schema.md
```

Older positional Music Score schema. It remains useful historical context for Studio/score interpretation, but current MusicXML World discovery is format/scalar based.

The previous `../../musicxml-world-taxonomy/` folder was removed after useful material was migrated into this active concept network.

## Adjacent But Separate Docs

These are related product/architecture docs, not musical-corpus source-of-truth:

```text
../../worlds-gallery-architecture.md
../../worlds-mvp-loop-checklist.md
../../shepard-pt-worlding-roadmap.md
../../studio-coordinate-explorer-spec.md
../../studio-toolbox-cartographer-spec.md
../../chain-format-ux-contract.md
```

Use them for product, UX, and world architecture. Do not use them to override connector ontology or MusicXML corpus rules.

## Where New Work Should Go

```text
New protocol/circularity rule
  -> 00-start-here/system-principles.md

New deployability recipe
  -> 00-start-here/deployable-connector-recipes.md

New MusicXML compatibility/rendering rule
  -> ../../musicxml-world-format-contract.md

New deployed connector documentation
  -> 01-deployed-graph/

New musical concept taxonomy
  -> 02-corpus/domain folder

New exploratory pass
  -> 02-corpus/06-research-passes/research-pass-00N.md

New reviewed deploy candidate
  -> 03-deploy-candidates/
```
