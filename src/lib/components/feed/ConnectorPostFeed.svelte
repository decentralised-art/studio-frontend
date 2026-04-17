<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import ParticlePostFeed from "./ParticlePostFeed.svelte";
  import type { NetworkFeedEvent } from "$lib/feed/particlePostData";

  let {
    events,
    loading = false,
    loadingMore = false,
    hasMore = false,
    onLoadMore,
    onConnectorOpen,
    onParticleOpen,
    onAddToToolbox,
    toolboxConnectorIds,
    toolboxParticleIds,
    authorLabelById,
    emptyMessage = "No events to display yet.",
  }: {
    events: NetworkFeedEvent[];
    loading?: boolean;
    loadingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: (() => void | Promise<void>) | undefined;
    onConnectorOpen?: ((connectorId: string) => void) | undefined;
    onParticleOpen?: ((connectorId: string) => void) | undefined;
    onAddToToolbox?: ((connectorId: string) => void) | undefined;
    toolboxConnectorIds?: ReadonlySet<string>;
    toolboxParticleIds?: ReadonlySet<string>;
    authorLabelById?: Readonly<Record<string, string>>;
    emptyMessage?: string;
  } = $props();

  const resolvedOpenHandler = $derived.by(() => onConnectorOpen ?? onParticleOpen);
  const resolvedToolboxIds = $derived.by(
    () => toolboxConnectorIds ?? toolboxParticleIds ?? new SvelteSet<string>(),
  );
</script>

<ParticlePostFeed
  {events}
  {loading}
  {loadingMore}
  {hasMore}
  {onLoadMore}
  onParticleOpen={resolvedOpenHandler}
  {onAddToToolbox}
  toolboxParticleIds={resolvedToolboxIds}
  {authorLabelById}
  {emptyMessage}
/>
