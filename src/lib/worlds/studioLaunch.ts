import { buildWorldAssetUrl } from "./api";
import type { WorldDescriptor, WorldRuntimeSurface } from "./types";

export type WorldOpeningView = "world" | "studio";
export const WORLD_LAUNCH_FILE = "world-launch.json";

export const opensWorldInStudioByDefault = (
  world: { surfaces: readonly WorldRuntimeSurface[] },
  preference: WorldOpeningView = "world",
): boolean => preference === "studio" && world.surfaces.includes("studio-plugin");

export const parseWorldOpeningView = (value: unknown): WorldOpeningView => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid World launch configuration.");
  const config = value as Record<string, unknown>;
  if (
    config.schemaVersion !== 1 ||
    (config.defaultView !== "world" && config.defaultView !== "studio")
  )
    throw new Error("Invalid World launch configuration.");
  return config.defaultView;
};

export const worldLaunchUrl = (world: WorldDescriptor, baseUrl: string): string => {
  const entry = new URL(buildWorldAssetUrl(world.entryUrn ?? world.entry), baseUrl);
  const entryPath = world.backend?.entryPath ?? "index.html";
  if (!entry.pathname.endsWith(`/${entryPath}`))
    throw new Error("Cannot resolve the World bundle root.");
  entry.pathname = entry.pathname.slice(0, -entryPath.length) + WORLD_LAUNCH_FILE;
  entry.search = "";
  entry.hash = "";
  if (world.backend?.bundleHash) entry.searchParams.set("v", world.backend.bundleHash);
  return entry.href;
};

const launchCache = new Map<string, Promise<WorldOpeningView>>();

/** Creator-owned opt-in. Missing or unreadable preferences preserve the World viewer. */
export const loadWorldOpeningView = async (
  world: WorldDescriptor,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<WorldOpeningView> => {
  if (world.source !== "backend" || !world.surfaces.includes("studio-plugin")) return "world";
  let url: string;
  try {
    url = worldLaunchUrl(world, baseUrl);
  } catch {
    return "world";
  }
  // Injected fetchers are isolated for tests; published assets are cached by bundle hash.
  const cached = fetcher === fetch ? launchCache.get(url) : undefined;
  if (cached) return cached;
  const pending = (async (): Promise<WorldOpeningView> => {
    try {
      const response = await fetcher(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 404) return "world";
      if (!response.ok) throw new Error("World launch configuration unavailable.");
      const text = await response.text();
      if (text.length > 4096) throw new Error("World launch configuration is too large.");
      return parseWorldOpeningView(JSON.parse(text));
    } catch {
      launchCache.delete(url);
      return "world";
    }
  })();
  if (fetcher === fetch) launchCache.set(url, pending);
  return pending;
};

/** Use the stable World id; names and slugs may change after publication. */
export const buildStudioWorldUrl = (worldId: string, connectorName = ""): `/studio?${string}` => {
  const params = new URLSearchParams({ world: worldId });
  if (connectorName.trim()) {
    params.set("network_kind", "connector");
    params.set("network_id", connectorName.trim());
  }
  return `/studio?${params}`;
};
