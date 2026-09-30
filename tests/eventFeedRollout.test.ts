import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const eventFeedRouteContracts = [
  {
    route: "src/routes/network/+page.svelte",
    requiredPhrases: [
      "syncParticlePostDataFromChain",
      "loadMoreConnectorPostDataFromChain",
      "createConnectorPostDataStream",
    ],
  },
  {
    route: "src/routes/account/+page.svelte",
    requiredPhrases: ["syncProfileActivityFromEventFeed", "listProfileActivityEvents"],
  },
  {
    route: "src/routes/u/[id]/+page.svelte",
    requiredPhrases: ["syncProfileActivityFromEventFeed", "listProfileActivityEvents"],
  },
  {
    route: "src/routes/studio/+page.svelte",
    requiredPhrases: ["loadStudioNetworkLibraryFromEventFeed"],
  },
] as const;

const activeEventFeedRoutes = eventFeedRouteContracts
  .map(({ route }) => route)
  .filter((route) => route !== "src/routes/studio/+page.svelte");

const forbiddenAccountScanPhrases = [
  "fetchChainOwnedStudioSnapshot",
  "syncParticlePostDataFromOwnedAccountSnapshotsForDebug",
] as const;

describe("event feed rollout guardrails", () => {
  it("keeps broad activity routes wired to the event feed path", () => {
    const missing = eventFeedRouteContracts.flatMap(({ route, requiredPhrases }) => {
      const source = readSource(route);
      return requiredPhrases
        .filter((phrase) => !source.includes(phrase))
        .map((phrase) => `${route} -> '${phrase}'`);
    });

    expect(missing).toEqual([]);
  });

  it("does not reintroduce owned-account scan wiring in broad activity routes", () => {
    const violations = activeEventFeedRoutes.flatMap((route) => {
      const source = readSource(route);
      return forbiddenAccountScanPhrases
        .filter((phrase) => source.includes(phrase))
        .map((phrase) => `${route} -> '${phrase}'`);
    });

    expect(violations).toEqual([]);
  });

  it("keeps the old account snapshot sync quarantined behind the debug-only export", () => {
    const source = readSource("src/lib/feed/particlePostData.ts");
    const defaultSyncSection =
      source
        .split("export const syncParticlePostDataFromChain")[1]
        ?.split("export const syncParticlePostDataFromOwnedAccountSnapshotsForDebug")[0] ?? "";
    const debugSyncSection =
      source.split("export const syncParticlePostDataFromOwnedAccountSnapshotsForDebug")[1] ?? "";

    expect(defaultSyncSection).not.toContain("loadOwnedAccountSnapshotParticlePostCache");
    expect(defaultSyncSection).not.toContain("fetchChainOwnedStudioSnapshot");
    expect(debugSyncSection).toContain("loadOwnedAccountSnapshotParticlePostCache");
  });
});
