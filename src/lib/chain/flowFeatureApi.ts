import { fromProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import { createDcnClient, isDcnApiError } from "$lib/chain/dcnClient";
import type { RawChainConnectorResponse } from "$lib/chain/registryApi";
import type { ApiDimension, ApiFeature, ApiTransformation } from "$lib/dcn/dcnApi";
import type {
  StudioConnectorDef,
  StudioConnectorDimension,
} from "$lib/studio/domain/connectorModel";

const uniqueOrdered = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  });
  return out;
};

const dimensionDependencies = (dimension: StudioConnectorDimension): string[] =>
  uniqueOrdered([dimension.composite ?? "", ...Object.values(dimension.bindings ?? {})]);

const mapTransformations = (dimension: StudioConnectorDimension): ApiTransformation[] =>
  dimension.transformations.map((tx) => ({
    name: tx.name,
    args: [...tx.args],
  }));

export const connectorToFlowFeature = (connector: StudioConnectorDef): ApiFeature => {
  const dimensions: ApiDimension[] = connector.dimensions.flatMap((dimension): ApiDimension[] => {
    const transformations = mapTransformations(dimension);
    const dependencies = dimensionDependencies(dimension);
    if (dependencies.length === 0) {
      return transformations.length > 0 ? [{ transformations }] : [];
    }
    return dependencies.map((featureName) => ({
      feature_name: featureName,
      ...(transformations.length > 0 ? { transformations } : {}),
    }));
  });

  return {
    name: connector.name,
    ...(connector.localAddress ? { local_address: connector.localAddress } : {}),
    ...(connector.ownerAddress ? { owner: connector.ownerAddress } : {}),
    dimensions,
  };
};

export const getChainConnectorFeature = async (name: string): Promise<ApiFeature | null> => {
  const trimmed = name.trim();
  if (!trimmed) return null;

  try {
    const payload = (await createDcnClient().connectorGet(trimmed)) as RawChainConnectorResponse;
    return connectorToFlowFeature(fromProtocolConnectorPayload(payload));
  } catch (error) {
    if (isDcnApiError(error) && error.status === 404) return null;
    throw error;
  }
};

export const doesChainConnectorFeatureExist = async (name: string): Promise<boolean> => {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return createDcnClient().connectorExists(trimmed);
};
