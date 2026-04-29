import type { ChainConditionResponse, ChainTransformationResponse } from "$lib/chain/registryApi";
import { inferArgsCountFromSnippet } from "$lib/components/solidity-editor/templates/inferArgsCount";
import { parseSoliditySnippet } from "$lib/components/solidity-editor/templates/parse";
import type { ExploreParticle } from "$lib/data/exploreParticles";
import { normalizeFeedSourceAddress } from "$lib/feed/feedSources";
import type {
  ChainStudioParticleFetchResult,
  ChainStudioSyncResult,
} from "$lib/studio/chainStudioAdapter";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import {
  alwaysTrueConditionCheck,
  extractToolboxRuntimeSnippet,
  identityTransformRun,
} from "$lib/studio/solidityDraftRuntime";
import {
  type DeployedLibrary,
  type DeployedRegistry,
  type RuntimeConditionDef,
  type RuntimeTransformationDef,
  upsertLibraryItem,
  upsertParticleItem,
} from "$lib/studio/studioRegistryState";

export type DeployedStudioState = {
  registry: DeployedRegistry;
  library: DeployedLibrary;
  particles: ExploreParticle[];
};

export type StudioChainSyncSource = {
  address: string;
  authorId: string;
  label: string;
};

export const buildStudioChainSyncSummary = ({
  sourceCount,
  connectorEntryCount,
  connectorCount,
  transformationCount,
  conditionCount,
}: {
  sourceCount: number;
  connectorEntryCount: number;
  connectorCount: number;
  transformationCount: number;
  conditionCount: number;
}): string =>
  `Synced ${sourceCount} sources · ${connectorEntryCount} connector entries · ${connectorCount} connectors · ${transformationCount} transformations · ${conditionCount} conditions.`;

export const shortStudioChainSourceAddress = (value: string): string => {
  const normalized = normalizeFeedSourceAddress(value);
  if (!normalized) return "";
  if (normalized.length < 14) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
};

export const buildStudioChainSyncSources = ({
  currentUserChainSourceAddresses,
  followedUserAddresses,
}: {
  currentUserChainSourceAddresses: readonly string[];
  followedUserAddresses: readonly string[];
}): StudioChainSyncSource[] => {
  const sourceAddresses = [
    currentUserChainSourceAddresses[0] ?? "",
    ...followedUserAddresses,
    ...currentUserChainSourceAddresses.slice(1),
  ];
  const byAddress = new Map<string, StudioChainSyncSource>();

  sourceAddresses.forEach((value) => {
    const address = normalizeFeedSourceAddress(value);
    if (!address || byAddress.has(address)) return;
    byAddress.set(address, {
      address,
      authorId: address,
      label: shortStudioChainSourceAddress(address) || address,
    });
  });

  return Array.from(byAddress.values());
};

export const isInvalidChainTokenError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /invalid token/i.test(message) || /authentication error/i.test(message);
};

const mapSnapshotTransformations = (
  transformations: ChainStudioSyncResult["registry"]["transformations"],
): Record<string, RuntimeTransformationDef> =>
  Object.fromEntries(
    Object.entries(transformations).map(([name, def]) => [
      name,
      {
        argc: def.argc,
        run: identityTransformRun,
      } satisfies RuntimeTransformationDef,
    ]),
  );

const mapSnapshotConditions = (
  conditions: ChainStudioSyncResult["registry"]["conditions"],
): Record<string, RuntimeConditionDef> =>
  Object.fromEntries(
    Object.entries(conditions).map(([name, def]) => [
      name,
      {
        argc: def.argc,
        check: alwaysTrueConditionCheck,
      } satisfies RuntimeConditionDef,
    ]),
  );

export const mergeChainSyncSnapshotIntoStudioState = (
  state: DeployedStudioState,
  snapshot: ChainStudioSyncResult,
): DeployedStudioState => ({
  registry: {
    ...state.registry,
    connectors: { ...state.registry.connectors, ...snapshot.registry.connectors },
    features: { ...state.registry.features, ...snapshot.registry.features },
    particles: { ...state.registry.particles, ...snapshot.registry.particles },
    transformations: {
      ...state.registry.transformations,
      ...mapSnapshotTransformations(snapshot.registry.transformations),
    },
    conditions: {
      ...state.registry.conditions,
      ...mapSnapshotConditions(snapshot.registry.conditions),
    },
  },
  library: {
    ...state.library,
    features: snapshot.library.features.reduce(upsertLibraryItem, state.library.features),
    transformations: snapshot.library.transformations.reduce(
      upsertLibraryItem,
      state.library.transformations,
    ),
    conditions: snapshot.library.conditions.reduce(upsertLibraryItem, state.library.conditions),
  },
  particles: snapshot.particles.reduce(upsertParticleItem, state.particles),
});

export const inferRuntimeFromConnector = (
  connector: StudioConnectorDef,
): {
  transformations: Record<string, RuntimeTransformationDef>;
  conditions: Record<string, RuntimeConditionDef>;
} => {
  const transformations: Record<string, RuntimeTransformationDef> = {};
  connector.dimensions.forEach((dimension) => {
    dimension.transformations.forEach((tx) => {
      const name = String(tx.name);
      transformations[name] ??= {
        argc: tx.args.length,
        run: identityTransformRun,
      };
    });
  });

  const conditions: Record<string, RuntimeConditionDef> = {};
  if (connector.conditionName) {
    conditions[connector.conditionName] = {
      argc: connector.conditionArgs?.length ?? 0,
      check: alwaysTrueConditionCheck,
    };
  }

  return { transformations, conditions };
};

export const mergeFetchedChainParticleIntoStudioState = (
  state: DeployedStudioState,
  fetched: ChainStudioParticleFetchResult,
  fallbackAuthorId: string,
): { state: DeployedStudioState; merged: boolean } => {
  const connector = fetched.registry.connector;
  const feature = fetched.registry.feature;
  const particle = fetched.registry.particle;
  if (!connector) return { state, merged: false };

  const inferred = inferRuntimeFromConnector(connector);
  const authorId = fetched.particleMeta?.authorId ?? fallbackAuthorId;

  return {
    state: {
      registry: {
        ...state.registry,
        connectors: { ...state.registry.connectors, [connector.name]: connector },
        ...(feature
          ? {
              features: { ...state.registry.features, [feature.name]: feature },
            }
          : {}),
        ...(particle
          ? {
              particles: { ...state.registry.particles, [particle.name]: particle },
            }
          : {}),
        transformations: {
          ...state.registry.transformations,
          ...inferred.transformations,
        },
        conditions: {
          ...state.registry.conditions,
          ...inferred.conditions,
        },
      },
      library: {
        ...state.library,
        features: upsertLibraryItem(state.library.features, {
          id: `feature-${connector.name}`,
          name: connector.name,
          kind: "feature",
          authorId,
          summary: "Fetched from chain on demand.",
          dimensions: connector.dimensions.length,
        }),
        transformations: Object.entries(inferred.transformations).reduce((items, [name]) => {
          return upsertLibraryItem(items, {
            id: `transform-${name}`,
            name,
            kind: "transformation",
            authorId,
            summary: "Fetched from chain on demand.",
          });
        }, state.library.transformations),
        conditions: Object.entries(inferred.conditions).reduce((items, [name]) => {
          return upsertLibraryItem(items, {
            id: `condition-${name}`,
            name,
            kind: "condition",
            authorId,
            summary: "Fetched from chain on demand.",
          });
        }, state.library.conditions),
      },
      particles: fetched.particleMeta
        ? upsertParticleItem(state.particles, fetched.particleMeta)
        : state.particles,
    },
    merged: true,
  };
};

const resolveRuntimePayloadName = (
  fallbackName: string,
  payload: ChainTransformationResponse | ChainConditionResponse,
): string => {
  return typeof payload.name === "string" && payload.name.trim()
    ? payload.name.trim()
    : fallbackName;
};

const inferRuntimeArgcFromSolidity = (solSrc: unknown): number => {
  const snippet = typeof solSrc === "string" ? solSrc : "";
  const parsed = parseSoliditySnippet(snippet);
  return parsed.ok ? Math.max(0, inferArgsCountFromSnippet(parsed.value).minArgsCount) : 0;
};

export const resolveToolboxRuntimeAuthorId = (owner: unknown, fallbackAuthorId: string): string =>
  typeof owner === "string"
    ? normalizeFeedSourceAddress(owner) || fallbackAuthorId
    : fallbackAuthorId;

export const mergeToolboxRuntimePayloadsIntoStudioState = (
  state: DeployedStudioState,
  kind: "transformation" | "condition",
  fetched: readonly (readonly [string, ChainTransformationResponse | ChainConditionResponse])[],
  fallbackAuthorId: string,
): DeployedStudioState => {
  if (fetched.length === 0) return state;

  if (kind === "transformation") {
    const transformations = Object.fromEntries(
      fetched.map(([fallbackName, payload]) => {
        const name = resolveRuntimePayloadName(fallbackName, payload);
        return [
          name,
          {
            argc: inferRuntimeArgcFromSolidity(payload.sol_src),
            run: identityTransformRun,
          } satisfies RuntimeTransformationDef,
        ];
      }),
    );

    return {
      ...state,
      registry: {
        ...state.registry,
        transformations: {
          ...state.registry.transformations,
          ...transformations,
        },
      },
      library: {
        ...state.library,
        transformations: fetched.reduce((items, [fallbackName, payload]) => {
          const name = resolveRuntimePayloadName(fallbackName, payload);
          return upsertLibraryItem(items, {
            id: `transform-${name}`,
            name,
            kind: "transformation",
            authorId: resolveToolboxRuntimeAuthorId(payload.owner, fallbackAuthorId),
            summary: "Saved in toolbox.",
            runtimeSnippet: extractToolboxRuntimeSnippet(payload.sol_src),
          });
        }, state.library.transformations),
      },
    };
  }

  const conditions = Object.fromEntries(
    fetched.map(([fallbackName, payload]) => {
      const name = resolveRuntimePayloadName(fallbackName, payload);
      return [
        name,
        {
          argc: inferRuntimeArgcFromSolidity(payload.sol_src),
          check: alwaysTrueConditionCheck,
        } satisfies RuntimeConditionDef,
      ];
    }),
  );

  return {
    ...state,
    registry: {
      ...state.registry,
      conditions: {
        ...state.registry.conditions,
        ...conditions,
      },
    },
    library: {
      ...state.library,
      conditions: fetched.reduce((items, [fallbackName, payload]) => {
        const name = resolveRuntimePayloadName(fallbackName, payload);
        return upsertLibraryItem(items, {
          id: `condition-${name}`,
          name,
          kind: "condition",
          authorId: resolveToolboxRuntimeAuthorId(payload.owner, fallbackAuthorId),
          summary: "Saved in toolbox.",
          runtimeSnippet: extractToolboxRuntimeSnippet(payload.sol_src),
        });
      }, state.library.conditions),
    },
  };
};
