<script lang="ts">
  import { onMount, tick } from "svelte";

  import { ChainApiRequestError } from "$lib/chain/registryApi";
  import MusicXmlDocumentRenderer from "$lib/components/score/MusicXmlDocumentRenderer.svelte";
  import { MUSICXML_SCORE_WORLD, MUSICXML_SCORE_WORLD_ID } from "$lib/worlds/registry";
  import {
    decodeDynamicRiQueryParam,
    executeMusicXmlWorldRun,
    normalizeParticlesCount,
  } from "$lib/worlds/musicXmlWorldRun";
  import {
    isWorldStateMessage,
    WORLD_ERROR_MESSAGE_TYPE,
    WORLD_PROTOCOL_VERSION,
    WORLD_READY_MESSAGE_TYPE,
    WORLD_RENDERED_MESSAGE_TYPE,
    type WorldRuntimeInput,
  } from "$lib/worlds/types";

  let runtimeInput = $state<WorldRuntimeInput | null>(null);
  let errorMessage = $state("");
  let standaloneStatus = $state("");

  const musicXml = $derived(runtimeInput?.artifacts?.musicXml ?? "");
  const label = $derived(runtimeInput?.label ?? "MusicXML Score World");
  const statsText = $derived(
    runtimeInput?.artifacts?.scoreStatsText ?? (standaloneStatus || "MusicXML Score World"),
  );
  const showDownload = $derived(runtimeInput?.surface !== "studio-plugin");

  const getErrorMessage = (error: unknown) => {
    const responseBody =
      error instanceof ChainApiRequestError && typeof error.responseBody === "string"
        ? error.responseBody
        : "";
    return (
      responseBody || (error instanceof Error ? error.message : "Could not render this world.")
    );
  };

  const postReady = () => {
    window.parent.postMessage(
      {
        type: WORLD_READY_MESSAGE_TYPE,
        worldId: MUSICXML_SCORE_WORLD_ID,
        protocolVersion: WORLD_PROTOCOL_VERSION,
      },
      "*",
    );
  };

  const loadStandaloneQuery = async () => {
    const params = new URLSearchParams(window.location.search);
    const connectorName = params.get("connector")?.trim();
    if (!connectorName) return;

    try {
      errorMessage = "";
      standaloneStatus = "Running connector";
      const result = await executeMusicXmlWorldRun({
        connectorName,
        particlesCount: normalizeParticlesCount(params.get("particles")),
        dynamicRiInput: decodeDynamicRiQueryParam(params.get("ri")),
        surface: "world-page",
        worldName: MUSICXML_SCORE_WORLD.name,
      });
      runtimeInput = result.worldInput;
      standaloneStatus = "Rendered from URL runtime values";
    } catch (error) {
      errorMessage = getErrorMessage(error);
      standaloneStatus = "Run failed";
      postError(errorMessage);
    }
  };

  const postRendered = () => {
    window.parent.postMessage(
      {
        type: WORLD_RENDERED_MESSAGE_TYPE,
        worldId: MUSICXML_SCORE_WORLD_ID,
        requestId: runtimeInput?.requestId,
      },
      "*",
    );
  };

  const postError = (message: string) => {
    window.parent.postMessage(
      {
        type: WORLD_ERROR_MESSAGE_TYPE,
        worldId: MUSICXML_SCORE_WORLD_ID,
        message,
      },
      "*",
    );
  };

  $effect(() => {
    const currentMusicXml = musicXml;
    if (!currentMusicXml) return;
    void tick().then(postRendered);
  });

  onMount(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isWorldStateMessage(event.data)) return;
      if (event.data.payload.worldId !== MUSICXML_SCORE_WORLD_ID) {
        errorMessage = "This world runtime received state for an incompatible world.";
        postError(errorMessage);
        return;
      }
      errorMessage = "";
      runtimeInput = event.data.payload;
    };

    window.addEventListener("message", handleMessage);
    postReady();
    void loadStandaloneQuery();
    return () => window.removeEventListener("message", handleMessage);
  });
</script>

<svelte:head>
  <title>MusicXML Score World</title>
</svelte:head>

<main class="runtime-page">
  {#if errorMessage}
    <div class="runtime-error">{errorMessage}</div>
  {:else}
    <MusicXmlDocumentRenderer
      {musicXml}
      {label}
      {statsText}
      showToolbar={true}
      {showDownload}
      emptyMessage=""
      frameLabel="MusicXML world score preview"
    />
  {/if}
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .runtime-page {
    @apply flex h-screen min-h-0 flex-col overflow-hidden bg-white p-2 text-slate-950;
  }

  .runtime-error {
    @apply flex h-full items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-4 text-center text-xs uppercase tracking-[0.16em] text-rose-700;
  }
</style>
