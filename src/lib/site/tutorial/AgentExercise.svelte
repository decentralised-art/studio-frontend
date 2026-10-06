<script lang="ts">
  const { prompt, label }: { prompt: string; label: string } = $props();
  let copied = $state(false);
  let failed = $state(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      copied = true;
      failed = false;
    } catch {
      failed = true;
    }
  }
</script>

<blockquote>{prompt}</blockquote>
<div class="copy-action" data-markdown-skip>
  <button type="button" onclick={copy}>{copied ? "Copied" : label}</button>
  {#if failed}<span role="status">Select the prompt and copy it manually.</span>{/if}
</div>

<style>
  blockquote {
    margin: 0;
    padding: 1rem 1.25rem;
    border-left: 2px solid var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 6%, transparent);
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.8;
  }
  .copy-action {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }
  button {
    padding: 0.55rem 0.9rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }
  span {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
</style>
