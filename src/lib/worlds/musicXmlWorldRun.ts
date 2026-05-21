import { loginWithBrowserWalletChainAccount } from "$lib/auth/api";
import { clearChainToken, getChainToken } from "$lib/auth/session";
import { fromProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import {
  getChainConnector,
  postChainExecuteDetailed,
  type ChainExecutePayload,
  type ChainExecuteRunningInstancePayload,
} from "$lib/chain/registryApi";
import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";
import { MUSIC_SCORE_PLUGIN_ID } from "$lib/score/codebook";
import type { ScorePluginRuntimeData } from "$lib/score/types";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import { buildExecuteRiPlan, type ExecuteNodeOverrides } from "$lib/studio/executeRequestPlanner";
import { groupMidiStreams, type StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
import { buildScorePluginRuntimeData } from "$lib/studio/plugins/scoreRuntime";
import { isInvalidChainTokenError } from "$lib/studio/studioChainSync";
import { buildMusicXmlWorldInput, MUSICXML_SCORE_WORLD } from "$lib/worlds/registry";
import type { WorldDescriptor, WorldNumericValueLimit, WorldRuntimeInput } from "$lib/worlds/types";

export type DynamicRiInput = Record<string, ChainExecuteRunningInstancePayload>;

export type MusicXmlRuntimeSelection = {
  connectorName: string;
  particlesCount: number;
  dynamicRiInput: DynamicRiInput;
};

export type MusicXmlWorldRunResult = {
  scoreData: ScorePluginRuntimeData;
  worldInput: WorldRuntimeInput;
};

export type MusicXmlWorldRandomRunResult = MusicXmlWorldRunResult & {
  selection: MusicXmlRuntimeSelection;
  attempts: number;
};

export type MusicXmlWorldRiField = {
  position: number;
  nodePosition: number;
  connectorName: string;
  contextPathPrefix?: string;
  label: string;
  protocolLabel: string;
  isStatic: boolean;
  startPoint: number;
  transformationShift: number;
  lockedByConnector?: string;
};

export type MusicXmlWorldConnectorContext = {
  connectorName: string;
  ownerAddress: string;
  registry: Record<string, StudioConnectorDef>;
  riFields: MusicXmlWorldRiField[];
};

const UINT32_MAX = 0xffff_ffff;
const RANDOM_RENDERABLE_ATTEMPTS = 8;

export const DEFAULT_MUSICXML_WORLD_CONNECTOR = "";
export const DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT = 12;

export const normalizeParticlesCount = (
  value: unknown,
  fallback = DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
  limit?: WorldNumericValueLimit,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const min = limit ? Math.max(1, Math.trunc(limit.min)) : 1;
  const max = limit ? Math.max(min, Math.trunc(limit.max)) : 2048;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const normalizeUint32 = (value: unknown, label: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }
  if (parsed < 0 || parsed > UINT32_MAX) {
    throw new Error(`${label} must fit uint32 range.`);
  }
  return parsed;
};

const normalizePositionKey = (value: string) => {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > UINT32_MAX) {
    throw new Error(`Runtime RI position '${value}' must be a non-negative integer.`);
  }
  return String(parsed);
};

export const parseDynamicRiInput = (raw: string): DynamicRiInput => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Runtime RI input must be a JSON object keyed by RI position.");
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([position, rawValue]) => {
      if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
        throw new Error(`Runtime RI position ${position} must be an object.`);
      }
      const value = rawValue as Record<string, unknown>;
      return [
        normalizePositionKey(position),
        {
          start_point: normalizeUint32(
            value.start_point,
            `Runtime RI position ${position}.start_point`,
          ),
          transformation_shift: normalizeUint32(
            value.transformation_shift,
            `Runtime RI position ${position}.transformation_shift`,
          ),
        },
      ];
    }),
  );
};

export const formatDynamicRiInput = (dynamicRiInput: DynamicRiInput) =>
  JSON.stringify(dynamicRiInput, null, 2);

export const compactDynamicRiInput = (dynamicRiInput: DynamicRiInput) =>
  JSON.stringify(dynamicRiInput);

export const decodeDynamicRiQueryParam = (value: string | null): DynamicRiInput =>
  parseDynamicRiInput(value ?? "{}");

const ensureChainAuthForWorldRun = async (forceRefresh = false) => {
  if (forceRefresh) clearChainToken();
  if (getChainToken() && !forceRefresh) return;
  await loginWithBrowserWalletChainAccount({ patchServicesProfile: true });
};

const executeWithAuthRetry = async (payload: ChainExecutePayload) => {
  try {
    await ensureChainAuthForWorldRun();
    return await postChainExecuteDetailed(payload);
  } catch (error) {
    if (!isInvalidChainTokenError(error)) throw error;
    await ensureChainAuthForWorldRun(true);
    return await postChainExecuteDetailed(payload);
  }
};

const normalizeExecuteOutput = (
  features: Array<{ path: string; data: number[] }>,
): PtOutputFeature[] =>
  features.map((stream) => ({
    feature_path: stream.path,
    data: [...stream.data],
  }));

const buildScoreData = (
  connectorName: string,
  streams: PtOutputFeature[],
  world: WorldDescriptor = MUSICXML_SCORE_WORLD,
): ScorePluginRuntimeData => {
  const runtimeData: StudioPluginRuntimeData = {
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    connectorTargets: [connectorName],
    streams,
    midiGroups: groupMidiStreams(streams),
  };
  return buildScorePluginRuntimeData(runtimeData, {
    scalarValueLimits: world.valueLimits?.scalarValues,
  });
};

export const executeMusicXmlWorldRun = async (input: {
  connectorName: string;
  particlesCount: number;
  dynamicRiInput: DynamicRiInput;
  surface: WorldRuntimeInput["surface"];
  worldName: string;
  world?: WorldDescriptor;
}): Promise<MusicXmlWorldRunResult> => {
  const connectorName = input.connectorName.trim();
  const world = input.world ?? MUSICXML_SCORE_WORLD;
  const particlesCount = normalizeParticlesCount(
    input.particlesCount,
    DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
    world.valueLimits?.particlesCount,
  );
  const requestBody: ChainExecutePayload = {
    connector_name: connectorName,
    particles_count: String(particlesCount),
    dynamic_ri: input.dynamicRiInput,
  };

  const result = await executeWithAuthRetry(requestBody);
  const streams = normalizeExecuteOutput(result.body);
  const scoreData = buildScoreData(connectorName, streams, world);
  return {
    scoreData,
    worldInput: buildMusicXmlWorldInput({
      scoreData,
      label: `${connectorName} · ${input.worldName}`,
      surface: input.surface,
      connectorTargets: [connectorName],
      particlesCount,
      dynamicRiInput: input.dynamicRiInput,
    }),
  };
};

export const fetchMusicXmlWorldConnectorRegistry = async (
  rootConnectorName: string,
): Promise<Record<string, StudioConnectorDef>> => {
  const registry: Record<string, StudioConnectorDef> = {};
  const visiting = new Set<string>();

  const visit = async (connectorName: string) => {
    const name = connectorName.trim();
    if (!name || registry[name] || visiting.has(name)) return;
    visiting.add(name);
    const response = await getChainConnector(name);
    const connector = fromProtocolConnectorPayload(response);
    registry[connector.name] = connector;

    const referencedConnectors = new Set<string>();
    connector.dimensions.forEach((dimension) => {
      if (dimension.composite) referencedConnectors.add(dimension.composite);
      Object.values(dimension.bindings ?? {}).forEach((target) => {
        if (target) referencedConnectors.add(target);
      });
    });

    for (const referencedConnector of referencedConnectors) {
      await visit(referencedConnector);
    }
    visiting.delete(name);
  };

  await visit(rootConnectorName);
  return registry;
};

const buildFirstDimensionPositionByNodeKey = (
  riPlan: ReturnType<typeof buildExecuteRiPlan>,
): Map<string, number> => {
  const positionByNodeKey = new Map<string, number>();
  riPlan.positioning.dimensions.forEach((dimension) => {
    if (dimension.dimensionIndex !== 0) return;
    if (positionByNodeKey.has(dimension.nodeKey)) return;
    positionByNodeKey.set(dimension.nodeKey, dimension.position);
  });
  return positionByNodeKey;
};

const resolveNodeRiTargetPosition = (
  node: ReturnType<typeof buildExecuteRiPlan>["positioning"]["nodes"][number],
  firstDimensionPositionByNodeKey: Map<string, number>,
) =>
  node.relation === "root"
    ? node.position
    : (firstDimensionPositionByNodeKey.get(node.key) ?? node.position);

const connectorPathSegment = (name: string, index: number | "*") =>
  index === "*" ? `${name}:*` : `${name}:${Math.max(0, index)}`;

const appendPathSegment = (path: string, segment: string) => `${path}/${segment}`;

const buildConnectorContextPathPrefixByNodeKey = (
  nodes: ReturnType<typeof buildExecuteRiPlan>["positioning"]["nodes"],
): Map<string, string> => {
  const nodeByKey = new Map(nodes.map((node) => [node.key, node] as const));
  const contextPathByNodeKey = new Map<string, string>();
  const prefixByNodeKey = new Map<string, string>();

  nodes.forEach((node) => {
    if (node.relation === "root" || !node.parentKey) {
      contextPathByNodeKey.set(node.key, "");
      prefixByNodeKey.set(node.key, `/${connectorPathSegment(node.connectorName, "*")}`);
      return;
    }

    const parentNode = nodeByKey.get(node.parentKey);
    const parentContextPath = contextPathByNodeKey.get(node.parentKey) ?? "";
    const parentDimensionIndex = node.parentDimensionIndex ?? 0;
    const contextPath = parentNode
      ? appendPathSegment(
          parentContextPath,
          connectorPathSegment(parentNode.connectorName, parentDimensionIndex),
        )
      : parentContextPath;

    contextPathByNodeKey.set(node.key, contextPath);
    prefixByNodeKey.set(
      node.key,
      appendPathSegment(contextPath, connectorPathSegment(node.connectorName, "*")),
    );
  });

  return prefixByNodeKey;
};

export const buildMusicXmlWorldRiFields = (
  registry: Record<string, StudioConnectorDef>,
  connectorName: string,
): MusicXmlWorldRiField[] => {
  const riPlan = buildExecuteRiPlan(registry, connectorName, {});
  const firstDimensionPositionByNodeKey = buildFirstDimensionPositionByNodeKey(riPlan);
  const contextPathPrefixByNodeKey = buildConnectorContextPathPrefixByNodeKey(
    riPlan.positioning.nodes,
  );
  const fieldsByPosition = new Map<number, MusicXmlWorldRiField>();

  const createField = (input: {
    position: number;
    nodePosition: number;
    connectorName: string;
    contextPathPrefix?: string;
    protocolLabel: string;
  }): MusicXmlWorldRiField => {
    return {
      position: input.position,
      nodePosition: input.nodePosition,
      connectorName: input.connectorName,
      contextPathPrefix: input.contextPathPrefix,
      label: input.protocolLabel,
      protocolLabel: input.protocolLabel,
      isStatic: false,
      startPoint: 0,
      transformationShift: 0,
    };
  };

  riPlan.positioning.nodes.forEach((node) => {
    const position = resolveNodeRiTargetPosition(node, firstDimensionPositionByNodeKey);
    fieldsByPosition.set(
      position,
      createField({
        position,
        nodePosition: node.position,
        connectorName: node.connectorName,
        contextPathPrefix: contextPathPrefixByNodeKey.get(node.key),
        protocolLabel: `${node.connectorName} · connector`,
      }),
    );
  });

  Object.entries(riPlan.staticRiByPosition).forEach(([rawPosition, staticRi]) => {
    const position = Number(rawPosition);
    const existing = fieldsByPosition.get(position);
    if (!existing) return;
    fieldsByPosition.set(position, {
      ...existing,
      position,
      connectorName: existing?.connectorName ?? staticRi.connectorName,
      label: existing?.label ?? `${staticRi.connectorName} · static RI ${staticRi.localPosition}`,
      protocolLabel:
        existing?.protocolLabel ??
        `${staticRi.connectorName} · static RI ${staticRi.localPosition}`,
      isStatic: true,
      startPoint: staticRi.startPoint,
      transformationShift: staticRi.transformationShift,
      lockedByConnector: staticRi.connectorName,
    });
  });

  return [...fieldsByPosition.values()].sort(
    (a, b) => a.nodePosition - b.nodePosition || a.position - b.position,
  );
};

export const fetchMusicXmlWorldConnectorContext = async (
  rootConnectorName: string,
): Promise<MusicXmlWorldConnectorContext> => {
  const connectorName = rootConnectorName.trim();
  const registry = await fetchMusicXmlWorldConnectorRegistry(connectorName);
  const rootConnector = registry[connectorName];
  if (!rootConnector) {
    throw new Error(`Connector '${connectorName}' was not found.`);
  }

  return {
    connectorName,
    ownerAddress: rootConnector.ownerAddress ?? "",
    registry,
    riFields: buildMusicXmlWorldRiFields(registry, connectorName),
  };
};

const createSeed = () => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] || Date.now();
  }
  return Math.floor(Math.random() * UINT32_MAX);
};

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const randomInt = (random: () => number, min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min;

const isRenderableMusicXmlResult = (result: MusicXmlWorldRunResult) =>
  Boolean(result.scoreData.musicXml) && result.scoreData.stats.noteCount > 0;

const normalizeRiFieldLabel = (field: MusicXmlWorldRiField) => field.label.trim().toLowerCase();

const normalizeScalarName = (value: string) => value.trim().toLowerCase();

const getWorldScalarValueLimits = (world: WorldDescriptor) =>
  new Map(
    Object.entries(world.valueLimits?.scalarValues ?? {})
      .map(([name, limit]) => [normalizeScalarName(name), limit] as const)
      .filter(([, limit]) => Number.isFinite(limit.min) && Number.isFinite(limit.max)),
  );

const resolveWorldScalarNameForRiField = (
  field: MusicXmlWorldRiField,
  world: WorldDescriptor,
): string | null => {
  const scalarLimits = getWorldScalarValueLimits(world);
  const connectorName = normalizeScalarName(field.connectorName);
  if (scalarLimits.has(connectorName)) return connectorName;

  const label = normalizeRiFieldLabel(field);
  const matchedName = [...scalarLimits.keys()].find((name) => label.includes(name));
  return matchedName ?? null;
};

const isWorldScalarRiField = (field: MusicXmlWorldRiField, world: WorldDescriptor) =>
  Boolean(resolveWorldScalarNameForRiField(field, world));

const randomParticleCount = (random: () => number, world: WorldDescriptor) => {
  const limit = world.valueLimits?.particlesCount;
  const min = limit ? Math.max(1, Math.ceil(limit.min)) : 1;
  const max = limit ? Math.max(min, Math.floor(limit.max)) : 64;
  return randomInt(random, min, max);
};

const createRandomRiValueForField = (
  random: () => number,
  field: MusicXmlWorldRiField,
  world: WorldDescriptor,
): ExecuteNodeOverrides[string] => {
  const scalarName = resolveWorldScalarNameForRiField(field, world);
  const limit = scalarName ? world.valueLimits?.scalarValues?.[scalarName] : null;
  const startMin = Math.max(0, Math.ceil(limit?.min ?? 0));
  const startMax = Math.min(UINT32_MAX, Math.floor(limit?.max ?? startMin));
  return {
    startPoint: randomInt(random, startMin, Math.max(startMin, startMax)),
    transformationShift: 0,
  };
};

const createDefaultRiValueForField = (): ExecuteNodeOverrides[string] => ({
  startPoint: 0,
  transformationShift: 0,
});

const getRandomizableRiFields = (
  registry: Record<string, StudioConnectorDef>,
  connectorName: string,
) => {
  const fields = buildMusicXmlWorldRiFields(registry, connectorName);
  const openFields = fields.filter((field) => !field.isStatic);
  return openFields.sort((a, b) => a.nodePosition - b.nodePosition || a.position - b.position);
};

const getRandomizableSemanticRiFields = (
  registry: Record<string, StudioConnectorDef>,
  connectorName: string,
  world: WorldDescriptor,
) =>
  getRandomizableRiFields(registry, connectorName).filter((field) =>
    isWorldScalarRiField(field, world),
  );

const buildDefaultRiOverrides = (
  registry: Record<string, StudioConnectorDef>,
  connectorName: string,
): ExecuteNodeOverrides => {
  const fields = getRandomizableRiFields(registry, connectorName);
  return Object.fromEntries(
    fields.map((field) => [String(field.position), createDefaultRiValueForField()]),
  );
};

export const createDefaultMusicXmlRuntimeSelectionFromRegistry = (
  connectorName: string,
  registry: Record<string, StudioConnectorDef>,
  particlesCount = DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
): MusicXmlRuntimeSelection => {
  const normalizedParticlesCount = normalizeParticlesCount(particlesCount);
  const defaultPlan = buildExecuteRiPlan(
    registry,
    connectorName,
    buildDefaultRiOverrides(registry, connectorName),
  );
  return {
    connectorName,
    particlesCount: normalizedParticlesCount,
    dynamicRiInput: defaultPlan.dynamicRi,
  };
};

export const createRandomMusicXmlRuntimeSelectionFromRegistry = (
  connectorName: string,
  registry: Record<string, StudioConnectorDef>,
  seed = createSeed(),
  world: WorldDescriptor = MUSICXML_SCORE_WORLD,
): MusicXmlRuntimeSelection => {
  const random = createSeededRandom(seed);
  const particlesCount = randomParticleCount(random, world);
  const fields = getRandomizableSemanticRiFields(registry, connectorName, world);

  const overrides: ExecuteNodeOverrides = buildDefaultRiOverrides(registry, connectorName);
  const shuffledFields = [...fields].sort(() => random() - 0.5);
  const overrideCount =
    shuffledFields.length === 0
      ? 0
      : Math.min(shuffledFields.length, Math.max(1, Math.ceil(shuffledFields.length * 0.35)));

  shuffledFields.slice(0, overrideCount).forEach((field) => {
    overrides[String(field.position)] = createRandomRiValueForField(random, field, world);
  });

  const randomizedPlan = buildExecuteRiPlan(registry, connectorName, overrides);
  return {
    connectorName,
    particlesCount,
    dynamicRiInput: randomizedPlan.dynamicRi,
  };
};

export const createRandomMusicXmlRuntimeSelection = async (
  connectorName: string,
  world: WorldDescriptor = MUSICXML_SCORE_WORLD,
): Promise<MusicXmlRuntimeSelection> => {
  const name = connectorName.trim();
  if (!name) throw new Error("A connector must be selected before randomizing this world.");
  const registry = await fetchMusicXmlWorldConnectorRegistry(name);
  return createRandomMusicXmlRuntimeSelectionFromRegistry(name, registry, createSeed(), world);
};

export const executeRandomRenderableMusicXmlWorldRun = async (input: {
  connectorName: string;
  surface: WorldRuntimeInput["surface"];
  worldName: string;
  maxAttempts?: number;
  world?: WorldDescriptor;
}): Promise<MusicXmlWorldRandomRunResult> => {
  const name = input.connectorName.trim();
  if (!name) throw new Error("A connector must be selected before randomizing this world.");
  const world = input.world ?? MUSICXML_SCORE_WORLD;
  const registry = await fetchMusicXmlWorldConnectorRegistry(name);
  const maxAttempts = Math.max(1, Math.trunc(input.maxAttempts ?? RANDOM_RENDERABLE_ATTEMPTS));
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const selection =
      attempt === maxAttempts
        ? createDefaultMusicXmlRuntimeSelectionFromRegistry(
            name,
            registry,
            normalizeParticlesCount(
              DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
              DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
              world.valueLimits?.particlesCount,
            ),
          )
        : createRandomMusicXmlRuntimeSelectionFromRegistry(name, registry, createSeed(), world);

    try {
      const result = await executeMusicXmlWorldRun({
        connectorName: selection.connectorName,
        particlesCount: selection.particlesCount,
        dynamicRiInput: selection.dynamicRiInput,
        surface: input.surface,
        worldName: input.worldName,
        world,
      });
      if (isRenderableMusicXmlResult(result)) {
        return {
          ...result,
          selection,
          attempts: attempt,
        };
      }
      if (attempt === maxAttempts) {
        throw new Error(
          "Could not find a random runtime that produced a renderable MusicXML score.",
        );
      }
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not find a renderable MusicXML runtime for this connector.");
};

export const buildMusicXmlRuntimeSearchParams = (selection: MusicXmlRuntimeSelection) => {
  const params = new URLSearchParams();
  params.set("connector", selection.connectorName);
  params.set("particles", String(selection.particlesCount));
  params.set("ri", compactDynamicRiInput(selection.dynamicRiInput));
  return params;
};
