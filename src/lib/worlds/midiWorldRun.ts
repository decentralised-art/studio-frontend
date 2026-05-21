import { loginWithBrowserWalletChainAccount } from "$lib/auth/api";
import { clearChainToken, getChainToken } from "$lib/auth/session";
import { postChainExecuteDetailed, type ChainExecutePayload } from "$lib/chain/registryApi";
import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import { pluginRuntimeToMidiClip, type StudioMidiClip } from "$lib/studio/plugins/midiExport";
import { MIDI_CLIP_PLUGIN_ID } from "$lib/studio/plugins/registry";
import { groupMidiStreams, type StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
import { isInvalidChainTokenError } from "$lib/studio/studioChainSync";
import {
  compactDynamicRiInput,
  createRandomMusicXmlRuntimeSelectionFromRegistry,
  decodeDynamicRiQueryParam,
  fetchMusicXmlWorldConnectorRegistry,
  normalizeParticlesCount,
  type DynamicRiInput,
  type MusicXmlRuntimeSelection,
} from "$lib/worlds/musicXmlWorldRun";
import { buildMidiWorldInput, MIDI_CLIP_WORLD } from "$lib/worlds/registry";
import type { WorldDescriptor, WorldNumericValueLimit, WorldRuntimeInput } from "$lib/worlds/types";

export type MidiRuntimeSelection = MusicXmlRuntimeSelection;

export type MidiWorldRunResult = {
  midiData: StudioPluginRuntimeData;
  midiClip: StudioMidiClip;
  worldInput: WorldRuntimeInput;
};

export type MidiWorldRandomRunResult = MidiWorldRunResult & {
  selection: MidiRuntimeSelection;
  attempts: number;
};

const RANDOM_RENDERABLE_ATTEMPTS = 8;

export const DEFAULT_MIDI_WORLD_CONNECTOR = "";
export const DEFAULT_MIDI_WORLD_PARTICLES_COUNT = 12;

export const normalizeMidiParticlesCount = (
  value: unknown,
  fallback = DEFAULT_MIDI_WORLD_PARTICLES_COUNT,
  limit: WorldNumericValueLimit | undefined = MIDI_CLIP_WORLD.valueLimits?.particlesCount,
) => normalizeParticlesCount(value, fallback, limit);

export const decodeMidiDynamicRiQueryParam = decodeDynamicRiQueryParam;

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

const buildMidiRuntimeData = (
  connectorName: string,
  streams: PtOutputFeature[],
): StudioPluginRuntimeData => ({
  pluginId: MIDI_CLIP_PLUGIN_ID,
  connectorTargets: [connectorName],
  streams,
  midiGroups: groupMidiStreams(streams),
});

const buildMidiStatsText = (runtimeData: StudioPluginRuntimeData, midiClip: StudioMidiClip) =>
  `${midiClip.notes.length} notes | ${runtimeData.midiGroups.length} groups | ${midiClip.channels} channels | ${midiClip.tempo} BPM${
    midiClip.skippedNotes > 0 ? ` | ${midiClip.skippedNotes} skipped` : ""
  }`;

export const executeMidiWorldRun = async (input: {
  connectorName: string;
  particlesCount: number;
  dynamicRiInput: DynamicRiInput;
  surface: WorldRuntimeInput["surface"];
  worldName: string;
  world?: WorldDescriptor;
}): Promise<MidiWorldRunResult> => {
  const connectorName = input.connectorName.trim();
  const world = input.world ?? MIDI_CLIP_WORLD;
  const particlesCount = normalizeMidiParticlesCount(
    input.particlesCount,
    DEFAULT_MIDI_WORLD_PARTICLES_COUNT,
    world.valueLimits?.particlesCount,
  );
  const requestBody: ChainExecutePayload = {
    connector_name: connectorName,
    particles_count: String(particlesCount),
    dynamic_ri: input.dynamicRiInput,
  };

  const result = await executeWithAuthRetry(requestBody);
  const streams = normalizeExecuteOutput(result.body);
  const midiData = buildMidiRuntimeData(connectorName, streams);
  const midiClip = pluginRuntimeToMidiClip(midiData, {
    scalarValueLimits: world.valueLimits?.scalarValues,
  });
  return {
    midiData,
    midiClip,
    worldInput: buildMidiWorldInput({
      runtimeData: midiData,
      label: `${connectorName} · ${input.worldName}`,
      surface: input.surface,
      particlesCount,
      dynamicRiInput: input.dynamicRiInput,
      statsText: buildMidiStatsText(midiData, midiClip),
    }),
  };
};

const isRenderableMidiResult = (result: MidiWorldRunResult) => result.midiClip.notes.length > 0;

export const createRandomMidiRuntimeSelectionFromRegistry = (
  connectorName: string,
  registry: Record<string, StudioConnectorDef>,
  seed?: number,
  world: WorldDescriptor = MIDI_CLIP_WORLD,
): MidiRuntimeSelection => {
  const selection = createRandomMusicXmlRuntimeSelectionFromRegistry(
    connectorName,
    registry,
    seed,
    world,
  );
  return {
    connectorName: selection.connectorName,
    particlesCount: normalizeMidiParticlesCount(
      selection.particlesCount,
      DEFAULT_MIDI_WORLD_PARTICLES_COUNT,
      world.valueLimits?.particlesCount,
    ),
    dynamicRiInput: selection.dynamicRiInput,
  };
};

export const executeRandomRenderableMidiWorldRun = async (input: {
  connectorName: string;
  surface: WorldRuntimeInput["surface"];
  worldName: string;
  maxAttempts?: number;
  world?: WorldDescriptor;
}): Promise<MidiWorldRandomRunResult> => {
  const name = input.connectorName.trim();
  if (!name) throw new Error("A connector must be selected before randomizing this world.");
  const world = input.world ?? MIDI_CLIP_WORLD;
  const registry = await fetchMusicXmlWorldConnectorRegistry(name);
  const maxAttempts = Math.max(1, Math.trunc(input.maxAttempts ?? RANDOM_RENDERABLE_ATTEMPTS));
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const selection =
      attempt === maxAttempts
        ? {
            connectorName: name,
            particlesCount: normalizeMidiParticlesCount(
              DEFAULT_MIDI_WORLD_PARTICLES_COUNT,
              DEFAULT_MIDI_WORLD_PARTICLES_COUNT,
              world.valueLimits?.particlesCount,
            ),
            dynamicRiInput: {},
          }
        : createRandomMidiRuntimeSelectionFromRegistry(name, registry, undefined, world);

    try {
      const result = await executeMidiWorldRun({
        connectorName: selection.connectorName,
        particlesCount: selection.particlesCount,
        dynamicRiInput: selection.dynamicRiInput,
        surface: input.surface,
        worldName: input.worldName,
        world,
      });
      if (isRenderableMidiResult(result)) {
        return {
          ...result,
          selection,
          attempts: attempt,
        };
      }
      if (attempt === maxAttempts) {
        throw new Error("Could not find a random runtime that produced renderable MIDI notes.");
      }
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not find a renderable MIDI runtime for this connector.");
};

export const buildMidiRuntimeSearchParams = (selection: MidiRuntimeSelection) => {
  const params = new URLSearchParams();
  params.set("connector", selection.connectorName);
  params.set("particles", String(selection.particlesCount));
  params.set("ri", compactDynamicRiInput(selection.dynamicRiInput));
  return params;
};
