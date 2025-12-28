<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  import type { ExploreParticle, ParticleView } from "$lib/data/exploreParticles";
  import type { User } from "$lib/data/users";

  const {
    particle,
    author,
    view,
    onAdd,
    onRerun,
    onAuthorSelect,
  }: {
    particle: ExploreParticle;
    author: User;
    view: ParticleView | null;
    onAdd?: (particle: ExploreParticle) => void;
    onRerun?: (particle: ExploreParticle) => void;
    onAuthorSelect?: (id: User["id"]) => void;
  } = $props();

  const handleAdd = () => onAdd?.(particle);
  const handleRerun = () => onRerun?.(particle);
  const handleAuthorSelect = () => onAuthorSelect?.(author.id);
</script>

<div class="space-y-4">
  <Card variant="soft" className="border-white/15 bg-black/70 backdrop-blur">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <Tag variant="accent">{view?.label ?? "Unknown view"}</Tag>
          <span class="mono-label">{particle.createdLabel}</span>
        </div>

        <div>
          <h3 class="text-lg font-semibold text-white">{particle.name}</h3>
          <p class="text-sm text-white/70">{particle.summary}</p>
        </div>

        <p class="text-sm text-white/70">
          Author:
          <button
            type="button"
            class="ml-1 text-white font-semibold hover:text-emerald-200 transition"
            onclick={handleAuthorSelect}
          >
            {author.nickname}
          </button>
        </p>
      </div>
    </div>
  </Card>

  <Card variant="soft">
    <div class="flex flex-wrap items-center justify-end gap-2 pb-3 border-b border-white/10">
      <Button variant="primary" onclick={handleRerun}>Re-run PT</Button>
      <Button variant="subtle" onclick={handleAdd}>Add to toolbox</Button>
    </div>

    <div class="flex items-center justify-between gap-3 pt-3">
      <div>
        <p class="text-sm font-semibold text-white">Particle view preview</p>
        <p class="text-xs text-white/50">
          Visualization for {view?.label ?? "this view"} will appear here.
        </p>
      </div>
      <Tag variant="outline">{view?.label ?? "Unknown view"}</Tag>
    </div>

    <div
      class="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/5
      min-h-[260px] lg:min-h-[360px] p-6 text-sm text-white/50 text-center
      flex items-center justify-center"
    >
      Preview window placeholder
    </div>
  </Card>

  <Card variant="soft">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-white">Performative transaction lineage</p>
        <p class="text-xs text-white/50">Tree view and dependency previews will live here.</p>
      </div>
      <Tag variant="outline">{particle.dependencies.length} nodes</Tag>
    </div>

    <div
      class="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/5
      p-6 text-xs text-white/50"
    >
      <p class="mb-3 text-sm text-white/60">Dependency snapshot</p>
      <div class="flex flex-wrap gap-2">
        {#each particle.dependencies as dependency (dependency)}
          <Tag variant="outline">{dependency}</Tag>
        {/each}
      </div>
    </div>
  </Card>
</div>
