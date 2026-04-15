import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const auditedFiles = [
  "src/lib/components/create/CreateParticleExplorer.svelte",
  "src/lib/components/explore/ExploreParticleList.svelte",
  "src/lib/components/explore/ExploreParticleDetail.svelte",
  "src/lib/components/explore/LineageNode.svelte",
  "src/lib/components/flow-editor/ResultPanel.svelte",
  "src/lib/components/flow-editor/FeatureNode.svelte",
  "src/lib/components/flow-editor/EditorPanel.svelte",
  "src/lib/components/workspace-window/WorkspaceTopBar.svelte",
  "src/lib/components/user/UserContribution.svelte",
  "src/routes/map/+page.svelte",
  "src/lib/network/mockNetworkGraph.ts",
  "src/routes/p/[id]/+page.svelte",
  "src/routes/studio/+page.svelte",
] as const;

const forbiddenLegacyPhrases = [
  "Particle explorer",
  "No particles match these filters yet.",
  "Particle view preview",
  "Particle Page",
  "Particle not found",
  "Loading particle...",
  "Fetching chain-backed particle data.",
  "No synced particle matches this ID yet.",
  "No particles reference",
  "Click particle nodes to open them in Studio.",
  "No feature selected.",
  " + Feature Node ",
  "Publish Feature",
  "Sync owned chain connectors, transformations, conditions and particles",
  "<span>Particle</span>",
  '<p class="mono-label">Features</p>',
] as const;

const requiredConnectorPhrases: Record<string, string[]> = {
  "src/lib/components/create/CreateParticleExplorer.svelte": [
    "Connector explorer",
    "Connectors",
    "No connectors match these filters yet.",
  ],
  "src/lib/components/explore/ExploreParticleList.svelte": [
    "No connectors match these filters yet.",
  ],
  "src/lib/components/explore/ExploreParticleDetail.svelte": ["Connector output preview"],
  "src/lib/components/explore/LineageNode.svelte": ["Connector"],
  "src/lib/components/flow-editor/ResultPanel.svelte": ["No connector selected."],
  "src/lib/components/flow-editor/FeatureNode.svelte": [
    "Connector Schema",
    "Connector schema name",
  ],
  "src/lib/components/flow-editor/EditorPanel.svelte": [" + Connector Schema Node "],
  "src/lib/components/workspace-window/WorkspaceTopBar.svelte": ["Publish Connector", "Connector"],
  "src/lib/components/user/UserContribution.svelte": ["Connectors"],
  "src/routes/map/+page.svelte": [
    "Connectors",
    "Connector Schemas",
    "Click connector nodes to open them in Studio.",
    "uses connector schema",
  ],
  "src/lib/network/mockNetworkGraph.ts": [
    'label: "Connector"',
    'label: "Connector Schema"',
    'label: "uses connector schema"',
  ],
  "src/routes/p/[id]/+page.svelte": [
    "Connector Page",
    "Connector not found",
    "Loading connector...",
    "No synced connector matches this ID yet.",
    "No connectors reference",
  ],
  "src/routes/studio/+page.svelte": [
    "connector records",
    "attached connector.",
    "and connector records",
    "<span>Connector</span>",
  ],
};

describe("terminology consistency", () => {
  it("does not reintroduce forbidden legacy UI phrases in audited files", () => {
    const violations = auditedFiles.flatMap((relativePath) => {
      const source = readSource(relativePath);
      return forbiddenLegacyPhrases
        .filter((phrase) => source.includes(phrase))
        .map((phrase) => `${relativePath} -> '${phrase}'`);
    });

    expect(violations).toEqual([]);
  });

  it("keeps connector-native replacement phrases in place", () => {
    const missing = Object.entries(requiredConnectorPhrases).flatMap(([relativePath, phrases]) => {
      const source = readSource(relativePath);
      return phrases
        .filter((phrase) => !source.includes(phrase))
        .map((phrase) => `${relativePath} -> '${phrase}'`);
    });

    expect(missing).toEqual([]);
  });
});
