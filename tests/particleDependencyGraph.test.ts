import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";

describe("particle dependency graph", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    const particlePostData = await import("../src/lib/feed/particlePostData");
    particlePostData.resetParticlePostDataCacheForDebug();
  });

  it("uses the Studio connector tree projection for social mini flows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname === "/feed") {
          return jsonResponse({
            limit: 128,
            cursor: { has_more: false, next_before: null },
            items: [
              feedConnectorItem("root", 300),
              feedConnectorItem("child", 200),
              feedConnectorItem("static_leaf", 100),
            ],
          });
        }
        if (url.pathname === "/connector/root") {
          return jsonResponse({
            name: "root",
            owner: OWNER,
            dimensions: [
              {
                composite: "child",
                bindings: { "0": "static_leaf" },
                transformations: [{ name: "add", args: [1] }],
              },
              {
                transformations: [{ name: "add", args: [2] }],
              },
            ],
            static_ri: {
              "0": { start_point: 7, transformation_shift: 2 },
              "2": { start_point: 11, transformation_shift: 3 },
            },
          });
        }
        if (url.pathname === "/connector/child") {
          return jsonResponse({
            name: "child",
            owner: OWNER,
            dimensions: [{ transformations: [{ name: "add", args: [3] }] }],
          });
        }
        if (url.pathname === "/connector/static_leaf") {
          return jsonResponse({
            name: "static_leaf",
            owner: OWNER,
            dimensions: [{ transformations: [{ name: "add", args: [4] }] }],
          });
        }
        throw new Error(`Unexpected request: ${url.pathname}`);
      }),
    );

    const particlePostData = await import("../src/lib/feed/particlePostData");
    await particlePostData.syncParticlePostDataFromChain({
      force: true,
      sourceAddresses: [OWNER],
      includeRuntimeCode: false,
    });

    const { buildParticleDependencyGraph } =
      await import("../src/lib/studio/particleDependencyGraph");
    const graph = buildParticleDependencyGraph("root");
    const connectorNode = (name: string) => {
      const node = graph.nodes.find(
        (candidate) => candidate.data.kind === "connector" && candidate.data.networkId === name,
      );
      if (!node) throw new Error(`Missing connector ${name}`);
      return node;
    };

    expect(connectorNode("root").data).toMatchObject({
      riStart: 7,
      riShift: 2,
      riLocked: true,
      staticRi: {
        "0": { startPoint: 7, transformationShift: 2 },
        "2": { startPoint: 11, transformationShift: 3 },
      },
    });
    expect(connectorNode("child").data).toMatchObject({
      riStart: 11,
      riShift: 3,
      riLocked: true,
    });
    expect(connectorNode("static_leaf").data).toMatchObject({
      boundKind: "static",
      boundOwnerName: "root",
      boundSlotLabel: "slot 0",
    });
  });
});

const feedConnectorItem = (name: string, createdAtMs: number) => ({
  feed_id: `feed-connector-${name}`,
  event_type: "connector_added",
  status: "safe",
  visible: true,
  tx_hash: `0x${name}`,
  block_number: 1,
  tx_index: 0,
  log_index: 0,
  history_cursor: `0000000000000001:0000:${name}`,
  created_at_ms: createdAtMs,
  updated_at_ms: createdAtMs,
  projector_version: 1,
  payload: {
    type: "connector",
    name,
    owner: OWNER,
  },
});

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
