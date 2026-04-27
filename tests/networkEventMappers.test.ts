import { describe, expect, it } from "vitest";

import { mapSnapshotToNetworkFeedEvents } from "../src/lib/feed/networkEventMappers";
import type { ChainStudioSyncResult } from "../src/lib/studio/chainStudioAdapter";

describe("networkEventMappers", () => {
  it("maps connector, transformation, and condition records from a chain snapshot", () => {
    const snapshot: ChainStudioSyncResult = {
      registry: {
        connectors: {},
        features: {},
        particles: {},
        transformations: {},
        conditions: {},
      },
      library: {
        features: [],
        transformations: [
          {
            id: "transform-test_add",
            name: "test_add",
            kind: "transformation",
            authorId: "source",
            summary: "Synced from chain.",
            runtimeSnippet: "return x + args[0];",
          },
        ],
        conditions: [
          {
            id: "condition-is_open",
            name: "is_open",
            kind: "condition",
            authorId: "source",
            summary: "Synced from chain.",
            runtimeSnippet: "return true;",
          },
        ],
      },
      particles: [
        {
          id: "testconnector12345901",
          name: "testconnector12345901",
          summary: "Synced from chain.",
          authorId: "source",
          viewId: "midi",
          createdAt: 100,
          createdLabel: "",
          ingredients: [],
          complexity: 1,
          transactionName: "testconnector12345901 PT",
          dependencies: [],
        },
      ],
    };

    const events = mapSnapshotToNetworkFeedEvents(
      "0xb584a15f38c2014cff54fdb1b417428b51999276",
      snapshot,
    );

    expect(events.map((event) => event.type).sort()).toEqual([
      "condition",
      "connector",
      "transformation",
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "transformation",
          elementId: "test_add",
          runtimeSnippet: "return x + args[0];",
        }),
        expect.objectContaining({
          type: "condition",
          elementId: "is_open",
          runtimeSnippet: "return true;",
        }),
      ]),
    );
  });
});
