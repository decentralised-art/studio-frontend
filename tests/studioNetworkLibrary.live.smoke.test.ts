import { describe, expect, it } from "vitest";

import { isPublishedChainAddress } from "../src/lib/studio/studioEntityOrigin";
import { loadStudioNetworkLibraryFromEventFeed } from "../src/lib/studio/studioEventFeedLibrary";

const liveSmokeEnabled = process.env.DCN_LIVE_SMOKE === "1";

describe("live Studio network library smoke (read-only, opt-in)", () => {
  it.skipIf(!liveSmokeEnabled)(
    "discovers published connectors beyond a page of local drafts",
    async () => {
      if (!import.meta.env.VITE_CHAIN_API_BASE_URL) {
        throw new Error("Set VITE_CHAIN_API_BASE_URL when running DCN_LIVE_SMOKE=1.");
      }

      const discovery = await loadStudioNetworkLibraryFromEventFeed({
        sourceAddresses: [],
        includeAllOwners: true,
        pageLimit: 256,
        maxPages: 8,
        includeUnfinalized: true,
      });
      const published = [
        ...discovery.library.features,
        ...discovery.library.transformations,
        ...discovery.library.conditions,
      ];
      const pitch = discovery.library.features.find((item) => item.id === "feature-pitch");

      expect(discovery.pageCount).toBeGreaterThanOrEqual(2);
      expect(discovery.discoveredItemCount).toBeGreaterThan(0);
      expect(discovery.discoveredItemCount).toBe(published.length);
      expect(pitch).toBeDefined();
      expect(isPublishedChainAddress(pitch?.chainAddress)).toBe(true);
      expect(published.every((item) => isPublishedChainAddress(item.chainAddress))).toBe(true);
      expect(
        discovery.library.features.some((item) => item.name === "oblique_memory_2026_v9"),
      ).toBe(false);

      console.info(
        JSON.stringify({
          check: "live Studio network library",
          pages: discovery.pageCount,
          feedItems: discovery.rawItemCount,
          publishedConnectors: discovery.library.features.length,
          publishedTransformations: discovery.library.transformations.length,
          publishedConditions: discovery.library.conditions.length,
          publishedPitchFound: Boolean(pitch),
          draftExcluded: true,
        }),
      );
    },
    180_000,
  );
});
