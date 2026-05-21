export const WORLD_PROTOCOL_VERSION = 1;

export const WORLD_STATE_MESSAGE_TYPE = "hypermusic:world-state";
export const WORLD_READY_MESSAGE_TYPE = "hypermusic:world-ready";
export const WORLD_RENDERED_MESSAGE_TYPE = "hypermusic:world-rendered";
export const WORLD_ERROR_MESSAGE_TYPE = "hypermusic:world-error";

export type WorldRuntimeSurface = "world-page" | "studio-plugin";

export type WorldRiCoordinate = {
  start_point: number;
  transformation_shift: number;
};

export type WorldRuntimeInput = {
  protocolVersion: typeof WORLD_PROTOCOL_VERSION;
  worldId: string;
  surface: WorldRuntimeSurface;
  requestId?: string;
  label?: string;
  connectorName?: string;
  connectorAddress?: string;
  connectorFormatHash?: string;
  particlesCount?: number;
  riCoordinate?: number | number[] | Record<string, number>;
  dynamicRiInput?: Record<string, WorldRiCoordinate>;
  selectedConnectorContextNames?: string[];
  selectedConnectorContextPathPrefixes?: string[];
  connectorGraph?: unknown;
  executeOutput?: Array<{
    path: string;
    data: number[];
  }>;
  artifacts?: {
    musicXml?: string;
    scoreRenderedNotes?: Array<{ sourcePaths: string[] }>;
    scoreStatsText?: string;
    scoreAdapterId?: string;
    midiStatsText?: string;
  };
};

export type WorldStateMessage = {
  type: typeof WORLD_STATE_MESSAGE_TYPE;
  payload: WorldRuntimeInput;
};

export type WorldReadyMessage = {
  type: typeof WORLD_READY_MESSAGE_TYPE;
  worldId: string;
  protocolVersion: typeof WORLD_PROTOCOL_VERSION;
};

export type WorldRenderedMessage = {
  type: typeof WORLD_RENDERED_MESSAGE_TYPE;
  worldId: string;
  requestId?: string;
};

export type WorldErrorMessage = {
  type: typeof WORLD_ERROR_MESSAGE_TYPE;
  worldId: string;
  message: string;
};

export type WorldRuntimeMessage = WorldReadyMessage | WorldRenderedMessage | WorldErrorMessage;

export type WorldNumericValueLimit = {
  min: number;
  max: number;
};

export type WorldValueLimits = {
  particlesCount?: WorldNumericValueLimit;
  scalarValues?: Record<string, WorldNumericValueLimit>;
};

export type WorldDescriptor = {
  id: string;
  slug: string;
  name: string;
  version: string;
  entry: string;
  runtime: "iframe";
  acceptedPluginIds: string[];
  acceptedFormatHashes?: string[];
  acceptedScalars?: string[];
  requiredScalars?: string[];
  surfaces: WorldRuntimeSurface[];
  description: string;
  shortDescription?: string;
  heroLabel?: string;
  accentColor?: string;
  valueLimits?: WorldValueLimits;
  stats?: Array<{ label: string; value: string }>;
};

export const isWorldRuntimeMessage = (value: unknown): value is WorldRuntimeMessage => {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === WORLD_READY_MESSAGE_TYPE ||
    type === WORLD_RENDERED_MESSAGE_TYPE ||
    type === WORLD_ERROR_MESSAGE_TYPE
  );
};

export const isWorldStateMessage = (value: unknown): value is WorldStateMessage => {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  return (value as { type?: unknown }).type === WORLD_STATE_MESSAGE_TYPE;
};
