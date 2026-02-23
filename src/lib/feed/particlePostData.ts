import { mockExploreParticles, type ExploreParticle } from "$lib/data/exploreParticles";
import { mockSocialEvents, type SocialEvent } from "$lib/social/mockSocialFeed";

export type ParticlePostEvent = SocialEvent;

export type ParticleRecord = Pick<
  ExploreParticle,
  "id" | "name" | "summary" | "authorId" | "createdAt" | "createdLabel" | "dependencies"
>;

const mockParticleById = new Map(
  mockExploreParticles.map((particle) => [particle.id, particle] as const),
);

export const listParticlePosts = (): ParticlePostEvent[] => mockSocialEvents;

export const listParticlePostsByAuthor = (authorId: string): ParticlePostEvent[] =>
  mockSocialEvents.filter((event) => event.authorId === authorId);

export const listParticlePostsReferencingParticle = (particleId: string): ParticlePostEvent[] =>
  mockSocialEvents.filter((event) => event.usedParticleIds.includes(particleId));

export const getParticleRecordById = (particleId: string): ParticleRecord | null => {
  const particle = mockParticleById.get(particleId);
  if (!particle) return null;
  return {
    id: particle.id,
    name: particle.name,
    summary: particle.summary,
    authorId: particle.authorId,
    createdAt: particle.createdAt,
    createdLabel: particle.createdLabel,
    dependencies: [...particle.dependencies],
  };
};

/**
 * Backend alignment plan (future implementation target):
 * - listParticlePosts(): GET /social/feed
 * - listParticlePostsByAuthor(authorId): GET /social/feed?author_id=:id (or GET /users/:id/feed)
 * - listParticlePostsReferencingParticle(particleId): GET /particles/:id/references?immediate=true
 * - getParticleRecordById(particleId): GET /particles/:id
 */
