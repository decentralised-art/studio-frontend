<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { onDestroy, onMount } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  import Input from "$lib/components/ui/Input.svelte";
  import SelectInput from "$lib/components/ui/SelectInput.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  import { mockExploreParticles } from "$lib/data/exploreParticles";
  import {
    mockConditions,
    mockFeatures,
    mockPlugins,
    mockTransformations,
  } from "$lib/data/studioLibrary";
  import { mockUsers } from "$lib/data/users";
  import { mockRegistrySnapshot } from "$lib/particles/mockPtNetwork";

  type SigmaCtor = new (
    graph: unknown,
    container: HTMLElement,
    settings?: Record<string, unknown>,
  ) => {
    kill: () => void;
    on: (event: string, handler: (payload: unknown) => void) => void;
  };

  type GraphCtor = new () => {
    hasNode: (id: string) => boolean;
    addNode: (id: string, attrs: Record<string, unknown>) => void;
    addEdgeWithKey: (
      key: string,
      source: string,
      target: string,
      attrs?: Record<string, unknown>,
    ) => void;
  };

  type NodeKind = "creator" | "particle" | "feature" | "transformation" | "condition" | "plugin";
  type EdgeKind =
    | "authored_by"
    | "uses_feature"
    | "depends_on"
    | "uses_transformation"
    | "guarded_by"
    | "renders_with";

  type NetworkNode = {
    id: string;
    entityId: string;
    kind: NodeKind;
    label: string;
    summary: string;
    creatorId?: string;
    x: number;
    y: number;
    size: number;
  };

  type NetworkEdge = {
    id: string;
    source: string;
    target: string;
    kind: EdgeKind;
  };

  const nodePalette: Record<NodeKind, { color: string; label: string }> = {
    creator: { color: "#71a7ff", label: "Creator" },
    particle: { color: "#37d39d", label: "Particle" },
    feature: { color: "#f4b247", label: "Feature" },
    transformation: { color: "#f07cbc", label: "Transformation" },
    condition: { color: "#f47a7a", label: "Condition" },
    plugin: { color: "#a993ff", label: "Plugin" },
  };

  const edgePalette: Record<EdgeKind, { color: string; label: string }> = {
    authored_by: { color: "#71a7ff", label: "authored by" },
    uses_feature: { color: "#40d69c", label: "uses feature" },
    depends_on: { color: "#ffd166", label: "depends on" },
    uses_transformation: { color: "#f28bc6", label: "uses transformation" },
    guarded_by: { color: "#ff8f8f", label: "guarded by" },
    renders_with: { color: "#b5a1ff", label: "renders with" },
  };

  const kindToggleOptions: Array<{ value: NodeKind; label: string }> = [
    { value: "creator", label: "Creators" },
    { value: "particle", label: "Particles" },
    { value: "feature", label: "Features" },
    { value: "transformation", label: "Transformations" },
    { value: "condition", label: "Conditions" },
    { value: "plugin", label: "Plugins" },
  ];

  const edgeOptions: Array<{ value: EdgeKind | "all"; label: string }> = [
    { value: "all", label: "All relations" },
    ...Object.entries(edgePalette).map(([value, meta]) => ({
      value: value as EdgeKind,
      label: meta.label,
    })),
  ];

  const creatorOptions = mockUsers
    .map((user) => ({ value: user.id, label: user.nickname }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const pluginByView = new SvelteMap<string, string>(
    mockPlugins
      .filter((plugin) => plugin.viewId)
      .map((plugin) => [plugin.viewId!, plugin.id] as const),
  );

  const featureByName = new SvelteMap(
    mockFeatures.map((feature) => [feature.id.replace(/^feature-/, ""), feature] as const),
  );
  const transformationByName = new SvelteMap(
    mockTransformations.map((item) => [item.id.replace(/^transform-/, ""), item] as const),
  );
  const conditionByName = new SvelteMap(
    mockConditions.map((item) => [item.id.replace(/^condition-/, ""), item] as const),
  );
  const particleByName = new SvelteMap(
    mockExploreParticles.map((particle) => [particle.id, particle] as const),
  );

  const nodes: NetworkNode[] = [];
  const nodeById = new SvelteMap<string, NetworkNode>();
  const edges: NetworkEdge[] = [];
  const edgeIdSet = new SvelteSet<string>();

  const slotByKind: Record<NodeKind, number> = {
    creator: 0,
    particle: 0,
    feature: 0,
    transformation: 0,
    condition: 0,
    plugin: 0,
  };

  const columnByKind: Record<NodeKind, number> = {
    creator: 0,
    particle: 1,
    feature: 2,
    transformation: 3,
    condition: 4,
    plugin: 5,
  };

  const columnGap = 300;
  const rowGap = 96;
  const startX = 140;
  const startY = 110;

  const positionFor = (kind: NodeKind) => {
    const slot = slotByKind[kind];
    slotByKind[kind] += 1;
    const x = startX + columnByKind[kind] * columnGap;
    const y = startY + slot * rowGap;
    return { x, y };
  };

  const addNode = (
    node: Omit<NetworkNode, "x" | "y" | "size"> & Partial<Pick<NetworkNode, "x" | "y" | "size">>,
  ) => {
    if (nodeById.has(node.id)) return;
    const pos = positionFor(node.kind);
    const resolved: NetworkNode = {
      ...node,
      x: node.x ?? pos.x,
      y: node.y ?? pos.y,
      size:
        node.size ??
        (node.kind === "creator"
          ? 8.5
          : node.kind === "particle"
            ? 7.8
            : node.kind === "plugin"
              ? 7.4
              : 6.9),
    };
    nodeById.set(resolved.id, resolved);
    nodes.push(resolved);
  };

  const addEdge = (edge: Omit<NetworkEdge, "id">) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    const id = `${edge.kind}:${edge.source}->${edge.target}`;
    if (edgeIdSet.has(id)) return;
    edgeIdSet.add(id);
    edges.push({ id, ...edge });
  };

  mockUsers.forEach((user) => {
    addNode({
      id: `creator:${user.id}`,
      entityId: user.id,
      kind: "creator",
      label: user.nickname,
      summary: user.bio ?? "Network contributor",
      creatorId: user.id,
    });
  });

  mockRegistrySnapshot.transformations.forEach((transformation) => {
    const meta = transformationByName.get(transformation.name);
    addNode({
      id: `transformation:${transformation.name}`,
      entityId: transformation.name,
      kind: "transformation",
      label: meta?.name ?? transformation.name,
      summary: meta?.summary ?? `Transformation with ${transformation.argc} argument(s).`,
      creatorId: meta?.authorId,
    });
  });

  mockRegistrySnapshot.conditions.forEach((condition) => {
    const meta = conditionByName.get(condition.name);
    addNode({
      id: `condition:${condition.name}`,
      entityId: condition.name,
      kind: "condition",
      label: meta?.name ?? condition.name,
      summary: meta?.summary ?? `Condition with ${condition.argc} argument(s).`,
      creatorId: meta?.authorId,
    });
  });

  mockRegistrySnapshot.features.forEach((feature) => {
    const meta = featureByName.get(feature.name);
    addNode({
      id: `feature:${feature.name}`,
      entityId: feature.name,
      kind: "feature",
      label: meta?.name ?? feature.name,
      summary: meta?.summary ?? `${feature.dimensions.length} dimension schema.`,
      creatorId: meta?.authorId,
    });
  });

  mockPlugins.forEach((plugin) => {
    addNode({
      id: `plugin:${plugin.id}`,
      entityId: plugin.id,
      kind: "plugin",
      label: plugin.name,
      summary: plugin.summary ?? "Output renderer",
      creatorId: plugin.authorId,
    });
  });

  mockRegistrySnapshot.particles.forEach((particle) => {
    const meta = particleByName.get(particle.name);
    addNode({
      id: `particle:${particle.name}`,
      entityId: particle.name,
      kind: "particle",
      label: meta?.name ?? particle.name,
      summary: meta?.summary ?? "Composable runnable particle.",
      creatorId: meta?.authorId,
    });

    addEdge({
      kind: "uses_feature",
      source: `particle:${particle.name}`,
      target: `feature:${particle.featureName}`,
    });

    particle.composites
      .filter((name): name is string => Boolean(name))
      .forEach((dependency) => {
        addEdge({
          kind: "depends_on",
          source: `particle:${particle.name}`,
          target: `particle:${dependency}`,
        });
      });

    if (particle.conditionName) {
      addEdge({
        kind: "guarded_by",
        source: `particle:${particle.name}`,
        target: `condition:${particle.conditionName}`,
      });
    }

    const pluginId = pluginByView.get(meta?.viewId ?? "midi");
    if (pluginId) {
      addEdge({
        kind: "renders_with",
        source: `particle:${particle.name}`,
        target: `plugin:${pluginId}`,
      });
    }
  });

  mockRegistrySnapshot.features.forEach((feature) => {
    const seen = new SvelteSet<string>();
    feature.dimensions.forEach((dimension) => {
      dimension.transformations.forEach((transformation) => {
        if (seen.has(transformation.name)) return;
        seen.add(transformation.name);
        addEdge({
          kind: "uses_transformation",
          source: `feature:${feature.name}`,
          target: `transformation:${transformation.name}`,
        });
      });
    });
  });

  nodes.forEach((node) => {
    if (!node.creatorId) return;
    addEdge({
      kind: "authored_by",
      source: `creator:${node.creatorId}`,
      target: node.id,
    });
  });

  let visibleKinds = $state<Record<NodeKind, boolean>>({
    creator: true,
    particle: true,
    feature: true,
    transformation: true,
    condition: true,
    plugin: true,
  });
  let creatorFilter = $state("all");
  let edgeFilter = $state<EdgeKind | "all">("all");
  let search = $state("");
  let selectedNodeId = $state("");

  let visibleNodes = $state<NetworkNode[]>(nodes);
  let visibleEdges = $state<NetworkEdge[]>(edges);

  const recomputeVisibleGraph = () => {
    const query = search.trim().toLowerCase();
    const filteredIds = new SvelteSet<string>();

    nodes.forEach((node) => {
      if (!visibleKinds[node.kind]) return;

      if (creatorFilter !== "all") {
        if (node.kind === "creator") {
          if (node.entityId !== creatorFilter) return;
        } else if (node.creatorId !== creatorFilter) {
          return;
        }
      }

      if (query.length > 0) {
        const haystack = `${node.label} ${node.entityId} ${node.summary}`.toLowerCase();
        if (!haystack.includes(query)) return;
      }

      filteredIds.add(node.id);
    });

    visibleNodes = nodes
      .filter((node) => filteredIds.has(node.id))
      .sort((a, b) => a.label.localeCompare(b.label));

    visibleEdges = edges.filter((edge) => {
      if (!filteredIds.has(edge.source) || !filteredIds.has(edge.target)) return false;
      if (edgeFilter !== "all" && edge.kind !== edgeFilter) return false;
      return true;
    });

    if (selectedNodeId && !filteredIds.has(selectedNodeId)) {
      selectedNodeId = "";
    }
  };

  const applyFilters = () => {
    recomputeVisibleGraph();
    mountSigma();
  };

  $effect(() => {
    void [visibleKinds, creatorFilter, edgeFilter, search];
    recomputeVisibleGraph();
  });

  const selectedNode = $derived.by(() => nodeById.get(selectedNodeId) ?? null);

  const graphSignature = $derived.by(() =>
    [
      ...Object.values(visibleKinds),
      creatorFilter,
      edgeFilter,
      search.trim().toLowerCase(),
      visibleNodes.map((node) => node.id).join("|"),
      visibleEdges.map((edge) => edge.id).join("|"),
    ].join("::"),
  );

  let graphMount = $state<HTMLDivElement | null>(null);
  let sigma: InstanceType<SigmaCtor> | null = null;
  let SigmaClass: SigmaCtor | null = null;
  let GraphClass: GraphCtor | null = null;
  let sigmaError = $state("");

  const sigmaUrl = "https://cdn.jsdelivr.net/npm/sigma@3.0.0-beta.29/+esm";
  const graphologyUrl = "https://cdn.jsdelivr.net/npm/graphology@0.26.0/+esm";

  const clearSigma = () => {
    if (sigma) {
      sigma.kill();
      sigma = null;
    }
    if (graphMount) {
      // eslint-disable-next-line svelte/no-dom-manipulating
      graphMount.replaceChildren();
    }
  };

  const nodeStudioKind = (kind: NodeKind): string => {
    if (kind === "plugin") return "plugin";
    return kind;
  };

  const openInStudio = (node: NetworkNode) => {
    if (node.kind !== "particle") return;
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", nodeStudioKind(node.kind));
    target.searchParams.set("network_id", node.entityId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const mountSigma = () => {
    if (!browser || !graphMount || !SigmaClass || !GraphClass) return;

    const graph = new GraphClass();

    visibleNodes.forEach((node) => {
      graph.addNode(node.id, {
        x: node.x,
        y: node.y,
        size: node.size,
        label: node.label,
        color: nodePalette[node.kind].color,
        labelColor: "#e8eefb",
        forceLabel: true,
      });
    });

    visibleEdges.forEach((edge) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;
      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        size: 1.55,
        color: edgePalette[edge.kind].color,
      });
    });

    clearSigma();

    sigma = new SigmaClass(graph, graphMount, {
      defaultEdgeType: "arrow",
      renderEdgeLabels: false,
      renderLabels: true,
      minCameraRatio: 0.05,
      maxCameraRatio: 2.2,
      labelDensity: 0.06,
      labelRenderedSizeThreshold: 0,
      labelColor: { color: "#e8eefb" },
      defaultLabelColor: "#e8eefb",
      zIndex: true,
      allowInvalidContainer: false,
    });

    sigma.on("clickNode", (payload) => {
      const nodeId =
        payload &&
        typeof payload === "object" &&
        "node" in payload &&
        typeof (payload as { node?: unknown }).node === "string"
          ? ((payload as { node: string }).node ?? undefined)
          : undefined;
      if (!nodeId) return;
      selectedNodeId = nodeId;
      const node = nodeById.get(nodeId);
      if (!node) return;
      if (node.kind !== "particle") return;
      openInStudio(node);
    });
  };

  onMount(async () => {
    if (!browser) return;

    try {
      const [sigmaModule, graphologyModule] = await Promise.all([
        import(/* @vite-ignore */ sigmaUrl),
        import(/* @vite-ignore */ graphologyUrl),
      ]);

      SigmaClass = (sigmaModule.default ?? sigmaModule.Sigma ?? sigmaModule) as SigmaCtor;
      GraphClass = (graphologyModule.MultiDirectedGraph ??
        graphologyModule.DirectedGraph ??
        graphologyModule.Graph ??
        graphologyModule.default) as GraphCtor;

      mountSigma();
    } catch (error) {
      sigmaError = error instanceof Error ? error.message : "Failed to load Sigma.js";
    }
  });

  onDestroy(() => {
    clearSigma();
  });

  $effect(() => {
    if (!SigmaClass || !GraphClass) return;
    void graphSignature;
    mountSigma();
  });
</script>

<div class="network-page">
  <section class="network-toolbar" aria-label="Network filters">
    <div class="toolbar-header">
      <div>
        <p class="toolbar-kicker">Network Map</p>
        <h1>Interconnected PT Graph</h1>
      </div>
      <div class="toolbar-stats">
        <Tag variant="outline">{visibleNodes.length} nodes</Tag>
        <Tag variant="outline">{visibleEdges.length} edges</Tag>
        {#if selectedNode}
          <Tag variant="accent">{selectedNode.label}</Tag>
        {/if}
      </div>
    </div>

    <div class="toolbar-controls">
      <div class="toolbar-kinds">
        {#each kindToggleOptions as option (option.value)}
          <label class="kind-toggle">
            <input
              type="checkbox"
              checked={visibleKinds[option.value]}
              onchange={(event) => {
                const target = event.currentTarget as HTMLInputElement | null;
                const checked = target?.checked ?? true;
                visibleKinds = { ...visibleKinds, [option.value]: checked };
                applyFilters();
              }}
            />
            <span class="kind-swatch" style={`--kind-color: ${nodePalette[option.value].color};`}
            ></span>
            <span>{option.label}</span>
          </label>
        {/each}
      </div>

      <div class="toolbar-fields">
        <SelectInput
          label="Creator"
          placeholder="All creators"
          placeholderValue="all"
          options={creatorOptions}
          value={creatorFilter}
          onchange={(event) => {
            creatorFilter = event.currentTarget.value;
            applyFilters();
          }}
        />
        <SelectInput
          label="Relation"
          options={edgeOptions}
          value={edgeFilter}
          onchange={(event) => {
            edgeFilter = event.currentTarget.value as EdgeKind | "all";
            applyFilters();
          }}
        />
        <Input
          label="Search"
          placeholder="name, id, summary..."
          value={search}
          oninput={(event) => {
            search = event.currentTarget.value;
            applyFilters();
          }}
        />
      </div>
    </div>
  </section>

  <section
    class="network-map-shell"
    aria-label="Network map canvas"
    style="height: min(72vh, calc(100dvh - 15rem)); min-height: 420px;"
  >
    {#if sigmaError}
      <div class="map-error">
        <p>Failed to load map engine.</p>
        <p>{sigmaError}</p>
      </div>
    {:else}
      <div class="map-canvas" bind:this={graphMount} style="height: 100%; min-height: 400px;"></div>
      <div class="map-hint">Click particle nodes to open them in Studio.</div>
    {/if}
  </section>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .network-page {
    @apply h-full flex-1 min-h-0 p-2 flex flex-col gap-2;
  }

  .network-toolbar {
    @apply shrink-0 rounded-2xl border border-white/10 bg-black/75 px-3 py-2.5;
  }

  .toolbar-header {
    @apply flex flex-wrap items-center justify-between gap-2;
  }

  .toolbar-kicker {
    @apply text-[0.58rem] uppercase tracking-[0.24em] text-white/45;
  }

  .toolbar-header h1 {
    @apply text-sm md:text-base font-semibold tracking-[0.06em] text-white;
  }

  .toolbar-stats {
    @apply flex flex-wrap items-center gap-1.5;
  }

  .toolbar-controls {
    @apply mt-2 flex flex-col gap-2;
  }

  .toolbar-kinds {
    @apply flex flex-wrap items-center gap-1;
  }

  .kind-toggle {
    @apply inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5
      text-[0.62rem] uppercase tracking-[0.14em] text-white/75 cursor-pointer select-none;
  }

  .kind-toggle input {
    @apply h-3.5 w-3.5 accent-emerald-400;
  }

  .kind-swatch {
    @apply h-2 w-2 rounded-full;
    background: var(--kind-color);
  }

  .toolbar-fields {
    @apply grid gap-2 md:grid-cols-2 xl:grid-cols-3;
  }

  .network-map-shell {
    @apply relative grow basis-0 min-h-[420px] rounded-3xl border border-white/10 bg-black/80 p-2;
  }

  .map-canvas {
    @apply h-full min-h-[400px] rounded-2xl border border-white/10 bg-slate-950;
  }

  .map-hint {
    @apply pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2
      rounded-full border border-white/10 bg-black/70 px-3 py-1.5
      text-[0.62rem] uppercase tracking-[0.14em] text-white/65;
  }

  .map-error {
    @apply h-full min-h-[420px] rounded-2xl border border-rose-400/30 bg-rose-500/10
      text-rose-100 text-sm p-4 flex flex-col gap-2;
  }

  @media (max-width: 768px) {
    .network-page {
      @apply p-1.5;
    }

    .network-toolbar {
      @apply px-2.5 py-2;
    }

    .network-map-shell {
      @apply p-1.5 min-h-[320px];
    }

    .map-canvas {
      @apply min-h-[300px];
    }

    .map-hint {
      @apply text-[0.55rem] tracking-[0.12em];
    }
  }
</style>
