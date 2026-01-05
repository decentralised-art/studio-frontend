<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  type FlowPreview = {
    title: string;
    summary?: string;
    viewLabel?: string;
  };

  const {
    preview = null,
    onRerun,
  }: {
    preview?: FlowPreview | null;
    onRerun?: () => void;
  } = $props();

  const handleRerun = () => {
    onRerun?.();
  };
</script>

<section class="visualizer">
  <header class="visualizer-header">
    <div class="header-text">
      <span class="eyebrow">Visualiser</span>
      <h2 class="title">{preview?.title ?? "Flow output preview"}</h2>
      <p class="subtitle">
        {preview?.summary ?? "Render from the current PT flow will appear here."}
      </p>
    </div>

    <Button variant="primary" onclick={handleRerun}>Re-run PT</Button>
  </header>

  <div class="meta-row">
    <Tag variant="outline">{preview?.viewLabel ?? "Flow view"}</Tag>
  </div>

  <div class="preview-box">
    <p>Visualiser output placeholder.</p>
  </div>
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .visualizer {
    @apply flex flex-col flex-1 min-h-0 gap-4
      rounded-3xl border border-white/10
      bg-linear-to-b from-white/5 to-black/60
      p-5;
  }

  .visualizer-header {
    @apply flex flex-wrap items-start justify-between gap-3;
  }

  .header-text {
    @apply space-y-1 min-w-0;
  }

  .eyebrow {
    @apply text-[0.6rem] font-mono uppercase tracking-[0.28em] text-white/40;
  }

  .title {
    @apply text-base font-semibold text-white;
  }

  .subtitle {
    @apply text-xs text-white/50 max-w-sm;
  }

  .meta-row {
    @apply flex flex-wrap items-center gap-2;
  }

  .preview-box {
    @apply flex-1 min-h-[240px]
      rounded-2xl border border-dashed border-white/20 bg-white/5
      p-4 text-xs text-white/50 text-center
      flex items-center justify-center;
  }
</style>
