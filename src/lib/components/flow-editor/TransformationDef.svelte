<script lang="ts">
  import { useEdges } from "@xyflow/svelte";

  import type {
    DimensionData,
    TransformationDef,
    TransformationDefPropsType,
  } from "./flowEditorTypes";

  import Input from "$lib/components/ui/Input.svelte";

  let { edgeId, def }: TransformationDefPropsType = $props();

  const edges = useEdges();

  function updateDef(patch: Partial<TransformationDef>) {
    edges.update((es) =>
      es.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              data: {
                ...(edge.data ?? {}),
                defs: ((edge.data as DimensionData)?.defs ?? []).map((d: TransformationDef) =>
                  d.id === def.id ? { ...d, ...patch } : d,
                ),
              },
            }
          : edge,
      ),
    );
  }

  function handleNameInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;
    updateDef({ name: target.value });
  }

  function handleArgChange(index: number, event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;

    const raw = target.value.trim();
    const num = raw === "" ? NaN : Number(raw);

    const nextArgs = [...def.args];
    nextArgs[index] = isNaN(num) ? 0 : num;

    updateDef({ args: nextArgs });
  }

  function addArg() {
    const nextArgs = [...def.args, 0];
    updateDef({ args: nextArgs });
  }

  function removeArg(index: number) {
    const nextArgs = def.args.filter((_, i) => i !== index);
    updateDef({ args: nextArgs });
  }
</script>

<div class="flex flex-col gap-1 text-xs w-full">
  <!-- Name -->
  <Input
    label=""
    placeholder="Transformation name"
    className="w-full"
    value={def.name}
    oninput={handleNameInput}
  />

  <!-- Args list -->
  <div class="flex items-center gap-2">
    <span class="text-[10px] text-white/60 shrink-0">args:</span>

    <div class="flex flex-wrap gap-1">
      {#if def.args.length === 0}
        <span class="text-[10px] text-white/40 italic">none</span>
      {:else}
        {#each def.args as arg, index (index)}
          <div class="flex items-center gap-1">
            <input
              type="number"
              value={arg}
              oninput={(event) => handleArgChange(index, event)}
              class="w-14 rounded border border-white/20 bg-white/5 px-1 py-0.5 text-[11px] text-white outline-none
                     focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/70"
            />
            <button
              class="px-1 rounded bg-red-500/70 hover:bg-red-500 text-[9px]"
              onclick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                removeArg(index);
              }}
            >
              ✕
            </button>
          </div>
        {/each}
      {/if}
    </div>

    <button
      class="ml-auto px-1.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-[10px]"
      onclick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        addArg();
      }}
    >
      + arg
    </button>
  </div>
</div>
