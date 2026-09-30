import { fromProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import type { ChainConnectorPayload } from "$lib/chain/registryApi";
import type { PublicationRecord } from "./studioPublication";
import type { DeployedLibrary } from "./studioRegistryState";

export type StudioLocalPublicationStep =
  | { kind: "connector"; name: string; body: ChainConnectorPayload }
  | {
      kind: "transformation" | "condition";
      name: string;
      body: { name: string; sol_src: string };
    };

export type StudioLocalEntity = StudioLocalPublicationStep & {
  stage: PublicationRecord["stage"];
};

const parseEntity = (record: PublicationRecord): StudioLocalEntity => {
  const body = JSON.parse(record.fingerprint);
  if (!body || typeof body !== "object" || Array.isArray(body) || body.name !== record.name) {
    throw new Error(`Saved ${record.kind} '${record.name}' has an invalid creation request.`);
  }
  if (record.kind === "connector") {
    fromProtocolConnectorPayload(body);
    return { kind: record.kind, name: record.name, stage: record.stage, body };
  }
  if (typeof body.sol_src !== "string" || !body.sol_src.trim()) {
    throw new Error(`Saved ${record.kind} '${record.name}' is missing its Solidity source.`);
  }
  return { kind: record.kind, name: record.name, stage: record.stage, body };
};

/** Read the current API/owner's PublicationStore; do not keep a second catalog in storage. */
export const listStudioLocalEntities = (
  records: readonly PublicationRecord[],
): StudioLocalEntity[] =>
  records.flatMap((record) => {
    try {
      // Parsing copies the saved body, so opening an editor cannot modify its immutable record.
      return [parseEntity(record)];
    } catch {
      return [];
    }
  });

export const buildStudioLocalLibrary = (
  records: readonly PublicationRecord[],
  ownerId: string,
): DeployedLibrary => {
  const library: DeployedLibrary = { features: [], transformations: [], conditions: [] };
  for (const entity of listStudioLocalEntities(records)) {
    if (entity.stage === "mined") continue;
    const summary =
      entity.stage === "draft"
        ? "Created locally. Not published on chain."
        : "Publication pending.";
    const common = { name: entity.name, authorId: ownerId, summary };
    if (entity.kind === "connector") {
      library.features.push({
        ...common,
        id: `feature-${entity.name}`,
        kind: "feature",
        dimensions: entity.body.dimensions.length,
      });
    } else {
      const items = entity.kind === "transformation" ? library.transformations : library.conditions;
      items.push({
        ...common,
        id: `${entity.kind === "transformation" ? "transform" : "condition"}-${entity.name}`,
        kind: entity.kind,
        runtimeSnippet: entity.body.sol_src
          .split(/\r?\n/)
          .find((line) => line.trim())
          ?.trim(),
      });
    }
  }
  return library;
};
