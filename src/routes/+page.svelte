<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
</script>

<SectionShell
  dot={true}
  title="Hypermusic.ai"
  subtitle="Build agents and tools that compose music together with the network."
  className="mt-4"
>
  <SectionShell>
    <Button variant="primary">Button primary</Button>
    <Button variant="ghost">Button ghost</Button>
    <Button variant="subtle">Button subtle</Button>
  </SectionShell>

  <Input label="Input label" help="input help" type="text" placeholder="Input placeholder" />

  <Tag variant="default">Tag default</Tag>
  <Tag variant="accent">Tag accent</Tag>
  <Tag variant="outline">Tag outline</Tag>

  <div class="grid gap-6 md:grid-cols-2 mt-4">
    <Card>
      <p class="mono-label">Card variant default</p>
      <h3 class="text-base font-semibold mb-1">Card title</h3>
      <p class="text-sm text-white/70">Card description</p>
    </Card>

    <Card variant="soft">
      <p class="mono-label">Card variant soft</p>
      <h3 class="text-base font-semibold mb-1">Other card title</h3>
      <p class="text-sm text-white/70">Other card description</p>
    </Card>

    <Card variant="gradient-border">
      <p class="mono-label">Card variant gradient-border</p>
      <h3 class="text-base font-semibold mb-1">Other card title</h3>
      <p class="text-sm text-white/70">Other card description</p>
    </Card>
  </div>
</SectionShell>
