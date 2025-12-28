<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import { mockExploreParticles } from "$lib/data/exploreParticles";

  const currentUser = mockUsersById[mockCurrentUserId];

  let profile = $state({
    nickname: currentUser.nickname,
    bio: currentUser.bio ?? "",
    kind: currentUser.kind,
    avatarUrl: currentUser.avatarUrl,
  });

  const toolboxParticles = currentUser.toolbox
    .map((id) => mockExploreParticles.find((particle) => particle.id === id))
    .filter((particle): particle is (typeof mockExploreParticles)[number] => Boolean(particle));

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
  };
</script>

<div class="flex-1 min-h-0 overflow-y-auto">
  <div class="px-4 py-6">
    <SectionShell
      dot={true}
      title="Account"
      subtitle="Manage your profile and toolbox settings."
      className="mt-4"
    >
      <div class="grid gap-6 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,0.38fr)]">
        <Card>
          <form class="space-y-6" onsubmit={handleSubmit}>
            <div class="flex flex-wrap items-center gap-4">
              <div class="h-16 w-16 rounded-full border border-white/10 bg-white/10 overflow-hidden">
                <img src={profile.avatarUrl} alt={profile.nickname} class="h-full w-full object-cover" />
              </div>
              <div>
                <p class="text-sm text-white/60">Profile photo</p>
                <p class="text-xs text-white/40">Swap avatars later.</p>
              </div>
            </div>

            <Input
              label="Nickname"
              bind:value={profile.nickname}
              inputClassName="!bg-black/40"
            />

            <label class="flex flex-col gap-2 text-sm">
              <span class="input-label">Account type</span>
              <select class="input bg-white/10 text-white/70" bind:value={profile.kind} disabled={true}>
                <option value="human">Human</option>
              </select>
            </label>

            <label class="flex flex-col gap-2 text-sm">
              <span class="input-label">Bio</span>
              <textarea
                class="input min-h-[120px]"
                bind:value={profile.bio}
                placeholder="Describe your creative focus"
              ></textarea>
            </label>

            <Input label="Ethereum address" value={currentUser.address} disabled={true} />

            <div class="flex flex-wrap gap-2">
              <Button variant="primary" type="submit">Save changes</Button>
              <Button variant="ghost" type="button">Discard</Button>
            </div>
          </form>
        </Card>

        <div class="space-y-6">
          <Card variant="soft">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-white">Authored contributions</p>
              <Tag variant="outline">Counts</Tag>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p class="mono-label">PTs</p>
                <p class="text-xl font-semibold text-white">
                  {currentUser.authored.performativeTransactions}
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p class="mono-label">Features</p>
                <p class="text-xl font-semibold text-white">{currentUser.authored.features}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p class="mono-label">Transformations</p>
                <p class="text-xl font-semibold text-white">{currentUser.authored.transformations}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p class="mono-label">Conditions</p>
                <p class="text-xl font-semibold text-white">{currentUser.authored.conditions}</p>
              </div>
            </div>
          </Card>

          <Card variant="soft">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-white">Toolbox</p>
                <p class="text-xs text-white/50">Saved particles ready for reuse.</p>
              </div>
              <Tag variant="outline">{currentUser.toolbox.length} particles</Tag>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              {#if toolboxParticles.length === 0}
                <Tag variant="outline">No saved particles yet</Tag>
              {:else}
                {#each toolboxParticles as particle (particle.id)}
                  <Tag variant="outline">{particle.name}</Tag>
                {/each}
              {/if}
            </div>
          </Card>
        </div>
      </div>
    </SectionShell>
  </div>
</div>
