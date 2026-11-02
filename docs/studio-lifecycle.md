# Studio workspaces and connector lifecycle

A Studio workspace is a mutable collection of connector instances, Worlds and links. A connector definition is a separate protocol entity. Removing or reconnecting an instance does not modify or remove its saved definition. Changing N or dynamic RI supplies run parameters; it does not create another definition.

The Chain API separates creating a server-local draft, simulation, owner-paid publication and reading published state. Studio follows those boundaries and derives actions from the current connector definition's verified address and owner. Feed membership, a tab label, a library category or an old transaction receipt cannot establish that a particular current definition is published.

## State and actions

| Current connector state           | Frontend visibility                             | Create locally   | Simulate              | Publish                    | Execute     |
| --------------------------------- | ----------------------------------------------- | ---------------- | --------------------- | -------------------------- | ----------- |
| No connector selected             | Workspace only                                  | No               | No                    | No                         | No          |
| Unsaved browser graph             | Current browser workspace                       | Sign-in required | Save first            | Save first                 | No          |
| Saved own draft, address `0x0`    | Signed-in owner's LOCAL library                 | Already saved    | Yes, no gas           | Owner wallet; gas required | No          |
| Another owner's unpublished draft | Omitted from public and other-account libraries | No               | Unavailable in Studio | No                         | No          |
| Published, nonzero address        | Public NETWORK and saved toolbox                | Already saved    | Yes, no gas           | Already published          | Yes, no gas |

Server-local drafts are not confidential storage: the current API exposes their definitions and permits anonymous simulation. Studio's owner-specific discovery policy must not be described as backend access control. The draft owner controls publication. Published execution is an anonymous, gas-free view read; authentication is required to create or publish, not to read published output.

Saved definitions are immutable. Reusing a saved draft in a workspace must preserve its registry identity. To change its definition, compose a new browser draft with a new valid name. Removing a connector instance, its contained presentation nodes and its workspace links remains reversible workspace editing.

## Resolving the active connector

`resolveStudioWorkspaceRoot` returns existing nodes without mutating, renaming or inventing them. Top-level candidates are connectors with no enclosing connector in ordinary connector-to-connector or connector-to-dimension-to-connector hierarchy. World links are attachments and do not make either endpoint a hierarchy parent.

The priority is:

1. An explicitly requested existing top-level connector, identified by node ID or unique registry name.
2. A unique top-level connector attached to a World. If the World links to a child connector, walk its enclosing hierarchy to the outer root.
3. A unique existing `tabRoot` that is still top-level.
4. The only remaining top-level candidate.

Several unrelated candidates without a preference return no root and report ambiguity. A cyclic connector hierarchy also cannot supply a runnable root. An empty workspace stays empty. Deleting an initial connector must not cause a reactive effect or session restoration to recreate it.

Display, run settings, Create, Publish, simulation and execution must share the same resolved root. Removing or replacing that root invalidates its cached run output and provenance. A stale connector tree model or tab `particleId` must not resurrect the removed root or override the workspace selection.

## Creating the selected definition

`collectStudioWorkspaceRootGraph` isolates the selected connector, its child connectors, owned dimensions and attached conditions. World attachments and unrelated workspace roots stay outside that scope. Create locally saves only the chosen definition and its required local dependencies, preserving dependency order. Unconnected unfinished drafts do not block that action or become immutable as a side effect. Hydration, draft compilation and creation planning use the same scope; unused standalone transformation sources are excluded from connector creation.

Successful creation preserves existing instance IDs, World connections and unrelated workspace content. Saved connector and condition instances become immutable references, their owned dimensions become read-only and saved transformation instances adopt network status. This does not imply publication. The original run-root instance remains selected and can be simulated or published by its owner.

## Removing workspace instances

`canRemoveStudioWorkspaceNode` separates deleting a reference from changing a saved definition. Worlds, browser connectors and top-level saved connector instances are removable. A saved connector referenced by a browser draft can also be detached. A child connector, dimension or attached condition inside a saved connector definition remains protected because deleting it independently would contradict that immutable definition.

`collectStudioWorkspaceRemovalIds` expands a removed saved connector into its projected descendant instances, owned dimensions and attached conditions. Removing a browser draft cleans up its owned dimensions and attached conditions while leaving referenced connector instances available for reuse or a new root selection. The caller removes incident edges and invalidates stale run output. Plugin attachments do not create ownership or cause deletion of their connected connectors.

## Publication and provenance

Publication uses the existing persistent publication records and owner/API-scoped locks. Conditions, transformations, composite connectors and bound connectors are published before their parent, serially for one owner. An unpublished dependency owned by another account blocks publication with an explanation; it cannot be published using the current account. Cycles are rejected.

A sending or pending transaction is resumed or confirmed using its recorded hash. Retrying does not authorize broadcasting another transaction. A mined transaction may precede safe-block execution or indexer readiness. Keep simulation distinct from chain execution and retain the latter's block number, block hash, runner and registry envelope. Retry a temporarily unavailable execution rather than republishing.

## Verification scenarios

- Anonymous, owner A and owner B see the same verified published library; only the currently authenticated owner sees their LOCAL drafts. Logout, account switches and delayed async responses must not retain another owner's draft entries.
- A feed entry whose detail address is `0x0`, missing or invalid does not enable Execute or appear as published. A known owner draft does not require a feed entry or local browser publication receipt to enable Publish.
- Opening Score, replacing its starter with an owned draft, and attaching that draft targets the same definition for rendering, simulation and publication.
- Deleting a new project's initial connector leaves an empty workspace, including after reload. Adding another connector preserves its name and registry identity. Orphan edges and dimension nodes are cleaned up.
- Multiple unconnected roots require a valid selection or unique World attachment; an arbitrary array position cannot choose what is executed.
- A saved draft remains simulatable and publishable by its owner when opened from LOCAL or added to a World workspace. Published definitions remain usable by everyone without implying editable definitions.
- Publication covers all dependency types, foreign-owned unpublished dependencies, cycles, wallet rejection, account/network changes, pending recovery and mined-but-not-safe execution delays.
