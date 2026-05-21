# Concept Node Template

Use this template for every reusable musical concept in the network.

```text
Name:
Status:
Precision:
Complexity:
Musical role:
World ownership:
Terminal scalar(s):
Format hash:
Owner:
Dependencies:
Connector tree:
Open RI:
Static RI:
Equivalent concepts represented by RI:
Relations:
Smoke test:
Reuse examples:
Notes:
```

## Field Definitions

`Name`

The deployed connector name or proposed connector name.

`Status`

One of:

```text
deployed-curated
deployed-superseded
draft
deploy-candidate
```

`Precision`

Use the corpus precision levels:

```text
P0 reference
P1 taxonomy node
P2 connector archetype
P3 deploy candidate
P4 deployed curated
P5 superseded
```

`Complexity`

Use:

```text
C0 terminal scalar
C1 single repeated operation
C2 cyclic grammar
C3 product table
C4 nested product / texture
C5 score/form root
```

`Musical role`

Plain-language meaning of the concept, such as "quarter-note onset grid" or "diatonic heptatonic pitch grammar."

`World ownership`

Use `world-agnostic` unless the connector only makes sense inside one specific world.

`Terminal scalar(s)`

Terminal scalars exposed through the full connector tree, such as:

```text
onset_tick
duration_tick
pitch_midi
velocity_midi
```

`Format hash`

The DCN format hash returned by deployment, when known.

`Owner`

The deployment owner reported by DCN.

`Dependencies`

Other connectors or transformations required by this node.

`Connector tree`

Tree using the notation from `connector-tree-notation.md`.

`Open RI`

Runtime-controlled RI positions and their meaning.

`Static RI`

Locked RI positions and their meaning.

`Equivalent concepts represented by RI`

Named concepts that should not be separate connectors because they are represented by shifts, starts, or traversal length.

`Relations`

Use explicit relation fields when known:

```text
depends_on
product_of
wraps
rotation_of
transposition_of
inversion_of
complement_of
augmentation_of
diminution_of
conceptual_ancestor
compatible_worlds
```

`Smoke test`

Small execution used to verify behavior.

`Reuse examples`

Higher-level concept nodes that already use or should use this node.

`Notes`

Any caveats, especially live protocol behavior discovered during deployment.
