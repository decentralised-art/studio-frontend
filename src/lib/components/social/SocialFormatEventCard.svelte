<script lang="ts">
  import { resolve } from "$app/paths";
  import Card from "$lib/components/ui/Card.svelte";
  import { displayUsersById } from "$lib/data/users";
  import type { FormatFeedEvent } from "$lib/formats/localFormats";
  import { getUserAvatarInitials } from "$lib/user/avatarInitials";

  const {
    event,
    authorLabelById,
    authorAvatarUrlById,
  }: {
    event: FormatFeedEvent;
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

  const author = $derived.by(() => displayUsersById[event.authorId] ?? null);
  const mappedAuthorLabel = $derived.by(() => {
    const exact = authorLabelById?.[event.authorId]?.trim();
    if (exact && exact.length > 0) return exact;
    const normalized = normalizeAddress(event.authorId);
    const byNormalized = authorLabelById?.[normalized]?.trim();
    if (byNormalized && byNormalized.length > 0) return byNormalized;
    return "";
  });
  const authorLabel = $derived.by(
    () => mappedAuthorLabel || author?.nickname || shortAddress(event.authorId) || event.authorId,
  );
  const mappedAuthorAvatarUrl = $derived.by(() => {
    const exact = authorAvatarUrlById?.[event.authorId]?.trim();
    if (exact && exact.length > 0) return exact;
    const normalized = normalizeAddress(event.authorId);
    const byNormalized = authorAvatarUrlById?.[normalized]?.trim();
    if (byNormalized && byNormalized.length > 0) return byNormalized;
    return "";
  });
  const authorAvatarUrl = $derived.by(() => mappedAuthorAvatarUrl || author?.avatarUrl || "");
  const authorAvatarInitials = $derived.by(() =>
    isAddressLabel(authorLabel) ? "?" : getUserAvatarInitials(authorLabel),
  );
</script>

<Card variant="soft">
  <article class="social-format-card">
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
              created a new format:
              <a class="format-link" href={resolve("/f/[slug]", { slug: event.formatSlug })}>
                {event.formatName}
              </a>
            </span>
          </div>
        </div>
      </div>
    </header>

    {#if event.terminalParticleLabels.length > 0}
      <div class="format-scalars">
        <p class="format-scalars-label">Scalars:</p>
        <p class="format-scalars-values">{event.terminalParticleLabels.join(", ")}</p>
      </div>
    {/if}
  </article>
</Card>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  :global(.card-soft) {
    @apply w-full;
  }

  .social-format-card {
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

  .format-link {
    @apply underline underline-offset-2 transition;
    color: var(--text-primary);
    text-decoration-color: var(--border-strong);
  }

  .format-link:hover {
    color: var(--color-accent-strong);
    text-decoration-color: color-mix(in srgb, var(--color-accent) 70%, transparent);
  }

  .format-scalars {
    @apply rounded-2xl border px-3 py-2.5;
    background: var(--surface-panel-soft);
    border-color: var(--border-subtle);
  }

  .format-scalars-label {
    @apply m-0 text-[0.62rem] uppercase tracking-[0.14em];
    color: var(--text-muted);
  }

  .format-scalars-values {
    @apply m-0 mt-1 break-words text-sm;
    color: var(--text-secondary);
  }
</style>
