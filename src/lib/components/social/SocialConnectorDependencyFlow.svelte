<script lang="ts">
  import SocialParticleDependencyFlow from "./SocialParticleDependencyFlow.svelte";

  let {
    connectorId,
    particleId,
    onConnectorOpen,
    onParticleOpen,
    displayMode = "card",
  }: {
    connectorId?: string;
    particleId?: string;
    onConnectorOpen?: ((connectorId: string) => void) | undefined;
    onParticleOpen?: ((particleId: string) => void) | undefined;
    displayMode?: "card" | "page";
  } = $props();

  const resolvedParticleId = $derived.by(() => {
    if (typeof connectorId === "string" && connectorId.trim().length > 0) {
      return connectorId.trim();
    }
    if (typeof particleId === "string" && particleId.trim().length > 0) {
      return particleId.trim();
    }
    return "";
  });

  const resolvedOpenHandler = $derived.by(() => onConnectorOpen ?? onParticleOpen);
</script>

{#if resolvedParticleId}
  <SocialParticleDependencyFlow
    onParticleOpen={resolvedOpenHandler}
    {displayMode}
    particleId={resolvedParticleId}
  />
{/if}
