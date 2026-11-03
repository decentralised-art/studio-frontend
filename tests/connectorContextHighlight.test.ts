import type { Edge } from "@xyflow/svelte";
import { describe, expect, it } from "vitest";

import {
  computeConnectorContextPathPrefixes,
  computeConnectorSourceOccurrences,
  computeSelectedConnectorContextHighlightRoles,
  isConnectorContextEdge,
  type ConnectorContextHighlightNode,
} from "../src/lib/studio/connectorContextHighlight";

const node = (
  id: string,
  kind: ConnectorContextHighlightNode["data"]["kind"] = "connector",
): ConnectorContextHighlightNode => ({
  id,
  data: { kind },
});

const edge = (
  source: string,
  target: string,
  relation?: "composite" | "binding",
  sourceHandle = "dim-0",
): Edge =>
  ({
    id: `${source}-${target}-${relation ?? "unknown"}`,
    source,
    target,
    sourceHandle,
    data: relation ? { relation } : undefined,
  }) as Edge;

describe("connector context highlight", () => {
  it("follows composite and binding connector descendants from the selected connector", () => {
    const roles = computeSelectedConnectorContextHighlightRoles(
      [node("root"), node("child"), node("bound"), node("dimension", "dimension")],
      [
        edge("root", "child", "composite"),
        edge("child", "bound", "binding"),
        edge("root", "dimension"),
      ],
      "root",
    );

    expect(Object.fromEntries(roles)).toEqual({
      root: "selected",
      child: "member",
      bound: "member",
    });
  });

  it("does not highlight duplicate connector instances unless they are in the selected subtree", () => {
    const roles = computeSelectedConnectorContextHighlightRoles(
      [node("root-a"), node("shared-a"), node("root-b"), node("shared-b")],
      [edge("root-a", "shared-a", "composite"), edge("root-b", "shared-b", "composite")],
      "root-a",
    );

    expect(Object.fromEntries(roles)).toEqual({
      "root-a": "selected",
      "shared-a": "member",
    });
  });

  it("ignores non-connector selections and non-context edges", () => {
    expect(
      Object.fromEntries(
        computeSelectedConnectorContextHighlightRoles(
          [node("plugin", "plugin"), node("connector")],
          [edge("plugin", "connector", "composite")],
          "plugin",
        ),
      ),
    ).toEqual({});

    expect(isConnectorContextEdge(edge("connector", "dimension"))).toBe(false);
  });

  it("stops traversal through connector cycles", () => {
    const roles = computeSelectedConnectorContextHighlightRoles(
      [node("root"), node("child")],
      [edge("root", "child", "composite"), edge("child", "root", "binding")],
      "root",
    );

    expect(Object.fromEntries(roles)).toEqual({
      root: "selected",
      child: "member",
    });
  });

  it("builds selected context path prefixes from graph lineage indices", () => {
    const nodes = [node("root"), node("same-a"), node("same-b")];
    const edges = [
      edge("root", "same-a", "composite", "dim-0"),
      edge("root", "same-b", "composite", "dim-1"),
    ];

    expect(
      computeConnectorContextPathPrefixes(nodes, edges, "root", new Set(["same-b"]), (item) =>
        item.id.startsWith("same") ? "same_connector" : item.id,
      ),
    ).toEqual(["/root:1/same_connector:*"]);
  });

  it("uses a wildcard root prefix so selecting the root covers all produced streams", () => {
    const nodes = [node("root"), node("left"), node("right")];
    const edges = [
      edge("root", "left", "composite", "dim-0"),
      edge("root", "right", "composite", "dim-1"),
    ];

    expect(
      computeConnectorContextPathPrefixes(
        nodes,
        edges,
        "root",
        new Set(["root"]),
        (item) => item.id,
      ),
    ).toEqual(["/root:*"]);
  });
});

describe("source occurrence mapping", () => {
  it("distinguishes reused connector instances, their nested scalar children and disconnected graphs", () => {
    const nodes = [
      node("root"),
      node("left"),
      node("right"),
      node("pitch-left"),
      node("pitch-right"),
      node("unrelated"),
    ];
    const edges = [
      edge("root", "left", "composite", "dim-0"),
      edge("root", "right", "composite", "dim-1"),
      edge("left", "pitch-left", "binding", "dim-2"),
      edge("right", "pitch-right", "binding", "dim-2"),
    ];
    const result = computeConnectorSourceOccurrences(nodes, edges, "root", (n) =>
      n.id === "left" || n.id === "right" ? "reused" : n.id.startsWith("pitch") ? "pitch" : n.id,
    );
    expect(result.map((s) => [s.nodeId, s.pathPrefix])).toEqual([
      ["root", "/root:*"],
      ["left", "/root:0/reused:*"],
      ["right", "/root:1/reused:*"],
      ["pitch-left", "/root:0/reused:2/pitch:*"],
      ["pitch-right", "/root:1/reused:2/pitch:*"],
    ]);
    expect(new Set(result.map((s) => s.occurrenceId)).size).toBe(result.length);
    expect(
      Object.fromEntries(computeSelectedConnectorContextHighlightRoles(nodes, edges, ["right"])),
    ).toEqual({ right: "selected", "pitch-right": "member" });
    expect(
      Object.fromEntries(
        computeSelectedConnectorContextHighlightRoles(nodes, edges, ["left", "right"]),
      ),
    ).toEqual({
      left: "selected",
      right: "selected",
      "pitch-left": "member",
      "pitch-right": "member",
    });
  });
  it("follows the existing dimension-out representation and stops cycles", () => {
    const nodes = [node("root"), node("dimension", "dimension"), node("child")];
    const edges = [
      edge("root", "dimension", undefined, "dim-3"),
      { ...edge("dimension", "child"), sourceHandle: "out" },
      edge("child", "root", "binding"),
    ];
    expect(
      Object.fromEntries(computeSelectedConnectorContextHighlightRoles(nodes, edges, "root")),
    ).toEqual({ root: "selected", child: "member" });
    expect(
      computeConnectorSourceOccurrences(nodes, edges, "root", (n) => n.id).map((s) => s.pathPrefix),
    ).toEqual(["/root:*", "/root:3/child:*"]);
  });
});
