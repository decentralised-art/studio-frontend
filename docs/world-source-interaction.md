# Optional World source interaction

Studio provides an optional `interaction` object in the canonical World SDK state payload. It is independent of a World's rendering, audio and execution behavior. Worlds that ignore it continue to work. No backend or SDK release is needed.

```ts
interaction: {
  protocolVersion: 1,
  revision: "opaque-realization-id",
  sources: [{
    occurrenceId: "opaque-source-id",
    nodeId: "host-node-id",
    connectorName: "arbitrary_name",
    pathPrefix: "/composition:1/arbitrary_name:*"
  }],
  selectedOccurrenceIds: ["opaque-source-id"]
}
```

Each source is an occurrence in the connected graph that contributes to the World’s current streams. Match stream paths by slash-delimited segments. A final `name:*` segment matches that connector's dimension indices. Names alone do not identify an occurrence: the same connector can be used in different branches. Only sources associated with the World’s connected output are offered.

When Studio selection changes, the revision remains stable and `selectedOccurrenceIds` changes. Worlds should update their highlighting without rerendering their data or restarting audio. Selecting a connector includes its dependent children. A new result or changed source graph gets a new revision.

A World can report a source selection using this optional message alongside its unchanged canonical SDK runtime:

```js
parent.postMessage(
  {
    type: "decentralised.art:world-source-selection",
    protocolVersion: 1,
    worldId: sdk.worldId,
    channelToken: new URLSearchParams(location.search).get("worldChannel"),
    revision: state.payload.interaction.revision,
    occurrenceIds: ["opaque-source-id"],
  },
  "*",
);
```

Use only IDs supplied in the current interaction context. An empty array clears selection. Studio checks the mounted iframe window, opaque origin, the canonical per-mount channel token, SDK World identity, current revision and offered IDs. It never accepts arbitrary node IDs or connector names from a World. Stale messages are ignored. Reporting selection changes no connector definitions, RI, simulation, publication or execution state.

Score uses the deepest common source occurrence of a note/rest collection for note clicks. Its notation IDs retain the mapping through ties and simplified measure rests. Clicking a note highlights that occurrence and its dependents in the graph; clicking a connector highlights all notes to which it contributes. Native graph selection remains on the chosen connector, so descendant highlighting does not create a bulk edit or deletion selection.
