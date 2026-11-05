import { createHash } from "node:crypto";

/** Synthetic music only. Real unpublished compositions stay outside this repository. */
export function largeConnectorFixture() {
  const root = "large_fixture_root",
    owner = `0x${"12".repeat(20)}`,
    otherOwner = "34".repeat(20);
  const wrappers = Array.from(
    { length: 102 },
    (_, i) => `fixture_wrapper_${String(i).padStart(3, "0")}`,
  );
  type Connector = {
    name: string;
    owner: string;
    address: string;
    format_hash: string;
    dimensions: Array<{
      composite?: string;
      transformations: Array<{ name: string; args: number[] }>;
    }>;
    static_ri: Record<string, { start_point: number; transformation_shift: number }>;
  };
  const connectors: Record<string, Connector> = {};
  for (const [index, name] of [root, ...wrappers].entries()) {
    connectors[name] = {
      name,
      owner: owner.slice(2),
      address: "0x0",
      format_hash: "cd".repeat(32),
      dimensions: [{ composite: wrappers[index] ?? "pitch", transformations: [] }],
      static_ri: {},
    };
  }
  connectors[root].static_ri["104"] = { start_point: 60, transformation_shift: 0 };
  connectors.pitch = {
    name: "pitch",
    owner: otherOwner,
    address: `0x${"ab".repeat(20)}`,
    format_hash: "ef".repeat(32),
    dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
    static_ri: {},
  };
  let path = "";
  const positions = [
    {
      position: 0,
      path,
      connector: root,
      role: "root",
      ri: { start_point: 0, transformation_shift: 0 },
    },
  ];
  [root, ...wrappers, "pitch"].forEach((name, index) => {
    path += `/${name}:0`;
    positions.push({
      position: index + 1,
      path,
      connector: name,
      role: name === "pitch" ? "terminal" : "structural",
      ri: { start_point: name === "pitch" ? 60 : 0, transformation_shift: 0 },
    });
  });
  const simulation = [{ path, data: Array.from({ length: 24 }, (_, row) => 60 + row) }];
  // Stable reference source IDs from Score's documented path/row identity scheme.
  const hash = (text: string) => {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0).toString(36);
  };
  const normalizedPath = path.replace(/:0$/, ":*");
  const noteSources: Record<string, string> = {};
  for (let row = 0; row < 24; row++) {
    const id = `e-${hash(`${normalizedPath}:row:${row}`)}`;
    noteSources[`${id}-f0-${row}`] = id;
  }
  const world = {
    id: "large-connector-score-fixture",
    slug: "score",
    name: "Score",
    version: "0.4.0",
    entryUrn: "/world-assets/large-connector-score-fixture/index.html",
    entryPath: "index.html",
    runtime: "iframe",
    surfaces: ["world-page", "studio-plugin"],
    permissions: ["browser.audio"],
    description: "Synthetic Score host regression fixture",
    acceptedFormatHashes: [connectors.pitch.format_hash],
    acceptedConnectorSets: [],
    ownerId: owner,
    bundleHash: "synthetic-score-bundle",
    manifestHash: "synthetic-score-manifest",
    status: "active",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-05T00:00:00Z",
  };
  return {
    source: {
      root,
      N: 24,
      connectorCount: 104,
      streamCount: 1,
      logicalNotes: 24,
      noteFragments: 24,
      totalEvents: 24,
      staticRiCount: 1,
      provenance:
        "Synthetic 104-definition chain with a cold foreign-owned published scalar beyond the old 64-node cap.",
      simulationSha256: createHash("sha256").update(JSON.stringify(simulation)).digest("hex"),
    },
    owner,
    connectors,
    positions,
    simulation,
    noteSources,
    world,
    transformations: {
      add: {
        name: "add",
        owner: otherOwner,
        address: `0x${"ac".repeat(20)}`,
        args_count: 1,
        sol_src: "return x + args[0];",
      },
    },
  };
}
