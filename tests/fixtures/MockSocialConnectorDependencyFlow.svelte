<script lang="ts">
  let { connectorId }: { connectorId: string } = $props();
</script>

<div data-testid="mock-connector-flow">{connectorId}</div>
