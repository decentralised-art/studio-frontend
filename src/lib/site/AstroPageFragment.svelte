<script lang="ts">
  import { onMount } from "svelte";
  import { asset } from "$app/paths";

  type Props = {
    canonicalUrl?: string;
    description?: string;
    html: string;
    title: string;
  };

  const { canonicalUrl, description, html, title }: Props = $props();

  const normalizePath = (value: string) => value.replace(/\/+$/, "") || "/";

  onMount(() => {
    const docsLinks = Array.from(document.querySelectorAll<HTMLElement>("[data-docs-nav-link]"));
    const docsSections = docsLinks
      .map((link) => document.getElementById(link.dataset.docsNavLink ?? ""))
      .filter((section): section is HTMLElement => section !== null);

    const setDocsActive = (id: string) => {
      docsLinks.forEach((link) => {
        const isActive = link.dataset.docsNavLink === id;
        link.classList.toggle("text-gray-900", isActive);
        link.classList.toggle("border-gray-400", isActive);
        link.classList.toggle("bg-gray-50", isActive);
      });
    };

    const docsObserver =
      docsSections.length > 0
        ? new IntersectionObserver(
            (entries) => {
              const active = entries.find((entry) => entry.isIntersecting)?.target.id;
              if (active) setDocsActive(active);
            },
            {
              rootMargin: "-40% 0px -55% 0px",
              threshold: 0.1,
            },
          )
        : null;

    docsSections.forEach((section) => docsObserver?.observe(section));

    const currentPath = normalizePath(window.location.pathname);
    const tocLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("[data-toc-section][data-toc-page]"),
    ).filter((link) => normalizePath(link.dataset.tocPage ?? "") === currentPath);
    const tocSections = tocLinks
      .map((link) => document.getElementById(link.dataset.tocSection ?? ""))
      .filter((section): section is HTMLElement => section !== null);

    const setTocActive = (id: string) => {
      tocLinks.forEach((link) => {
        const isActive = link.dataset.tocSection === id;
        link.classList.toggle("is-active", isActive);
        link.setAttribute("aria-current", isActive ? "location" : "false");
      });
    };

    let ticking = false;
    const updateTocFromScroll = () => {
      const scanLine = window.scrollY + window.innerHeight * 0.34;
      let activeId = tocSections[0]?.id ?? "";

      tocSections.forEach((section) => {
        if (section.offsetTop <= scanLine) activeId = section.id;
      });

      if (activeId) setTocActive(activeId);
      ticking = false;
    };

    const requestTocUpdate = () => {
      if (ticking || tocSections.length === 0) return;
      ticking = true;
      window.requestAnimationFrame(updateTocFromScroll);
    };

    const handleTocClick = (event: Event) => {
      const link = event.currentTarget;
      if (!(link instanceof HTMLAnchorElement)) return;
      const id = link.dataset.tocSection ?? "";
      if (id) setTocActive(id);
    };

    const handleHashChange = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (id) setTocActive(id);
    };

    tocLinks.forEach((link) => {
      link.addEventListener("click", handleTocClick);
    });
    window.addEventListener("scroll", requestTocUpdate, { passive: true });
    window.addEventListener("resize", requestTocUpdate);
    window.addEventListener("hashchange", handleHashChange);
    requestTocUpdate();

    return () => {
      docsObserver?.disconnect();
      tocLinks.forEach((link) => {
        link.removeEventListener("click", handleTocClick);
      });
      window.removeEventListener("scroll", requestTocUpdate);
      window.removeEventListener("resize", requestTocUpdate);
      window.removeEventListener("hashchange", handleHashChange);
    };
  });
</script>

<svelte:head>
  <title>{title}</title>
  {#if description}
    <meta name="description" content={description} />
  {/if}
  {#if canonicalUrl}
    <link rel="canonical" href={canonicalUrl} />
  {/if}
  <link rel="stylesheet" href={asset("/_astro/api-status.D4V5fBaG.css")} />
  <link rel="stylesheet" href={asset("/_astro/dcn-inline.css")} />
  <link rel="stylesheet" href={asset("/_astro/dcn-theme-overrides.css")} />
</svelte:head>

<div class="dcn-astro-fragment">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- generated from the local Astro build, not user-supplied content -->
  {@html html}
</div>

<style>
  .dcn-astro-fragment {
    background: var(--surface-page);
    color: var(--text-primary);
    font-family: "Space Grotesk", system-ui, sans-serif;
    min-height: 100%;
  }

  :global(.dcn-astro-fragment .docs-surface) {
    background: var(--surface-page) !important;
    color: var(--text-primary) !important;
  }

  :global(.dcn-astro-fragment .docs-surface .sidebar) {
    border-color: var(--border-subtle) !important;
  }

  :global(.dcn-astro-fragment .docs-surface :where(.layout-sidebar, .sidebar)) {
    background: transparent !important;
    color: var(--text-secondary) !important;
  }

  :global(.dcn-astro-fragment .docs-surface :where(h1, h2, h3, h4, dt, strong)) {
    color: var(--text-primary) !important;
  }

  :global(.dcn-astro-fragment .docs-tutorial section + section) {
    margin-top: clamp(4rem, 7vw, 6.5rem) !important;
  }

  :global(.dcn-astro-fragment .docs-tutorial h3[id]) {
    scroll-margin-top: calc(var(--nav-offset, 3.5rem) + 1.5rem);
  }

  :global(.dcn-astro-fragment .docs-tutorial section > h2:first-child) {
    margin-bottom: 1.25rem;
  }

  :global(.dcn-astro-fragment .docs-surface :where(p, li, dd, summary, figcaption)) {
    color: var(--text-secondary) !important;
  }

  :global(.dcn-astro-fragment .docs-surface :where(a)) {
    color: var(--color-accent-strong) !important;
  }

  :global(.dcn-astro-fragment .docs-surface :where(pre, code)) {
    background: var(--surface-code) !important;
    border-color: var(--border-subtle) !important;
    color: var(--text-primary) !important;
  }

  :global(.dcn-astro-fragment .docs-surface pre code) {
    background: transparent !important;
    border-color: transparent !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(
        article,
        figure,
        .concept-card,
        .cta-band,
        .hero-shell,
        .identity-card,
        .identity-item,
        .onboarding-card,
        .panel,
        .resource-card,
        .step-card,
        .tutorial-criteria-card,
        .tutorial-usecase-card,
        .workflow-card
      )
  ) {
    background: var(--surface-card) !important;
    border-color: var(--border-subtle) !important;
    color: var(--text-primary) !important;
    box-shadow: none !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where([class*="bg-white"], [class*="bg-gray-50"], [class*="bg-gray-100"])
  ) {
    background-color: var(--surface-card) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where([class*="border-gray"], [class*="border-slate"], [class*="border-white"])
  ) {
    border-color: var(--border-subtle) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where([class*="text-gray"], [class*="text-slate"], [class*="text-white"])
  ) {
    color: var(--text-secondary) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(h1, h2, h3, h4, dt, strong, [class*="text-gray-900"], [class*="text-slate-900"])
  ) {
    color: var(--text-primary) !important;
  }

  :global(.dcn-astro-fragment .docs-surface .tutorial-toc-section-link.is-active) {
    background: var(--surface-card-hover) !important;
    border-color: var(--border-strong) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(
        .tutorial-toc-nav,
        .tutorial-toc-group,
        .tutorial-toc-summary,
        .tutorial-toc-page-link,
        .tutorial-toc-section-link,
        .tutorial-toc-caret,
        .tutorial-toc-dash
      )
  ) {
    border-color: var(--border-subtle) !important;
    color: var(--text-muted) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(
        .tutorial-toc-page-link:hover,
        .tutorial-toc-section-link:hover,
        .tutorial-toc-group[open] .tutorial-toc-caret
      )
  ) {
    color: var(--text-primary) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(.tutorial-toc-page-link.is-active, .tutorial-toc-section-link.is-active)
  ) {
    background: var(--surface-card-hover) !important;
    border-color: var(--color-accent-strong) !important;
    color: var(--color-accent-strong) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(.tutorial-toc-dot, .bg-gray-300, .bg-gray-400, .bg-gray-500)
  ) {
    background-color: var(--border-strong) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(
        .button-ghost,
        .tab-btn-inactive,
        .resource-card:hover,
        .tutorial-criteria-icon,
        .workflow-index
      )
  ) {
    background: var(--surface-card-hover) !important;
    border-color: var(--border-subtle) !important;
    color: var(--text-secondary) !important;
  }

  :global(
    .dcn-astro-fragment
      .docs-surface
      :where(.button-accent, .tab-btn-active, .tutorial-criteria-card h3)
  ) {
    color: var(--text-inverse) !important;
  }

  :global(.dcn-astro-fragment .docs-surface .tutorial-criteria-card h3) {
    color: var(--color-accent-strong) !important;
  }
</style>
