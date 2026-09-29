<script lang="ts">
  import { browser } from "$app/environment";
  import { base } from "$app/paths";
  import { onDestroy, onMount } from "svelte";
  import { createWorldHost, type WorldHost } from "dcn/worlds/host";

  import { createDcnClient } from "$lib/chain/dcnClient";
  import { buildWorldAssetUrl } from "$lib/worlds/api";
  import { createWorldChainClient } from "$lib/worlds/chainApiCompatibility";
  import {
    isWorldRuntimeMessage,
    WORLD_ERROR_MESSAGE_TYPE,
    WORLD_READY_MESSAGE_TYPE,
    WORLD_RENDERED_MESSAGE_TYPE,
    WORLD_STATE_MESSAGE_TYPE,
    type WorldDescriptor,
    type WorldRuntimeInput,
    type WorldRuntimeMessage,
    type WorldStateMessage,
  } from "$lib/worlds/types";

  type Props = {
    world: WorldDescriptor;
    input: WorldRuntimeInput | null;
    srcOverride?: string;
    title?: string;
    showStatus?: boolean;
    sandboxPermissions?: string;
  };

  let {
    world,
    input,
    srcOverride,
    title = world.name,
    showStatus = false,
    sandboxPermissions,
  }: Props = $props();

  let iframeElement: HTMLIFrameElement | null = $state(null);
  let frameLoaded = $state(false);
  let worldReady = $state(false);
  let statusText = $state("Loading world");
  let errorText = $state("");
  let sdkFrameSrc = $state("");
  let worldHost: WorldHost | null = null;
  let worldHostKey = "";
  let rpcExecutionProvenance = $state<WorldRuntimeInput["executionProvenance"]>();

  const usesSdkWorldHost = $derived(world.source === "backend");
  const rawSrc = $derived.by(() => {
    const entry = srcOverride ?? world.entry;
    if (world.source === "backend") return buildWorldAssetUrl(entry);
    return srcOverride ?? `${base}${world.entry}`;
  });
  const src = $derived(usesSdkWorldHost ? sdkFrameSrc || "about:blank" : rawSrc);
  const resolvedSandboxPermissions = $derived.by(() => {
    if (sandboxPermissions) return sandboxPermissions;
    if (world.source !== "backend") return "allow-scripts allow-same-origin allow-downloads";
    const permissions = world.permissions ?? [];
    return permissions.includes("browser.downloads")
      ? "allow-scripts allow-downloads"
      : "allow-scripts";
  });

  const cloneWorldRuntimeInput = (value: WorldRuntimeInput): WorldRuntimeInput =>
    JSON.parse(JSON.stringify(value)) as WorldRuntimeInput;

  const disposeWorldHost = () => {
    worldHost?.dispose();
    worldHost = null;
    worldHostKey = "";
    sdkFrameSrc = "";
  };

  const resetRuntimeState = () => {
    frameLoaded = false;
    worldReady = false;
    statusText = "Loading world";
    errorText = "";
  };

  const postInput = () => {
    if (!browser || !iframeElement?.contentWindow || !input) return;
    if (usesSdkWorldHost) {
      worldHost?.pushState({ payload: cloneWorldRuntimeInput(input) });
      statusText = worldReady ? "Sent world state" : "Waiting for world runtime";
      return;
    }
    const message: WorldStateMessage = {
      type: WORLD_STATE_MESSAGE_TYPE,
      payload: cloneWorldRuntimeInput(input),
    };
    iframeElement.contentWindow.postMessage(message, "*");
    statusText = worldReady ? "Sent world state" : "Waiting for world runtime";
  };

  const handleFrameLoad = () => {
    frameLoaded = true;
    postInput();
  };

  const handleRuntimeMessage = (message: WorldRuntimeMessage) => {
    if (message.worldId !== world.id) return;
    if (message.type === WORLD_READY_MESSAGE_TYPE) {
      worldReady = true;
      errorText = "";
      statusText = "World ready";
      postInput();
      return;
    }
    if (message.type === WORLD_RENDERED_MESSAGE_TYPE) {
      statusText = "World rendered";
      return;
    }
    if (message.type === WORLD_ERROR_MESSAGE_TYPE) {
      errorText = message.message;
      statusText = "World error";
    }
  };

  $effect(() => {
    const currentFrame = iframeElement;
    const currentWorld = world;
    const currentSrc = rawSrc;

    if (!browser || !currentFrame || currentWorld.source !== "backend") {
      disposeWorldHost();
      return;
    }

    const nextHostKey = `${currentWorld.id}:${currentSrc}:${currentWorld.chainApiVersion ?? 1}`;
    if (worldHost && worldHostKey === nextHostKey) return;

    disposeWorldHost();
    resetRuntimeState();
    rpcExecutionProvenance = undefined;
    worldHost = createWorldHost({
      client: createWorldChainClient(
        createDcnClient(),
        currentWorld.chainApiVersion ?? 1,
        (provenance) => {
          rpcExecutionProvenance = provenance;
        },
      ),
      permissions: currentWorld.permissions ?? [],
      valueLimits: currentWorld.backend?.valueLimits,
      iframe: currentFrame,
      expectedOrigin: "null",
      onReady: () => {
        worldReady = true;
        errorText = "";
        statusText = "World ready";
        postInput();
      },
      onRendered: () => {
        statusText = "World rendered";
      },
      onError: (message) => {
        errorText = message.message;
        statusText = "World error";
      },
    });
    worldHostKey = nextHostKey;
    sdkFrameSrc = worldHost.worldUrl(currentSrc);
  });

  $effect(() => {
    const currentInput = input;
    const currentFrame = iframeElement;
    if (!browser || !currentInput || !currentFrame || !frameLoaded) return;
    postInput();
  });

  onMount(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isWorldRuntimeMessage(event.data)) return;
      handleRuntimeMessage(event.data);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  });

  onDestroy(() => {
    disposeWorldHost();
    worldReady = false;
  });
</script>

<div class="world-frame-shell">
  {#if showStatus}
    <div class="world-frame-status" class:is-error={Boolean(errorText)}>
      {errorText || statusText}
      {#if rpcExecutionProvenance}
        <span
          title={`World RPC block ${rpcExecutionProvenance.block_hash}; Runner ${rpcExecutionProvenance.runner}`}
        >
          · Last World chain call: block {rpcExecutionProvenance.block_number}</span
        >
      {/if}
    </div>
  {/if}
  <iframe
    bind:this={iframeElement}
    class="world-frame"
    {src}
    {title}
    sandbox={resolvedSandboxPermissions}
    referrerpolicy="no-referrer"
    onload={handleFrameLoad}
  ></iframe>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .world-frame-shell {
    @apply relative flex min-h-0 flex-1 overflow-hidden rounded-md border border-white/10 bg-white;
  }

  .world-frame {
    @apply h-full min-h-[190px] w-full border-0 bg-white;
  }

  .world-frame-status {
    @apply absolute right-2 top-2 z-10 rounded-md border border-white/15 bg-black/70 px-2 py-1 text-[0.52rem] uppercase tracking-[0.16em] text-white/70;
  }

  .world-frame-status.is-error {
    @apply border-rose-300/30 bg-rose-950/80 text-rose-100;
  }

  :global(:root[data-theme="light"] .world-frame-shell) {
    border-color: var(--studio-node-border) !important;
  }
</style>
