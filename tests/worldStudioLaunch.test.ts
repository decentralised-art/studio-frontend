import { describe, expect, it, vi } from "vitest";
import {
  loadWorldOpeningView,
  opensWorldInStudioByDefault,
  parseWorldOpeningView,
  worldLaunchUrl,
} from "../src/lib/worlds/studioLaunch";
import type { WorldDescriptor } from "../src/lib/worlds/types";

const world = {
  id: "any-creators-world",
  source: "backend",
  entry: "/services/world-assets/any-id/nested/index.html?worldId=any-id",
  surfaces: ["world-page", "studio-plugin"],
  backend: { entryPath: "nested/index.html", bundleHash: "bundle-one" },
} as WorldDescriptor;

describe("creator-controlled World opening", () => {
  it("defaults to the World viewer even when Studio is supported", () => {
    expect(opensWorldInStudioByDefault(world)).toBe(false);
    expect(opensWorldInStudioByDefault(world, "world")).toBe(false);
    expect(opensWorldInStudioByDefault(world, "studio")).toBe(true);
    expect(opensWorldInStudioByDefault({ surfaces: ["world-page"] }, "studio")).toBe(false);
  });
  it.each(["world", "studio"] as const)(
    "reads the creator's explicit %s preference for any World identity",
    async (defaultView) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, defaultView })));
      expect(await loadWorldOpeningView(world, "https://platform.test", fetcher)).toBe(defaultView);
      expect(fetcher).toHaveBeenCalledWith(
        "https://platform.test/services/world-assets/any-id/world-launch.json?v=bundle-one",
        expect.objectContaining({ credentials: "omit", signal: expect.any(AbortSignal) }),
      );
    },
  );
  it("resolves nested entry roots and versions preferences with the uploaded bundle", () => {
    expect(worldLaunchUrl(world, "https://platform.test")).toBe(
      "https://platform.test/services/world-assets/any-id/world-launch.json?v=bundle-one",
    );
    expect(
      worldLaunchUrl(
        { ...world, backend: { ...world.backend!, bundleHash: "bundle-two" } },
        "https://platform.test",
      ),
    ).toContain("?v=bundle-two");
  });
  it.each([404, 500])(
    "keeps the viewer when an optional preference returns HTTP %s",
    async (status) => {
      expect(
        await loadWorldOpeningView(
          world,
          "https://platform.test",
          vi.fn().mockResolvedValue(new Response(null, { status })),
        ),
      ).toBe("world");
    },
  );
  it.each(["{}", "not json", " ".repeat(4097)])(
    "keeps the viewer for malformed or excessive configuration",
    async (text) => {
      expect(
        await loadWorldOpeningView(
          world,
          "https://platform.test",
          vi.fn().mockResolvedValue(new Response(text)),
        ),
      ).toBe("world");
    },
  );
  it("keeps the viewer on a failed or timed-out request", async () => {
    expect(
      await loadWorldOpeningView(
        world,
        "https://platform.test",
        vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")),
      ),
    ).toBe("world");
  });
  it("does not request preferences for Worlds without Studio support", async () => {
    const fetcher = vi.fn();
    expect(
      await loadWorldOpeningView(
        { ...world, surfaces: ["world-page"] },
        "https://platform.test",
        fetcher,
      ),
    ).toBe("world");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    null,
    [],
    { schemaVersion: 2, defaultView: "studio" },
    { schemaVersion: 1, defaultView: "elsewhere" },
  ])("rejects unsupported launch configurations", (value) => {
    expect(() => parseWorldOpeningView(value)).toThrow("Invalid World launch");
  });
});
