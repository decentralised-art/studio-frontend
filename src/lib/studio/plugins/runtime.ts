import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";

export type MidiScalarKey = "pitch" | "time" | "duration" | "velocity";

export type StudioPluginMidiStreamGroup = {
  groupPath: string;
  pitch?: PtOutputFeature;
  time?: PtOutputFeature;
  duration?: PtOutputFeature;
  velocity?: PtOutputFeature;
};

export type StudioPluginRuntimeData = {
  pluginId: string;
  connectorTargets: string[];
  streams: PtOutputFeature[];
  midiGroups: StudioPluginMidiStreamGroup[];
};

export const normalizePluginPathSegmentName = (segment: string): string =>
  segment.split(":")[0]?.trim().toLowerCase() ?? "";

const parsePathSegments = (path: string): string[] =>
  path
    .trim()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

const normalizePluginPathSegment = (segment: string): string => segment.trim().toLowerCase();

const parseScalarKey = (path: string): MidiScalarKey | null => {
  const segments = parsePathSegments(path);
  const leaf = segments[segments.length - 1];
  const name = normalizePluginPathSegmentName(leaf ?? "");
  if (name === "pitch") return "pitch";
  if (name === "time") return "time";
  if (name === "duration" || name === "durationv2") return "duration";
  if (name === "velocity") return "velocity";
  return null;
};

const parseGroupPath = (path: string): string => {
  const segments = parsePathSegments(path);
  if (segments.length <= 2) return "/";
  return `/${segments.slice(0, -2).join("/")}`;
};

const pathContainsTargetConnector = (path: string, targets: Set<string>): boolean => {
  if (!targets.size) return false;
  const segments = parsePathSegments(path);
  return segments.some((segment) => targets.has(normalizePluginPathSegmentName(segment)));
};

export const pathContainsConnectorName = (path: string, connectorName: string): boolean => {
  const normalized = connectorName.trim().toLowerCase();
  if (!normalized) return false;
  return parsePathSegments(path).some(
    (segment) => normalizePluginPathSegmentName(segment) === normalized,
  );
};

export const pathContainsAnyConnectorName = (
  path: string,
  connectorNames: readonly string[],
): boolean => {
  const normalizedNames = new Set(
    connectorNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  if (!normalizedNames.size) return false;
  return parsePathSegments(path).some((segment) =>
    normalizedNames.has(normalizePluginPathSegmentName(segment)),
  );
};

export const pathStartsWithConnectorPrefix = (path: string, prefix: string): boolean => {
  const sourceSegments = parsePathSegments(path).map(normalizePluginPathSegment);
  const prefixSegments = parsePathSegments(prefix).map(normalizePluginPathSegment);
  if (!prefixSegments.length || prefixSegments.length > sourceSegments.length) return false;
  return prefixSegments.every((segment, index) => {
    const sourceSegment = sourceSegments[index];
    if (segment.endsWith(":*")) {
      return sourceSegment?.split(":")[0] === segment.slice(0, -2);
    }
    return sourceSegment === segment;
  });
};

export const pathStartsWithAnyConnectorPrefix = (
  path: string,
  prefixes: readonly string[],
): boolean => prefixes.some((prefix) => pathStartsWithConnectorPrefix(path, prefix));

export const collectConnectorScopedStreams = (
  streams: PtOutputFeature[],
  connectorTargets: string[],
): PtOutputFeature[] => {
  const normalizedTargets = new Set(
    connectorTargets.map((target) => target.trim().toLowerCase()).filter(Boolean),
  );
  if (!normalizedTargets.size) return [];
  return streams.filter((stream) =>
    pathContainsTargetConnector(stream.feature_path, normalizedTargets),
  );
};

export const groupMidiStreams = (streams: PtOutputFeature[]): StudioPluginMidiStreamGroup[] => {
  const groups = new Map<string, StudioPluginMidiStreamGroup>();

  streams.forEach((stream) => {
    const scalar = parseScalarKey(stream.feature_path);
    if (!scalar) return;
    const groupPath = parseGroupPath(stream.feature_path);
    const current = groups.get(groupPath) ?? { groupPath };
    if (scalar === "duration" && current.duration) {
      // Prefer the first duration path encountered to keep grouping deterministic.
      groups.set(groupPath, current);
      return;
    }
    groups.set(groupPath, { ...current, [scalar]: stream });
  });

  return [...groups.values()].sort((a, b) => a.groupPath.localeCompare(b.groupPath));
};

export const buildStudioPluginRuntimeData = (
  pluginId: string,
  connectorTargets: string[],
  streams: PtOutputFeature[],
): StudioPluginRuntimeData => {
  const scopedStreams = collectConnectorScopedStreams(streams, connectorTargets);
  return {
    pluginId,
    connectorTargets: [...connectorTargets],
    streams: scopedStreams,
    midiGroups: groupMidiStreams(scopedStreams),
  };
};
