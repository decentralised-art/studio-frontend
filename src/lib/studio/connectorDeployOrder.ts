import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";

export type ConnectorDeployOrderResult = {
  ordered: StudioConnectorDef[];
  warnings: string[];
};

const collectLocalDependencies = (
  connector: StudioConnectorDef,
  localNames: Set<string>,
): string[] => {
  const dependencies = new Set<string>();
  connector.dimensions.forEach((dimension) => {
    if (dimension.composite && localNames.has(dimension.composite)) {
      dependencies.add(dimension.composite);
    }
    Object.values(dimension.bindings ?? {}).forEach((target) => {
      if (localNames.has(target)) dependencies.add(target);
    });
  });
  dependencies.delete(connector.name);
  return Array.from(dependencies).sort();
};

export const orderConnectorDefsForDeploy = (
  connectors: StudioConnectorDef[],
): ConnectorDeployOrderResult => {
  const byName = new Map<string, StudioConnectorDef>();
  connectors.forEach((connector) => {
    if (!byName.has(connector.name)) byName.set(connector.name, connector);
  });

  const localNames = new Set(byName.keys());
  const ordered: StudioConnectorDef[] = [];
  const warnings: string[] = [];
  const permanent = new Set<string>();
  const temporary = new Set<string>();

  const visit = (name: string, path: string[]) => {
    if (permanent.has(name)) return;
    if (temporary.has(name)) {
      const cycleStart = path.indexOf(name);
      const cyclePath =
        cycleStart >= 0 ? path.slice(cycleStart).join(" -> ") : [...path, name].join(" -> ");
      warnings.push(`Connector dependency cycle detected: ${cyclePath}.`);
      return;
    }

    const connector = byName.get(name);
    if (!connector) return;

    temporary.add(name);
    collectLocalDependencies(connector, localNames).forEach((dependencyName) => {
      visit(dependencyName, [...path, dependencyName]);
    });
    temporary.delete(name);
    permanent.add(name);
    ordered.push(connector);
  };

  Array.from(byName.keys())
    .sort()
    .forEach((name) => visit(name, [name]));

  return { ordered, warnings };
};
