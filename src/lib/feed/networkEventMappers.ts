import type { ExploreParticle } from "$lib/data/exploreParticles";
import type {
  ConnectorPostEvent,
  NetworkFeedEvent,
  RuntimeCodePostEvent,
} from "$lib/feed/particlePostData";
import type { ChainStudioSyncResult } from "$lib/studio/chainStudioAdapter";

const compareNewestFirst = (
  a: { createdAt: number; id: string },
  b: { createdAt: number; id: string },
) => {
  const byCreatedAt = b.createdAt - a.createdAt;
  if (byCreatedAt !== 0) return byCreatedAt;
  return b.id.localeCompare(a.id);
};

export const mapSnapshotParticlesToConnectorEvents = (
  authorAddress: string,
  particles: Array<
    Pick<
      ExploreParticle,
      "id" | "name" | "createdAt" | "createdLabel" | "dependencies" | "formatHash"
    >
  >,
): ConnectorPostEvent[] =>
  particles
    .map(
      (particle): ConnectorPostEvent => ({
        type: "connector",
        id: `event-connector-created-${particle.id}`,
        authorId: authorAddress,
        createdAt: Number.isFinite(particle.createdAt) ? particle.createdAt : 0,
        createdLabel: particle.createdLabel || "",
        particleId: particle.id,
        particleLabel: particle.name,
        usedParticleIds: [...particle.dependencies],
        usedParticleLabels: [...particle.dependencies],
        createdNodeIds: [],
        reusedNodeIds: [],
        focusNodeIds: [],
        ...(particle.formatHash ? { formatHash: particle.formatHash } : {}),
      }),
    )
    .sort(compareNewestFirst);

const normalizeRuntimeSnippet = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const returnMatch = trimmed.match(/\breturn\b[\s\S]*?;/i);
  if (returnMatch) return returnMatch[0].replace(/\s+/g, " ").trim();
  return trimmed.replace(/\s+/g, " ").trim();
};

const mapSnapshotRuntimeCodeToEvents = (
  authorAddress: string,
  snapshot: Pick<ChainStudioSyncResult, "library">,
): RuntimeCodePostEvent[] => {
  const transformations = snapshot.library.transformations
    .map((item): RuntimeCodePostEvent | null => {
      const transformationId = item.id.replace(/^transform-/, "").trim() || item.id;
      const runtimeSnippet = normalizeRuntimeSnippet(
        item.runtimeSnippet?.trim() || item.summary?.trim() || "",
      );
      if (!runtimeSnippet) return null;
      return {
        type: "transformation",
        id: `event-transformation-created-${transformationId}`,
        authorId: authorAddress,
        createdAt: 0,
        createdLabel: "",
        elementId: transformationId,
        elementLabel: item.name,
        runtimeSnippet,
      };
    })
    .filter((event): event is RuntimeCodePostEvent => Boolean(event));

  const conditions = snapshot.library.conditions
    .map((item): RuntimeCodePostEvent | null => {
      const conditionId = item.id.replace(/^condition-/, "").trim() || item.id;
      const runtimeSnippet = normalizeRuntimeSnippet(
        item.runtimeSnippet?.trim() || item.summary?.trim() || "",
      );
      if (!runtimeSnippet) return null;
      return {
        type: "condition",
        id: `event-condition-created-${conditionId}`,
        authorId: authorAddress,
        createdAt: 0,
        createdLabel: "",
        elementId: conditionId,
        elementLabel: item.name,
        runtimeSnippet,
      };
    })
    .filter((event): event is RuntimeCodePostEvent => Boolean(event));

  return [...transformations, ...conditions];
};

export const mapSnapshotToNetworkFeedEvents = (
  authorAddress: string,
  snapshot: ChainStudioSyncResult,
): NetworkFeedEvent[] =>
  [
    ...mapSnapshotParticlesToConnectorEvents(authorAddress, snapshot.particles),
    ...mapSnapshotRuntimeCodeToEvents(authorAddress, snapshot),
  ].sort(compareNewestFirst);
