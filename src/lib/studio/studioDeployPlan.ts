import { toProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import type { ChainConnectorPayload } from "$lib/chain/registryApi";
import { orderConnectorDefsForDeploy } from "$lib/studio/connectorDeployOrder";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import { isConnectorKind, normalizeKey } from "$lib/studio/studioNaming";
import { buildStudioRuntime, type StudioEdge, type StudioNode } from "$lib/studio/studioRuntime";

export type StudioDeployPlanActiveTab = {
  label: string;
  particleId?: string;
} | null;

export type StudioDeploySourceMap<T> = Map<string, T> | Record<string, T>;

export type StudioDeployPlanInput = {
  activeTab: StudioDeployPlanActiveTab;
  nodes: StudioNode[];
  edges: StudioEdge[];
  runtimeOverrides?: Parameters<typeof buildStudioRuntime>[2];
  compiledTransformations?: Record<string, unknown>;
  draftTransformationSources?: StudioDeploySourceMap<{ code: string }>;
  conditionSourcesByNodeId?: StudioDeploySourceMap<string>;
  deployedConnectorNames?: string[];
  networkConnectorNames?: string[];
};

export type StudioDeployConditionStep = {
  order: number;
  kind: "condition";
  name: string;
  method: "POST";
  path: "/chain/condition";
  body: { name: string; sol_src: string };
};

export type StudioDeployTransformationStep = {
  order: number;
  kind: "transformation";
  name: string;
  method: "POST";
  path: "/chain/transformation";
  body: { name: string; sol_src: string };
};

export type StudioDeployConnectorStep = {
  order: number;
  kind: "connector";
  name: string;
  method: "POST";
  path: "/chain/connector";
  body: ChainConnectorPayload;
};

export type StudioDeployPlanStep =
  | StudioDeployConditionStep
  | StudioDeployTransformationStep
  | StudioDeployConnectorStep;

export type StudioDeployPlanPreview = {
  ok: boolean;
  root_connector: string | null;
  summary: {
    total_requests: number;
    conditions: number;
    transformations: number;
    connectors: number;
  };
  warnings: string[];
  errors: string[];
  dependencies: {
    local_connectors: string[];
    network_connectors: string[];
  };
  deploy_requests: Array<{
    order: number;
    kind: StudioDeployPlanStep["kind"];
    name: string;
    method: "POST";
    path: StudioDeployPlanStep["path"];
    body: StudioDeployPlanStep["body"];
  }>;
};

export type StudioDeployPlan = {
  ok: boolean;
  rootConnectorName: string | null;
  runtime: ReturnType<typeof buildStudioRuntime> | null;
  localConnectorNames: string[];
  networkConnectorNames: string[];
  warnings: string[];
  errors: string[];
  steps: StudioDeployPlanStep[];
  preview: StudioDeployPlanPreview;
};

const resolvePlanNodeName = (node: StudioNode): string => {
  if (node.data.networkId) return node.data.networkId;
  if (node.data.particleId) return node.data.particleId;
  return node.data.label.trim() || node.data.label;
};

const sourceMapGet = <T>(
  source: StudioDeploySourceMap<T> | undefined,
  key: string,
): T | undefined => {
  if (!source) return undefined;
  if (source instanceof Map) return source.get(key);
  return source[key];
};

const uniqueByName = <T extends { name: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  const unique: T[] = [];
  items.forEach((item) => {
    const key = normalizeKey(item.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  return unique;
};

const collectConnectorDependencies = (
  connector: StudioConnectorDef,
  localConnectorNames: Set<string>,
): { local: string[]; network: string[] } => {
  const local = new Set<string>();
  const network = new Set<string>();
  const add = (name: string | undefined) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed || trimmed === connector.name) return;
    if (localConnectorNames.has(trimmed)) {
      local.add(trimmed);
      return;
    }
    network.add(trimmed);
  };

  connector.dimensions.forEach((dimension) => {
    add(dimension.composite);
    Object.values(dimension.bindings ?? {}).forEach(add);
  });

  return {
    local: Array.from(local).sort(),
    network: Array.from(network).sort(),
  };
};

const buildPreview = (plan: Omit<StudioDeployPlan, "preview">): StudioDeployPlanPreview => ({
  ok: plan.ok,
  root_connector: plan.rootConnectorName,
  summary: {
    total_requests: plan.steps.length,
    conditions: plan.steps.filter((step) => step.kind === "condition").length,
    transformations: plan.steps.filter((step) => step.kind === "transformation").length,
    connectors: plan.steps.filter((step) => step.kind === "connector").length,
  },
  warnings: [...plan.warnings],
  errors: [...plan.errors],
  dependencies: {
    local_connectors: [...plan.localConnectorNames],
    network_connectors: [...plan.networkConnectorNames],
  },
  deploy_requests: plan.steps.map((step) => ({
    order: step.order,
    kind: step.kind,
    name: step.name,
    method: step.method,
    path: step.path,
    body: step.body,
  })),
});

export const buildStudioDeployPlan = ({
  activeTab,
  nodes,
  edges,
  runtimeOverrides,
  compiledTransformations = {},
  draftTransformationSources,
  conditionSourcesByNodeId,
  deployedConnectorNames = [],
  networkConnectorNames = [],
}: StudioDeployPlanInput): StudioDeployPlan => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const steps: StudioDeployPlanStep[] = [];

  const localConditionNodes = nodes.filter(
    (node) => node.data.kind === "condition" && !node.data.fromNetwork,
  );
  const localConnectorNodes = nodes.filter(
    (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
  );
  const hasLocalConnectors = localConnectorNodes.length > 0;
  const compiledTransformationNames = Object.keys(compiledTransformations);

  if (!activeTab) {
    errors.push("No active Studio tab.");
  }

  const deployedConnectorKeys = new Set(deployedConnectorNames.map((name) => name.trim()));
  const discoveredNetworkConnectorKeys = new Set(networkConnectorNames.map((name) => name.trim()));
  if (activeTab && hasLocalConnectors && !activeTab.particleId) {
    const rootName = activeTab.particleId ?? (activeTab.label.trim() || activeTab.label);
    if (deployedConnectorKeys.has(rootName) || discoveredNetworkConnectorKeys.has(rootName)) {
      warnings.push(`Connector already exists in network: ${rootName}.`);
    }
  }

  let runtime: ReturnType<typeof buildStudioRuntime> | null = null;
  if (activeTab && hasLocalConnectors) {
    try {
      runtime = buildStudioRuntime(
        { nodes, edges },
        { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
        runtimeOverrides,
      );
      errors.push(
        ...runtime.warnings.filter(
          (warning) => !warning.startsWith("Using local override for network connector:"),
        ),
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Failed to build deploy runtime.");
    }
  }

  const localConnectorDefs: StudioConnectorDef[] = [];
  const localConnectorDefNames = new Set<string>();
  if (runtime) {
    localConnectorNodes.forEach((connectorNode) => {
      const connectorName = resolvePlanNodeName(connectorNode);
      const def = runtime?.registry.connectors[connectorName];
      if (!def || localConnectorDefNames.has(def.name)) return;
      localConnectorDefNames.add(def.name);
      localConnectorDefs.push(def);
    });

    const rootDef = runtime.registry.connectors[runtime.rootConnector];
    const hasLocalRootConnector = localConnectorNodes.some(
      (node) =>
        Boolean((node.data as { tabRoot?: unknown }).tabRoot) ||
        resolvePlanNodeName(node) === runtime?.rootConnector,
    );
    if (hasLocalRootConnector && rootDef && !localConnectorDefNames.has(rootDef.name)) {
      localConnectorDefNames.add(rootDef.name);
      localConnectorDefs.push(rootDef);
    }
  }

  const orderedConnectors = orderConnectorDefsForDeploy(localConnectorDefs);
  errors.push(...orderedConnectors.warnings);

  const localConnectorNameSet = new Set(localConnectorDefs.map((connector) => connector.name));
  const networkDependencyNames = new Set<string>();
  localConnectorDefs.forEach((connector) => {
    const dependencies = collectConnectorDependencies(connector, localConnectorNameSet);
    dependencies.network.forEach((name) => networkDependencyNames.add(name));
  });

  const localConditions = uniqueByName(
    localConditionNodes.map((node) => ({
      name: resolvePlanNodeName(node),
      code: sourceMapGet(conditionSourcesByNodeId, node.id) ?? "",
    })),
  );
  const localTransformations = uniqueByName(
    compiledTransformationNames.flatMap((name) => {
      const source = sourceMapGet(draftTransformationSources, name);
      return source ? [{ name, code: source.code }] : [];
    }),
  );

  let order = 1;
  localConditions.forEach((condition) => {
    steps.push({
      order,
      kind: "condition",
      name: condition.name,
      method: "POST",
      path: "/chain/condition",
      body: { name: condition.name, sol_src: condition.code },
    });
    order += 1;
  });
  localTransformations.forEach((transformation) => {
    steps.push({
      order,
      kind: "transformation",
      name: transformation.name,
      method: "POST",
      path: "/chain/transformation",
      body: { name: transformation.name, sol_src: transformation.code },
    });
    order += 1;
  });
  orderedConnectors.ordered.forEach((connector) => {
    try {
      steps.push({
        order,
        kind: "connector",
        name: connector.name,
        method: "POST",
        path: "/chain/connector",
        body: toProtocolConnectorPayload(connector),
      });
      order += 1;
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `Failed to serialize ${connector.name}.`,
      );
    }
  });

  if (!steps.length) {
    errors.push("Nothing to deploy.");
  }

  const planWithoutPreview: Omit<StudioDeployPlan, "preview"> = {
    ok: errors.length === 0,
    rootConnectorName: runtime?.rootConnector ?? null,
    runtime,
    localConnectorNames: orderedConnectors.ordered.map((connector) => connector.name),
    networkConnectorNames: Array.from(networkDependencyNames).sort(),
    warnings,
    errors,
    steps,
  };

  return {
    ...planWithoutPreview,
    preview: buildPreview(planWithoutPreview),
  };
};
