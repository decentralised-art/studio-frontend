<script lang="ts">
  import type { Snippet } from "svelte";

  type Link = {
    href: string;
    label: string;
  };

  type Props = {
    eyebrow?: string;
    title: string;
    description: string;
    links?: Link[];
    children?: Snippet;
  };

  const {
    eyebrow = "Decentralised Creative Network",
    title,
    description,
    links = [],
    children,
  }: Props = $props();
</script>

<main class="site-content-page">
  <section class="site-content-hero">
    <p>{eyebrow}</p>
    <h1>{title}</h1>
    <span>{description}</span>
    {#if links.length > 0}
      <nav class="site-content-links" aria-label={`${title} links`}>
        {#each links as link (link.href)}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={link.href}>{link.label}</a>
        {/each}
      </nav>
    {/if}
  </section>

  <section class="site-content-body">
    {@render children?.()}
  </section>
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .site-content-page {
    @apply flex-1 overflow-auto px-4 py-10 md:py-14;
    background: var(--surface-page);
    color: var(--text-primary);
  }

  .site-content-hero,
  .site-content-body {
    @apply mx-auto max-w-5xl;
  }

  .site-content-hero {
    @apply pb-9;
  }

  .site-content-hero p {
    @apply m-0 text-xs uppercase tracking-[0.22em];
    color: var(--text-faint);
  }

  .site-content-hero h1 {
    @apply m-0 mt-4 text-3xl font-semibold leading-tight md:text-5xl;
    color: var(--text-primary);
  }

  .site-content-hero span {
    @apply mt-5 block max-w-3xl text-base leading-8;
    color: var(--text-secondary);
  }

  .site-content-links {
    @apply mt-7 flex flex-wrap gap-3;
  }

  .site-content-links a {
    @apply rounded-md border px-4 py-2 text-sm font-semibold transition;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    color: var(--text-secondary);
  }

  .site-content-links a:hover {
    background: var(--surface-card-hover);
    color: var(--text-primary);
  }

  .site-content-body {
    @apply grid gap-6 text-sm leading-7;
    color: var(--text-secondary);
  }

  .site-content-body :global(h2) {
    @apply m-0 mt-6 text-2xl font-semibold;
    color: var(--text-primary);
  }

  .site-content-body :global(h3) {
    @apply m-0 mt-3 text-lg font-semibold;
    color: var(--text-primary);
  }

  .site-content-body :global(p),
  .site-content-body :global(li) {
    color: var(--text-secondary);
  }

  .site-content-body :global(a) {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .site-content-body :global(.info-grid) {
    @apply grid gap-4 md:grid-cols-2;
  }

  .site-content-body :global(.info-card) {
    @apply rounded-md border p-5;
    background: var(--surface-card);
    border-color: var(--border-subtle);
  }

  .site-content-body :global(code),
  .site-content-body :global(pre) {
    @apply rounded border px-1.5 py-0.5;
    background: var(--surface-code);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .site-content-body :global(pre) {
    @apply overflow-auto p-4;
  }
</style>
