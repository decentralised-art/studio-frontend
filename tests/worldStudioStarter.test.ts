import { describe, expect, it, vi } from "vitest";
import {
  loadWorldStudioStarter,
  parseWorldStudioStarter,
  worldStudioStarterUrl,
} from "../src/lib/worlds/studioStarter";
import type { WorldDescriptor } from "../src/lib/worlds/types";

const starter = {
  schemaVersion: 1,
  connector: "arbitrary_collection",
  particlesCount: 8,
  dynamicRi: { "0": { start_point: 60, transformation_shift: 2 } },
  simulate: true,
};
const world = {
  entry: "/services/world-assets/id/nested/index.html?worldId=id",
  backend: { entryPath: "nested/index.html" },
} as WorldDescriptor;

describe("World-owned Studio starters", () => {
  it("loads from the bundle root, preserving deployment prefixes and nested entries", async () => {
    expect(worldStudioStarterUrl(world, "https://platform.test/studio")).toBe(
      "https://platform.test/services/world-assets/id/studio-starter.json",
    );
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(starter)));
    expect(await loadWorldStudioStarter(world, "https://platform.test", fetcher)).toEqual(starter);
    expect(fetcher).toHaveBeenCalledWith(
      "https://platform.test/services/world-assets/id/studio-starter.json",
      { credentials: "omit" },
    );
  });
  it("preserves legacy Worlds without an optional file, but reports broken starters", async () => {
    expect(
      await loadWorldStudioStarter(
        world,
        "https://platform.test",
        vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      ),
    ).toBeNull();
    await expect(
      loadWorldStudioStarter(
        world,
        "https://platform.test",
        vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
      ),
    ).rejects.toThrow("503");
    await expect(
      loadWorldStudioStarter(
        world,
        "https://platform.test",
        vi.fn().mockResolvedValue(new Response("{}")),
      ),
    ).rejects.toThrow("Invalid World");
    await expect(
      loadWorldStudioStarter(
        world,
        "https://platform.test",
        vi.fn().mockResolvedValue(new Response(" ".repeat(65537))),
      ),
    ).rejects.toThrow("64 KB");
  });
  it.each([
    { ...starter, schemaVersion: 2 },
    { ...starter, connector: "https://example.test" },
    { ...starter, particlesCount: 0 },
    { ...starter, particlesCount: 1.2 },
    { ...starter, particlesCount: 10001 },
    { ...starter, simulate: "execute" },
    { ...starter, dynamicRi: { "-1": { start_point: 1, transformation_shift: 0 } } },
    { ...starter, dynamicRi: { "0": { start_point: 1, transformation_shift: -1 } } },
    { ...starter, dynamicRi: { "0": { start_point: "60", transformation_shift: 0 } } },
  ])("rejects malformed starter inputs: %j", (value) => {
    expect(() => parseWorldStudioStarter(value)).toThrow("Invalid World");
  });
});
