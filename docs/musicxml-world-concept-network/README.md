# MusicXML World Concept Network

This folder documents the musical concept graph being built for the MusicXML World.

The structure is intentionally navigable from the filesystem. Read it in numeric order:

```text
00-start-here/
  Core principles, notation, documentation map, and concept-node template.

01-deployed-graph/
  What already exists onchain and should be reused as curated vocabulary.

02-corpus/
  Exploratory taxonomy and research workspace, grouped by musical domain.

03-deploy-candidates/
  Exact candidate specs that can be reviewed before deployment.

corpus-tree.md
  Top-level tree of the current proposed corpus, including deployed,
  candidate, proposed, and missing areas.
```

The graph is not a universal coordinate compiler over every possible connector tree. It is a growing deployed/deployable network of reusable musical concepts.

## Reading Order

```text
00-start-here/system-principles.md
  Core PT/DCN connector ontology, circular transformation semantics, RI rules,
  product/material distinctions, and red flags.

00-start-here/deployable-connector-recipes.md
  Concrete deployable recipes for scalar streams, value cycles, onset rhythms,
  product tables, chord products, wrappers, and condition-gated connectors.

../musicxml-world-format-contract.md
  Active MusicXML World compatibility and rendering contract.

00-start-here/documentation-map.md
  Detailed map of active, historical, exploratory, and adjacent docs.

corpus-tree.md
  Bird's-eye view of the whole corpus and what is still missing.

01-deployed-graph/dependency-graph.md
  Current deployed curated graph.

02-corpus/README.md
  Research workspace and precision levels.

02-corpus/00-overview/readiness-matrix.md
  Bridge from broad taxonomy to deployable or blocked candidates.

02-corpus/00-overview/operational-deployability-review.md
  Corpus-wide operational review from the connector/transformation/condition
  level.

03-deploy-candidates/README.md
  Exact pre-deployment specs.
```

## Intended Workflow

```text
musical concept
  -> corpus taxonomy
  -> readiness classification
  -> exact deploy-candidate spec
  -> deploy onchain
  -> deployed graph documentation
  -> reuse in higher-level concepts
```

## Current Scope

This network currently documents:

```text
terminal scalars
onset materials
duration materials
pitch materials
MusicXML-compatible note tables
superseded deployed artifacts
deploy candidates for the next material/product layer
```

## Concept Network Rules

1. A concept node should only claim runtime dependencies that are actually used in its connector tree.
2. Named rotations, modes, phases, transpositions, and fixed starts should be RI metadata before they become separate connectors.
3. Higher-level concepts should reuse lower-level connectors instead of copying their transformation sequences.
4. A connector can be musically meaningful without being directly MusicXML-compatible. MusicXML compatibility belongs to product nodes whose terminal scalar set satisfies the world contract.
5. Superseded connectors remain onchain, but the docs must mark them clearly so future composition connectors do not depend on them by mistake.

## Deployment Status Values

Use these status labels:

```text
deployed-curated
  Onchain and recommended for reuse.

deployed-superseded
  Onchain but not recommended for curated reuse.

draft
  Conceptually useful but not yet deployable.

deploy-candidate
  Exact tree is documented and ready for review/deployment.
```
