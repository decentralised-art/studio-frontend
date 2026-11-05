export type ConnectorDependencyLoadResult = {
  loaded: string[];
  missing: string[];
};

export type ConnectorDependencyLoaderOptions<TConnector> = {
  rootName: string;
  getConnector: (name: string) => TConnector | undefined;
  loadConnector: (name: string) => Promise<void>;
  referenceNames: (connector: TConnector) => readonly string[];
  signal?: AbortSignal;
};

const throwIfCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException("Connector loading cancelled.", "AbortError");
};

/** Resolve the whole reference graph, including references of cached connectors. */
export const loadConnectorDependencies = async <TConnector>(
  options: ConnectorDependencyLoaderOptions<TConnector>,
): Promise<ConnectorDependencyLoadResult> => {
  throwIfCancelled(options.signal);
  const root = options.rootName.trim();
  if (!root) return { loaded: [], missing: [] };

  const queued = [root];
  const scheduled = new Set(queued);
  const loaded: string[] = [];
  const missing: string[] = [];

  for (let index = 0; index < queued.length; index += 1) {
    throwIfCancelled(options.signal);
    const name = queued[index];
    let connector = options.getConnector(name);
    if (connector === undefined) {
      await options.loadConnector(name);
      throwIfCancelled(options.signal);
      connector = options.getConnector(name);
      if (connector === undefined) {
        missing.push(name);
        continue;
      }
      loaded.push(name);
    }

    for (const reference of options.referenceNames(connector)) {
      const childName = reference.trim();
      if (!childName || scheduled.has(childName)) continue;
      scheduled.add(childName);
      queued.push(childName);
    }
  }

  return { loaded, missing };
};
