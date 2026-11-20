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

Studio opens a publication review for the selected saved entity. It resolves the full draft dependency graph through the Chain API before opening a transaction confirmation. Conditions, transformations, composites and bindings are part of the graph. Shared references are counted once by kind and registry name, and parents follow their dependencies. A verified published entity is a boundary. Its existing on-chain definition is reused, including when it belongs to someone else. Missing definitions, cycles, and unpublished dependencies owned by another wallet stop preflight before it sends any transaction.

### Pricing and running the queue

The review separates registered dependencies, recorded receipts, and remaining writes. It asks the existing prepare endpoint for items whose dependencies can already be used on-chain. A priced item shows the prepared gas limit multiplied by the wallet's current gas price on the target chain. The displayed sum covers the named subset. An ancestor whose prerequisites are still drafts is listed as unpriced. Fee estimates change with the market, and MetaMask shows the fee for the actual transaction it submits. If a ready item cannot be prepared, Studio shows the reason and asks for a fresh review.

During publication Studio prepares each write again inside the owner-and-API scoped lock, checks the selected wallet and chain, and waits for the receipt before advancing. Pause stops at the next safe boundary. During an open wallet prompt or receipt check the current item can finish, and no later item is sent. Switching accounts stops the queue. A review for a different wallet uses a different publication journal.

### Resuming after interruption

Studio saves the transaction hash before requesting confirmation. If the API call is interrupted, a fresh review checks the existing hash even when the by-name lookup has already caught up. If the wallet response was interrupted before providing a hash, Studio asks the API whether the exact artifact is registered, and uses the existing hash recovery control if the result is still ambiguous. The owner-wide nonce also blocks a different queue while an unresolved send is recorded. A mined result can precede index or safe-block readiness. Keep the receipt and retry the read when the chain is ready. The library and Execute continue to use their normal published-state checks.

### Wallet batching

The current prepare endpoint requires dependencies to be registered, derives the address using the current owner publication nonce, and returns one transaction. Giving independently prepared calls to a wallet batch would reuse that nonce. The current receipt verifier expects one matching registration, so it also needs to understand multiple registrations before Studio can use an atomic batch.

A batch-capable Chain API would need to plan exact content hashes and ordered nonces, estimate each batch against the state built by its prerequisites, split large trees into viable groups, and verify the registration events individually. Studio could then check the selected wallet and chain for EIP-5792 capabilities and request approval for a prepared batch. A plan should keep confirmed items and unmined or rejected batches visible so a large job can still resume. The frontend review uses the current per-entity wallet path and estimates the remaining writes it can prepare.

## Verification scenarios

- Anonymous, owner A and owner B see the same verified published library; only the currently authenticated owner sees their LOCAL drafts. Logout, account switches and delayed async responses must not retain another owner's draft entries.
- A feed entry whose detail address is `0x0`, missing or invalid does not enable Execute or appear as published. A known owner draft does not require a feed entry or local browser publication receipt to enable Publish.
- Opening Score, replacing its starter with an owned draft, and attaching that draft targets the same definition for rendering, simulation and publication.
- Deleting a new project's initial connector leaves an empty workspace, including after reload. Adding another connector preserves its name and registry identity. Orphan edges and dimension nodes are cleaned up.
- Multiple unconnected roots require a valid selection or unique World attachment; an arbitrary array position cannot choose what is executed.
- A saved draft remains simulatable and publishable by its owner when opened from LOCAL or added to a World workspace. Published definitions remain usable by everyone without implying editable definitions.
- Publication covers all dependency types, foreign-owned unpublished dependencies, cycles, wallet rejection, account/network changes, pending recovery and mined-but-not-safe execution delays.
