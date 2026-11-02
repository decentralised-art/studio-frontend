/** Use the stable World id; names and slugs may change after publication. */
export const buildStudioWorldUrl = (worldId: string, connectorName = ""): `/studio?${string}` => {
  const params = new URLSearchParams({ world: worldId });
  if (connectorName.trim()) {
    params.set("network_kind", "connector");
    params.set("network_id", connectorName.trim());
  }
  return `/studio?${params}`;
};
