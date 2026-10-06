import { loginWithBrowserWalletChainAccount } from "$lib/auth/api";
import { clearChainToken, getChainToken } from "$lib/auth/session";
import { postChainExecuteDetailed, type ChainExecutePayload } from "$lib/chain/registryApi";
import { isInvalidChainTokenError } from "$lib/studio/studioChainSync";
import {
  compileToneAddressFromStreams,
  composeToneWorld,
  getToneWorldLayerCompatibilityFromStreams,
} from "$lib/toneWorld";
import {
  compactDynamicRiInput,
  createRandomMusicXmlRuntimeSelectionFromRegistry,
  decodeDynamicRiQueryParam,
  normalizeParticlesCount,
  type DynamicRiInput,
  type MusicXmlRuntimeSelection,
} from "$lib/worlds/musicXmlWorldRun";
import { buildToneWorldInput, TONE_WORLD } from "$lib/worlds/registry";
import type { WorldDescriptor, WorldNumericValueLimit, WorldRuntimeInput } from "$lib/worlds/types";

export type ToneRuntimeSelection = MusicXmlRuntimeSelection;

export type ToneWorldRunResult = {
  streams: Array<{ path: string; data: number[] }>;
  worldInput: WorldRuntimeInput;
  statsText: string;
};

export const DEFAULT_TONE_WORLD_CONNECTOR = "";
export const DEFAULT_TONE_WORLD_PARTICLES_COUNT = 24;

export const normalizeToneParticlesCount = (
  value: unknown,
  fallback = DEFAULT_TONE_WORLD_PARTICLES_COUNT,
  limit: WorldNumericValueLimit | undefined = TONE_WORLD.valueLimits?.particlesCount,
) => normalizeParticlesCount(value, fallback, limit);

export const decodeToneDynamicRiQueryParam = decodeDynamicRiQueryParam;

const ensureChainAuthForWorldRun = async (forceRefresh = false) => {
  if (forceRefresh) clearChainToken();
  if (getChainToken() && !forceRefresh) return;
  await loginWithBrowserWalletChainAccount();
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
): Array<{ path: string; data: number[] }> =>
  features.map((stream) => ({
    path: stream.path,
    data: [...stream.data],
  }));

const formatMissingRequiredToneLayerError = (layerCompatibility: {
  missingAudioScalars: readonly string[];
  missingVisualScalars: readonly string[];
}) =>
  [
    "Tone World requires either a complete audio layer or a complete visual layer.",
    `Missing for audio layer: ${layerCompatibility.missingAudioScalars.join(", ")}.`,
    `Missing for visual layer: ${layerCompatibility.missingVisualScalars.join(", ")}.`,
  ].join(" ");

const buildToneStatsText = (streams: Array<{ path: string; data: number[] }>, seed: number) => {
  const address = compileToneAddressFromStreams(streams, seed);
  const composition = composeToneWorld(address);
  return `${composition.statsText} | ${streams.length} streams`;
};

export const executeToneWorldRun = async (input: {
  connectorName: string;
  particlesCount: number;
  dynamicRiInput: DynamicRiInput;
  surface: WorldRuntimeInput["surface"];
  worldName: string;
  world?: WorldDescriptor;
}): Promise<ToneWorldRunResult> => {
  const connectorName = input.connectorName.trim();
  const world = input.world ?? TONE_WORLD;
  const particlesCount = normalizeToneParticlesCount(
    input.particlesCount,
    DEFAULT_TONE_WORLD_PARTICLES_COUNT,
    world.valueLimits?.particlesCount,
  );
  const requestBody: ChainExecutePayload = {
    connector_name: connectorName,
    particles_count: String(particlesCount),
    dynamic_ri: input.dynamicRiInput,
  };

  const result = await executeWithAuthRetry(requestBody);
  const streams = normalizeExecuteOutput(result.body.particles);
  const layerCompatibility = getToneWorldLayerCompatibilityFromStreams(streams);
  if (!layerCompatibility.hasAnyLayer) {
    throw new Error(formatMissingRequiredToneLayerError(layerCompatibility));
  }
  const statsText = buildToneStatsText(streams, particlesCount);
  return {
    streams,
    statsText,
    worldInput: buildToneWorldInput({
      streams,
      label: `${connectorName} · ${input.worldName}`,
      surface: input.surface,
      connectorTargets: [connectorName],
      particlesCount,
      dynamicRiInput: input.dynamicRiInput,
      executionMode: "execute",
      executionProvenance: {
        block_number: result.body.block_number,
        block_hash: result.body.block_hash,
        runner: result.body.runner,
        registry: result.body.registry,
      },
      statsText,
    }),
  };
};

export const createRandomToneRuntimeSelectionFromRegistry = (
  connectorName: string,
  registry: Parameters<typeof createRandomMusicXmlRuntimeSelectionFromRegistry>[1],
  seed?: number,
  world: WorldDescriptor = TONE_WORLD,
): ToneRuntimeSelection => {
  const selection = createRandomMusicXmlRuntimeSelectionFromRegistry(
    connectorName,
    registry,
    seed,
    world,
  );
  return {
    connectorName: selection.connectorName,
    particlesCount: normalizeToneParticlesCount(
      selection.particlesCount,
      DEFAULT_TONE_WORLD_PARTICLES_COUNT,
      world.valueLimits?.particlesCount,
    ),
    dynamicRiInput: selection.dynamicRiInput,
  };
};

export const buildToneRuntimeSearchParams = (selection: ToneRuntimeSelection) => {
  const params = new URLSearchParams();
  params.set("connector", selection.connectorName);
  params.set("particles", String(selection.particlesCount));
  params.set("ri", compactDynamicRiInput(selection.dynamicRiInput));
  return params;
};
