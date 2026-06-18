<script lang="ts">
  let { showLogout = true }: { showLogout?: boolean } = $props();
</script>

<button type="button" data-show-logout={String(showLogout)}>Login with MetaMask</button>
