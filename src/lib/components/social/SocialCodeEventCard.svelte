<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import { resolve } from "$app/paths";
  import type { RuntimeCodePostEvent } from "$lib/feed/particlePostData";
  import { getUserAvatarInitials } from "$lib/user/avatarInitials";

  const {
    event,
    authorLabelById,
    authorAvatarUrlById,
  }: {
    event: RuntimeCodePostEvent;
    authorLabelById?: Readonly<Record<string, string>>;
    authorAvatarUrlById?: Readonly<Record<string, string>>;
  } = $props();

  const normalizeAddress = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  };

  const shortAddress = (value: string) => {
    const normalized = normalizeAddress(value);
    if (!normalized) return "";
    if (normalized.length < 14) return normalized;
    return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
  };
  const isAddressLabel = (value: string) => /^0x[0-9a-f]{6,}/i.test(value.trim());

  const mappedAuthorLabel = $derived.by(() => {
    const exact = authorLabelById?.[event.authorId]?.trim();
    if (exact && exact.length > 0) return exact;
    const normalized = normalizeAddress(event.authorId);
    const byNormalized = authorLabelById?.[normalized]?.trim();
    if (byNormalized && byNormalized.length > 0) return byNormalized;
    return "";
  });
  const authorLabel = $derived.by(
    () => mappedAuthorLabel || shortAddress(event.authorId) || event.authorId,
  );
  const mappedAuthorAvatarUrl = $derived.by(() => {
    const exact = authorAvatarUrlById?.[event.authorId]?.trim();
    if (exact && exact.length > 0) return exact;
    const normalized = normalizeAddress(event.authorId);
    const byNormalized = authorAvatarUrlById?.[normalized]?.trim();
    if (byNormalized && byNormalized.length > 0) return byNormalized;
    return "";
  });
  const authorAvatarUrl = $derived.by(() => mappedAuthorAvatarUrl);
  const authorAvatarInitials = $derived.by(() =>
    isAddressLabel(authorLabel) ? "?" : getUserAvatarInitials(authorLabel),
  );
  const elementKindLabel = $derived.by(() =>
    event.type === "transformation" ? "transformation" : "condition",
  );
</script>

<Card variant="soft">
  <article class="social-code-card">
    <header class="event-header">
      <div class="event-author">
        {#if authorAvatarUrl}
          <img class="author-avatar" src={authorAvatarUrl} alt={`${authorLabel} avatar`} />
        {:else}
          <div class="author-avatar author-avatar--fallback" aria-hidden="true">
            {authorAvatarInitials}
          </div>
        {/if}
        <div class="author-meta">
          <div class="author-row">
            <div class="author-identity">
              <a class="author-name author-link" href={resolve("/u/[id]", { id: event.authorId })}
                >{authorLabel}</a
              >
              {#if event.createdLabel}
                <p class="event-time">{event.createdLabel}</p>
              {/if}
            </div>
            <span class="author-event-text">
              created a new {elementKindLabel}: <strong>{event.elementLabel}</strong>
            </span>
          </div>
        </div>
      </div>
    </header>

    <div class="code-shell" aria-label={`${elementKindLabel} runtime snippet`}>
      <pre><code>{event.runtimeSnippet}</code></pre>
    </div>
  </article>
</Card>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  :global(.card-soft) {
    @apply w-full;
  }

  .social-code-card {
    @apply flex flex-col gap-2.5;
    color: var(--text-primary);
  }

  .event-header {
    @apply flex items-center gap-2;
  }

  .event-author {
    @apply flex items-center gap-2.5 min-w-0;
  }

  .author-avatar {
    @apply h-10 w-10 shrink-0 rounded-xl border object-cover;
    background: var(--surface-panel-soft);
    border-color: var(--border-subtle);
  }

  .author-avatar--fallback {
    @apply flex items-center justify-center font-semibold;
    color: var(--text-muted);
  }

  .author-meta {
    @apply min-w-0;
  }

  .author-row {
    @apply flex flex-wrap items-baseline gap-x-2 gap-y-1;
  }

  .author-identity {
    @apply min-w-0;
    line-height: 1;
  }

  .author-name {
    @apply text-sm font-semibold tracking-[0.03em] md:text-[0.95rem];
    color: var(--text-primary);
  }

  .author-link {
    @apply transition;
    text-decoration: none;
  }

  .author-link:hover {
    color: var(--color-accent-strong);
  }

  .event-time {
    @apply mt-0.5 text-[0.62rem] uppercase tracking-[0.16em];
    color: var(--text-faint);
  }

  .author-event-text {
    @apply text-sm leading-snug;
    align-self: baseline;
    color: var(--text-muted);
  }

  .code-shell {
    @apply rounded-2xl border px-3 py-2.5;
    background: var(--surface-code);
    border-color: var(--border-subtle);
  }

  .code-shell pre {
    @apply m-0 overflow-x-auto;
  }

  .code-shell code {
    @apply text-xs md:text-[0.82rem];
    color: var(--color-accent-strong);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
      monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
