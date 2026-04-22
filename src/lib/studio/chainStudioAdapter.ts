import { fromProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import {
  getChainAccount,
  getChainAccounts,
  getChainCondition,
  getChainConnector,
  getChainTransformation,
  resolveChainAccountCursor,
  resolveChainAccountsCursor,
  type RawChainConnectorResponse,
} from "$lib/chain/registryApi";
import type { ExploreParticle } from "$lib/data/exploreParticles";
import type { LibraryItem } from "$lib/data/studioLibrary";
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

const CHAIN_ACCOUNTS_PAGE_LIMIT = 256;
const CHAIN_ACCOUNTS_PAGE_GUARD = 128;
const CHAIN_ACCOUNT_OWNED_PAGE_LIMIT = 256;
const CHAIN_ACCOUNT_OWNED_PAGE_GUARD = 256;
const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;

const normalizeAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return withPrefix;
};

const isChainAddress = (value: string): boolean => ETH_ADDRESS_RE.test(value);

const shortAddress = (address: string): string => {
  const normalized = normalizeAddress(address);
  if (!isChainAddress(normalized)) return normalized || "Unknown account";
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
};

let chainSyncSourcesCache: ChainOwnerSyncSource[] | null = null;
let chainSyncSourcesLoadPromise: Promise<ChainOwnerSyncSource[]> | null = null;

export const listChainSyncSourcesForApp = async (options?: {
  force?: boolean;
}): Promise<ChainOwnerSyncSource[]> => {
  if (chainSyncSourcesCache && !options?.force) return chainSyncSourcesCache;
  if (chainSyncSourcesLoadPromise && !options?.force) return chainSyncSourcesLoadPromise;

  chainSyncSourcesLoadPromise = (async () => {
    const byAddress = new Map<string, ChainOwnerSyncSource>();

    let after: string | null = null;
    let guard = 0;
    do {
      const response = await getChainAccounts({
        limit: CHAIN_ACCOUNTS_PAGE_LIMIT,
        ...(after ? { after } : {}),
      });
      const accounts = Array.isArray(response.accounts) ? response.accounts : [];
      accounts.forEach((value) => {
        const address = normalizeAddress(value);
        if (!isChainAddress(address)) return;
        if (byAddress.has(address)) return;
        byAddress.set(address, {
          address,
          authorId: address,
          label: shortAddress(address),
        });
      });
      const cursor = resolveChainAccountsCursor(response);
      if (!cursor.hasMore || !cursor.nextAfter) break;
      after = cursor.nextAfter;
      guard += 1;
    } while (guard < CHAIN_ACCOUNTS_PAGE_GUARD);

    const resolved = Array.from(byAddress.values()).sort((a, b) =>
      a.address.localeCompare(b.address),
    );
    chainSyncSourcesCache = resolved;
    return resolved;
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

const extractConnectorCreatedAt = (payload: RawChainConnectorResponse): number | null =>
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

const cloneStaticRi = (
  staticRi: StudioConnectorDef["staticRi"],
): StudioConnectorDef["staticRi"] => {
  if (!staticRi) return undefined;
  const out: NonNullable<StudioConnectorDef["staticRi"]> = {};
  Object.entries(staticRi).forEach(([key, value]) => {
    out[key] = {
      startPoint: value.startPoint,
      transformationShift: value.transformationShift,
    };
  });
  return out;
};

const cloneConnectorDef = (connector: StudioConnectorDef): StudioConnectorDef => ({
  name: connector.name,
  dimensions: connector.dimensions.map((dimension) => ({
    transformations: dimension.transformations.map((tx) => ({
      name: tx.name,
      args: [...tx.args],
    })),
    ...(dimension.composite ? { composite: dimension.composite } : {}),
    bindings: { ...(dimension.bindings ?? {}) },
    ...(typeof dimension.riStart === "number" ? { riStart: dimension.riStart } : {}),
    ...(typeof dimension.riShift === "number" ? { riShift: dimension.riShift } : {}),
  })),
  ...(connector.conditionName ? { conditionName: connector.conditionName } : {}),
  ...(connector.conditionArgs ? { conditionArgs: [...connector.conditionArgs] } : {}),
  ...(connector.staticRi ? { staticRi: cloneStaticRi(connector.staticRi) } : {}),
  ...(connector.formatHash ? { formatHash: connector.formatHash } : {}),
  ...(connector.localAddress ? { localAddress: connector.localAddress } : {}),
  ...(connector.ownerAddress ? { ownerAddress: connector.ownerAddress } : {}),
});

const normalizeConnector = (payload: RawChainConnectorResponse): StudioConnectorDef | null => {
  try {
    return cloneConnectorDef(fromProtocolConnectorPayload(payload));
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
  formatHash?: string,
): ExploreParticle => ({
  id: particle.name,
  name: particle.name,
  summary: "Synced from chain.",
  authorId,
  viewId: "midi",
  createdAt,
  createdLabel: "",
  ingredients: [
    particle.featureName,
    ...particle.composites
      .filter((name): name is string => typeof name === "string" && name.length > 0)
      .map((name) => name),
  ],
  complexity: 1 + particle.composites.filter(Boolean).length,
  transactionName: `${particle.name} PT`,
  dependencies: particle.composites.filter(Boolean) as string[],
  ...(formatHash ? { formatHash } : {}),
});

export const fetchChainOwnedStudioSnapshot = async (
  address: string,
  options: { authorId: string; limit?: number; includeRuntimeCode?: boolean } = {
    authorId: normalizeAddress(address) || "unknown-owner",
    includeRuntimeCode: true,
  },
): Promise<ChainStudioSyncResult> => {
  const pageLimit = options.limit ?? CHAIN_ACCOUNT_OWNED_PAGE_LIMIT;
  const ownedConnectors = new Set<string>();
  const ownedTransformations = new Set<string>();
  const ownedConditions = new Set<string>();
  let afterConnectors: string | null = null;
  let afterTransformations: string | null = null;
  let afterConditions: string | null = null;
  let guard = 0;

  do {
    const account = await getChainAccount(address, {
      limit: pageLimit,
      ...(afterConnectors ? { after_connectors: afterConnectors } : {}),
      ...(afterTransformations ? { after_transformations: afterTransformations } : {}),
      ...(afterConditions ? { after_conditions: afterConditions } : {}),
    });

    (account.owned_connectors ?? []).forEach((name) => {
      const normalized = name.trim();
      if (normalized) ownedConnectors.add(normalized);
    });
    (account.owned_transformations ?? []).forEach((name) => {
      const normalized = name.trim();
      if (normalized) ownedTransformations.add(normalized);
    });
    (account.owned_conditions ?? []).forEach((name) => {
      const normalized = name.trim();
      if (normalized) ownedConditions.add(normalized);
    });

    const connectorCursor = resolveChainAccountCursor(account, "connectors");
    const transformationCursor = resolveChainAccountCursor(account, "transformations");
    const conditionCursor = resolveChainAccountCursor(account, "conditions");

    afterConnectors =
      connectorCursor.hasMore && connectorCursor.nextAfter ? connectorCursor.nextAfter : null;
    afterTransformations =
      transformationCursor.hasMore && transformationCursor.nextAfter
        ? transformationCursor.nextAfter
        : null;
    afterConditions =
      conditionCursor.hasMore && conditionCursor.nextAfter ? conditionCursor.nextAfter : null;

    guard += 1;
  } while (
    guard < CHAIN_ACCOUNT_OWNED_PAGE_GUARD &&
    (afterConnectors || afterTransformations || afterConditions)
  );

  const connectorPayloads = (
    await Promise.allSettled(
      Array.from(ownedConnectors).map(
        async (name) => [name, await getChainConnector(name)] as const,
      ),
    )
  )
    .filter(
      (result): result is PromiseFulfilledResult<readonly [string, RawChainConnectorResponse]> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  const includeRuntimeCode = options.includeRuntimeCode !== false;
  const transformationPayloads = includeRuntimeCode
    ? (
        await Promise.allSettled(
          Array.from(ownedTransformations).map(
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
          Array.from(ownedConditions).map(
            async (name) => [name, await getChainCondition(name)] as const,
          ),
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
          connector.formatHash,
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
  const ownerAddress = normalizeAddress(connectorPayload.owner ?? "");
  let authorId = options?.authorId?.trim() ?? "";
  if (!authorId) {
    authorId = ownerAddress || "unknown-owner";
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
      connector.formatHash,
    ),
  };
};
