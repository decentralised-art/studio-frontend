<script lang="ts">
  import { base } from "$app/paths";
  import { onDestroy, onMount, tick } from "svelte";

  import {
    compileToneAddressFromStreams,
    composeToneWorld,
    createDefaultToneAddress,
    getToneWorldLayerCompatibilityFromStreams,
    type ToneAddress,
    type ToneWorldComposition,
    type ToneWorldStream,
  } from "$lib/toneWorld";
  import {
    decodeToneDynamicRiQueryParam,
    executeToneWorldRun,
    normalizeToneParticlesCount,
  } from "$lib/worlds/toneWorldRun";
  import { TONE_WORLD, TONE_WORLD_ID } from "$lib/worlds/registry";
  import {
    isWorldStateMessage,
    WORLD_ERROR_MESSAGE_TYPE,
    WORLD_PROTOCOL_VERSION,
    WORLD_READY_MESSAGE_TYPE,
    WORLD_RENDERED_MESSAGE_TYPE,
    type WorldRuntimeInput,
  } from "$lib/worlds/types";

  type ToneRowRuntimeState = {
    address: ToneAddress;
    composition: ToneWorldComposition;
    hashLabel: string;
    isPlayable: boolean;
    hasVisualMaterial: boolean;
  };

  type ToneRowRuntime = {
    setState: (state: ToneRowRuntimeState) => void;
    dispose: () => void;
  };

  type ToneRowRuntimeFactory = (options: {
    root: HTMLElement;
    Tone: typeof import("tone");
    assetBase: string;
    initialState: ToneRowRuntimeState;
    onRendered: () => void;
    onError: (message: string) => void;
  }) => ToneRowRuntime;

  const toneWorldAudioConnectorInstructions = [
    {
      scalar: "onset_tick",
      expects: "absolute event start positions in score ticks; 2520 ticks is one quarter note",
    },
    { scalar: "duration_tick", expects: "event lengths in score ticks; use positive values" },
    { scalar: "pitch_midi", expects: "MIDI pitches, usually 0 to 127; scales, chords, or rows" },
    { scalar: "velocity_midi", expects: "MIDI loudness values, usually 0 to 127" },
    { scalar: "tone_sample_set", expects: "sample-bank selectors; integers 1 to 5" },
    { scalar: "tone_sample_index", expects: "sample selectors inside a bank; integers 1 to 12" },
  ] as const;

  const toneWorldVisualConnectorInstructions = [
    {
      scalar: "tone_visual_variant",
      expects: "original Tone Row visual family selectors; integers 1 to 5",
    },
    {
      scalar: "tone_color_r",
      expects: "red color material; numeric values are clamped near 0 to 2.5",
    },
    {
      scalar: "tone_color_g",
      expects: "green color material; numeric values are clamped near 0 to 2.5",
    },
    {
      scalar: "tone_color_b",
      expects: "blue color material; numeric values are clamped near 0 to 2.5",
    },
    { scalar: "tone_shape_sides", expects: "geometric side counts; integers 3 to 9" },
    { scalar: "tone_reactivity", expects: "visual response amount; numeric values 0 to 8" },
  ] as const;

  const initialAddress = createDefaultToneAddress();

  let rootElement = $state<HTMLElement | null>(null);
  let runtimeInput = $state<WorldRuntimeInput | null>(null);
  let address = $state<ToneAddress>(initialAddress);
  let composition = $state<ToneWorldComposition>(composeToneWorld(initialAddress));
  let isPlayable = $state(false);
  let hasVisualMaterial = $state(false);
  let showingInfo = $state(false);
  let runtime: ToneRowRuntime | null = null;
  let runtimeReadyPromise: Promise<void> | null = null;

  const assetBase = $derived(`${base}/worlds/tone-world`);

  const postReady = () => {
    window.parent.postMessage(
      {
        type: WORLD_READY_MESSAGE_TYPE,
        worldId: TONE_WORLD_ID,
        protocolVersion: WORLD_PROTOCOL_VERSION,
      },
      "*",
    );
  };

  const postRendered = () => {
    window.parent.postMessage(
      {
        type: WORLD_RENDERED_MESSAGE_TYPE,
        worldId: TONE_WORLD_ID,
        requestId: runtimeInput?.requestId,
      },
      "*",
    );
  };

  const postError = (message: string) => {
    window.parent.postMessage(
      {
        type: WORLD_ERROR_MESSAGE_TYPE,
        worldId: TONE_WORLD_ID,
        message,
      },
      "*",
    );
  };

  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[data-tone-row-src="${src}"]`,
      );
      if (existing?.dataset.loaded === "true") {
        resolve();
      }
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.toneRowSrc = src;
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true },
      );
      script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), {
        once: true,
      });
      document.head.append(script);
    });

  const getToneMaterialLayers = (streams: readonly ToneWorldStream[]) =>
    getToneWorldLayerCompatibilityFromStreams(streams);

  const toggleInfo = (event: MouseEvent) => {
    event.stopPropagation();
    showingInfo = !showingInfo;
  };

  const createRuntimeState = (): ToneRowRuntimeState => ({
    address,
    composition,
    hashLabel:
      isPlayable || hasVisualMaterial
        ? runtimeInput?.connectorName || runtimeInput?.label || `Seed ${address.seed}`
        : "No connector loaded",
    isPlayable,
    hasVisualMaterial,
  });

  const ensureRuntime = async () => {
    if (runtime || runtimeReadyPromise) return runtimeReadyPromise;
    runtimeReadyPromise = (async () => {
      if (!rootElement) {
        await tick();
      }
      if (!rootElement) throw new Error("Tone World runtime root is not mounted.");
      await loadScript(`${assetBase}/hydra-synth.js`);
      await loadScript(`${assetBase}/tone-row-world.js`);
      const Tone = await import("tone");
      const toneRowWindow = window as Window & {
        createToneRowWorldRuntime?: ToneRowRuntimeFactory;
      };
      if (!toneRowWindow.createToneRowWorldRuntime) {
        throw new Error("Tone World runtime script did not register.");
      }
      runtime = toneRowWindow.createToneRowWorldRuntime({
        root: rootElement,
        Tone,
        assetBase,
        initialState: createRuntimeState(),
        onRendered: postRendered,
        onError: postError,
      });
    })().catch((error) => {
      runtimeReadyPromise = null;
      const message =
        error instanceof Error ? error.message : "Could not initialize Tone World runtime.";
      postError(message);
      throw error;
    });
    return runtimeReadyPromise;
  };

  const compileRuntime = (input: WorldRuntimeInput | null) => {
    const seed = normalizeToneParticlesCount(input?.particlesCount ?? 24);
    const streams = input?.executeOutput ?? [];
    const toneLayers = getToneMaterialLayers(streams);
    runtimeInput = input;
    isPlayable = toneLayers.hasAudioLayer;
    hasVisualMaterial = toneLayers.hasVisualLayer;
    address = compileToneAddressFromStreams(streams, seed);
    composition = composeToneWorld(address);
    if (runtime) {
      runtime.setState(createRuntimeState());
    } else {
      void ensureRuntime();
    }
  };

  const loadStandaloneQuery = async () => {
    const params = new URLSearchParams(window.location.search);
    const connectorName = params.get("connector")?.trim();
    if (!connectorName) return;

    try {
      const result = await executeToneWorldRun({
        connectorName,
        particlesCount: normalizeToneParticlesCount(params.get("particles")),
        dynamicRiInput: decodeToneDynamicRiQueryParam(params.get("ri")),
        surface: "world-page",
        worldName: TONE_WORLD.name,
        world: TONE_WORLD,
      });
      compileRuntime(result.worldInput);
    } catch (error) {
      postError(error instanceof Error ? error.message : "Could not render this world.");
    }
  };

  onMount(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isWorldStateMessage(event.data)) return;
      if (event.data.payload.worldId !== TONE_WORLD_ID) {
        postError("This world runtime received state for an incompatible world.");
        return;
      }
      compileRuntime(event.data.payload);
    };

    window.addEventListener("message", handleMessage);
    compileRuntime(null);
    postReady();
    void loadStandaloneQuery();
    return () => window.removeEventListener("message", handleMessage);
  });

  onDestroy(() => {
    runtime?.dispose();
    runtime = null;
    runtimeReadyPromise = null;
  });
</script>

<svelte:head>
  <title>Tone World</title>
</svelte:head>

<div class="tone-world-shell">
  <main bind:this={rootElement} class="tone-row-world">
    <div id="loadingStatus">Loading sounds...</div>
    <div class="container">
      <div id="nowPlaying"></div>
      <div id="content">
        <span class="typewrite">
          <span class="wrap"></span>
        </span>
      </div>
      <div id="hash"></div>
    </div>
  </main>
  <button
    class="info-toggle"
    type="button"
    aria-label={showingInfo
      ? "Return to Tone World artwork"
      : "Show Tone World connector instructions"}
    aria-pressed={showingInfo}
    title={showingInfo ? "Return to artwork" : "Connector instructions"}
    onclick={toggleInfo}
  >
    i
  </button>
  {#if showingInfo}
    <section class="tone-world-info" aria-label="Tone World connector instructions">
      <div class="info-panel">
        <h1>Tone World</h1>
        <p>
          Tone World is a connector-driven version of Tone Row:
          <a
            href="https://www.fxhash.xyz/project/tone-row"
            target="_blank"
            rel="noopener noreferrer">https://www.fxhash.xyz/project/tone-row</a
          >. Connector output replaces the fxhash random sources: musical streams define row,
          rhythm, loudness, and timbre material; visual streams steer Hydra color, shape, variant,
          and audio reactivity. The artwork still composes from those values, so inputs guide the
          world rather than becoming a literal score.
        </p>

        <h2>Valid Connector</h2>
        <p>
          A connector can supply the audio layer, the visual layer, or both. Each active layer must
          expose every terminal scalar in its list with at least one numeric output value. Parent
          and intermediate connector names can vary; compatibility is checked by these leaf names.
        </p>

        <h2>Audio Layer</h2>
        <p>
          Audio-layer connectors render sound only. If no visual layer is present, the world does
          not add visual effects.
        </p>
        <dl class="scalar-list">
          {#each toneWorldAudioConnectorInstructions as item (item.scalar)}
            <dt><code>{item.scalar}</code></dt>
            <dd>({item.expects})</dd>
          {/each}
        </dl>

        <h2>Visual Layer</h2>
        <p>
          Visual-layer connectors render the artwork image. If no audio layer is present, the world
          does not make sound.
        </p>
        <dl class="scalar-list">
          {#each toneWorldVisualConnectorInstructions as item (item.scalar)}
            <dt><code>{item.scalar}</code></dt>
            <dd>({item.expects})</dd>
          {/each}
        </dl>

        <h2>Particles</h2>
        <p>
          Particles are the number of values requested from each terminal connector during
          execution. One value behaves like a stable setting. A short sequence cycles through the
          12-position row. Twelve particles naturally address the whole row. More than twelve
          particles create larger pools for pitch, rhythm, samples, color, shape, and reactivity;
          the world folds those pools back into row positions, parts, and visual controls.
        </p>
      </div>
    </section>
  {/if}
</div>

<style lang="postcss">
  @font-face {
    font-family: "Handjet";
    font-optical-sizing: auto;
    font-weight: 500;
    font-style: normal;
    font-variation-settings:
      "ELGR" 1,
      "ELSH" 2;
    font-display: swap;
    src: url("/worlds/tone-world/Handjet/Handjet.ttf") format("truetype");
  }

  :global(html),
  :global(body) {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: white;
  }

  :global(body) {
    position: relative;
  }

  :global(canvas) {
    position: fixed !important;
    inset: 0;
  }

  .tone-world-shell {
    position: fixed;
    inset: 0;
    z-index: 10;
    font-family: "Handjet", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .tone-row-world {
    position: absolute;
    inset: 0;
    font-family: inherit;
  }

  .info-toggle {
    position: absolute;
    right: 14px;
    bottom: 14px;
    z-index: 50;
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    border: 1px solid rgb(0 0 255 / 24%);
    border-radius: 50%;
    background: rgb(255 255 255 / 28%);
    color: rgb(0 0 255 / 46%);
    cursor: pointer;
    font: inherit;
    font-size: 15px;
    line-height: 1;
  }

  .info-toggle:hover,
  .info-toggle:focus-visible {
    outline: none;
    border-color: rgb(0 0 255 / 70%);
    background: rgb(255 255 255 / 82%);
    color: blue;
  }

  .tone-world-info {
    position: absolute;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: clamp(20px, 5vw, 64px);
    background: rgb(250 250 247 / 97%);
    color: black;
    cursor: default;
  }

  .info-panel {
    width: min(880px, 100%);
    max-height: calc(100vh - clamp(40px, 10vw, 128px));
    overflow: auto;
    padding: clamp(20px, 4vw, 42px);
    border: 1px solid rgb(0 0 0 / 35%);
    background: rgb(255 255 255 / 94%);
    box-shadow: 0 20px 60px rgb(0 0 0 / 12%);
  }

  .info-panel h1,
  .info-panel h2,
  .info-panel p {
    letter-spacing: 0;
  }

  .info-panel h1 {
    margin: 0 0 14px;
    font-size: clamp(42px, 8vw, 82px);
    font-weight: 600;
    line-height: 0.9;
  }

  .info-panel h2 {
    margin: 30px 0 12px;
    font-size: clamp(24px, 3.4vw, 36px);
    font-weight: 600;
    line-height: 1;
  }

  .info-panel p {
    margin: 0 0 16px;
    font-size: clamp(18px, 2.2vw, 24px);
    line-height: 1.18;
  }

  .info-panel a {
    color: blue;
    text-decoration: underline;
    text-underline-offset: 0.12em;
    overflow-wrap: anywhere;
  }

  .scalar-list {
    display: grid;
    grid-template-columns: minmax(220px, max-content) minmax(0, 1fr);
    gap: 7px 18px;
    margin: 0;
  }

  .scalar-list dt,
  .scalar-list dd {
    min-width: 0;
    font-size: clamp(17px, 2vw, 22px);
    line-height: 1.12;
  }

  .scalar-list dt {
    font-weight: 600;
  }

  .scalar-list dd {
    margin: 0;
  }

  .scalar-list code {
    color: blue;
    font-family: "Handjet", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: normal;
    word-break: break-word;
  }

  #loadingStatus {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 20;
    display: block;
    transform: translate(-50%, -50%);
    color: blue;
    font-size: 24px;
  }

  #nowPlaying {
    position: absolute;
    top: 10px;
    right: 10px;
    font-family: "Handjet", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  #hash {
    position: absolute;
    bottom: 5px;
    left: 10px;
    color: black;
    word-wrap: break-word;
    font-family: "Handjet", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .container {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 10;
    display: flex;
    width: 80%;
    height: 80%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
    background-color: rgb(255 255 255 / 50%);
  }

  #content {
    display: none;
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: black;
    text-align: center;
    font-family: "Handjet", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  @media (max-width: 680px) {
    .tone-world-info {
      align-items: flex-start;
      padding: 58px 16px 24px;
    }

    .info-panel {
      max-height: none;
      padding: 18px;
    }

    .scalar-list {
      grid-template-columns: minmax(0, 1fr);
      gap: 2px;
    }

    .scalar-list dd {
      margin-bottom: 8px;
    }
  }
</style>
