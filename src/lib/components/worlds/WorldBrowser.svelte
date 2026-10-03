<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import { onMount, tick } from "svelte";

  import { getCurrentUserProfileState } from "$lib/auth/api";
  import { hasAuthSession } from "$lib/auth/session";
  import { getWorld, listWorlds } from "$lib/worlds/api";
  import {
    backendWorldToFrontendDescriptor,
    type BackendWorldDescriptor,
  } from "$lib/worlds/contract";

  import WorldFrame from "./WorldFrame.svelte";
  import WorldTile from "./WorldTile.svelte";

  type BrowseMode = "gallery" | "stream";

  const PAGE_SIZE = 30;
  const VIEW_STORAGE_KEY = "dcn-worlds-view";

  let worlds = $state<BackendWorldDescriptor[]>([]);
  let mode = $state<BrowseMode>("gallery");
  let pageNumber = 0;
  let loading = $state(false);
  // False until the first page request settles, including in the prerendered HTML.
  let hasLoadedOnce = $state(false);
  let hasMore = $state(true);
  let loadError = $state("");
  let selectedWorld = $state<BackendWorldDescriptor | null>(null);
  let currentUserId = $state<string | null>(null);
  let isAdmin = $state(false);
  let fullscreen = $state(false);
  let dialogElement = $state<HTMLDialogElement | null>(null);
  let stageElement = $state<HTMLDivElement | null>(null);
  let loadSentinel: HTMLDivElement;
  let openedFromPage = false;
  let previouslyFocused: HTMLElement | null = null;
  let previousBodyOverflow = "";

  const selectedFrameWorld = $derived(
    selectedWorld ? backendWorldToFrontendDescriptor(selectedWorld) : null,
  );

  const loadNext = async () => {
    if (loading || !hasMore) return;
    loading = true;
    loadError = "";
    try {
      const next = await listWorlds({ page: pageNumber, limit: PAGE_SIZE, surface: "world-page" });
      const seen = new Set(worlds.map((world) => world.id));
      worlds = [...worlds, ...next.filter((world) => !seen.has(world.id))];
      pageNumber += 1;
      hasMore = next.length === PAGE_SIZE;
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Could not load Worlds.";
    } finally {
      loading = false;
      hasLoadedOnce = true;
    }
  };

  const setMode = (next: BrowseMode) => {
    mode = next;
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Browsing still works when storage is unavailable.
    }
  };

  const openWorld = async (world: BackendWorldDescriptor, pushHistory = true) => {
    if (selectedWorld?.id === world.id && dialogElement?.open) return;
    previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selectedWorld = world;
    openedFromPage = pushHistory;
    if (pushHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("world", world.id);
      history.pushState({ worldModal: world.id }, "", url);
    }
    await tick();
    if (selectedWorld?.id !== world.id || !dialogElement) return;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialogElement.open) dialogElement.showModal();
  };

  const closeModalNow = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    dialogElement?.close();
    selectedWorld = null;
    fullscreen = false;
    document.body.style.overflow = previousBodyOverflow;
    await tick();
    previouslyFocused?.focus();
    previouslyFocused = null;
  };

  const requestClose = () => {
    if (!selectedWorld) return;
    if (openedFromPage) {
      openedFromPage = false;
      history.back();
      void closeModalNow();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("world");
    history.replaceState(history.state, "", url);
    void closeModalNow();
  };

  const syncWorldFromUrl = async () => {
    const id = new URL(window.location.href).searchParams.get("world");
    if (!id) {
      if (selectedWorld) await closeModalNow();
      return;
    }
    if (selectedWorld?.id === id) return;
    try {
      const world = worlds.find((item) => item.id === id) ?? (await getWorld(id));
      if (!world.surfaces.includes("world-page")) return;
      await openWorld(world, false);
    } catch {
      // A stale shared link leaves the gallery available.
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageElement?.requestFullscreen();
      }
    } catch {
      // The popup remains usable when a browser denies fullscreen.
    }
  };

  const refreshCurrentUser = async () => {
    if (!hasAuthSession()) {
      currentUserId = null;
      isAdmin = false;
      return;
    }
    try {
      const profile = await getCurrentUserProfileState({ preferCached: true });
      currentUserId = profile.userId;
      const me = profile.me as { roles?: string[]; user?: { roles?: string[] } } | null;
      isAdmin = [...(me?.roles ?? []), ...(me?.user?.roles ?? [])].some(
        (role) => role.toLowerCase() === "admin",
      );
    } catch {
      currentUserId = null;
      isAdmin = false;
    }
  };

  onMount(() => {
    try {
      mode = localStorage.getItem(VIEW_STORAGE_KEY) === "stream" ? "stream" : "gallery";
    } catch {
      mode = "gallery";
    }
    void loadNext().then(() => syncWorldFromUrl());
    void refreshCurrentUser();

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNext();
      },
      { rootMargin: "800px" },
    );
    if (loadSentinel) observer.observe(loadSentinel);

    const onPopState = () => void syncWorldFromUrl();
    const onFullscreenChange = () => {
      fullscreen = Boolean(document.fullscreenElement);
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("auth:change", refreshCurrentUser);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("auth:change", refreshCurrentUser);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.body.style.overflow = previousBodyOverflow;
    };
  });
</script>

<div class="browser-art" aria-hidden="true">
  <img
    src={asset("/site/images/collective_performative_intelligence.jpeg")}
    alt=""
    fetchpriority="high"
  />
</div>

<section class="world-browser" aria-label="Worlds">
  <div class="browser-toolbar">
    <div class="browser-actions">
      <div class="view-toggle" role="group" aria-label="World browsing view">
        <button
          type="button"
          class:is-active={mode === "gallery"}
          aria-pressed={mode === "gallery"}
          onclick={() => setMode("gallery")}>Gallery</button
        >
        <button
          type="button"
          class:is-active={mode === "stream"}
          aria-pressed={mode === "stream"}
          onclick={() => setMode("stream")}>One by one</button
        >
      </div>
      <a class="publish-link" href={resolve("/worlds/upload")}
        >Publish a World <span aria-hidden="true">↗</span></a
      >
    </div>
  </div>

  {#if worlds.length > 0}
    {#if mode === "gallery"}
      <div class="gallery-list" aria-label="World gallery">
        {#each worlds as world (world.id)}
          <WorldTile
            {world}
            mode="gallery"
            canManage={isAdmin || currentUserId === world.ownerId}
            onOpen={openWorld}
          />
        {/each}
      </div>
    {:else}
      <div class="stream-list" aria-label="Worlds one by one">
        {#each worlds as world (world.id)}
          <WorldTile
            {world}
            mode="stream"
            canManage={isAdmin || currentUserId === world.ownerId}
            onOpen={openWorld}
          />
        {/each}
      </div>
    {/if}
  {:else if hasLoadedOnce && !loading && !loadError}
    <p class="browser-status">No Worlds have been published yet.</p>
  {/if}

  {#if loadError}
    <div class="browser-status" role="status">
      <p>
        {worlds.length ? "More Worlds could not be loaded." : "The Worlds registry is unavailable."}
      </p>
      <button type="button" onclick={() => void loadNext()}>Try again</button>
    </div>
  {/if}
  {#if loading || !hasLoadedOnce}
    <p class="browser-status" role="status">Loading Worlds…</p>
  {/if}
  <div class="load-sentinel" bind:this={loadSentinel}></div>
  {#if hasMore && !loading && !loadError && worlds.length > 0}
    <button class="load-more" type="button" onclick={() => void loadNext()}>Load more Worlds</button
    >
  {/if}
</section>

{#if selectedWorld && selectedFrameWorld}
  <dialog
    bind:this={dialogElement}
    class="world-dialog"
    aria-label={selectedWorld.name}
    oncancel={(event) => {
      event.preventDefault();
      requestClose();
    }}
    onclick={(event) => {
      if (event.target === dialogElement) requestClose();
    }}
  >
    <div class="world-stage" bind:this={stageElement}>
      <div class="stage-bar">
        <h2>{selectedWorld.name}</h2>
        <div class="stage-actions">
          <button
            type="button"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onclick={() => void toggleFullscreen()}>{fullscreen ? "⤡" : "⤢"}</button
          >
          <button type="button" aria-label="Close World" title="Close" onclick={requestClose}
            >×</button
          >
        </div>
      </div>
      <div class="world-player">
        <WorldFrame world={selectedFrameWorld} input={null} />
      </div>
    </div>
  </dialog>
{/if}

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .world-browser {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: calc(100svh + var(--nav-offset, 3.5rem));
    padding: calc(var(--nav-offset, 3.5rem) + 1.5rem) clamp(0.65rem, 2vw, 2rem) 3rem;
    background: transparent;
    color: #fff !important;
  }

  .browser-art {
    position: absolute;
    inset: 0 0 auto;
    z-index: 0;
    pointer-events: none;
  }

  .browser-art img {
    display: block;
    width: 100%;
    height: auto;
  }

  .browser-art::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(4, 8, 11, 0.55),
      rgba(4, 8, 11, 0.48) 42%,
      #070b0e 100%
    );
  }

  .browser-toolbar {
    display: flex;
    align-items: end;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0 0 1.2rem;
    padding: 0 clamp(0.25rem, 1vw, 0.75rem);
  }

  .browser-actions,
  .view-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .browser-actions {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .view-toggle {
    padding: 0.25rem;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 0.35rem;
    background: rgba(255, 255, 255, 0.04);
  }

  .view-toggle button,
  .publish-link,
  .load-more,
  .browser-status button {
    border: 0;
    border-radius: 0.25rem;
    padding: 0.48rem 0.75rem;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.82rem;
    cursor: pointer;
    text-decoration: none;
  }

  .view-toggle button.is-active {
    background: rgba(141, 229, 250, 0.18);
    color: #fff;
  }

  .view-toggle button:hover,
  .publish-link:hover,
  .load-more:hover,
  .browser-status button:hover {
    color: #fff;
  }

  .publish-link {
    border: 1px solid rgba(255, 255, 255, 0.3);
    white-space: nowrap;
  }

  .gallery-list {
    columns: 16rem;
    column-gap: 0.8rem;
    width: 100%;
  }

  .stream-list {
    height: min(80svh, 60rem);
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    scrollbar-color: #47636c #10191e;
  }

  .stream-list:focus-visible,
  .view-toggle button:focus-visible,
  .publish-link:focus-visible,
  .load-more:focus-visible {
    outline: 2px solid #8de5fa;
    outline-offset: 2px;
  }

  .browser-status {
    margin: 2rem 0;
    color: #ffffff !important;
    text-align: center;
  }

  .browser-status button,
  .load-more {
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .load-more {
    display: block;
    margin: 1rem auto;
  }

  .load-sentinel {
    height: 1px;
  }

  .world-dialog {
    position: fixed;
    inset: 0;
    width: min(96vw, 110rem);
    height: min(93dvh, 75rem);
    max-width: none;
    max-height: none;
    margin: auto;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 0.5rem;
    overflow: hidden;
    background: #080d11;
    color: #fff;
    box-shadow: 0 30px 100px rgba(0, 0, 0, 0.7);
  }

  .world-dialog::backdrop {
    background: rgba(1, 5, 8, 0.82);
    backdrop-filter: blur(7px);
  }

  .world-stage {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: #080d11;
  }

  .world-stage:fullscreen {
    width: 100vw;
    height: 100dvh;
  }

  .stage-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex: none;
    min-height: 3.35rem;
    padding: 0.45rem 0.6rem 0.45rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  }

  .stage-bar h2 {
    margin: 0;
    overflow: hidden;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stage-actions {
    display: flex;
    gap: 0.35rem;
  }

  .stage-actions button {
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0.3rem;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    cursor: pointer;
    font-size: 1.35rem;
    line-height: 1;
  }

  .stage-actions button:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  .stage-actions button:focus-visible {
    outline: 2px solid #8de5fa;
  }

  .world-player {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .world-player :global(.world-frame-shell) {
    border: 0;
    border-radius: 0;
  }

  .world-player :global(.world-frame) {
    min-height: 0;
  }

  @media (max-width: 640px) {
    .world-browser {
      padding-left: 0.55rem;
      padding-right: 0.55rem;
    }

    .browser-toolbar {
      align-items: start;
    }

    .browser-actions {
      width: 100%;
      justify-content: space-between;
    }

    .gallery-list {
      columns: 2 9rem;
      column-gap: 0.55rem;
    }

    .world-dialog {
      width: 100vw;
      height: 100dvh;
      border: 0;
      border-radius: 0;
    }
  }
</style>
