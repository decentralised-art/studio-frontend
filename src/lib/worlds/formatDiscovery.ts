import {
  getChainFormat,
  getChainFormats,
  normalizeFormatHash,
  type RawChainFormatResponse,
} from "$lib/chain/registryApi";
import { hydrateChainEventDetail } from "$lib/feed/chainEventHydration";
import type { ConnectorPostEvent } from "$lib/feed/particlePostData";

const FORMAT_DISCOVERY_PAGE_LIMIT = 48;
const FORMAT_HASH_PAGE_LIMIT = 256;
const DEFAULT_DISCOVERY_CONNECTOR_CANDIDATES = 24;
const CONNECTOR_HYDRATION_CONCURRENCY = 8;

export type WorldFormatConnectorDiscoveryResult = {
  events: ConnectorPostEvent[];
  formatHashes: string[];
  hasMore: boolean;
  errors: string[];
};

const runSettledWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> => {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results;
};

const normalizeConnectorNamesFromFormat = (format: RawChainFormatResponse): string[] =>
  Array.from(
    new Set(
      (format.connectors ?? [])
        .map((connectorName) => connectorName.trim())
        .filter((connectorName) => connectorName.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

const buildConnectorPostEvent = (
  detail: Awaited<ReturnType<typeof hydrateChainEventDetail>>,
  fallbackFormatHash: string,
): ConnectorPostEvent | null => {
  if (detail.type !== "connector") return null;
  return {
    type: "connector",
    id: `world-format-candidate-${detail.name}`,
    authorId: detail.owner,
    createdAt: 0,
    createdLabel: "",
    particleId: detail.name,
    particleLabel: detail.name,
    formatHash: detail.formatHash ?? fallbackFormatHash,
    usedParticleIds: [...detail.dependencies],
    usedParticleLabels: [...detail.dependencies],
    createdNodeIds: [],
    reusedNodeIds: [],
    focusNodeIds: [],
  };
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown world format discovery error.";

const parseFormatScalarName = (scalarLabel: string): string =>
  scalarLabel.trim().split(":")[0]?.trim() ?? "";

export const isFormatCompatibleWithScalarContract = (
  format: RawChainFormatResponse,
  options: {
    acceptedScalars: readonly string[];
    requiredScalars: readonly string[];
  },
): boolean => {
  const accepted = new Set(options.acceptedScalars.map((scalar) => scalar.trim()).filter(Boolean));
  const required = new Set(options.requiredScalars.map((scalar) => scalar.trim()).filter(Boolean));
  if (accepted.size === 0 || required.size === 0) return false;

  const scalarNames = new Set(
    (format.scalars ?? []).map(parseFormatScalarName).filter((scalar) => scalar.length > 0),
  );
  if (scalarNames.size === 0) return false;

  for (const requiredScalar of required) {
    if (!scalarNames.has(requiredScalar)) return false;
  }
  for (const scalarName of scalarNames) {
    if (!accepted.has(scalarName)) return false;
  }
  return true;
};

const discoverFormatHashesByScalarContract = async (options: {
  acceptedScalars: readonly string[];
  requiredScalars: readonly string[];
}): Promise<{ formatHashes: string[]; errors: string[] }> => {
  const errors: string[] = [];
  const formatHashes: string[] = [];
  const seen = new Set<string>();
  let after: string | null = null;

  while (true) {
    let page;
    try {
      page = await getChainFormats({ limit: FORMAT_HASH_PAGE_LIMIT, after });
    } catch (error) {
      errors.push(errorMessage(error));
      break;
    }

    const hashes = page.formats ?? [];
    const formatResults = await runSettledWithConcurrency(
      hashes,
      CONNECTOR_HYDRATION_CONCURRENCY,
      async (hash) => {
        const normalizedHash = normalizeFormatHash(hash);
        return {
          formatHash: normalizedHash,
          response: await getChainFormat(normalizedHash, { limit: FORMAT_DISCOVERY_PAGE_LIMIT }),
        };
      },
    );

    formatResults.forEach((result, index) => {
      const rawHash = hashes[index] ?? "";
      if (result.status === "rejected") {
        errors.push(`${rawHash}: ${errorMessage(result.reason)}`);
        return;
      }
      if (!isFormatCompatibleWithScalarContract(result.value.response, options)) return;
      if (seen.has(result.value.formatHash)) return;
      seen.add(result.value.formatHash);
      formatHashes.push(result.value.formatHash);
    });

    if (!page.cursor?.has_more) break;
    const nextAfter = page.cursor.next_after?.trim();
    if (!nextAfter || nextAfter === after) break;
    after = nextAfter;
  }

  return { formatHashes, errors };
};

export const fetchWorldFormatConnectorEvents = async (options: {
  acceptedFormatHashes?: readonly string[];
  acceptedScalars?: readonly string[];
  requiredScalars?: readonly string[];
  connectorLimit?: number;
}): Promise<WorldFormatConnectorDiscoveryResult> => {
  const connectorLimit = Math.max(
    1,
    Math.trunc(options.connectorLimit ?? DEFAULT_DISCOVERY_CONNECTOR_CANDIDATES),
  );
  const formatConnectorPageLimit = Math.max(FORMAT_DISCOVERY_PAGE_LIMIT, connectorLimit);
  const seenFormatHashes = new Set<string>();
  let normalizedHashes = (options.acceptedFormatHashes ?? [])
    .map((hash) => {
      try {
        return normalizeFormatHash(hash);
      } catch {
        return "";
      }
    })
    .filter((hash) => {
      if (!hash || seenFormatHashes.has(hash)) return false;
      seenFormatHashes.add(hash);
      return true;
    });

  const errors: string[] = [];
  if (
    normalizedHashes.length === 0 &&
    options.acceptedScalars?.length &&
    options.requiredScalars?.length
  ) {
    const discovery = await discoverFormatHashesByScalarContract({
      acceptedScalars: options.acceptedScalars,
      requiredScalars: options.requiredScalars,
    });
    errors.push(...discovery.errors);
    normalizedHashes = discovery.formatHashes;
  }

  if (normalizedHashes.length === 0)
    return { events: [], formatHashes: [], hasMore: false, errors };

  const formatResults = await runSettledWithConcurrency(
    normalizedHashes,
    CONNECTOR_HYDRATION_CONCURRENCY,
    async (formatHash) => ({
      formatHash,
      response: await getChainFormat(formatHash, { limit: formatConnectorPageLimit }),
    }),
  );

  const connectorFormatByName = new Map<string, string>();
  formatResults.forEach((result, index) => {
    const formatHash = normalizedHashes[index];
    if (result.status === "rejected") {
      errors.push(`${formatHash}: ${errorMessage(result.reason)}`);
      return;
    }
    normalizeConnectorNamesFromFormat(result.value.response).forEach((connectorName) => {
      if (!connectorFormatByName.has(connectorName)) {
        connectorFormatByName.set(connectorName, result.value.formatHash);
      }
    });
  });

  const connectorNames = [...connectorFormatByName.keys()]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, connectorLimit);
  const formatPagesHaveMore = formatResults.some(
    (result) => result.status === "fulfilled" && Boolean(result.value.response.cursor?.has_more),
  );
  const hasMore = connectorFormatByName.size > connectorLimit || formatPagesHaveMore;
  const connectorResults = await runSettledWithConcurrency(
    connectorNames,
    CONNECTOR_HYDRATION_CONCURRENCY,
    async (connectorName) =>
      buildConnectorPostEvent(
        await hydrateChainEventDetail({ type: "connector", name: connectorName }),
        connectorFormatByName.get(connectorName) ?? "",
      ),
  );

  const events: ConnectorPostEvent[] = [];
  connectorResults.forEach((result, index) => {
    const connectorName = connectorNames[index];
    if (result.status === "rejected") {
      errors.push(`${connectorName}: ${errorMessage(result.reason)}`);
      return;
    }
    if (result.value) events.push(result.value);
  });

  return {
    events: events.sort((a, b) => a.particleLabel.localeCompare(b.particleLabel)),
    formatHashes: normalizedHashes,
    hasMore,
    errors,
  };
};
