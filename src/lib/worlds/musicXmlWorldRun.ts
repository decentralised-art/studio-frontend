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
import {
  resolveMusicScorePositionSchemaEntry,
  type MusicScorePositionSchemaEntry,
} from "$lib/score/positionSchema";
import type { ScorePluginRuntimeData } from "$lib/score/types";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import { buildExecuteRiPlan, type ExecuteNodeOverrides } from "$lib/studio/executeRequestPlanner";
import { groupMidiStreams, type StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
import { buildScorePluginRuntimeData } from "$lib/studio/plugins/scoreRuntime";
import { isInvalidChainTokenError } from "$lib/studio/studioChainSync";
import {
  buildMusicXmlWorldInput,
  MUSICXML_SCORE_WORLD_DEFAULT_CONNECTOR,
} from "$lib/worlds/registry";
import type { WorldRuntimeInput } from "$lib/worlds/types";

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
  label: string;
  protocolLabel: string;
  semanticLabel?: string;
  semanticPath?: number[];
  schemaEntry?: MusicScorePositionSchemaEntry;
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
const RANDOM_PARTICLE_COUNTS = [16, 24, 32, 48, 64] as const;
const RANDOM_RI_VALUE_MAX = 7;
const RANDOM_RENDERABLE_ATTEMPTS = 8;

export const DEFAULT_MUSICXML_WORLD_CONNECTOR = MUSICXML_SCORE_WORLD_DEFAULT_CONNECTOR;
export const DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT = 12;

export const normalizeParticlesCount = (
  value: unknown,
  fallback = DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(2048, Math.trunc(parsed)));
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
): ScorePluginRuntimeData => {
  const runtimeData: StudioPluginRuntimeData = {
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    connectorTargets: [connectorName],
    streams,
    midiGroups: groupMidiStreams(streams),
  };
  return buildScorePluginRuntimeData(runtimeData);
};

export const executeMusicXmlWorldRun = async (input: {
  connectorName: string;
  particlesCount: number;
  dynamicRiInput: DynamicRiInput;
  surface: WorldRuntimeInput["surface"];
  worldName: string;
}): Promise<MusicXmlWorldRunResult> => {
  const connectorName = input.connectorName.trim();
  const particlesCount = normalizeParticlesCount(input.particlesCount);
  const requestBody: ChainExecutePayload = {
    connector_name: connectorName,
    particles_count: String(particlesCount),
    dynamic_ri: input.dynamicRiInput,
  };

  const result = await executeWithAuthRetry(requestBody);
  const streams = normalizeExecuteOutput(result.body);
  const scoreData = buildScoreData(connectorName, streams);
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

export const buildMusicXmlWorldRiFields = (
  registry: Record<string, StudioConnectorDef>,
  connectorName: string,
): MusicXmlWorldRiField[] => {
  const riPlan = buildExecuteRiPlan(registry, connectorName, {});
  const firstDimensionPositionByNodeKey = buildFirstDimensionPositionByNodeKey(riPlan);
  const fieldsByPosition = new Map<number, MusicXmlWorldRiField>();
  type SemanticContext = {
    path: number[];
    inheritedEntry: MusicScorePositionSchemaEntry | null;
  };

  const contextByNodeKey = new Map<string, SemanticContext>();

  const resolveSchemaEntry = (
    path: number[],
    connectorNameAtPath?: string,
  ): MusicScorePositionSchemaEntry | null =>
    resolveMusicScorePositionSchemaEntry(path, {
      connectors: registry,
      ...(connectorNameAtPath ? { connectorNameAtPath } : {}),
    });

  const chooseInheritedEntry = (
    entry: MusicScorePositionSchemaEntry | null,
    fallback: MusicScorePositionSchemaEntry | null,
  ) => (entry?.kind === "field" ? entry : fallback);

  [...riPlan.positioning.nodes]
    .sort((a, b) => a.depth - b.depth || a.position - b.position)
    .forEach((node) => {
      if (!node.parentKey || node.parentDimensionIndex === null) {
        contextByNodeKey.set(node.key, { path: [], inheritedEntry: null });
        return;
      }

      const parentContext = contextByNodeKey.get(node.parentKey) ?? {
        path: [],
        inheritedEntry: null,
      };
      const path = [...parentContext.path, node.parentDimensionIndex + 1];
      const entry = resolveSchemaEntry(path, node.connectorName);
      contextByNodeKey.set(node.key, {
        path,
        inheritedEntry: chooseInheritedEntry(entry, parentContext.inheritedEntry),
      });
    });

  const createField = (input: {
    position: number;
    nodePosition: number;
    connectorName: string;
    protocolLabel: string;
    semanticPath?: number[];
    schemaEntry?: MusicScorePositionSchemaEntry | null;
  }): MusicXmlWorldRiField => {
    const semanticLabel = input.schemaEntry?.label;
    return {
      position: input.position,
      nodePosition: input.nodePosition,
      connectorName: input.connectorName,
      label: semanticLabel ? `${semanticLabel} · ${input.connectorName}` : input.protocolLabel,
      protocolLabel: input.protocolLabel,
      ...(semanticLabel ? { semanticLabel } : {}),
      ...(input.semanticPath ? { semanticPath: input.semanticPath } : {}),
      ...(input.schemaEntry ? { schemaEntry: input.schemaEntry } : {}),
      isStatic: false,
      startPoint: 0,
      transformationShift: 0,
    };
  };

  riPlan.positioning.nodes.forEach((node) => {
    const context = contextByNodeKey.get(node.key) ?? { path: [], inheritedEntry: null };
    const ownEntry = resolveSchemaEntry(context.path, node.connectorName);
    const schemaEntry = context.inheritedEntry ?? ownEntry;
    const position = resolveNodeRiTargetPosition(node, firstDimensionPositionByNodeKey);
    fieldsByPosition.set(
      position,
      createField({
        position,
        nodePosition: node.position,
        connectorName: node.connectorName,
        protocolLabel: `${node.connectorName} · connector`,
        semanticPath: context.path,
        schemaEntry,
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

type RandomRiRange = {
  startMin: number;
  startMax: number;
  shiftMin: number;
  shiftMax: number;
  startStep?: number;
};

const normalizeRiFieldLabel = (field: MusicXmlWorldRiField) =>
  `${field.schemaEntry?.label ?? ""} ${field.semanticLabel ?? ""} ${field.label}`
    .trim()
    .toLowerCase();

const getRandomRiRangeForField = (field: MusicXmlWorldRiField): RandomRiRange => {
  const label = normalizeRiFieldLabel(field);

  if (label.includes("pitch")) {
    return { startMin: 48, startMax: 72, shiftMin: 0, shiftMax: 6 };
  }
  if (label.includes("duration") && label.includes("tick")) {
    return { startMin: 630, startMax: 5040, shiftMin: 0, shiftMax: 0, startStep: 630 };
  }
  if (label.includes("tick")) {
    return { startMin: 0, startMax: 10080, shiftMin: 0, shiftMax: 0, startStep: 2520 };
  }
  if (label.includes("bpm")) {
    return { startMin: 60, startMax: 160, shiftMin: 0, shiftMax: 0 };
  }
  if (label.includes("dynamic")) {
    return { startMin: 0, startMax: 7, shiftMin: 0, shiftMax: 0 };
  }
  if (label.includes("part") || label.includes("staff") || label.includes("voice")) {
    return { startMin: 1, startMax: 4, shiftMin: 0, shiftMax: 0 };
  }
  if (label.includes("event id")) {
    return { startMin: 0, startMax: 16, shiftMin: 0, shiftMax: 0 };
  }

  return {
    startMin: 0,
    startMax: RANDOM_RI_VALUE_MAX,
    shiftMin: 0,
    shiftMax: RANDOM_RI_VALUE_MAX,
  };
};

const randomSteppedInt = (random: () => number, min: number, max: number, step = 1): number => {
  const normalizedStep = Math.max(1, Math.trunc(step));
  const steps = Math.max(0, Math.floor((max - min) / normalizedStep));
  return min + randomInt(random, 0, steps) * normalizedStep;
};

const createRandomRiValueForField = (
  random: () => number,
  field: MusicXmlWorldRiField,
): ExecuteNodeOverrides[string] => {
  const range = getRandomRiRangeForField(field);
  return {
    startPoint: randomSteppedInt(random, range.startMin, range.startMax, range.startStep),
    transformationShift: randomInt(random, range.shiftMin, range.shiftMax),
  };
};

const getRandomizableRiFields = (
  registry: Record<string, StudioConnectorDef>,
  connectorName: string,
) => {
  const fields = buildMusicXmlWorldRiFields(registry, connectorName);
  const openFields = fields.filter((field) => !field.isStatic);
  const semanticFields = openFields.filter((field) => field.schemaEntry?.kind === "field");
  return (semanticFields.length > 0 ? semanticFields : openFields).sort(
    (a, b) => a.nodePosition - b.nodePosition || a.position - b.position,
  );
};

export const createRandomMusicXmlRuntimeSelectionFromRegistry = (
  connectorName: string,
  registry: Record<string, StudioConnectorDef>,
  seed = createSeed(),
): MusicXmlRuntimeSelection => {
  const random = createSeededRandom(seed);
  const particlesCount =
    RANDOM_PARTICLE_COUNTS[randomInt(random, 0, RANDOM_PARTICLE_COUNTS.length - 1)];
  const fields = getRandomizableRiFields(registry, connectorName);

  const overrides: ExecuteNodeOverrides = {};
  const shuffledFields = [...fields].sort(() => random() - 0.5);
  const overrideCount = Math.min(
    shuffledFields.length,
    Math.max(1, Math.ceil(shuffledFields.length * 0.35)),
  );

  shuffledFields.slice(0, overrideCount).forEach((field) => {
    overrides[String(field.position)] = createRandomRiValueForField(random, field);
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
): Promise<MusicXmlRuntimeSelection> => {
  const name = connectorName.trim() || DEFAULT_MUSICXML_WORLD_CONNECTOR;
  const registry = await fetchMusicXmlWorldConnectorRegistry(name);
  return createRandomMusicXmlRuntimeSelectionFromRegistry(name, registry);
};

export const executeRandomRenderableMusicXmlWorldRun = async (input: {
  connectorName: string;
  surface: WorldRuntimeInput["surface"];
  worldName: string;
  maxAttempts?: number;
}): Promise<MusicXmlWorldRandomRunResult> => {
  const name = input.connectorName.trim() || DEFAULT_MUSICXML_WORLD_CONNECTOR;
  const registry = await fetchMusicXmlWorldConnectorRegistry(name);
  const maxAttempts = Math.max(1, Math.trunc(input.maxAttempts ?? RANDOM_RENDERABLE_ATTEMPTS));
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const selection =
      attempt === maxAttempts
        ? {
            connectorName: name,
            particlesCount: RANDOM_PARTICLE_COUNTS[0],
            dynamicRiInput: {},
          }
        : createRandomMusicXmlRuntimeSelectionFromRegistry(name, registry);

    try {
      const result = await executeMusicXmlWorldRun({
        connectorName: selection.connectorName,
        particlesCount: selection.particlesCount,
        dynamicRiInput: selection.dynamicRiInput,
        surface: input.surface,
        worldName: input.worldName,
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
