/** Optional Studio interaction layer carried by the canonical SDK's arbitrary state payload. */
export const WORLD_SOURCE_SELECTION = "decentralised.art:world-source-selection";
export const WORLD_SELECTION_HANDLER = Symbol("studio-world-source-selection");
export type WorldSourceOccurrence = {
  occurrenceId: string;
  nodeId: string;
  pathPrefix: string;
  connectorName: string;
};
export type WorldInteractionContext = {
  protocolVersion: 1;
  revision: string;
  sources: WorldSourceOccurrence[];
  selectedOccurrenceIds: string[];
};
export type WorldSourceSelection = { revision: string; occurrenceIds: string[] };
export type StudioWorldSourceSelection = WorldSourceSelection & { worldNodeId: string };
export type WorldSelectionHandler = (selection: StudioWorldSourceSelection) => void;

/** Never interpret names or arbitrary node IDs supplied by an iframe. */
export function readWorldSourceSelection(
  event: Pick<MessageEvent, "source" | "origin" | "data">,
  options: {
    source: Window | null;
    worldId: string | undefined;
    channelToken: string | undefined;
    context: WorldInteractionContext | undefined;
  },
): WorldSourceSelection | null {
  const { context, source, worldId, channelToken } = options;
  if (
    !source ||
    event.source !== source ||
    event.origin !== "null" ||
    !worldId ||
    !channelToken ||
    !context
  )
    return null;
  const data = event.data;
  if (
    !data ||
    typeof data !== "object" ||
    data.type !== WORLD_SOURCE_SELECTION ||
    data.protocolVersion !== 1 ||
    data.worldId !== worldId ||
    data.channelToken !== channelToken ||
    data.revision !== context.revision ||
    !Array.isArray(data.occurrenceIds) ||
    data.occurrenceIds.length > context.sources.length
  )
    return null;
  const offered = new Set(context.sources.map((source) => source.occurrenceId));
  if (!data.occurrenceIds.every((id: unknown) => typeof id === "string" && offered.has(id)))
    return null;
  return { revision: context.revision, occurrenceIds: [...new Set<string>(data.occurrenceIds)] };
}

/** Selection updates reuse the realization revision. A new result or source graph invalidates old clicks. */
export function createWorldInteractionRegistry() {
  const entries = new Map<
    string,
    {
      streams: unknown;
      sourceKey: string;
      context: WorldInteractionContext;
    }
  >();
  return {
    contextFor(
      worldNodeId: string,
      sources: WorldSourceOccurrence[],
      streams: unknown,
      selectedNodeIds: ReadonlySet<string>,
    ): WorldInteractionContext {
      const sourceKey = JSON.stringify(sources);
      const previous = entries.get(worldNodeId);
      const selectedOccurrenceIds = sources
        .filter((source) => selectedNodeIds.has(source.nodeId))
        .map((source) => source.occurrenceId);
      const sameResult = previous?.streams === streams && previous?.sourceKey === sourceKey;
      if (
        sameResult &&
        JSON.stringify(previous.context.selectedOccurrenceIds) ===
          JSON.stringify(selectedOccurrenceIds)
      )
        return previous.context;
      const context: WorldInteractionContext = {
        protocolVersion: 1,
        revision: sameResult ? previous.context.revision : crypto.randomUUID(),
        sources,
        selectedOccurrenceIds,
      };
      entries.set(worldNodeId, { streams, sourceKey, context });
      return context;
    },
    prune(worldNodeIds: ReadonlySet<string>) {
      for (const id of entries.keys()) if (!worldNodeIds.has(id)) entries.delete(id);
    },
    clear() {
      entries.clear();
    },
  };
}

/** Index stream ancestry once; large scores must not compare every source with every stream. */
export function scopeWorldSourceOccurrences(
  sources: readonly WorldSourceOccurrence[],
  outputPaths: readonly string[],
  targetNodeIds: ReadonlySet<string>,
): WorldSourceOccurrence[] {
  const targetPrefixes = new Set(
    sources
      .filter((source) => targetNodeIds.has(source.nodeId))
      .map((source) => source.pathPrefix.toLowerCase()),
  );
  const contributing = new Set<string>();
  for (const path of outputPaths) {
    const prefixes: string[] = [];
    let ancestry = "";
    for (const segment of path
      .split("/")
      .map((segment) => segment.trim().toLowerCase())
      .filter(Boolean)) {
      prefixes.push(`${ancestry}/${segment.split(":")[0]}:*`);
      ancestry += `/${segment}`;
    }
    if (prefixes.some((prefix) => targetPrefixes.has(prefix)))
      for (const prefix of prefixes) contributing.add(prefix);
  }
  return sources.filter((source) => contributing.has(source.pathPrefix.toLowerCase()));
}
