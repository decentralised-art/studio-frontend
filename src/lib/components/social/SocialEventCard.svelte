<script lang="ts">
  import { resolve } from "$app/paths";
  import Card from "$lib/components/ui/Card.svelte";
  import SocialConnectorDependencyFlow from "$lib/components/social/SocialConnectorDependencyFlow.svelte";
  import { displayUsersById } from "$lib/data/users";
  import type { ConnectorPostEvent } from "$lib/feed/particlePostData";
  import { getUserAvatarInitials } from "$lib/user/avatarInitials";
  const {
    event,
    onConnectorOpen,
    onParticleOpen,
    onAddToToolbox,
    onLoadInWorld,
    toolboxMode = "add",
    authorLabelById,
    authorAvatarUrlById,
    inToolbox = false,
  }: {
    event: ConnectorPostEvent;
    onConnectorOpen?: ((connectorId: string) => void) | undefined;
    onParticleOpen?: ((particleId: string) => void) | undefined;
    onAddToToolbox?: ((particleId: string) => void) | undefined;
    onLoadInWorld?: ((particleId: string) => void) | undefined;
    toolboxMode?: "add" | "toggle";
    authorLabelById?: Readonly<Record<string, string>>;
    authorAvatarUrlById?: Readonly<Record<string, string>>;
    inToolbox?: boolean;
  } = $props();

  const resolvedOpenHandler = $derived.by(() => onConnectorOpen ?? onParticleOpen);

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
  const dependencies = $derived.by(() =>
    event.usedParticleIds.map((id, index) => ({
      id,
      label: event.usedParticleLabels[index] ?? id,
    })),
  );
  const toolboxButtonDisabled = $derived(inToolbox && toolboxMode !== "toggle");
  const toolboxButtonTitle = $derived(
    inToolbox
      ? toolboxMode === "toggle"
        ? "Remove from toolbox"
        : "Already in toolbox"
      : "Add to toolbox",
  );
  const toolboxButtonLabel = $derived(
    inToolbox
      ? toolboxMode === "toggle"
        ? "Remove connector from toolbox"
        : "Connector already in toolbox"
      : "Add connector to toolbox",
  );
  const handleToolboxClick = (eventClick: MouseEvent) => {
    eventClick.preventDefault();
    eventClick.stopPropagation();
    if (toolboxButtonDisabled) return;
    onAddToToolbox?.(event.particleId);
  };
  const handleLoadInWorldClick = (eventClick: MouseEvent) => {
    eventClick.preventDefault();
    eventClick.stopPropagation();
    onLoadInWorld?.(event.particleId);
  };
</script>

<Card variant="soft">
  <article class="social-event-card">
    <div class="card-action-buttons">
      {#if onLoadInWorld}
        <button
          type="button"
          class="world-load-button"
          title="Load connector in world"
          aria-label="Load connector in world"
          onclick={handleLoadInWorldClick}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14"></path>
            <path d="m13 6 6 6-6 6"></path>
          </svg>
        </button>
      {/if}

      <button
        type="button"
        class={`toolbox-add-button ${inToolbox ? "is-saved" : ""}`}
        title={toolboxButtonTitle}
        aria-label={toolboxButtonLabel}
        aria-pressed={inToolbox}
        onclick={handleToolboxClick}
        disabled={toolboxButtonDisabled}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 20.4c-.3 0-.7-.1-.9-.3C7.6 17.2 4 14.2 4 9.9 4 7.1 6.1 5 8.9 5c1.4 0 2.7.6 3.6 1.6C13.4 5.6 14.7 5 16.1 5 18.9 5 21 7.1 21 9.9c0 4.3-3.6 7.3-7.1 10.2-.2.2-.6.3-.9.3Z"
          ></path>
        </svg>
      </button>
    </div>

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
              created a new connector:
              <a class="event-connector-link" href={resolve("/c/[id]", { id: event.particleId })}>
                {event.particleLabel}
              </a>
            </span>
          </div>
        </div>
      </div>
    </header>

    <div class="event-graph">
      <SocialConnectorDependencyFlow
        connectorId={event.particleId}
        onConnectorOpen={resolvedOpenHandler}
      />
    </div>

    <div class="event-body">
      <div class="event-links" aria-label="Connector dependencies">
        {#if event.formatHash}
          <p class="event-link-row">
            <span class="event-link-label">Format:</span>
            <a
              class="event-dependency-link"
              href={resolve("/f/[slug]", { slug: event.formatHash })}
            >
              {event.formatHash}
            </a>
          </p>
        {/if}
        {#if dependencies.length > 0}
          <p class="event-link-row">
            <span class="event-link-label">Dependencies:</span>
            <span class="event-dependency-links">
              {#each dependencies as connectorRef, index (`${connectorRef.id}-${index}`)}
                <a class="event-dependency-link" href={resolve("/c/[id]", { id: connectorRef.id })}>
                  {connectorRef.label}
                </a>
                {#if index < dependencies.length - 1}
                  <span class="event-link-separator" aria-hidden="true">, </span>
                {/if}
              {/each}
            </span>
          </p>
        {/if}
      </div>
    </div>
  </article>
</Card>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  :global(.card-soft) {
    @apply w-full;
  }

  .social-event-card {
    @apply relative flex flex-col gap-2.5;
    color: var(--text-primary);
  }

  .card-action-buttons {
    @apply absolute right-0.5 top-0.5 z-10 flex gap-1;
  }

  .toolbox-add-button,
  .world-load-button {
    @apply h-8 w-8 rounded-lg border transition;
    display: grid;
    place-items: center;
    backdrop-filter: blur(8px);
    background: var(--surface-floating);
    border-color: var(--border-subtle);
    color: var(--text-muted);
  }

  .toolbox-add-button:hover:not(:disabled) {
    background: var(--surface-floating-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .world-load-button:hover {
    background: var(--surface-floating-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .toolbox-add-button:disabled {
    @apply cursor-default opacity-100;
  }

  .toolbox-add-button.is-saved {
    @apply border-[#8de58f]/45 bg-[#8de58f]/15 text-[#8de58f];
  }

  .toolbox-add-button svg,
  .world-load-button svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .toolbox-add-button:not(.is-saved) svg {
    fill: transparent;
  }

  .toolbox-add-button.is-saved svg {
    fill: currentColor;
    fill-opacity: 0.15;
  }

  .event-header {
    @apply flex items-center gap-2 pr-10;
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

  .event-body {
    @apply grid gap-1;
  }

  .event-links {
    @apply grid gap-1 text-xs;
  }

  .event-link-row {
    @apply flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-snug;
    color: var(--text-muted);
  }

  .event-link-label {
    @apply text-[0.62rem] uppercase tracking-[0.14em];
    color: var(--text-faint);
  }

  .event-connector-link,
  .event-dependency-link {
    @apply no-underline transition;
    color: var(--text-primary);
  }

  .event-connector-link:hover,
  .event-dependency-link:hover {
    color: var(--color-accent-strong);
  }

  .event-connector-link {
    @apply font-medium;
  }

  .event-dependency-links {
    @apply flex flex-wrap items-baseline;
  }

  .event-link-separator {
    color: var(--text-faint);
  }

  .event-graph {
    @apply order-2;
  }

  @media (max-width: 768px) {
    .event-graph :global(.social-dependency-flow) {
      min-height: 260px;
    }
  }
</style>
