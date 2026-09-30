<script lang="ts">
  import { resolve } from "$app/paths";
  import type { LibraryItem } from "$lib/data/studioLibrary";
  import type { User } from "$lib/data/users";

  const {
    item,
    author,
    inToolbox = false,
    selected = false,
    draggable = false,
    local = false,
    publishDisabled = false,
    onAdd,
    onToolbox,
    onOpen,
    onPublish,
    onDragStart,
  }: {
    item: LibraryItem;
    author: User;
    inToolbox?: boolean;
    selected?: boolean;
    draggable?: boolean;
    local?: boolean;
    publishDisabled?: boolean;
    onAdd?: (item: LibraryItem) => void;
    onToolbox?: (item: LibraryItem) => void;
    onOpen?: (item: LibraryItem) => void;
    onPublish?: (item: LibraryItem) => void;
    onDragStart?: (event: DragEvent, item: LibraryItem) => void;
  } = $props();

  const handleAdd = (event: MouseEvent) => {
    event.stopPropagation();
    onAdd?.(item);
  };

  const handleToolbox = (event: MouseEvent) => {
    event.stopPropagation();
    onToolbox?.(item);
  };

  const handleOpen = (event: MouseEvent) => {
    event.stopPropagation();
    onOpen?.(item);
  };

  const handlePublish = (event: MouseEvent) => {
    event.stopPropagation();
    onPublish?.(item);
  };

  const handleDragStart = (event: DragEvent) => {
    onDragStart?.(event, item);
  };

  const authorLabel = $derived.by(() => {
    const nickname = author.nickname.trim();
    if (nickname && nickname.toLowerCase() !== "unknown") return nickname;
    return author.address.trim() || author.id.trim() || "Unknown";
  });

  const authorLabelParts = $derived.by(() => {
    const tailLength = 8;
    if (authorLabel.length <= tailLength * 2) {
      return { head: authorLabel, tail: "" };
    }

    return {
      head: authorLabel.slice(0, -tailLength),
      tail: authorLabel.slice(-tailLength),
    };
  });

  const registryName = $derived.by(() => {
    switch (item.kind) {
      case "feature":
        return item.id.replace(/^feature-/, "");
      case "transformation":
        return item.id.replace(/^transform-/, "");
      case "condition":
        return item.id.replace(/^condition-/, "");
      default:
        return item.id;
    }
  });

  const authorRouteId = $derived.by(
    () => author.address.trim() || author.id.trim() || item.authorId.trim(),
  );
</script>

<div
  class={`library-card ${selected ? "card-selected" : ""}`}
  role="listitem"
  ondragstart={handleDragStart}
  {draggable}
>
  <div class="card-content">
    {#if item.kind === "feature" && !local}
      <a class="item-name item-link" href={resolve("/c/[id]", { id: registryName })}>
        {item.name}
      </a>
    {:else}
      <span class="item-name">{item.name}</span>
    {/if}

    <div class="card-meta-row">
      <a
        class="author author-link"
        href={resolve("/u/[id]", { id: authorRouteId })}
        title={authorLabel}
        aria-label={authorLabel}
      >
        <span class="author-head">{authorLabelParts.head}</span>
        {#if authorLabelParts.tail}
          <span class="author-tail">{authorLabelParts.tail}</span>
        {/if}
      </a>

      <div class="card-actions">
        {#if onToolbox}
          <button
            class={`icon-button ${inToolbox ? "is-saved" : ""}`}
            type="button"
            title={inToolbox ? "Remove from toolbox" : "Add to toolbox"}
            onclick={handleToolbox}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.5 12.572 12 20l-7.5-7.428a4.5 4.5 0 0 1 6.364-6.364L12 7.5l1.136-1.292a4.5 4.5 0 0 1 6.364 6.364Z"
              ></path>
            </svg>
          </button>
        {/if}
        {#if item.kind === "feature"}
          <button class="icon-button" type="button" title="Open in Studio" onclick={handleOpen}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9V4h5"></path>
              <path d="M15 4h5v5"></path>
              <path d="M20 15v5h-5"></path>
              <path d="M9 20H4v-5"></path>
            </svg>
          </button>
        {/if}
        <button class="icon-button" type="button" title="Add to flow" onclick={handleAdd}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </button>
      </div>
    </div>
    {#if onPublish}
      <button
        class="publish-button"
        type="button"
        disabled={publishDisabled}
        onclick={handlePublish}
      >
        Publish to the Network
      </button>
    {/if}
  </div>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .library-card {
    @apply w-full rounded-2xl border border-white/10 bg-white/5 p-2 transition
      hover:border-emerald-400 hover:shadow-lg;
  }

  .card-selected {
    @apply border border-emerald-500/60 bg-emerald-500/10 text-emerald-300;
  }

  .card-content {
    @apply flex min-w-0 w-full flex-col gap-1 text-left;
  }

  .card-meta-row {
    @apply flex min-w-0 items-center justify-between gap-2 text-[0.66rem] text-white/70;
  }

  .item-name {
    @apply block min-w-0 w-full max-w-full text-[0.78rem] font-semibold leading-snug text-left text-white;
    overflow-wrap: anywhere;
  }

  .item-link {
    @apply rounded-sm hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-cyan-300/70;
  }

  .author {
    @apply inline-flex min-w-0 max-w-full text-white/60;
  }

  .author-link {
    @apply rounded-sm hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-cyan-300/70;
  }

  .author-head {
    @apply min-w-0 truncate;
  }

  .author-tail {
    @apply shrink-0 whitespace-nowrap;
  }

  .card-actions {
    @apply flex shrink-0 items-center gap-1;
  }

  .publish-button {
    @apply self-start rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2 py-1
      text-[0.62rem] text-emerald-200 hover:border-emerald-300/60
      disabled:cursor-not-allowed disabled:opacity-50;
  }

  .icon-button {
    @apply h-5 w-5 flex items-center justify-center
      rounded-md border border-white/10 bg-white/5
      text-white/60 hover:text-white hover:border-white/30;
  }

  .icon-button svg {
    @apply h-3 w-3;
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .icon-button.is-saved {
    @apply text-cyan-200 border-cyan-300/50 bg-cyan-500/10;
  }
</style>
