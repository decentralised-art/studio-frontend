<script lang="ts">
  import { resolve } from "$app/paths";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SocialEventCard from "$lib/components/social/SocialEventCard.svelte";
  import { mockSocialEvents, mockSocialNetworkGraph } from "$lib/social/mockSocialFeed";
  import { networkNodeStudioKind, type NetworkGraphNode } from "$lib/network/mockNetworkGraph";
  import {
    mockCurrentUserId,
    mockFollowingByUserId,
    mockUsers,
    mockUsersById,
    type User,
  } from "$lib/data/users";
  import type { NetworkNodeKind } from "$lib/network/mockNetworkGraph";

  let followSearch = $state("");
  let localFollowing = $state<User["id"][]>([...(mockFollowingByUserId[mockCurrentUserId] ?? [])]);

  const followedAuthorIds = $derived.by(() => new Set(localFollowing));
  const searchQuery = $derived.by(() => followSearch.trim().toLowerCase());

  const userSearchResults = $derived.by(() => {
    if (!searchQuery) return [] as User[];
    return mockUsers
      .filter((user) => user.id !== mockCurrentUserId)
      .filter((user) => {
        return `${user.nickname} ${user.address} ${user.bio ?? ""}`
          .toLowerCase()
          .includes(searchQuery);
      })
      .slice(0, 6);
  });

  type SearchableEntityKind = Extract<
    NetworkNodeKind,
    "particle" | "feature" | "transformation" | "condition"
  >;

  type EntitySearchResult = {
    id: string;
    label: string;
    kind: SearchableEntityKind;
    entityId: string;
    summary: string;
    creatorName: string;
  };

  const entitySearchResults = $derived.by(() => {
    if (!searchQuery) return [] as EntitySearchResult[];
    const allowedKinds = new Set<SearchableEntityKind>([
      "particle",
      "feature",
      "transformation",
      "condition",
    ]);
    return mockSocialNetworkGraph.nodes
      .filter((node): node is typeof node & { kind: SearchableEntityKind } =>
        allowedKinds.has(node.kind as SearchableEntityKind),
      )
      .filter((node) =>
        `${node.label} ${node.entityId} ${node.summary}`.toLowerCase().includes(searchQuery),
      )
      .map((node) => ({
        id: node.id,
        label: node.label,
        kind: node.kind,
        entityId: node.entityId,
        summary: node.summary,
        creatorName: mockUsersById[node.creatorId ?? ""]?.nickname ?? "unknown contributor",
      }))
      .slice(0, 10);
  });

  const showSearchResults = $derived.by(() => searchQuery.length > 0);

  // Feed should render the full event stream; follow state is used for social actions/search,
  // not for suppressing mock events. This keeps the rendering path compatible with future DB feeds.
  const feedEvents = $derived.by(() => mockSocialEvents);

  const openParticleInStudio = (particleId: string | NetworkGraphNode) => {
    const resolvedParticleId =
      typeof particleId === "string"
        ? particleId
        : particleId.kind === "particle"
          ? particleId.entityId
          : null;
    if (!resolvedParticleId) return;
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("particle"));
    target.searchParams.set("network_id", resolvedParticleId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const followUser = (userId: User["id"]) => {
    if (localFollowing.includes(userId)) return;
    localFollowing = [...localFollowing, userId];
  };
</script>

<div class="social-page">
  <div class="follow-panel-shell">
    <section class="follow-search-bar" aria-label="Search users and network elements">
      <div class="follow-search-inner">
        <div class="follow-search-field">
          <Input
            label=""
            placeholder="Search users, particles, features, transformations, conditions"
            value={followSearch}
            oninput={(event) => {
              followSearch = event.currentTarget.value;
            }}
          />
        </div>
      </div>

      {#if showSearchResults}
        <div class="follow-candidate-list" role="list" aria-label="Search results">
          {#if userSearchResults.length}
            <div class="result-group">
              <p class="result-group-label">Users</p>
              {#each userSearchResults as user (user.id)}
                <div class="follow-candidate-item" role="listitem">
                  <div class="candidate-meta">
                    <img
                      class="candidate-avatar"
                      src={user.avatarUrl}
                      alt={`${user.nickname} avatar`}
                    />
                    <div class="candidate-text">
                      <p class="candidate-name">{user.nickname}</p>
                      <p class="candidate-kind">{user.kind === "agent" ? "AI Agent" : "Human"}</p>
                    </div>
                  </div>
                  {#if followedAuthorIds.has(user.id)}
                    <span class="candidate-state">Following</span>
                  {:else}
                    <Button
                      variant="ghost"
                      onclick={() => followUser(user.id)}
                      className="follow-btn"
                    >
                      Follow
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if entitySearchResults.length}
            <div class="result-group">
              <p class="result-group-label">Network elements</p>
              {#each entitySearchResults as item (item.id)}
                <div class="follow-candidate-item" role="listitem">
                  <div class="candidate-meta">
                    <div class="candidate-avatar candidate-avatar--glyph" aria-hidden="true">
                      {item.kind.slice(0, 1).toUpperCase()}
                    </div>
                    <div class="candidate-text">
                      <p class="candidate-name">{item.label}</p>
                      <p class="candidate-kind">
                        {item.kind} · by {item.creatorName}
                      </p>
                    </div>
                  </div>
                  {#if item.kind === "particle"}
                    <Button
                      variant="ghost"
                      onclick={() =>
                        openParticleInStudio({
                          id: item.id,
                          label: item.label,
                          kind: "particle",
                          entityId: item.entityId,
                          summary: item.summary,
                          x: 0,
                          y: 0,
                          size: 0,
                        })}
                      className="follow-btn"
                    >
                      Open
                    </Button>
                  {:else}
                    <span class="candidate-state">{item.kind}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if userSearchResults.length === 0 && entitySearchResults.length === 0}
            <div class="search-empty" role="listitem">No users or network elements found.</div>
          {/if}
        </div>
      {/if}
    </section>
  </div>

  <section class="social-feed" aria-label="Activity feed">
    {#if feedEvents.length === 0}
      <div class="feed-empty">
        <p>No events to display yet.</p>
      </div>
    {:else}
      {#each feedEvents as event (event.id)}
        <div class="feed-card-shell">
          <SocialEventCard {event} onParticleOpen={openParticleInStudio} />
        </div>
      {/each}
    {/if}
  </section>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .social-page {
    @apply h-full flex-1 min-h-0 overflow-hidden p-2 md:p-3 grid gap-3;
    grid-template-rows: auto minmax(0, 1fr);
    --social-feed-card-width: min(50vw, 56rem);
    background:
      radial-gradient(circle at 10% -10%, rgba(103, 214, 255, 0.12), transparent 45%),
      radial-gradient(circle at 90% 0%, rgba(244, 178, 71, 0.09), transparent 45%),
      radial-gradient(circle at 50% 120%, rgba(168, 85, 247, 0.08), transparent 55%);
  }

  .follow-panel-shell {
    @apply mx-auto z-10 shrink-0;
    width: var(--social-feed-card-width);
    max-width: 100%;
  }

  .follow-search-bar {
    @apply rounded-3xl border border-white/10 bg-black/70 backdrop-blur-xl
      px-3 py-3 md:px-4 md:py-3.5;
  }

  .follow-search-inner {
    @apply flex flex-col gap-2;
  }

  .follow-search-field {
    @apply min-w-0;
  }

  .follow-candidate-list {
    @apply mt-2 grid gap-2;
  }

  .result-group {
    @apply grid gap-1.5;
  }

  .result-group-label {
    @apply text-[0.58rem] uppercase tracking-[0.2em] text-white/40 px-1;
  }

  .follow-candidate-item {
    @apply flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2;
  }

  .candidate-meta {
    @apply flex items-center gap-2.5 min-w-0;
  }

  .candidate-avatar {
    @apply h-8 w-8 rounded-lg border border-white/10 object-cover bg-white/5 shrink-0;
  }

  .candidate-avatar--glyph {
    @apply flex items-center justify-center text-xs font-semibold text-white/70;
  }

  .candidate-text {
    @apply min-w-0;
  }

  .candidate-name {
    @apply text-sm font-medium text-white leading-tight;
  }

  .candidate-kind {
    @apply text-[0.62rem] uppercase tracking-[0.14em] text-white/45;
  }

  .follow-btn {
    @apply text-xs px-2.5 py-1.5;
  }

  .candidate-state {
    @apply text-[0.62rem] uppercase tracking-[0.14em] text-white/45 px-1;
  }

  .search-empty {
    @apply rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60;
  }

  .social-feed {
    @apply min-h-0 overflow-y-auto grid gap-3 pb-2 justify-items-center pr-1;
    align-content: start;
  }

  .feed-card-shell {
    @apply mx-auto;
    width: var(--social-feed-card-width);
    max-width: 100%;
  }

  .feed-empty {
    @apply rounded-3xl border border-white/10 bg-black/40 p-6 text-center text-white/70 mx-auto;
    width: var(--social-feed-card-width);
    max-width: 100%;
  }

  @media (max-width: 1200px) {
    .social-page {
      --social-feed-card-width: min(68vw, 56rem);
    }
  }

  @media (max-width: 900px) {
    .social-page {
      --social-feed-card-width: 100%;
    }
  }
</style>
