import {
  getChainAccount,
  getChainCondition,
  getChainFeature,
  getChainParticle,
  getChainTransformation,
  type ChainFeatureResponse,
  type ChainParticleResponse,
} from "$lib/chain/registryApi";
import type { ExploreParticle } from "$lib/data/exploreParticles";
import type { LibraryItem } from "$lib/data/studioLibrary";
import { mockUsers } from "$lib/data/users";
import type { MockFeatureDef, MockParticleDef } from "$lib/particles/mockPtNetwork";

type ChainRuntimeShape = {
  features: Record<string, MockFeatureDef>;
  particles: Record<string, MockParticleDef>;
  transformations: Record<string, { argc: number }>;
  conditions: Record<string, { argc: number }>;
};

export type ChainStudioSyncResult = {
  registry: ChainRuntimeShape;
  library: {
    features: LibraryItem[];
    transformations: LibraryItem[];
    conditions: LibraryItem[];
  };
  particles: ExploreParticle[];
};

export type ChainStudioParticleFetchResult = {
  registry: {
    feature?: MockFeatureDef;
    particle?: MockParticleDef;
  };
  particleMeta?: ExploreParticle;
};

const normalizeEpochMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) return null;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
};

const extractParticleCreatedAt = (payload: ChainParticleResponse): number | null => {
  const record = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    record.created_at,
    record.createdAt,
    record.timestamp,
    record.time,
    record.block_time,
    record.blockTime,
    record.block_timestamp,
    record.blockTimestamp,
    record.tx_time,
    record.txTime,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeEpochMs(candidate);
    if (normalized !== null) return normalized;
  }

  return null;
};

const titleize = (value: string) =>
  value
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const normalizeCompositeNames = (payload: ChainParticleResponse): Array<string | null> =>
  (payload.composite_names ?? payload.compositeNames ?? payload.composites ?? []).map((entry) =>
    typeof entry === "string" && entry.trim().length > 0 ? entry.trim() : null,
  );

const normalizeFeatureName = (payload: ChainParticleResponse) =>
  (payload.feature_name ?? payload.featureName ?? "").trim();

const normalizeConditionName = (payload: ChainParticleResponse) =>
  (payload.condition_name ?? payload.conditionName ?? "").trim() || undefined;

const normalizeConditionArgs = (payload: ChainParticleResponse) =>
  (payload.condition_args ?? payload.conditionArgs ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

const normalizeFeature = (payload: ChainFeatureResponse): MockFeatureDef | null => {
  const name = (payload.name ?? "").trim();
  if (!name) return null;
  const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  return {
    name,
    dimensions: dimensions.map((dimension, index) => ({
      label: `dim-${index + 1}`,
      transformations: (dimension.transformations ?? [])
        .map((tx) => {
          const txName = typeof tx?.name === "string" ? tx.name.trim() : "";
          if (!txName) return null;
          const args = Array.isArray(tx?.args)
            ? tx.args.filter((value): value is number => typeof value === "number")
            : [];
          return { name: txName as never, args };
        })
        .filter((tx): tx is { name: never; args: number[] } => Boolean(tx)),
    })),
  };
};

const normalizeParticle = (payload: ChainParticleResponse): MockParticleDef | null => {
  const name = (payload.name ?? "").trim();
  const featureName = normalizeFeatureName(payload);
  if (!name || !featureName) return null;
  const conditionName = normalizeConditionName(payload);
  const conditionArgs = normalizeConditionArgs(payload);
  return {
    name,
    featureName,
    composites: normalizeCompositeNames(payload),
    conditionName,
    conditionArgs: conditionName ? conditionArgs : undefined,
  };
};

const mapFeatureLibraryItem = (feature: MockFeatureDef, authorId: string): LibraryItem => ({
  id: `feature-${feature.name}`,
  name: titleize(feature.name),
  kind: "feature",
  authorId,
  summary: "Synced from chain.",
  dimensions: feature.dimensions.length,
});

const mapTransformationLibraryItem = (
  name: string,
  authorId: string,
  solSrc?: string,
): LibraryItem => ({
  id: `transform-${name}`,
  name: titleize(name),
  kind: "transformation",
  authorId,
  summary: solSrc ? "Synced from chain Solidity source." : "Synced from chain.",
});

const mapConditionLibraryItem = (name: string, authorId: string, solSrc?: string): LibraryItem => ({
  id: `condition-${name}`,
  name: titleize(name),
  kind: "condition",
  authorId,
  summary: solSrc ? "Synced from chain Solidity source." : "Synced from chain.",
});

const mapExploreParticle = (
  particle: MockParticleDef,
  authorId: string,
  createdAt: number,
): ExploreParticle => ({
  id: particle.name,
  name: titleize(particle.name),
  summary: "Synced from chain.",
  authorId,
  viewId: "midi",
  createdAt,
  createdLabel: "just synced",
  ingredients: [
    titleize(particle.featureName),
    ...particle.composites.filter(Boolean).map(titleize),
  ],
  complexity: 1 + particle.composites.filter(Boolean).length,
  transactionName: `${titleize(particle.name)} PT`,
  dependencies: particle.composites.filter(Boolean) as string[],
});

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const fetchChainOwnedStudioSnapshot = async (
  address: string,
  options: { authorId: string; limit?: number; page?: number } = { authorId: "user-lyra" },
): Promise<ChainStudioSyncResult> => {
  const account = await getChainAccount(address, {
    limit: options.limit ?? 200,
    page: options.page ?? 0,
  });

  const ownedFeatures = uniqueStrings(account.owned_features ?? []);
  const ownedTransformations = uniqueStrings(account.owned_transformations ?? []);
  const ownedConditions = uniqueStrings(account.owned_conditions ?? []);
  const ownedParticles = uniqueStrings(account.owned_particles ?? []);

  const featurePayloads = (
    await Promise.allSettled(ownedFeatures.map((name) => getChainFeature(name)))
  )
    .filter(
      (result): result is PromiseFulfilledResult<ChainFeatureResponse> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  const particlePayloads = (
    await Promise.allSettled(
      ownedParticles.map(async (name) => [name, await getChainParticle(name)] as const),
    )
  )
    .filter(
      (result): result is PromiseFulfilledResult<readonly [string, ChainParticleResponse]> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  const transformationPayloads = (
    await Promise.allSettled(
      ownedTransformations.map(async (name) => [name, await getChainTransformation(name)] as const),
    )
  )
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        readonly [string, Awaited<ReturnType<typeof getChainTransformation>>]
      > => result.status === "fulfilled",
    )
    .map((result) => result.value);
  const conditionPayloads = (
    await Promise.allSettled(
      ownedConditions.map(async (name) => [name, await getChainCondition(name)] as const),
    )
  )
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        readonly [string, Awaited<ReturnType<typeof getChainCondition>>]
      > => result.status === "fulfilled",
    )
    .map((result) => result.value);

  const features: Record<string, MockFeatureDef> = {};
  const particles: Record<string, MockParticleDef> = {};
  const transformations: Record<string, { argc: number }> = {};
  const conditions: Record<string, { argc: number }> = {};

  featurePayloads.forEach((payload) => {
    const feature = normalizeFeature(payload);
    if (!feature) return;
    features[feature.name] = feature;
    feature.dimensions.forEach((dimension) => {
      dimension.transformations.forEach((tx) => {
        const argc = tx.args.length;
        transformations[tx.name as string] = {
          argc: Math.max(argc, transformations[tx.name as string]?.argc ?? 0),
        };
      });
    });
  });

  particlePayloads.forEach(([, payload]) => {
    const particle = normalizeParticle(payload);
    if (!particle) return;
    particles[particle.name] = particle;
    if (particle.conditionName) {
      conditions[particle.conditionName] = {
        argc: Math.max(
          particle.conditionArgs?.length ?? 0,
          conditions[particle.conditionName]?.argc ?? 0,
        ),
      };
    }
  });

  // Backfill explicit owned condition names even if no particle references them.
  conditionPayloads.forEach(([name]) => {
    const key = name.trim();
    if (!key) return;
    conditions[key] ??= { argc: 0 };
  });

  const syncedAt = Date.now();

  return {
    registry: {
      features,
      particles,
      transformations,
      conditions,
    },
    library: {
      features: Object.values(features).map((item) =>
        mapFeatureLibraryItem(item, options.authorId),
      ),
      transformations: transformationPayloads.map(([name, payload]) =>
        mapTransformationLibraryItem(name, options.authorId, payload.sol_src),
      ),
      conditions: conditionPayloads.map(([name, payload]) =>
        mapConditionLibraryItem(name, options.authorId, payload.sol_src),
      ),
    },
    particles: particlePayloads
      .map(([, payload], index) => {
        const particle = normalizeParticle(payload);
        if (!particle) return null;
        return mapExploreParticle(
          particle,
          options.authorId,
          extractParticleCreatedAt(payload) ?? Math.max(1, syncedAt - index),
        );
      })
      .filter((particle): particle is ExploreParticle => Boolean(particle)),
  };
};

export const fetchChainParticleForStudio = async (
  particleName: string,
  options?: { authorId?: string },
): Promise<ChainStudioParticleFetchResult> => {
  const particlePayload = await getChainParticle(particleName);
  const particle = normalizeParticle(particlePayload);
  if (!particle) return { registry: {} };

  const featurePayload = await getChainFeature(particle.featureName);
  const feature = normalizeFeature(featurePayload) ?? undefined;
  const ownerAddress = (particlePayload.owner ?? "").toLowerCase();
  const authorId =
    options?.authorId?.trim() ||
    mockUsers.find((user) => (user.address ?? "").toLowerCase() === ownerAddress)?.id ||
    "user-lyra";

  return {
    registry: {
      feature,
      particle,
    },
    particleMeta: mapExploreParticle(
      particle,
      authorId,
      extractParticleCreatedAt(particlePayload) ?? Date.now(),
    ),
  };
};
