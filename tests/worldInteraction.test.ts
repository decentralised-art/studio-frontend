import { describe, expect, it } from "vitest";
import {
  createWorldInteractionRegistry,
  readWorldSourceSelection,
  scopeWorldSourceOccurrences,
  WORLD_SOURCE_SELECTION,
  type WorldSourceOccurrence,
} from "../src/lib/worlds/interaction";
const sources: WorldSourceOccurrence[] = [
  {
    occurrenceId: "a",
    nodeId: "same-left",
    pathPrefix: "/root:0/reused:*",
    connectorName: "reused",
  },
  {
    occurrenceId: "b",
    nodeId: "same-right",
    pathPrefix: "/root:1/reused:*",
    connectorName: "reused",
  },
];
describe("optional World source interaction", () => {
  it("keeps selection and realization identity separate, including repeated connector names", () => {
    const registry = createWorldInteractionRegistry(),
      streams = [{ path: "/root:0/reused:0/pitch:0", data: [60] }];
    const first = registry.contextFor("world", sources, streams, new Set(["same-left"]));
    expect(first.selectedOccurrenceIds).toEqual(["a"]);
    const selected = registry.contextFor(
      "world",
      structuredClone(sources),
      streams,
      new Set(["same-right"]),
    );
    expect(selected.revision).toBe(first.revision);
    expect(selected.selectedOccurrenceIds).toEqual(["b"]);
    expect(registry.contextFor("world", sources, streams, new Set(["same-right"]))).toBe(selected);
    const executed = registry.contextFor("world", sources, structuredClone(streams), new Set());
    expect(executed.revision).not.toBe(first.revision);
    expect(registry.contextFor("other-world", sources, streams, new Set()).revision).not.toBe(
      executed.revision,
    );
    expect(
      registry.contextFor("world", sources.slice(0, 1), executed, new Set()).revision,
    ).not.toBe(executed.revision);
  });
  it("accepts only current, offered source IDs from this mounted opaque iframe", () => {
    const context = createWorldInteractionRegistry().contextFor("world", sources, [], new Set());
    const options = { context, source: window, worldId: "score", channelToken: "mount-token" };
    const data = {
      type: WORLD_SOURCE_SELECTION,
      protocolVersion: 1,
      worldId: "score",
      channelToken: "mount-token",
      revision: context.revision,
      occurrenceIds: ["b"],
    };
    const event = { data, source: window, origin: "null" };
    expect(readWorldSourceSelection(event, options)).toEqual({
      revision: context.revision,
      occurrenceIds: ["b"],
    });
    expect(
      readWorldSourceSelection({ ...event, data: { ...data, occurrenceIds: [] } }, options)
        ?.occurrenceIds,
    ).toEqual([]);
    for (const patch of [
      { channelToken: "other-mount" },
      { worldId: "another-world" },
      { revision: "older-result" },
      { occurrenceIds: ["same-right"] },
      { occurrenceIds: ["b", "unknown"] },
      { occurrenceIds: [5] },
      { protocolVersion: 2 },
      { occurrenceIds: "b" },
    ])
      expect(
        readWorldSourceSelection({ ...event, data: { ...data, ...patch } }, options),
      ).toBeNull();
    expect(readWorldSourceSelection({ ...event, source: null }, options)).toBeNull();
    expect(readWorldSourceSelection({ ...event, origin: location.origin }, options)).toBeNull();
    expect(readWorldSourceSelection(event, { ...options, context: undefined })).toBeNull();
  });
});

it("offers only source occurrences contributing to the World's connected subtree", () => {
  const output = ["/root:0/reused:0/pitch:0", "/root:1/reused:0/pitch:0"];
  expect(scopeWorldSourceOccurrences(sources, output, new Set(["same-right"]))).toEqual([
    sources[1],
  ]);
  expect(scopeWorldSourceOccurrences(sources, output, new Set(["unconnected"]))).toEqual([]);
  expect(
    scopeWorldSourceOccurrences(sources, ["/root:10/reused:0/pitch:0"], new Set(["same-right"])),
  ).toEqual([]);
});
