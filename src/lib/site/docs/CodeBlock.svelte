<script lang="ts">
  import { highlight, type CodeLanguage } from "$lib/site/docs/highlight";
  import { languagePreference } from "$lib/site/docs/languagePreference.svelte";

  type Sample = { label: string; lang: CodeLanguage; code: string };

  type Props = {
    /** One sample, or several shown as tabs (for example JavaScript and Python). */
    samples?: Sample[];
    code?: string;
    lang?: CodeLanguage;
    /** Optional file name or caption shown above a single sample. */
    caption?: string;
  };

  const { samples, code = "", lang = "ts", caption }: Props = $props();

  const allSamples = $derived<Sample[]>(samples ?? [{ label: caption ?? "", lang, code }]);
  const hasTabs = $derived(allSamples.length > 1);

  const active = $derived.by(() => {
    const wanted = languagePreference.value;
    return allSamples.find((sample) => sample.label === wanted) ?? allSamples[0];
  });
  // Every sample is rendered and the inactive ones are hidden, so the HTML (and the markdown
  // generated from it) carries all languages.
  const highlighted = $derived(
    allSamples.map((sample) => ({
      ...sample,
      html: highlight(sample.code.replace(/\n$/, ""), sample.lang),
    })),
  );

  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const choose = (label: string) => languagePreference.set(label);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.code.replace(/\n$/, ""));
      copied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (copied = false), 1600);
    } catch {
      copied = false;
    }
  };
</script>

<div class="code-block" data-code-block data-code-caption={hasTabs ? undefined : caption}>
  <div class="code-bar" data-markdown-skip>
    {#if hasTabs}
      <div class="code-tabs" role="tablist" aria-label="Code language">
        {#each allSamples as sample (sample.label)}
          <button
            type="button"
            role="tab"
            class="code-tab"
            aria-selected={sample.label === active.label}
            onclick={() => choose(sample.label)}
          >
            {sample.label}
          </button>
        {/each}
      </div>
    {:else}
      <span class="code-caption">{caption ?? ""}</span>
    {/if}
    <button type="button" class="code-copy" onclick={copy} aria-live="polite">
      {copied ? "Copied" : "Copy"}
    </button>
  </div>
  <!-- eslint-disable svelte/no-at-html-tags -- highlight() escapes the source first -->
  {#each highlighted as sample (sample.label)}
    <pre
      hidden={sample.label !== active.label}
      data-code-label={hasTabs ? sample.label : undefined}
      data-code-lang={sample.lang}><code>{@html sample.html}</code></pre>
  {/each}
  <!-- eslint-enable svelte/no-at-html-tags -->
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .code-block {
    --tok-comment: #8b93a7;
    --tok-string: #8de58f;
    --tok-number: #f7c86a;
    --tok-keyword: #ff8fd8;
    --tok-literal: #ff9b7a;
    --tok-type: #67d6ff;
    --tok-function: #b9a7ff;
    --tok-property: #67d6ff;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    border-radius: 0.75rem;
    background: #0b0d14;
  }

  :global(:root[data-theme="light"]) .code-block {
    --tok-comment: #6b7280;
    --tok-string: #0b7a3e;
    --tok-number: #a15c00;
    --tok-keyword: #b4237d;
    --tok-literal: #c2410c;
    --tok-type: #0a6c9b;
    --tok-function: #5b3cc4;
    --tok-property: #0a6c9b;
    background: #f6f7fb;
  }

  .code-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 2.4rem;
    padding: 0 0.5rem 0 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .code-tabs {
    display: flex;
    flex: 1;
    align-self: stretch;
    gap: 0.25rem;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .code-tab {
    position: relative;
    flex: none;
    white-space: nowrap;
    padding: 0 0.6rem;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
  }

  .code-tab[aria-selected="true"] {
    color: var(--text-primary);
  }

  .code-tab[aria-selected="true"]::after {
    content: "";
    position: absolute;
    right: 0.4rem;
    bottom: -1px;
    left: 0.4rem;
    height: 2px;
    border-radius: 2px;
    background: var(--color-accent);
  }

  .code-caption {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .code-copy {
    flex: none;
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.4rem;
    background: transparent;
    font: inherit;
    font-size: 0.72rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .code-copy:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  /* !important: the site's light theme restyles every pre and code element. */
  .code-block pre,
  .code-block code {
    margin: 0;
    border: 0 !important;
    border-radius: 0;
    background: transparent !important;
  }

  .code-block pre[hidden] {
    display: none;
  }

  .code-block pre {
    overflow-x: auto;
    padding: 0.9rem 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 0.8rem;
    line-height: 1.6;
    tab-size: 2;
  }

  .code-block code {
    padding: 0;
    color: #e5e7eb !important;
    white-space: pre;
  }

  :global(:root[data-theme="light"]) .code-block code {
    color: #1f2937 !important;
  }

  .code-block :global(.tok-comment) {
    color: var(--tok-comment);
    font-style: italic;
  }

  .code-block :global(.tok-string) {
    color: var(--tok-string);
  }

  .code-block :global(.tok-number) {
    color: var(--tok-number);
  }

  .code-block :global(.tok-keyword) {
    color: var(--tok-keyword);
  }

  .code-block :global(.tok-literal) {
    color: var(--tok-literal);
  }

  .code-block :global(.tok-type) {
    color: var(--tok-type);
  }

  .code-block :global(.tok-function) {
    color: var(--tok-function);
  }

  .code-block :global(.tok-property) {
    color: var(--tok-property);
  }
</style>
