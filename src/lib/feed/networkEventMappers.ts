import type { ExploreParticle } from "$lib/data/exploreParticles";
import type { ConnectorPostEvent } from "$lib/feed/particlePostData";

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
