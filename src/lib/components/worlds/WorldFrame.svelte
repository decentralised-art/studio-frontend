<script lang="ts">
  import { browser } from "$app/environment";
  import { base } from "$app/paths";
  import { onDestroy, onMount } from "svelte";

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

  const {
    world,
    input,
    srcOverride,
    title = world.name,
    showStatus = false,
    sandboxPermissions = "allow-scripts allow-same-origin allow-downloads",
  }: Props = $props();

  let iframeElement: HTMLIFrameElement | null = $state(null);
  let frameLoaded = $state(false);
  let worldReady = $state(false);
  let statusText = $state("Loading world");
  let errorText = $state("");

  const src = $derived(srcOverride ?? `${base}${world.entry}`);

  const postInput = () => {
    if (!browser || !iframeElement?.contentWindow || !input) return;
    const message: WorldStateMessage = {
      type: WORLD_STATE_MESSAGE_TYPE,
      payload: input,
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
    worldReady = false;
  });
</script>

<div class="world-frame-shell">
  {#if showStatus}
    <div class="world-frame-status" class:is-error={Boolean(errorText)}>
      {errorText || statusText}
    </div>
  {/if}
  <iframe
    bind:this={iframeElement}
    class="world-frame"
    {src}
    {title}
    sandbox={sandboxPermissions}
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
