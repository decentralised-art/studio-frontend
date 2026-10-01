<script module lang="ts">
  export type DocsSectionGroup = {
    label: string;
    sections: { id: string; label: string }[];
  };
</script>

<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import { languagePreference } from "$lib/site/docs/languagePreference.svelte";

  type Props = {
    eyebrow?: string;
    title: string;
    description: string;
    groups: DocsSectionGroup[];
    children: Snippet;
  };

  const { eyebrow = "Docs", title, description, groups, children }: Props = $props();

  let article = $state<HTMLElement | null>(null);
  let activeId = $state("");
  // Collapsed on small screens so the contents list does not push the page down.
  let tocOpen = $state(true);

  onMount(() => {
    languagePreference.restore();
    tocOpen = window.matchMedia("(min-width: 1024px)").matches;
    if (!article) return;

    // Highlight the last section whose heading has scrolled past the top of the viewport.
    const headings = groups
      .flatMap((group) => group.sections)
      .map(({ id }) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => heading !== null);
    const update = () => {
      const offset = 120;
      let current = headings[0]?.id ?? "";
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - offset <= 0) current = heading.id;
      }
      activeId = current;
    };
    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", update, { capture: true });
  });
</script>

<main class="docs-page">
  <header class="docs-hero">
    <p class="docs-eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p class="docs-intro">{description}</p>
  </header>

  <div class="docs-body">
    <nav class="docs-toc" aria-label="On this page">
      <details bind:open={tocOpen}>
        <summary>On this page</summary>
        {#each groups as group (group.label)}
          <p class="docs-toc-group">{group.label}</p>
          <ul>
            {#each group.sections as section (section.id)}
              <li>
                <a
                  href={`#${section.id}`}
                  class:active={activeId === section.id}
                  aria-current={activeId === section.id ? "location" : undefined}
                >
                  {section.label}
                </a>
              </li>
            {/each}
          </ul>
        {/each}
      </details>
    </nav>

    <article class="docs-article" bind:this={article}>
      {@render children()}
    </article>
  </div>
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .docs-page {
    flex: 1;
    padding: 2.5rem 1rem 4rem;
    background: var(--surface-page);
    color: var(--text-primary);
  }

  .docs-hero,
  .docs-body {
    max-width: 72rem;
    margin: 0 auto;
  }

  .docs-hero {
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .docs-eyebrow {
    margin: 0;
    font-size: 0.75rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .docs-hero h1 {
    margin: 1rem 0 0;
    font-size: clamp(1.9rem, 4vw, 3rem);
    font-weight: 600;
    line-height: 1.1;
  }

  .docs-hero .docs-intro {
    max-width: 46rem;
    margin: 1.1rem 0 0;
    font-size: 1rem;
    line-height: 1.75;
    color: var(--text-secondary) !important;
  }

  .docs-body {
    display: grid;
    gap: 2rem;
    padding-top: 2rem;
  }

  @media (min-width: 1024px) {
    .docs-body {
      grid-template-columns: 14rem minmax(0, 1fr);
      gap: 3rem;
    }

    .docs-toc {
      position: sticky;
      top: 4.5rem;
      align-self: start;
      max-height: calc(100vh - 5.5rem);
      overflow-y: auto;
    }

    .docs-toc summary {
      pointer-events: none;
      list-style: none;
    }

    .docs-toc summary::-webkit-details-marker {
      display: none;
    }
  }

  .docs-toc details {
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.75rem;
    background: var(--surface-card);
  }

  @media (min-width: 1024px) {
    .docs-toc details {
      padding: 0;
      border: 0;
      background: transparent;
    }
  }

  .docs-toc summary {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
    cursor: pointer;
  }

  .docs-toc .docs-toc-group {
    margin: 1.1rem 0 0.35rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-primary) !important;
  }

  .docs-toc ul {
    display: grid;
    gap: 0.1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .docs-toc a {
    display: block;
    padding: 0.28rem 0.6rem;
    border-left: 2px solid var(--border-subtle);
    font-size: 0.8rem;
    color: var(--text-muted);
    text-decoration: none;
  }

  .docs-toc a:hover {
    color: var(--text-primary);
  }

  .docs-toc a.active {
    border-left-color: var(--color-accent);
    color: var(--text-primary);
    font-weight: 600;
  }

  /* Content typography for every docs page. */
  .docs-article {
    min-width: 0;
    max-width: 50rem;
    font-size: 0.95rem;
    line-height: 1.75;
    color: var(--text-secondary);
  }

  .docs-article :global(section) {
    scroll-margin-top: 4.5rem;
    padding-bottom: 1.5rem;
  }

  .docs-article :global(h2) {
    margin: 2.25rem 0 0.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-subtle);
    font-size: 1.55rem;
    font-weight: 600;
    line-height: 1.25;
    scroll-margin-top: 4.5rem;
  }

  .docs-article :global(section:first-child h2) {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }

  .docs-article :global(h3) {
    margin: 1.75rem 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    scroll-margin-top: 4.5rem;
  }

  .docs-article :global(p),
  .docs-article :global(li) {
    margin: 0.75rem 0;
  }

  .docs-article :global(ul),
  .docs-article :global(ol) {
    padding-left: 1.25rem;
  }

  .docs-article :global(ul) {
    list-style: disc;
  }

  .docs-article :global(ol) {
    list-style: decimal;
  }

  .docs-article :global(li::marker) {
    color: var(--text-faint);
  }

  .docs-article :global(li) {
    margin: 0.35rem 0;
  }

  .docs-article :global(a) {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .docs-article :global(strong) {
    color: var(--text-primary);
    font-weight: 600;
  }

  .docs-article :global(:not(pre) > code) {
    padding: 0.08rem 0.35rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.35rem;
    background: var(--surface-panel-soft);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.84em;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .docs-article :global(.code-block) {
    margin: 1rem 0;
  }

  .docs-article :global(.table-wrap) {
    margin: 1rem 0;
    overflow-x: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 0.75rem;
  }

  .docs-article :global(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    line-height: 1.55;
  }

  .docs-article :global(th),
  .docs-article :global(td) {
    padding: 0.55rem 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
    text-align: left;
    vertical-align: top;
  }

  .docs-article :global(th) {
    background: var(--surface-panel-soft);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-primary);
  }

  .docs-article :global(tr:last-child td) {
    border-bottom: 0;
  }

  .docs-article :global(td code) {
    white-space: nowrap;
  }

  .docs-article :global(.callout) {
    margin: 1rem 0;
    padding: 0.8rem 1rem;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--color-accent);
    border-radius: 0.6rem;
    background: var(--surface-card);
  }

  .docs-article :global(.callout p) {
    margin: 0.25rem 0;
  }

  .docs-article :global(.callout-warning) {
    border-left-color: #f7a531;
  }
</style>
