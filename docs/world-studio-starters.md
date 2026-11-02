# World-owned Studio starter flows

A World may include an optional `studio-starter.json` at the root of its ZIP bundle. Studio discovers it through the ordinary public World asset route. No manifest extension, backend release, authentication or World-specific frontend branch is required. Worlds without this file keep the existing launch behavior. A present but invalid file produces a launch error instead of silently substituting content.

```json
{
  "schemaVersion": 1,
  "connector": "your_published_connector",
  "particlesCount": 12,
  "dynamicRi": {
    "0": { "start_point": 60, "transformation_shift": 0 }
  },
  "simulate": true
}
```

`connector` names an existing published network connector. Studio uses its normal registry hydration and connector-tree graph builder, including composite/binding descendants. Definitions are fetched from the platform rather than embedded or recreated by the World. `dynamicRi` is keyed by standard RI positions; omitted positions retain their connector defaults. Static network RIs keep their existing locking rules. `particlesCount` must be an integer between 1 and 10,000. RI coordinates must be safe integers and shifts nonnegative. `simulate` defaults to false; setting it to true requests the existing anonymous server simulation after the normal World attachment. It never requests execution, publication or entity creation.

Opening from the World gallery creates a separate browser tab. The starter is loaded into an editable World workspace, with the World attached using Studio's existing compatibility and connection helpers. There is no fabricated composition connector. World workspaces allow deleting every node, including the active root, without recreating a placeholder root. A newly added connector can become the root through the same root-selection logic. Ordinary connector-authoring tabs retain their protected root. Execution, authentication, save and publication behavior are unchanged.

Authenticated sessions retain the World workspace identity alongside the existing graph snapshots. Reload reuses the edited graph and refreshes its simulation, preserving RI edits and deletions. Anonymous reload restarts from the bundle because anonymous sessions use Studio's existing nonpersistent behavior. Explicit `network_kind=connector&network_id=...` links take precedence over starter content.

The bundle owns all connector names, RI values and preview settings. Studio implements only this generic loader. Deploying a new starter requires updating the World bundle; the generic host support must also be deployed before production can use it.
