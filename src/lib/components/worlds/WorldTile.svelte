<script lang="ts">
  import { resolve } from "$app/paths";

  import { buildWorldAssetUrl } from "$lib/worlds/api";
  import type { BackendWorldDescriptor } from "$lib/worlds/contract";

  type Props = {
    world: BackendWorldDescriptor;
    mode: "gallery" | "stream";
    canManage?: boolean;
    onOpen: (world: BackendWorldDescriptor) => void;
  };

  let { world, mode, canManage = false, onOpen }: Props = $props();
  let imageFailed = $state(false);
  const previewUrl = $derived(
    world.previewUrn
      ? `${buildWorldAssetUrl(world.previewUrn)}?v=${encodeURIComponent(world.bundleHash)}`
      : "",
  );
</script>

<article class="world-tile" class:is-stream={mode === "stream"}>
  <button
    type="button"
    class="tile-open"
    aria-label={`Open ${world.name}`}
    onclick={() => onOpen(world)}
  >
    {#if previewUrl && !imageFailed}
      <img
        src={previewUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onerror={() => (imageFailed = true)}
      />
    {:else}
      <span class="missing-preview" aria-hidden="true">Preview coming soon</span>
    {/if}
    <span class="tile-caption">
      <strong>{world.name}</strong>
      {#if mode === "stream"}
        <span>{world.shortDescription ?? world.description}</span>
      {/if}
    </span>
  </button>
  {#if canManage}
    <a class="tile-manage" href={resolve("/worlds/[slug]", { slug: world.slug })}> Manage world </a>
  {/if}
</article>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .world-tile {
    position: relative;
    display: block;
    width: 100%;
    margin: 0 0 0.8rem;
    break-inside: avoid;
    overflow: hidden;
    background: #111920;
  }

  .tile-open {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: #111920;
    color: #fff;
    cursor: pointer;
    text-align: left;
  }

  .tile-open img {
    display: block;
    width: 100%;
    height: auto;
    min-height: 12rem;
    object-fit: cover;
    transition:
      transform 350ms ease,
      filter 350ms ease;
  }

  .tile-open:hover img,
  .tile-open:focus-visible img {
    transform: scale(1.025);
    filter: brightness(0.86);
  }

  .tile-open:focus-visible,
  .tile-manage:focus-visible {
    outline: 2px solid #8de5fa;
    outline-offset: -3px;
  }

  .missing-preview {
    display: grid;
    min-height: 15rem;
    place-items: center;
    background: linear-gradient(135deg, #101d25, #1b2c33 48%, #101518);
    color: rgba(255, 255, 255, 0.62);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
  }

  .tile-caption {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    gap: 0.3rem;
    padding: 2.5rem 1rem 0.9rem;
    background: linear-gradient(transparent, rgba(4, 8, 11, 0.83));
    color: #fff;
    opacity: 0;
    transform: translateY(0.3rem);
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .tile-open:hover .tile-caption,
  .tile-open:focus-visible .tile-caption,
  .is-stream .tile-caption {
    opacity: 1;
    transform: none;
  }

  .tile-caption strong {
    font-family: "Syne", "Space Grotesk", system-ui, sans-serif;
    font-size: 1rem;
    font-weight: 600;
  }

  .tile-caption span {
    max-width: 45rem;
    color: rgba(255, 255, 255, 0.83);
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .tile-manage {
    position: absolute;
    top: 0.7rem;
    right: 0.7rem;
    z-index: 1;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 0.3rem;
    padding: 0.35rem 0.55rem;
    background: rgba(4, 8, 11, 0.75);
    color: #fff;
    font-size: 0.7rem;
    text-decoration: none;
  }

  .tile-manage:hover {
    background: rgba(4, 8, 11, 0.95);
  }

  .is-stream {
    height: min(76svh, 56rem);
    min-height: 24rem;
    margin-bottom: 0.65rem;
    scroll-snap-align: start;
  }

  .is-stream .tile-open,
  .is-stream .tile-open img,
  .is-stream .missing-preview {
    width: 100%;
    height: 100%;
  }

  .is-stream .tile-open img {
    object-fit: contain;
    min-height: 0;
  }

  .is-stream .tile-caption {
    padding: 4rem clamp(1rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem);
  }

  .is-stream .tile-caption strong {
    font-size: clamp(1.25rem, 2.4vw, 2rem);
  }

  @media (hover: none) {
    .tile-caption {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile-open img,
    .tile-caption {
      transition: none;
    }
  }
</style>
