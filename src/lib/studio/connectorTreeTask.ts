import { buildConnectorTreeGraph, type ConnectorTreeModel } from "$lib/studio/connectorTreeGraph";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";

export type ConnectorTreeTask = {
  connectorRegistry: Record<string, StudioConnectorDef>;
  rootConnectorName: string;
  origin: { x: number; y: number };
  idPrefix: string;
  labels: Record<string, string>;
  hideReadOnlyLeafOutlets?: boolean;
  markRootAsTabRoot?: boolean;
};

/** The normal graph/RI rules, with serializable options for a dedicated thread. */
export function runConnectorTreeTask(task: ConnectorTreeTask): ConnectorTreeModel {
  let idIndex = 0;
  return buildConnectorTreeGraph({
    connectorRegistry: task.connectorRegistry,
    rootConnectorName: task.rootConnectorName,
    origin: task.origin,
    options: {
      hideReadOnlyLeafOutlets: task.hideReadOnlyLeafOutlets,
      markRootAsTabRoot: task.markRootAsTabRoot,
      idFactory: () => `${task.idPrefix}-${idIndex++}`,
      labelForConnector: (name) => task.labels[name] ?? name,
    },
  });
}
