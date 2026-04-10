import { browser } from "$app/environment";
import { listServicesUsers } from "$lib/auth/api";
import { getOrCreateMockEthereumAccount } from "$lib/auth/mockEthereum";
import { fromProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import {
  getChainAccount,
  getChainCondition,
  getChainConnector,
  getChainTransformation,
  type ChainConnectorResponse,
} from "$lib/chain/registryApi";
import type { ExploreParticle } from "$lib/data/exploreParticles";
import type { LibraryItem } from "$lib/data/studioLibrary";
import {
  extraChainSyncSources,
  mockUserSeedChainSyncSources,
  mockUsers,
  mockUsersById,
} from "$lib/data/users";
import type { MockFeatureDef, MockParticleDef } from "$lib/particles/mockPtNetwork";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";

type ChainRuntimeShape = {
  connectors: Record<string, StudioConnectorDef>;
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
    connector?: StudioConnectorDef;
    feature?: MockFeatureDef;
    particle?: MockParticleDef;
  };
  particleMeta?: ExploreParticle;
};

export type ChainOwnerSyncSource = {
  address: string;
  authorId: string;
  label: string;
};

const normalizeAddress = (value: string) => value.trim().toLowerCase();

const fallbackAuthorIdFromAddress = (address: string) => {
  const normalized = normalizeAddress(address).replace(/^0x/, "");
  return normalized ? `chain-source-${normalized.slice(0, 8)}` : "chain-source-unknown";
};

const sourceLabelFromUser = (user: Record<string, unknown>) => {
  const displayName =
    typeof user.display_name === "string"
      ? user.display_name.trim()
      : typeof user.displayName === "string"
        ? user.displayName.trim()
        : "";
  if (displayName) return displayName;
  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (email) return email;
  const id = typeof user.id === "string" ? user.id.trim() : "";
  return id || "Unknown user";
};

const mockUserIdFromServicesUser = (
  user: Record<string, unknown>,
): keyof typeof mockUsersById | null => {
  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email.endsWith("@mock.decentralised.art")) {
    const id = email.replace(/@mock\.decentralised\.art$/i, "");
    if (id in mockUsersById) return id as keyof typeof mockUsersById;
  }

  const displayName =
    typeof user.display_name === "string"
      ? user.display_name.trim()
      : typeof user.displayName === "string"
        ? user.displayName.trim()
        : "";
  if (displayName) {
    const match = Object.values(mockUsersById).find((entry) => entry.nickname === displayName);
    if (match) return match.id as keyof typeof mockUsersById;
  }

  return null;
};

const resolveMockRuntimeAddress = (userId: string): string => {
  if (!browser) return "";
  try {
    return normalizeAddress(getOrCreateMockEthereumAccount(`mock-user:${userId}`).address);
  } catch {
    return "";
  }
};

const addSource = (dedup: Map<string, ChainOwnerSyncSource>, source: ChainOwnerSyncSource) => {
  const address = normalizeAddress(source.address);
  if (!address) return;
  if (dedup.has(address)) return;
  dedup.set(address, {
    address,
    authorId: source.authorId,
    label: source.label,
  });
};

const fallbackChainSyncSources = (): ChainOwnerSyncSource[] => {
  const dedup = new Map<string, ChainOwnerSyncSource>();

  // 1) Seed addresses from source data (immutable baseline)
  mockUserSeedChainSyncSources.forEach((entry) => {
    addSource(dedup, {
      address: entry.address,
      authorId: entry.id,
      label: entry.label,
    });
  });

  // 2) Current in-memory mock addresses (may be patched after chain auth)
  mockUsers.forEach((entry) => {
    addSource(dedup, {
      address: entry.address,
      authorId: entry.id,
      label: entry.nickname,
    });
  });

  // 3) Deterministic runtime wallet aliases used by chain auth
  mockUsers.forEach((entry) => {
    const runtimeAddress = resolveMockRuntimeAddress(entry.id);
    if (!runtimeAddress) return;
    addSource(dedup, {
      address: runtimeAddress,
      authorId: entry.id,
      label: entry.nickname,
    });
  });

  // 4) External explicit sources
  extraChainSyncSources.forEach((entry) => {
    addSource(dedup, {
      address: entry.address,
      authorId: entry.id,
      label: entry.label,
    });
  });

  return Array.from(dedup.values());
};

let chainSyncSourcesCache: ChainOwnerSyncSource[] | null = null;
let chainSyncSourcesLoadPromise: Promise<ChainOwnerSyncSource[]> | null = null;

export const listChainSyncSourcesForApp = async (options?: {
  force?: boolean;
}): Promise<ChainOwnerSyncSource[]> => {
  if (chainSyncSourcesCache && !options?.force) return chainSyncSourcesCache;
  if (chainSyncSourcesLoadPromise && !options?.force) return chainSyncSourcesLoadPromise;

  chainSyncSourcesLoadPromise = (async () => {
    const fallback = fallbackChainSyncSources();
    try {
      const users = await listServicesUsers();
      const byAddress = new Map<string, ChainOwnerSyncSource>();
      users.forEach((user) => {
        const addressRaw =
          typeof user.ethereum_address === "string"
            ? user.ethereum_address
            : typeof user.ethereumAddress === "string"
              ? user.ethereumAddress
              : "";
        const address = normalizeAddress(addressRaw);
        if (!address) return;
        if (byAddress.has(address)) return;
        const mockId = mockUserIdFromServicesUser(user);
        const authorId =
          mockId ??
          (typeof user.id === "string" && user.id.trim().length > 0
            ? user.id.trim()
            : fallbackAuthorIdFromAddress(address));
        const mockLabel = mockId ? (mockUsersById[mockId]?.nickname ?? "") : "";
        byAddress.set(address, {
          address,
          authorId,
          label: mockLabel || sourceLabelFromUser(user),
        });
      });

      // Temporary workaround: always merge with known mock/fallback sources.
      // Services users can be incomplete early in development (e.g., missing ethereum_address).
      fallback.forEach((source) => {
        const address = normalizeAddress(source.address);
        if (!address) return;
        if (byAddress.has(address)) return;
        byAddress.set(address, {
          address,
          authorId: source.authorId,
          label: source.label,
        });
      });

      const merged = Array.from(byAddress.values());
      if (merged.length > 0) {
        chainSyncSourcesCache = merged;
        return merged;
      }
    } catch (error) {
      console.warn("[Chain sync] Failed to load users from services API.", error);
    }

    chainSyncSourcesCache = fallback;
    return fallback;
  })();

  try {
    return await chainSyncSourcesLoadPromise;
  } finally {
    chainSyncSourcesLoadPromise = null;
  }
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

const extractCreatedAtFromRecord = (record: Record<string, unknown>): number | null => {
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

const extractConnectorCreatedAt = (payload: ChainConnectorResponse): number | null =>
  extractCreatedAtFromRecord(payload as Record<string, unknown>);

const connectorToFeature = (connector: StudioConnectorDef): MockFeatureDef => ({
  name: connector.name,
  dimensions: connector.dimensions.map((dimension, index) => ({
    label: `dim-${index + 1}`,
    transformations: dimension.transformations.map((tx) => ({
      // Runtime currently supports known local transformation names only.
      // Keep chain names for sync/deploy metadata; local run will use identity placeholders.
      name: tx.name as never,
      args: [...tx.args],
    })),
  })),
});

const connectorToParticle = (connector: StudioConnectorDef): MockParticleDef => ({
  name: connector.name,
  featureName: connector.name,
  composites: connector.dimensions.map((dimension) => dimension.composite ?? null),
  conditionName: connector.conditionName,
  conditionArgs: connector.conditionName ? [...(connector.conditionArgs ?? [])] : undefined,
});

const normalizeConnector = (payload: ChainConnectorResponse): StudioConnectorDef | null => {
  try {
    return fromProtocolConnectorPayload(payload);
  } catch {
    return null;
  }
};

const mapFeatureLibraryItem = (feature: MockFeatureDef, authorId: string): LibraryItem => ({
  id: `feature-${feature.name}`,
  name: feature.name,
  kind: "feature",
  authorId,
  summary: "Synced from chain.",
  dimensions: feature.dimensions.length,
});

const extractRuntimeSnippet = (solSrc?: string): string | undefined => {
  if (!solSrc) return undefined;
  const trimmed = solSrc.trim();
  if (!trimmed) return undefined;
  const returnMatch = trimmed.match(/\breturn\b[\s\S]*?;/i);
  if (returnMatch) {
    return returnMatch[0].replace(/\s+/g, " ").trim();
  }
  const firstLine = trimmed
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine;
};

const mapTransformationLibraryItem = (
  name: string,
  authorId: string,
  solSrc?: string,
): LibraryItem => ({
  id: `transform-${name}`,
  name,
  kind: "transformation",
  authorId,
  summary: "Synced from chain.",
  runtimeSnippet: extractRuntimeSnippet(solSrc),
});

const mapConditionLibraryItem = (name: string, authorId: string, solSrc?: string): LibraryItem => ({
  id: `condition-${name}`,
  name,
  kind: "condition",
  authorId,
  summary: "Synced from chain.",
  runtimeSnippet: extractRuntimeSnippet(solSrc),
});

const mapExploreParticle = (
  particle: MockParticleDef,
  authorId: string,
  createdAt: number,
): ExploreParticle => ({
  id: particle.name,
  name: particle.name,
  summary: "Synced from chain.",
  authorId,
  viewId: "midi",
  createdAt,
  createdLabel: "just synced",
  ingredients: [
    particle.featureName,
    ...particle.composites
      .filter((name): name is string => typeof name === "string" && name.length > 0)
      .map((name) => name),
  ],
  complexity: 1 + particle.composites.filter(Boolean).length,
  transactionName: `${particle.name} PT`,
  dependencies: particle.composites.filter(Boolean) as string[],
});

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const fetchChainOwnedStudioSnapshot = async (
  address: string,
  options: { authorId: string; limit?: number; includeRuntimeCode?: boolean } = {
    authorId: "user-lyra",
    includeRuntimeCode: true,
  },
): Promise<ChainStudioSyncResult> => {
  const account = await getChainAccount(address, {
    limit: options.limit ?? 200,
  });

  const ownedConnectors = uniqueStrings(account.owned_connectors ?? []);
  const ownedTransformations = uniqueStrings(account.owned_transformations ?? []);
  const ownedConditions = uniqueStrings(account.owned_conditions ?? []);

  const connectorPayloads = (
    await Promise.allSettled(
      ownedConnectors.map(async (name) => [name, await getChainConnector(name)] as const),
    )
  )
    .filter(
      (result): result is PromiseFulfilledResult<readonly [string, ChainConnectorResponse]> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  const includeRuntimeCode = options.includeRuntimeCode !== false;
  const transformationPayloads = includeRuntimeCode
    ? (
        await Promise.allSettled(
          ownedTransformations.map(
            async (name) => [name, await getChainTransformation(name)] as const,
          ),
        )
      )
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<
            readonly [string, Awaited<ReturnType<typeof getChainTransformation>>]
          > => result.status === "fulfilled",
        )
        .map((result) => result.value)
    : [];
  const conditionPayloads = includeRuntimeCode
    ? (
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
        .map((result) => result.value)
    : [];

  const connectors: Record<string, StudioConnectorDef> = {};
  const features: Record<string, MockFeatureDef> = {};
  const particles: Record<string, MockParticleDef> = {};
  const transformations: Record<string, { argc: number }> = {};
  const conditions: Record<string, { argc: number }> = {};

  connectorPayloads.forEach(([, payload]) => {
    const connector = normalizeConnector(payload);
    if (!connector) return;

    connectors[connector.name] = connector;

    const feature = connectorToFeature(connector);
    const particle = connectorToParticle(connector);

    features[feature.name] = feature;
    particles[particle.name] = particle;

    connector.dimensions.forEach((dimension) => {
      dimension.transformations.forEach((tx) => {
        const argc = tx.args.length;
        transformations[tx.name] = {
          argc: Math.max(argc, transformations[tx.name]?.argc ?? 0),
        };
      });
    });

    if (connector.conditionName) {
      conditions[connector.conditionName] = {
        argc: Math.max(
          connector.conditionArgs?.length ?? 0,
          conditions[connector.conditionName]?.argc ?? 0,
        ),
      };
    }
  });

  if (includeRuntimeCode) {
    // Backfill explicit owned condition names even if no particle references them.
    conditionPayloads.forEach(([name]) => {
      const key = name.trim();
      if (!key) return;
      conditions[key] ??= { argc: 0 };
    });
  }

  return {
    registry: {
      connectors,
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
    particles: connectorPayloads
      .map(([, payload]) => {
        const connector = normalizeConnector(payload);
        if (!connector) return null;
        const particle = connectorToParticle(connector);
        return mapExploreParticle(
          particle,
          options.authorId,
          extractConnectorCreatedAt(payload) ?? 0,
        );
      })
      .filter((particle): particle is ExploreParticle => Boolean(particle)),
  };
};

export const fetchChainParticleForStudio = async (
  particleName: string,
  options?: { authorId?: string },
): Promise<ChainStudioParticleFetchResult> => {
  const connectorPayload = await getChainConnector(particleName);
  const connector = normalizeConnector(connectorPayload);
  if (!connector) return { registry: {} };

  const feature = connectorToFeature(connector);
  const particle = connectorToParticle(connector);
  const ownerAddress = (connectorPayload.owner ?? "").toLowerCase();
  let authorId = options?.authorId?.trim() ?? "";
  if (!authorId && ownerAddress) {
    try {
      const sources = await listChainSyncSourcesForApp();
      authorId =
        sources.find(
          (source) => normalizeAddress(source.address) === normalizeAddress(ownerAddress),
        )?.authorId ?? "";
    } catch {
      authorId = "";
    }
  }
  if (!authorId) {
    authorId = mockUsers.find((user) => normalizeAddress(user.address) === ownerAddress)?.id ?? "";
  }
  if (!authorId) {
    authorId = fallbackAuthorIdFromAddress(ownerAddress);
  }

  return {
    registry: {
      connector,
      feature,
      particle,
    },
    particleMeta: mapExploreParticle(
      particle,
      authorId,
      extractConnectorCreatedAt(connectorPayload) ?? Date.now(),
    ),
  };
};
