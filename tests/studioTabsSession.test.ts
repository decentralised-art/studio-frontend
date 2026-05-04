import { describe, expect, it } from "vitest";

import {
  STUDIO_TABS_SESSION_STORAGE_KEY,
  STUDIO_TABS_SESSION_VERSION,
  buildStudioTabsSessionPayload,
  readStudioTabsSession,
  restoreStudioTabsSessionPayload,
  sanitizePersistedTabs,
} from "../src/lib/studio/studioTabsSession";

type TestNode = {
  id: string;
  data?: { label: string };
};

type TestEdge = {
  id: string;
  source: string;
  target: string;
};

const storageWith = (value: unknown) => ({
  getItem: (key: string) =>
    key === STUDIO_TABS_SESSION_STORAGE_KEY ? JSON.stringify(value) : null,
});

describe("Studio tabs session helpers", () => {
  it("reads only valid session payload versions", () => {
    const validPayload = {
      version: STUDIO_TABS_SESSION_VERSION,
      tabs: [],
      activeTabId: "tab-1",
      tabGraphs: {},
      connectorTreeModels: {},
    };

    expect(readStudioTabsSession(storageWith(validPayload))).toEqual(validPayload);
    expect(readStudioTabsSession(storageWith({ ...validPayload, version: 0 }))).toBeNull();
    expect(readStudioTabsSession({ getItem: () => "{bad json" })).toBeNull();
    expect(readStudioTabsSession(null)).toBeNull();
  });

  it("sanitizes tab ids, labels, and optional particle ids", () => {
    expect(
      sanitizePersistedTabs([
        { id: " tab-1 ", label: " Root ", particleId: " pitch " },
        { id: "tab-2", label: "Draft", particleId: " " },
        { id: "", label: "Missing id" },
        { id: "missing-label", label: "" },
        null,
      ]),
    ).toEqual([
      { id: "tab-1", label: "Root", particleId: "pitch" },
      { id: "tab-2", label: "Draft", particleId: undefined },
    ]);
  });

  it("builds a cloned session payload from current tab graphs", () => {
    const graph = {
      nodes: [{ id: "node-1", data: { label: "Root" } }],
      edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
    };
    const treeModel = {
      rootConnectorName: "pitch",
      nodes: [{ id: "tree-node" }],
      edges: [] as TestEdge[],
    };

    const payload = buildStudioTabsSessionPayload<
      { id: string; label: string; particleId?: string },
      TestNode,
      TestEdge
    >({
      tabs: [{ id: "tab-1", label: "Draft", particleId: " " }],
      activeTabId: "tab-1",
      tabGraphs: new Map([["tab-1", graph]]),
      connectorTreeModels: new Map([["tab-2", treeModel]]),
      tabViewports: new Map([
        ["tab-1", { x: 12, y: -24, zoom: 0.5 }],
        ["tab-bad", { x: 1, y: 2, zoom: 0 }],
      ]),
    });

    graph.nodes[0].data!.label = "Mutated";
    treeModel.nodes[0].id = "mutated-tree-node";

    expect(payload.tabs).toEqual([{ id: "tab-1", label: "Draft", particleId: undefined }]);
    expect(payload.tabGraphs["tab-1"].nodes[0].data?.label).toBe("Root");
    expect(payload.connectorTreeModels["tab-2"].nodes[0].id).toBe("tree-node");
    expect(payload.tabViewports?.["tab-1"]).toEqual({ x: 12, y: -24, zoom: 0.5 });
    expect(payload.tabViewports?.["tab-bad"]).toBeUndefined();
  });

  it("restores only valid tab-owned graphs and tree models", () => {
    const restored = restoreStudioTabsSessionPayload<TestNode, TestEdge>({
      version: STUDIO_TABS_SESSION_VERSION,
      activeTabId: "missing-tab",
      tabs: [
        { id: " tab-1 ", label: " Draft " },
        { id: "particle-tab", label: "Pitch", particleId: "pitch" },
      ],
      tabGraphs: {
        "tab-1": {
          nodes: [{ id: "node-1" }],
          edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
        },
        "particle-tab": {
          nodes: [{ id: "particle-root" }],
          edges: [],
        },
        "unknown-tab": {
          nodes: [{ id: "unknown" }],
          edges: [],
        },
      },
      connectorTreeModels: {
        "tab-1": {
          rootConnectorName: " root ",
          nodes: [{ id: "tree-root" }],
          edges: [],
        },
        "particle-tab": {
          rootConnectorName: "",
          nodes: [{ id: "ignored" }],
          edges: [],
        },
      },
      tabViewports: {
        "tab-1": { x: 10, y: 20, zoom: 0.75 },
        "particle-tab": { x: -5, y: 0, zoom: 1.2 },
        "unknown-tab": { x: 99, y: 99, zoom: 0.5 },
        "bad-tab": { x: 0, y: 0, zoom: 0 },
      },
    });

    expect(restored?.activeTabId).toBe("tab-1");
    expect(Object.keys(restored?.tabGraphs ?? {})).toEqual(["tab-1", "particle-tab"]);
    expect(restored?.connectorTreeModels["tab-1"].rootConnectorName).toBe("root");
    expect(restored?.connectorTreeModels["particle-tab"]).toEqual({
      rootConnectorName: "pitch",
      nodes: [{ id: "particle-root" }],
      edges: [],
    });
    expect(restored?.tabViewports).toEqual({
      "tab-1": { x: 10, y: 20, zoom: 0.75 },
      "particle-tab": { x: -5, y: 0, zoom: 1.2 },
    });
  });
});
