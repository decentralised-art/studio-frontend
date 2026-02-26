<script lang="ts">
  import StudioLibraryCard from "$lib/components/studio/StudioLibraryCard.svelte";
  import type { LibraryItem } from "$lib/data/studioLibrary";
  import type { User } from "$lib/data/users";

  let {
    title = "Library",
    items = [],
    loading = false,
    usersById = {},
    selectedId,
    draggable = false,
    showHeader = true,
    onSelect,
    onAdd,
    onToolbox,
    onDragStart,
  }: {
    title?: string;
    items?: LibraryItem[];
    loading?: boolean;
    usersById?: Record<User["id"], User>;
    selectedId?: LibraryItem["id"];
    draggable?: boolean;
    showHeader?: boolean;
    onSelect?: (id: LibraryItem["id"]) => void;
    onAdd?: (item: LibraryItem) => void;
    onToolbox?: (item: LibraryItem) => void;
    onDragStart?: (event: DragEvent, item: LibraryItem) => void;
  } = $props();

  const getAuthor = (id: User["id"]) =>
    usersById[id] ?? {
      id,
      kind: "human",
      address: "",
      nickname: "Unknown",
      avatarUrl: "",
      authored: {
        performativeTransactions: 0,
        features: 0,
        transformations: 0,
        conditions: 0,
      },
      toolbox: [],
    };
</script>

<section class="library">
  {#if showHeader}
    <div class="library-header">
      <div class="header-text">
        <span class="eyebrow">Library</span>
        <h2 class="title">{title}</h2>
      </div>
      <span class="count">{items.length}</span>
    </div>
  {/if}

  <div class="list">
    {#if loading && items.length === 0}
      {#each Array.from({ length: 5 }) as _, index (`library-skeleton-${index}`)}
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-title shimmer"></div>
          <div class="skeleton-subtitle shimmer"></div>
        </div>
      {/each}
    {:else if items.length === 0}
      <p class="empty">No entries yet.</p>
    {:else}
      {#each items as item (item.id)}
        <StudioLibraryCard
          {item}
          author={getAuthor(item.authorId)}
          selected={item.id === selectedId}
          {draggable}
          {onSelect}
          {onAdd}
          {onToolbox}
          {onDragStart}
        />
      {/each}
    {/if}
  </div>
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .library {
    @apply flex flex-col flex-1 min-h-0 gap-3
      rounded-2xl border border-white/10 bg-black/70 p-3;
  }

  .library-header {
    @apply flex items-center justify-between gap-2;
  }

  .header-text {
    @apply flex flex-col;
  }

  .eyebrow {
    @apply text-[0.55rem] font-mono uppercase tracking-[0.28em] text-white/40;
  }

  .title {
    @apply text-sm font-semibold text-white;
  }

  .count {
    @apply text-[0.55rem] uppercase tracking-[0.24em] text-white/40;
  }

  .list {
    @apply flex-1 min-h-0 overflow-y-auto space-y-1 pr-1;
  }

  .empty {
    @apply text-[0.7rem] text-white/50;
  }

  .skeleton-card {
    @apply rounded-xl border border-white/10 bg-white/5 p-3 grid gap-2;
  }

  .skeleton-title {
    @apply h-3 rounded-full bg-white/10;
    width: 66%;
  }

  .skeleton-subtitle {
    @apply h-2 rounded-full bg-white/8;
    width: 38%;
  }

  .shimmer {
    animation: library-skeleton-pulse 1.4s ease-in-out infinite;
  }

  @keyframes library-skeleton-pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }
</style>
