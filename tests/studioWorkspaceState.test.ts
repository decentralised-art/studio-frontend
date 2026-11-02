import { describe, expect, it } from "vitest";

import {
  canRemoveStudioWorkspaceNode,
  collectStudioWorkspaceRemovalIds,
  collectStudioWorkspaceRootGraph,
  getStudioWorkspaceConnectorName,
  resolveStudioWorkspaceCapabilities,
  resolveStudioWorkspaceRoot,
  type StudioWorkspaceNode,
} from "../src/lib/studio/workspaceState";

const owner = "0x1234567890123456789012345678901234567890";
const otherOwner = "0x2234567890123456789012345678901234567890";
const publishedAddress = "0x3334567890123456789012345678901234567890";
const node = (id: string, data: StudioWorkspaceNode["data"] = {}): StudioWorkspaceNode => ({
  id,
  data: { kind: "connector", label: id, ...data },
});
const edge = (source: string, target: string) => ({ source, target });

const choose = (
  nodes: StudioWorkspaceNode[],
  edges: { source: string; target: string }[] = [],
  options: { requestedRootId?: string; requestedRootName?: string } = {},
) => resolveStudioWorkspaceRoot({ nodes, edges, ...options });

describe("Studio workspace root selection", () => {
  it("leaves empty and World-only workspaces empty", () => {
    expect(choose([])).toEqual({ root: null, candidates: [], ambiguous: false });
    expect(choose([node("world", { kind: "plugin" })])).toEqual({
      root: null,
      candidates: [],
      ambiguous: false,
    });
  });

  it("selects the sole connector without changing its identity", () => {
    const root = node("pitch", { networkId: "pitch", fromNetwork: true });
    Object.freeze(root.data);
    Object.freeze(root);
    expect(choose([root]).root).toBe(root);
    expect(root.data).toEqual({
      kind: "connector",
      label: "pitch",
      networkId: "pitch",
      fromNetwork: true,
    });
  });

  it("excludes direct children and dimension children from root candidates", () => {
    const root = node("composition");
    const dimension = node("dimension", { kind: "dimension" });
    const child = node("notes");
    const leaf = node("pitch", { kind: "feature" });
    const result = choose(
      [root, dimension, child, leaf],
      [edge(root.id, dimension.id), edge(dimension.id, child.id), edge(child.id, leaf.id)],
    );
    expect(result.root).toBe(root);
    expect(result.candidates).toEqual([root]);
  });

  it("uses a dimension's owner metadata when the presentation edge is absent", () => {
    const root = node("score");
    const dimension = node("dimension", { kind: "dimension", parentFeatureId: root.id });
    expect(
      choose([root, dimension, node("pitch")], [edge(dimension.id, "pitch")]).candidates,
    ).toEqual([root]);
  });

  it("does not interpret condition or World links as connector hierarchy", () => {
    const root = node("pitch");
    const world = node("world", { kind: "plugin" });
    const condition = node("condition", { kind: "condition" });
    expect(
      choose([root, world, condition], [edge(world.id, root.id), edge(condition.id, root.id)]),
    ).toEqual({ root, candidates: [root], ambiguous: false });
  });

  it("honors a requested valid root before World attachment or a previous tab root", () => {
    const first = node("first", { tabRoot: true });
    const next = node("next");
    const world = node("world", { kind: "plugin" });
    expect(
      choose([first, next, world], [edge(world.id, first.id)], { requestedRootId: next.id }).root,
    ).toBe(next);
  });

  it("accepts a unique requested registry name and ignores a missing selection", () => {
    const root = node("node-1", { networkId: "score_study_v2" });
    const another = node("node-2", { tabRoot: true });
    expect(choose([root, another], [], { requestedRootName: "score_study_v2" }).root).toBe(root);
    expect(choose([root, another], [], { requestedRootId: "removed" }).root).toBe(another);
  });

  it("does not select an explicitly requested child as a root", () => {
    const root = node("score");
    expect(
      choose([root, node("pitch")], [edge(root.id, "pitch")], { requestedRootId: "pitch" }).root,
    ).toBe(root);
  });

  it("selects a World-attached root before a detached previous tab root", () => {
    const previous = node("pitch", { tabRoot: true });
    const score = node("score_study_v2");
    const world = node("score-world", { kind: "plugin" });
    expect(choose([previous, score, world], [edge(world.id, score.id)]).root).toBe(score);
    expect(choose([previous, score, world], [edge(score.id, world.id)]).root).toBe(score);
  });

  it("walks a World-attached descendant through dimensions to its outer root", () => {
    const outer = node("composition");
    const dimension = node("dimension", { kind: "dimension" });
    const child = node("notes", { tabRoot: true });
    const world = node("world", { kind: "plugin" });
    expect(
      choose(
        [outer, dimension, child, world, node("unrelated")],
        [edge(outer.id, dimension.id), edge(dimension.id, child.id), edge(world.id, child.id)],
      ).root,
    ).toBe(outer);
  });

  it("treats several Worlds attached to the same root as one choice", () => {
    const root = node("score");
    const one = node("one", { kind: "plugin" });
    const two = node("two", { kind: "plugin" });
    expect(
      choose([root, one, two, node("unused")], [edge(one.id, root.id), edge(two.id, root.id)]).root,
    ).toBe(root);
  });

  it("requires selection when multiple unrelated roots have no preference", () => {
    const roots = [node("one"), node("two")];
    expect(choose(roots)).toEqual({ root: null, candidates: roots, ambiguous: true });
    expect(choose(roots.slice(1))).toEqual({
      root: roots[1],
      candidates: [roots[1]],
      ambiguous: false,
    });
  });

  it("falls back to a valid marked root when multiple Worlds target different roots", () => {
    const first = node("first", { tabRoot: true });
    const second = node("second");
    const world = node("world", { kind: "plugin" });
    const world2 = node("world2", { kind: "plugin" });
    const nodes = [first, second, world, world2];
    const edges = [edge(world.id, first.id), edge(world2.id, second.id)];
    expect(choose(nodes, edges).root).toBe(first);
    first.data.tabRoot = false;
    expect(choose(nodes, edges).ambiguous).toBe(true);
  });

  it("does not use a duplicate requested name or multiple tab root markers to break ambiguity", () => {
    const nodes = [
      node("one", { label: "same", tabRoot: true }),
      node("two", { label: "same", tabRoot: true }),
    ];
    expect(choose(nodes, [], { requestedRootName: "same" }).root).toBeNull();
    expect(choose(nodes).ambiguous).toBe(true);
  });

  it("does not hang or invent a root for cyclic hierarchy", () => {
    const world = node("world", { kind: "plugin" });
    const result = choose(
      [node("one"), node("two"), world],
      [edge("one", "two"), edge("two", "one"), edge(world.id, "one")],
    );
    expect(result).toEqual({ root: null, candidates: [], ambiguous: true });
  });

  it("ignores dangling edges after removing a root", () => {
    const remaining = node("replacement");
    expect(
      choose([remaining], [edge("deleted", remaining.id)], { requestedRootId: "deleted" }).root,
    ).toBe(remaining);
  });

  it("resolves registry identity before presentation labels", () => {
    expect(
      getStudioWorkspaceConnectorName(node("one", { networkId: " pitch ", particleId: "time" })),
    ).toBe("pitch");
    expect(getStudioWorkspaceConnectorName(node("one", { particleId: " time " }))).toBe("time");
    expect(getStudioWorkspaceConnectorName(node("one", { label: " notes " }))).toBe("notes");
  });
});

describe("Studio workspace lifecycle capabilities", () => {
  const savedRoot = node("score", { fromNetwork: true });
  const capabilities = (
    connector: { chainAddress?: unknown; ownerAddress?: unknown },
    currentOwner = owner,
    root: StudioWorkspaceNode | null = savedRoot,
  ) => resolveStudioWorkspaceCapabilities({ root, connector, currentOwner });

  it("disables all actions without an active connector", () => {
    expect(capabilities({ chainAddress: publishedAddress }, owner, null)).toEqual({
      state: "empty",
      canCreate: false,
      canSimulate: false,
      canPublish: false,
      canExecute: false,
    });
  });

  it("makes an unsaved browser graph Create-only even if its label matches an existing entity", () => {
    expect(capabilities({ chainAddress: publishedAddress }, owner, node("score"))).toEqual({
      state: "browser-draft",
      canCreate: true,
      canSimulate: false,
      canPublish: false,
      canExecute: false,
    });
  });

  it.each(["0x0", `0x${"0".repeat(40)}`])(
    "allows owner simulation and publication for saved draft %s",
    (chainAddress) => {
      expect(capabilities({ chainAddress, ownerAddress: owner.toUpperCase() })).toEqual({
        state: "saved-owned-draft",
        canCreate: false,
        canSimulate: true,
        canPublish: true,
        canExecute: false,
      });
    },
  );

  it.each(["", otherOwner, "current-user"])(
    "makes a local draft unavailable to wallet '%s'",
    (currentOwner) => {
      expect(capabilities({ chainAddress: "0x0", ownerAddress: owner }, currentOwner)).toEqual({
        state: "unavailable",
        canCreate: false,
        canSimulate: false,
        canPublish: false,
        canExecute: false,
      });
    },
  );

  it.each(["", owner, otherOwner])(
    "allows public simulation and execution for wallet '%s'",
    (currentOwner) => {
      expect(
        capabilities({ chainAddress: publishedAddress, ownerAddress: owner }, currentOwner),
      ).toEqual({
        state: "published",
        canCreate: false,
        canSimulate: true,
        canPublish: false,
        canExecute: true,
      });
    },
  );

  it.each([undefined, "", "0x123", "not-an-address"])(
    "never infers publication from missing or invalid address %s",
    (chainAddress) => {
      expect(capabilities({ chainAddress, ownerAddress: owner }).state).toBe("unavailable");
    },
  );

  it("does not treat the zero owner as an authenticated draft owner", () => {
    expect(
      capabilities(
        { chainAddress: "0x0", ownerAddress: `0x${"0".repeat(40)}` },
        `0x${"0".repeat(40)}`,
      ).canPublish,
    ).toBe(false);
  });
});

describe("Studio workspace instance removal", () => {
  const saved = node("saved", { fromNetwork: true });
  const browser = node("browser");
  const dimension = node("dimension", { kind: "dimension", parentFeatureId: saved.id });
  const child = node("child", { fromNetwork: true });
  const childDimension = node("child-dimension", { kind: "dimension", parentFeatureId: child.id });
  const leaf = node("pitch", { fromNetwork: true });
  const condition = node("condition", { kind: "condition", fromNetwork: true });
  const world = node("world", { kind: "plugin" });
  const graph = {
    nodes: [saved, browser, dimension, child, childDimension, leaf, condition, world],
    edges: [
      edge(saved.id, dimension.id),
      edge(dimension.id, child.id),
      edge(child.id, childDimension.id),
      edge(childDimension.id, leaf.id),
      edge(condition.id, saved.id),
      edge(world.id, child.id),
    ],
  };

  it("allows removing top-level saved and browser connector instances", () => {
    expect(canRemoveStudioWorkspaceNode({ ...graph, node: saved })).toBe(true);
    expect(canRemoveStudioWorkspaceNode({ ...graph, node: browser })).toBe(true);
  });

  it("protects child connectors and dimensions belonging to a saved definition", () => {
    for (const selected of [dimension, child, childDimension, leaf])
      expect(canRemoveStudioWorkspaceNode({ ...graph, node: selected })).toBe(false);
  });

  it("protects an attached condition belonging to a saved definition", () => {
    expect(canRemoveStudioWorkspaceNode({ ...graph, node: condition })).toBe(false);
  });

  it("allows World removal even when it is attached to a protected child", () => {
    expect(canRemoveStudioWorkspaceNode({ ...graph, node: world })).toBe(true);
    expect(collectStudioWorkspaceRemovalIds({ ...graph, nodeIds: [world.id] })).toEqual(
      new Set([world.id]),
    );
  });

  it("allows detaching a saved connector referenced by a browser draft", () => {
    const browserDimension = node("browser-dimension", {
      kind: "dimension",
      parentFeatureId: browser.id,
    });
    const nested = {
      nodes: [...graph.nodes, browserDimension],
      edges: [
        ...graph.edges,
        edge(browser.id, browserDimension.id),
        edge(browserDimension.id, saved.id),
      ],
    };
    expect(canRemoveStudioWorkspaceNode({ ...nested, node: saved })).toBe(true);
    expect(canRemoveStudioWorkspaceNode({ ...nested, node: child })).toBe(false);
  });

  it("protects browser-shaped children nested inside a saved ancestor", () => {
    const temporaryChild = node("temporary-child");
    const nested = {
      nodes: [...graph.nodes, temporaryChild],
      edges: [...graph.edges, edge(child.id, temporaryChild.id)],
    };
    expect(canRemoveStudioWorkspaceNode({ ...nested, node: temporaryChild })).toBe(false);
  });

  it("removes the saved instance's full projected tree and attached condition", () => {
    expect(collectStudioWorkspaceRemovalIds({ ...graph, nodeIds: [saved.id] })).toEqual(
      new Set([saved.id, dimension.id, child.id, childDimension.id, leaf.id, condition.id]),
    );
  });

  it("does not remove protected children independently or include stale selected IDs", () => {
    expect(
      collectStudioWorkspaceRemovalIds({
        ...graph,
        nodeIds: [child.id, dimension.id, condition.id, "removed"],
      }),
    ).toEqual(new Set());
  });

  it("removes owned browser dimensions while keeping referenced connectors reusable", () => {
    const browserDimension = node("browser-dimension", {
      kind: "dimension",
      parentFeatureId: browser.id,
    });
    const nested = {
      nodes: [...graph.nodes, browserDimension],
      edges: [
        ...graph.edges,
        edge(browser.id, browserDimension.id),
        edge(browserDimension.id, saved.id),
      ],
    };
    expect(collectStudioWorkspaceRemovalIds({ ...nested, nodeIds: [browser.id] })).toEqual(
      new Set([browser.id, browserDimension.id]),
    );
  });

  it("cleans up a hidden condition attached only to a deleted browser connector", () => {
    const browserCondition = node("browser-condition", { kind: "condition" });
    const nested = {
      nodes: [browser, browserCondition],
      edges: [edge(browserCondition.id, browser.id)],
    };
    expect(canRemoveStudioWorkspaceNode({ ...nested, node: browserCondition })).toBe(true);
    expect(collectStudioWorkspaceRemovalIds({ ...nested, nodeIds: [browser.id] })).toEqual(
      new Set([browser.id, browserCondition.id]),
    );
  });

  it("recognizes a direct immutable parent and dimension ownership without presentation edges", () => {
    const direct = { nodes: [saved, child, dimension], edges: [edge(saved.id, child.id)] };
    expect(canRemoveStudioWorkspaceNode({ ...direct, node: child })).toBe(false);
    expect(canRemoveStudioWorkspaceNode({ ...direct, node: dimension })).toBe(false);
    expect(collectStudioWorkspaceRemovalIds({ ...direct, nodeIds: [saved.id] })).toEqual(
      new Set([saved.id, child.id, dimension.id]),
    );
  });

  it("combines multiple removable selections without changing the input graph", () => {
    const before = JSON.stringify(graph);
    const ids = collectStudioWorkspaceRemovalIds({
      ...graph,
      nodeIds: [saved.id, browser.id, world.id, saved.id],
    });
    expect(ids).toEqual(new Set(graph.nodes.map((item) => item.id)));
    expect(JSON.stringify(graph)).toBe(before);
  });
});

describe("saved connector placeholder ownership", () => {
  const saved = node("saved", { fromNetwork: true });
  const dimension = node("dimension", { kind: "dimension", parentFeatureId: saved.id });
  const placeholder = node("missing-dependency", { kind: "particle", fromNetwork: true });

  it.each(["connector", "dimension"])(
    "protects and cascades a placeholder under its saved %s",
    (source) => {
      const graph = {
        nodes: [saved, dimension, placeholder],
        edges: [edge(source === "connector" ? saved.id : dimension.id, placeholder.id)],
      };
      expect(canRemoveStudioWorkspaceNode({ ...graph, node: placeholder })).toBe(false);
      expect(collectStudioWorkspaceRemovalIds({ ...graph, nodeIds: [placeholder.id] })).toEqual(
        new Set(),
      );
      expect(collectStudioWorkspaceRemovalIds({ ...graph, nodeIds: [saved.id] })).toEqual(
        new Set([saved.id, dimension.id, placeholder.id]),
      );
      expect(resolveStudioWorkspaceRoot(graph).candidates).toEqual([saved]);
    },
  );

  it("keeps a referenced particle reusable after deleting its browser parent", () => {
    const browser = node("browser");
    const graph = { nodes: [browser, placeholder], edges: [edge(browser.id, placeholder.id)] };
    expect(canRemoveStudioWorkspaceNode({ ...graph, node: placeholder })).toBe(true);
    expect(collectStudioWorkspaceRemovalIds({ ...graph, nodeIds: [browser.id] })).toEqual(
      new Set([browser.id]),
    );
    expect(resolveStudioWorkspaceRoot(graph).root).toBe(browser);
  });

  it("does not make a standalone particle a runnable connector", () => {
    const graph = { nodes: [placeholder], edges: [] };
    expect(canRemoveStudioWorkspaceNode({ ...graph, node: placeholder })).toBe(true);
    expect(resolveStudioWorkspaceRoot(graph)).toEqual({
      root: null,
      candidates: [],
      ambiguous: false,
    });
  });
});

describe("selected connector workspace scope", () => {
  it("collects descendants, owned dimensions and conditions without World attachments or other roots", () => {
    const root = node("root", { tabRoot: true });
    const dimension = node("dimension", { kind: "dimension", parentFeatureId: root.id });
    const child = node("child", { fromNetwork: true });
    const childDimension = node("child-dimension", {
      kind: "dimension",
      parentFeatureId: child.id,
    });
    const condition = node("condition", { kind: "condition" });
    const placeholder = node("placeholder", { kind: "particle", fromNetwork: true });
    const world = node("world", { kind: "plugin" });
    const other = node("other");
    const otherCondition = node("other-condition", { kind: "condition" });
    const edges = [
      edge(root.id, dimension.id),
      edge(dimension.id, child.id),
      edge(child.id, childDimension.id),
      edge(child.id, placeholder.id),
      edge(condition.id, root.id),
      edge(world.id, root.id),
      edge(otherCondition.id, other.id),
    ];
    const graph = {
      nodes: [
        root,
        dimension,
        child,
        childDimension,
        condition,
        placeholder,
        world,
        other,
        otherCondition,
      ],
      edges,
    };
    const before = JSON.stringify(graph);
    const result = collectStudioWorkspaceRootGraph(graph);
    expect(result.root).toBe(root);
    expect(result.nodes).toEqual([root, dimension, child, childDimension, condition, placeholder]);
    expect(result.edges).toEqual(edges.slice(0, 5));
    expect(result.nodes[0]).toBe(root);
    expect(result.edges[0]).toBe(edges[0]);
    expect(JSON.stringify(graph)).toBe(before);
  });

  it("uses the explicitly selected root instead of the current marker or World root", () => {
    const one = node("one", { tabRoot: true });
    const two = node("two");
    const world = node("world", { kind: "plugin" });
    expect(
      collectStudioWorkspaceRootGraph({
        nodes: [one, two, world],
        edges: [edge(world.id, one.id)],
        requestedRootId: two.id,
      }).nodes,
    ).toEqual([two]);
  });

  it("returns no deployable nodes when the workspace is empty or ambiguous", () => {
    expect(collectStudioWorkspaceRootGraph({ nodes: [], edges: [] }).nodes).toEqual([]);
    const graph = { nodes: [node("one"), node("two")], edges: [] };
    expect(collectStudioWorkspaceRootGraph(graph)).toMatchObject({
      root: null,
      ambiguous: true,
      nodes: [],
      edges: [],
    });
  });

  it("includes a shared condition only with its selected attachment edge", () => {
    const one = node("one");
    const two = node("two");
    const condition = node("condition", { kind: "condition" });
    const selectedEdge = edge(condition.id, one.id);
    const result = collectStudioWorkspaceRootGraph({
      nodes: [one, two, condition],
      edges: [selectedEdge, edge(condition.id, two.id)],
      requestedRootId: one.id,
    });
    expect(result.nodes).toEqual([one, condition]);
    expect(result.edges).toEqual([selectedEdge]);
  });
});
