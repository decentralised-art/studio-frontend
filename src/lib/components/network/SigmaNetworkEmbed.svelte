<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";

  import {
    networkEdgePalette,
    networkNodePalette,
    type NetworkGraphEdge,
    type NetworkGraphNode,
  } from "$lib/network/mockNetworkGraph";

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

  const {
    nodes = [],
    edges = [],
    highlightedNodeIds = [],
    selectedNodeId = "",
    minHeight = 220,
    clickableKinds = ["particle"] as Array<NetworkGraphNode["kind"]>,
    onNodeActivate,
    hint = "",
  }: {
    nodes?: NetworkGraphNode[];
    edges?: NetworkGraphEdge[];
    highlightedNodeIds?: string[];
    selectedNodeId?: string;
    minHeight?: number;
    clickableKinds?: Array<NetworkGraphNode["kind"]>;
    onNodeActivate?: ((node: NetworkGraphNode) => void) | undefined;
    hint?: string;
  } = $props();

  let graphMount = $state<HTMLDivElement | null>(null);
  let sigma: InstanceType<SigmaCtor> | null = null;
  let SigmaClass: SigmaCtor | null = null;
  let GraphClass: GraphCtor | null = null;
  let sigmaError = $state("");
  let isVisible = $state(false);
  let visibilityObserver: IntersectionObserver | null = null;

  const sigmaUrl = "https://cdn.jsdelivr.net/npm/sigma@3.0.0-beta.29/+esm";
  const graphologyUrl = "https://cdn.jsdelivr.net/npm/graphology@0.26.0/+esm";

  const nodeById = $derived.by(() => new Map(nodes.map((node) => [node.id, node] as const)));
  const highlightSet = $derived.by(() => new SvelteSet(highlightedNodeIds));
  const clickableKindSet = $derived.by(() => new SvelteSet(clickableKinds));

  const graphSignature = $derived.by(() =>
    [
      nodes.map((node) => node.id).join("|"),
      edges.map((edge) => edge.id).join("|"),
      highlightedNodeIds.join("|"),
      selectedNodeId,
    ].join("::"),
  );

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

  const mountSigma = () => {
    if (!browser || !graphMount || !SigmaClass || !GraphClass || !isVisible) return;
    clearSigma();
    if (nodes.length === 0) return;

    const graph = new GraphClass();

    nodes.forEach((node) => {
      const highlighted = highlightSet.has(node.id);
      const selected = selectedNodeId === node.id;
      const color = networkNodePalette[node.kind].color;
      graph.addNode(node.id, {
        x: node.x,
        y: node.y,
        size: node.size + (highlighted ? 1.8 : 0) + (selected ? 1 : 0),
        label: node.label,
        color,
        labelColor: "#f4f7ff",
        forceLabel: true,
        zIndex: highlighted || selected ? 2 : 1,
      });
    });

    edges.forEach((edge) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;
      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        size: 1.25,
        color: networkEdgePalette[edge.kind].color,
      });
    });

    sigma = new SigmaClass(graph, graphMount, {
      defaultEdgeType: "arrow",
      renderEdgeLabels: false,
      renderLabels: true,
      minCameraRatio: 0.08,
      maxCameraRatio: 3,
      labelDensity: 1,
      labelRenderedSizeThreshold: 0,
      labelColor: { color: "#f4f7ff" },
      defaultLabelColor: "#f4f7ff",
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
      const node = nodeById.get(nodeId);
      if (!node) return;
      if (!clickableKindSet.has(node.kind)) return;
      onNodeActivate?.(node);
    });
  };

  onMount(async () => {
    if (!browser) return;
    if (graphMount) {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          const nextVisible = entries.some((entry) => entry.isIntersecting);
          if (nextVisible === isVisible) return;
          isVisible = nextVisible;
          if (!nextVisible) clearSigma();
          else mountSigma();
        },
        { root: null, rootMargin: "240px 0px", threshold: 0.01 },
      );
      visibilityObserver.observe(graphMount);
    }

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

      if (isVisible) mountSigma();
    } catch (error) {
      sigmaError = error instanceof Error ? error.message : "Failed to load Sigma.js";
    }
  });

  onDestroy(() => {
    visibilityObserver?.disconnect();
    visibilityObserver = null;
    clearSigma();
  });

  $effect(() => {
    if (!SigmaClass || !GraphClass || !isVisible) return;
    void graphSignature;
    mountSigma();
  });
</script>

<section
  class="sigma-embed-shell"
  style={`--sigma-min-height: ${minHeight}px;`}
  aria-label="Embedded network graph"
>
  {#if sigmaError}
    <div class="sigma-embed-error">
      <p>Failed to load embedded graph.</p>
      <p>{sigmaError}</p>
    </div>
  {:else}
    <div class="sigma-embed-canvas" bind:this={graphMount}></div>
    {#if !isVisible}
      <div class="sigma-embed-idle" aria-hidden="true"></div>
    {/if}
    {#if hint}
      <div class="sigma-embed-hint">{hint}</div>
    {/if}
  {/if}
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .sigma-embed-shell {
    @apply relative rounded-2xl border border-white/10 bg-slate-950/90 p-2;
    min-height: var(--sigma-min-height);
  }

  .sigma-embed-canvas {
    @apply h-full min-h-[180px] rounded-xl border border-white/10 bg-slate-950;
    min-height: calc(var(--sigma-min-height) - 16px);
  }

  .sigma-embed-hint {
    @apply pointer-events-none absolute left-1/2 bottom-3 -translate-x-1/2
      rounded-full border border-white/10 bg-black/70 px-2.5 py-1
      text-[0.58rem] uppercase tracking-[0.12em] text-white/60;
  }

  .sigma-embed-error {
    @apply min-h-[180px] rounded-xl border border-rose-400/30 bg-rose-500/10 p-3
      text-xs text-rose-100 flex flex-col gap-1.5;
  }

  .sigma-embed-idle {
    @apply pointer-events-none absolute inset-2 rounded-xl border border-white/5;
    background:
      radial-gradient(circle at 24% 26%, rgba(255, 255, 255, 0.04), transparent 38%),
      radial-gradient(circle at 78% 70%, rgba(103, 214, 255, 0.06), transparent 42%);
  }
</style>
