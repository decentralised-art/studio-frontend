import { describe, expect, it } from "vitest";

import {
  buildConnectorTreeGraph,
  computeConnectorOpenSlotsInRegistry,
  hasConnectorTreePlaceholderNodes,
  isCompleteConnectorTreeModel,
  shouldReplaceConnectorTreeModel,
  type ConnectorTreeModel,
  type ConnectorTreeNode,
} from "../src/lib/studio/connectorTreeGraph";
import type { StudioConnectorDef } from "../src/lib/studio/domain/connectorModel";
import { listStudioPluginTemplates } from "../src/lib/studio/plugins/templates";

const ids = () => {
  let index = 0;
  return () => {
    index += 1;
    return `id-${index}`;
  };
};

const connector = (
  name: string,
  dimensions: Array<{
    transformations?: Array<{ name: string; args?: number[] }>;
    composite?: string;
    bindings?: Record<string, string>;
  }>,
  extra: Partial<StudioConnectorDef> = {},
): StudioConnectorDef => ({
  name,
  dimensions: dimensions.map((dimension) => ({
    transformations: (dimension.transformations ?? []).map((tx) => ({
      name: tx.name,
      args: [...(tx.args ?? [])],
    })),
    ...(dimension.composite ? { composite: dimension.composite } : {}),
    bindings: { ...(dimension.bindings ?? {}) },
  })),
  ...extra,
});

const build = (
  connectorRegistry: Record<string, StudioConnectorDef>,
  rootConnectorName: string,
): ConnectorTreeModel =>
  buildConnectorTreeGraph({
    connectorRegistry,
    rootConnectorName,
    origin: { x: 100, y: 50 },
    options: {
      idFactory: ids(),
      labelForConnector: (name) => `Label ${name}`,
    },
  });

const connectorNode = (model: ConnectorTreeModel, name: string): ConnectorTreeNode => {
  const node = model.nodes.find(
    (candidate) => candidate.data.kind === "connector" && candidate.data.networkId === name,
  );
  if (!node) throw new Error(`Missing connector node ${name}`);
  return node;
};

const connectorNodes = (model: ConnectorTreeModel): ConnectorTreeNode[] =>
  model.nodes.filter((node) => node.data.kind === "connector");

const edgeData = (edge: ConnectorTreeModel["edges"][number]) =>
  (edge.data ?? {}) as {
    relation?: string;
    bindingOwnerName?: string;
    bindingSlot?: number;
  };

describe("connectorTreeGraph", () => {
  it("renders nested composites with connector rows and RI positions", () => {
    const registry = {
      root: connector(
        "root",
        [
          { transformations: [{ name: "root_tx", args: [1, 2] }], composite: "child" },
          { transformations: [{ name: "terminal_tx" }] },
        ],
        {
          staticRi: {
            "0": { startPoint: 7, transformationShift: 2 },
            "1": { startPoint: 11, transformationShift: 3 },
          },
        },
      ),
      child: connector("child", [{ transformations: [{ name: "child_tx", args: [5] }] }]),
    };

    const model = build(registry, "root");
    const root = connectorNode(model, "root");
    const child = connectorNode(model, "child");

    expect(root.data).toMatchObject({
      label: "Label root",
      tabRoot: true,
      riPosition: 0,
      riStart: 7,
      riShift: 2,
      riLocked: true,
      hideOutlets: false,
    });
    expect(root.data.connectorRows?.[0]?.transformations).toEqual(["root_tx (1, 2)"]);
    expect(child.data).toMatchObject({
      label: "Label child",
      riPosition: 1,
      riStart: 11,
      riShift: 3,
      riLocked: true,
      hideOutlets: true,
    });
    expect(
      model.edges.some(
        (edge) =>
          edge.source === root.id &&
          edge.target === child.id &&
          edgeData(edge).relation === "composite",
      ),
    ).toBe(true);
    expect(computeConnectorOpenSlotsInRegistry(registry, "root")).toBe(2);
  });

  it("projects static bindings and forwarded bindings through nested slots", () => {
    const registry = {
      parent: connector("parent", [{ composite: "root", bindings: { "1": "forwardB" } }]),
      root: connector("root", [{ composite: "child", bindings: { "0": "staticA" } }]),
      child: connector("child", [{}]),
      staticA: connector("staticA", [{}, {}]),
      forwardB: connector("forwardB", [{}]),
    };

    const model = build(registry, "parent");
    const child = connectorNode(model, "child");
    const staticA = connectorNode(model, "staticA");
    const forwardB = connectorNode(model, "forwardB");

    expect(staticA.data).toMatchObject({
      boundKind: "static",
      boundSlotLabel: "slot 0",
      boundOwnerName: "root",
    });
    expect(forwardB.data).toMatchObject({
      boundKind: "forwarded",
      boundSlotLabel: "slot 1 (from slot 1)",
      boundOwnerName: "parent",
    });

    const staticBindingEdge = model.edges.find(
      (edge) =>
        edge.source === child.id &&
        edge.target === staticA.id &&
        edgeData(edge).relation === "binding",
    );
    expect(edgeData(staticBindingEdge!)).toMatchObject({
      bindingOwnerName: "root",
      bindingSlot: 0,
    });

    const forwardedBindingEdge = model.edges.find(
      (edge) =>
        edge.source === staticA.id &&
        edge.target === forwardB.id &&
        edgeData(edge).relation === "binding",
    );
    expect(edgeData(forwardedBindingEdge!)).toMatchObject({
      bindingOwnerName: "parent",
      bindingSlot: 1,
    });
    expect(computeConnectorOpenSlotsInRegistry(registry, "root")).toBe(2);
    expect(computeConnectorOpenSlotsInRegistry(registry, "parent")).toBe(2);
  });

  it("renders loading placeholders for missing composite connectors", () => {
    const registry = {
      root: connector("root", [{ composite: "missing_child" }]),
    };

    const model = build(registry, "root");
    const placeholder = model.nodes.find((node) => node.data.placeholder);

    expect(placeholder?.data).toMatchObject({
      label: "Loading connector...",
      kind: "particle",
      placeholderState: "loading",
      placeholderDetail: "waiting for chain sync: missing_child",
    });
    expect(
      model.edges.some(
        (edge) =>
          edge.target === placeholder?.id &&
          edge.label === "composite · D1" &&
          edgeData(edge).relation === "composite",
      ),
    ).toBe(true);
  });

  it("renders warning placeholders for connector cycles", () => {
    const registry = {
      root: connector("root", [{ composite: "child" }]),
      child: connector("child", [{ composite: "root" }]),
    };

    const model = build(registry, "root");
    const placeholder = model.nodes.find((node) => node.data.placeholder);

    expect(placeholder?.data).toMatchObject({
      label: "Connector cycle",
      kind: "particle",
      placeholderState: "warning",
      placeholderDetail: "Connector cycle at root",
    });
    expect(() => computeConnectorOpenSlotsInRegistry(registry, "root")).toThrowError(
      /Connector cycle/,
    );
  });

  it("keeps template children on depth rows sized by the tallest parent row", () => {
    const slotNames = [
      "parts",
      "meter",
      "clefs",
      "tempo",
      "key",
      "notes",
      "articulations",
      "slurs",
    ];
    const registry = {
      score_full_v2: connector(
        "score_full_v2",
        slotNames.map((name) => ({ composite: name })),
      ),
      ...Object.fromEntries(
        slotNames.map((name) => [
          name,
          connector(
            name,
            Array.from({ length: name === "notes" ? 9 : 2 }, (_, index) => ({
              composite: `${name}_slot_${index}`,
            })),
          ),
        ]),
      ),
      ...Object.fromEntries(
        slotNames.flatMap((name) =>
          Array.from({ length: name === "notes" ? 9 : 2 }, (_, index) => [
            `${name}_slot_${index}`,
            connector(`${name}_slot_${index}`, [{}]),
          ]),
        ),
      ),
    };

    const model = build(registry, "score_full_v2");
    const root = connectorNode(model, "score_full_v2");
    const levelOne = slotNames.map((name) => connectorNode(model, name));
    const levelTwo = ["parts_slot_0", "notes_slot_0", "slurs_slot_0"].map((name) =>
      connectorNode(model, name),
    );

    expect(new Set(levelOne.map((node) => node.position.y)).size).toBe(1);
    expect(new Set(levelTwo.map((node) => node.position.y)).size).toBe(1);
    expect(levelOne[0].position.y - root.position.y).toBeGreaterThan(500);
    expect(levelTwo[0].position.y).toBeGreaterThan(levelOne[0].position.y);
  });

  it("keeps connector child rows ordered for every registered template", () => {
    const templates = listStudioPluginTemplates();
    const archetypeNames = new Set(templates.flatMap((template) => template.archetypeConnectors));
    const registry: Record<string, StudioConnectorDef> = {};

    templates.forEach((template) => {
      template.archetypeConnectors.forEach((name) => {
        registry[name] = connector(
          name,
          template.slotConnectors.map((slotName) => ({ composite: slotName })),
        );
      });
    });

    templates
      .flatMap((template) => template.slotConnectors)
      .filter((name) => !archetypeNames.has(name))
      .forEach((name) => {
        registry[name] = connector(name, [{}]);
      });

    templates.forEach((template) => {
      const rootName = template.archetypeConnectors[0];
      const model = build(registry, rootName);
      const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

      connectorNodes(model).forEach((parent) => {
        const childNodes = model.edges
          .filter((edge) => {
            const target = nodesById.get(edge.target);
            return edge.source === parent.id && target?.data.kind === "connector";
          })
          .map((edge) => nodesById.get(edge.target))
          .filter((node): node is ConnectorTreeNode => Boolean(node));

        if (childNodes.length === 0) return;

        const expectedY = childNodes[0].position.y;
        childNodes.forEach((child) => {
          expect(
            child.position.y,
            `${template.id}: expected ${child.data.networkId} below ${parent.data.networkId}`,
          ).toBeGreaterThan(parent.position.y);
          expect(
            Math.abs(child.position.y - expectedY),
            `${template.id}: expected children of ${parent.data.networkId} on one row`,
          ).toBeLessThan(0.1);
        });
      });
    });
  });

  it("does not replace a complete restored tree with a placeholder rebuild", () => {
    const complete = build(
      {
        root: connector("root", [{ composite: "child" }]),
        child: connector("child", [{}]),
      },
      "root",
    );
    const placeholder = build(
      {
        root: connector("root", [{ composite: "child" }]),
      },
      "root",
    );

    expect(isCompleteConnectorTreeModel(complete)).toBe(true);
    expect(hasConnectorTreePlaceholderNodes(placeholder)).toBe(true);
    expect(shouldReplaceConnectorTreeModel(complete, placeholder)).toBe(false);
    expect(shouldReplaceConnectorTreeModel(placeholder, complete)).toBe(true);
  });
});
