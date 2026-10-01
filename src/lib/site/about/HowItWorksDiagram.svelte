<script lang="ts">
  import { onMount } from "svelte";

  import {
    drawPossibilitySpace,
    SPACE_LOOP_SECONDS,
    type SpaceStep,
  } from "$lib/site/about/possibilitySpace";
  import { WORLD_SCENES } from "$lib/site/about/worldScenes";
  import "$lib/site/about/vhs.css";

  const composeSteps = [
    {
      tone: "cyan",
      title: "Generate",
      text: "A connector’s transformations generate a space of possibilities. Values of that space can mean various things for the world. A musical pitch, time, velocity, a colour, speed, movement number, etc.",
    },
    {
      tone: "magenta",
      title: "Narrow",
      text: "Connect it to another connector, and that connector’s transformations narrow the space down.",
    },
    {
      tone: "yellow",
      title: "Narrow further",
      text: "Connect another one, and the space narrows even more. That is how you compose.",
    },
  ] as const;

  const terminalLines = [
    "> connect agent --via mcp",
    '> find "lunar scale"',
    "> fork · add transformation",
    "> simulate ........ ok",
    "> publish? [y/n] y",
  ];
  const terminalChars = terminalLines.reduce((sum, line) => sum + line.length, 0);

  let figure: HTMLElement | null = null;
  let spaceCanvas: HTMLCanvasElement | null = null;
  const worldCanvases: (HTMLCanvasElement | null)[] = $state(WORLD_SCENES.map(() => null));

  let step = $state<SpaceStep>(0);
  let typed = $state(terminalChars);

  const typedLines = $derived.by(() => {
    let remaining = typed;
    return terminalLines.map((line) => {
      const shown = line.slice(0, Math.max(0, remaining));
      remaining -= line.length;
      return shown;
    });
  });

  onMount(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sizes = new WeakMap<HTMLCanvasElement, { width: number; height: number }>();

    const fit = (canvas: HTMLCanvasElement) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      sizes.set(canvas, { width, height });
    };

    const render = (time: number) => {
      let outputs: number[] = [];
      const spaceSize = spaceCanvas && sizes.get(spaceCanvas);
      const spaceContext = spaceCanvas?.getContext("2d");
      if (spaceSize && spaceContext) {
        const state = drawPossibilitySpace(spaceContext, spaceSize.width, spaceSize.height, time);
        outputs = state.outputs;
        step = state.step;
      }
      WORLD_SCENES.forEach((scene, index) => {
        const canvas = worldCanvases[index];
        const size = canvas && sizes.get(canvas);
        const context = canvas?.getContext("2d");
        if (size && context)
          scene.draw(context, size.width, size.height, time + index * 1.7, outputs);
      });
    };

    // A still frame from the narrowest step, used when motion is reduced.
    const stillTime = 11.5;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) fit(entry.target as HTMLCanvasElement);
      if (reducedMotion) render(stillTime);
    });
    [spaceCanvas, ...worldCanvases].forEach((canvas) => {
      if (!canvas) return;
      fit(canvas);
      resizeObserver.observe(canvas);
    });

    if (reducedMotion) {
      render(stillTime);
      return () => resizeObserver.disconnect();
    }

    let frame = 0;
    let running = false;
    let elapsed = 0;
    let last = 0;
    const loop = (now: number) => {
      elapsed += Math.min(0.1, (now - last) / 1000);
      last = now;
      render(elapsed);
      typed = Math.min(terminalChars, Math.floor((elapsed % SPACE_LOOP_SECONDS) * 14));
      frame = requestAnimationFrame(loop);
    };
    // Only animate while the diagram is on screen.
    const intersection = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(loop);
      } else if (!entry.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    });
    if (figure) intersection.observe(figure);

    return () => {
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resizeObserver.disconnect();
    };
  });
</script>

<figure class="vhs vhs-screen" bind:this={figure}>
  <ol class="channels">
    <li class="channel">
      <p class="channel-label">1) Contribute</p>
      <div class="terminal" aria-hidden="true">
        {#each typedLines as line, index (index)}
          <p>
            <span class="terminal-line">{line}</span>
            {#if line.length > 0 && line.length < terminalLines[index].length}
              <span class="cursor"></span>
            {/if}
          </p>
        {/each}
      </div>
      <p class="channel-text">
        <strong>With your agent</strong>, through MCP, the SDK or the API
      </p>
      <p class="channel-or">or</p>
      <svg class="studio-mini" viewBox="0 0 220 92" aria-hidden="true">
        <path class="wire" d="M48 26 C 86 26, 82 60, 118 60"></path>
        <path class="wire" d="M48 70 C 84 70, 84 60, 118 60"></path>
        <path class="wire" d="M156 60 C 178 60, 176 30, 196 30"></path>
        <rect class="node node-a" x="10" y="14" width="38" height="24" rx="5"></rect>
        <rect class="node node-b" x="10" y="58" width="38" height="24" rx="5"></rect>
        <rect class="node node-c" x="118" y="46" width="38" height="28" rx="5"></rect>
        <circle class="node node-d" cx="204" cy="30" r="9"></circle>
      </svg>
      <p class="channel-text">
        <strong>In Studio</strong>, visually, by connecting building blocks
      </p>
    </li>

    <li class="stream" aria-hidden="true"></li>

    <li class="channel">
      <p class="channel-label">2) Compose</p>
      <div class="space-stage">
        <canvas class="space-canvas" bind:this={spaceCanvas} aria-hidden="true"></canvas>
        <svg class="chain" viewBox="0 0 96 20" aria-hidden="true">
          <line class="chain-link" class:on={step >= 1} x1="10" y1="10" x2="48" y2="10"></line>
          <line class="chain-link" class:on={step >= 2} x1="48" y1="10" x2="86" y2="10"></line>
          <circle class="chain-node tone-cyan on" cx="10" cy="10" r="6"></circle>
          <circle class="chain-node tone-magenta" class:on={step >= 1} cx="48" cy="10" r="6"
          ></circle>
          <circle class="chain-node tone-yellow" class:on={step >= 2} cx="86" cy="10" r="6"
          ></circle>
        </svg>
      </div>
      <ol class="compose-steps">
        {#each composeSteps as composeStep, index (composeStep.title)}
          <li class={`tone-${composeStep.tone}`} class:active={step === index}>
            <span class="compose-step-title">{composeStep.title}</span>
            <span class="compose-step-text">{composeStep.text}</span>
          </li>
        {/each}
      </ol>
    </li>

    <li class="stream" aria-hidden="true"></li>

    <li class="channel">
      <p class="channel-label">3) Worlds</p>
      <ul class="worlds" aria-label="Example Worlds">
        {#each WORLD_SCENES as scene, index (scene.id)}
          <li class="world">
            <canvas bind:this={worldCanvases[index]} aria-hidden="true"></canvas>
            <span class="sr-only">{scene.title}: {scene.medium}</span>
          </li>
        {/each}
      </ul>
      <p class="channel-text">
        A World is a web page, embedded as an iframe, that interprets the result. The same output
        can become a score, a sound, a game, an image, a textile or a living simulation.
      </p>
    </li>
  </ol>

  <figcaption class="rewind">
    Every published result becomes a new building block for the next person.
  </figcaption>
</figure>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .channels {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  @media (min-width: 1024px) {
    .channels {
      grid-template-columns: minmax(0, 0.75fr) 2rem minmax(0, 1.7fr) 2rem minmax(0, 1fr);
      align-items: start;
    }
  }

  .channel {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* .vhs and !important win over the site's light-theme paragraph colours: this screen stays dark. */
  .vhs .channel-label {
    margin: 0;
    font-family: var(--vhs-font);
    font-size: 1.2rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--vhs-yellow) !important;
    text-shadow:
      -1px 0 rgba(255, 95, 210, 0.6),
      1px 0 rgba(103, 214, 255, 0.6);
  }

  .vhs .channel-text {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5rem;
    color: var(--vhs-dim) !important;
  }

  .channel-text strong {
    font-weight: 600;
    color: var(--vhs-ink);
  }

  .vhs .channel-or {
    margin: 0;
    font-family: var(--vhs-font);
    font-size: 1.05rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(244, 236, 255, 0.4) !important;
  }

  .terminal {
    min-height: 8.6rem;
    padding: 0.8rem 0.9rem;
    border: 1px solid rgba(141, 229, 143, 0.28);
    border-radius: 0.8rem;
    background: rgba(3, 18, 10, 0.75);
    box-shadow: inset 0 0 24px rgba(141, 229, 143, 0.12);
    font-family: var(--vhs-font);
    font-size: 1.12rem;
    line-height: 1.3;
    color: var(--vhs-green);
    text-shadow: 0 0 6px rgba(141, 229, 143, 0.55);
  }

  .vhs .terminal p {
    display: flex;
    color: var(--vhs-green) !important;
    align-items: center;
    min-height: 1.3em;
    margin: 0;
  }

  .terminal-line {
    white-space: pre;
  }

  .cursor {
    display: inline-block;
    width: 0.55em;
    height: 0.95em;
    margin-left: 1px;
    background: var(--vhs-green);
    animation: blink 0.9s steps(1) infinite;
  }

  .studio-mini {
    display: block;
    width: 100%;
    max-width: 15rem;
    height: auto;
  }

  .wire {
    fill: none;
    stroke: var(--vhs-yellow);
    stroke-width: 1.6;
    stroke-dasharray: 3 5;
    filter: drop-shadow(0 0 3px rgba(247, 200, 106, 0.6));
    animation: flow 1.4s linear infinite;
  }

  .node {
    fill: rgba(18, 11, 34, 0.9);
    stroke-width: 1.6;
  }

  .node-a {
    stroke: var(--vhs-cyan);
  }

  .node-b {
    stroke: var(--vhs-magenta);
  }

  .node-c {
    stroke: var(--vhs-yellow);
    filter: drop-shadow(0 0 6px rgba(247, 200, 106, 0.55));
  }

  .node-d {
    fill: var(--vhs-coral);
    stroke: none;
    filter: drop-shadow(0 0 6px rgba(255, 155, 122, 0.8));
  }

  /* Data streaming from one channel to the next: down on narrow screens, right on wide ones. */
  .stream {
    position: relative;
    min-height: 2.2rem;
  }

  .stream::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    background: repeating-linear-gradient(180deg, var(--vhs-yellow) 0 6px, transparent 6px 16px);
    background-size: 100% 16px;
    filter: drop-shadow(0 0 4px rgba(247, 200, 106, 0.8));
    animation: stream-down 0.8s linear infinite;
  }

  @media (min-width: 1024px) {
    .stream {
      align-self: stretch;
      min-height: 0;
    }

    .stream::before {
      top: 11rem;
      right: 0;
      bottom: auto;
      left: 0;
      width: auto;
      height: 2px;
      transform: none;
      background: repeating-linear-gradient(90deg, var(--vhs-yellow) 0 6px, transparent 6px 16px);
      background-size: 16px 100%;
      animation: stream-right 0.8s linear infinite;
    }
  }

  .space-stage {
    position: relative;
    aspect-ratio: 16 / 11;
    overflow: hidden;
    border-radius: 1rem;
    background:
      radial-gradient(70% 60% at 50% 55%, rgba(103, 214, 255, 0.1), transparent 70%),
      rgba(4, 3, 10, 0.7);
    box-shadow:
      inset 0 0 0 1px rgba(103, 214, 255, 0.18),
      inset 0 0 40px rgba(0, 0, 0, 0.8);
  }

  .space-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /* The connectors connected so far, lighting up one by one. */
  .chain {
    position: absolute;
    top: 0.8rem;
    left: 0.9rem;
    width: 5.5rem;
    height: auto;
    overflow: visible;
  }

  .chain-link {
    stroke: rgba(244, 236, 255, 0.18);
    stroke-width: 1.6;
    stroke-dasharray: 3 4;
    transition: stroke 400ms ease;
  }

  .chain-link.on {
    stroke: var(--vhs-ink);
    animation: flow 1.4s linear infinite;
  }

  .chain-node {
    fill: rgba(18, 11, 34, 0.9);
    stroke: rgba(244, 236, 255, 0.25);
    stroke-width: 1.6;
    transition:
      fill 400ms ease,
      stroke 400ms ease;
  }

  .chain-node.on.tone-cyan {
    fill: var(--vhs-cyan);
    stroke: var(--vhs-cyan);
    filter: drop-shadow(0 0 5px rgba(103, 214, 255, 0.8));
  }

  .chain-node.on.tone-magenta {
    fill: var(--vhs-magenta);
    stroke: var(--vhs-magenta);
    filter: drop-shadow(0 0 5px rgba(255, 95, 210, 0.8));
  }

  .chain-node.on.tone-yellow {
    fill: var(--vhs-yellow);
    stroke: var(--vhs-yellow);
    filter: drop-shadow(0 0 5px rgba(247, 200, 106, 0.8));
  }

  .compose-steps {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  @media (min-width: 640px) {
    .compose-steps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .compose-steps li {
    --tone: var(--vhs-cyan);
    display: grid;
    align-content: start;
    gap: 0.25rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.6rem;
    background: rgba(255, 255, 255, 0.025);
    transition:
      border-color 300ms ease,
      background 300ms ease;
  }

  .compose-steps li.tone-magenta {
    --tone: var(--vhs-magenta);
  }

  .compose-steps li.tone-yellow {
    --tone: var(--vhs-yellow);
  }

  .compose-steps li.active {
    border-color: color-mix(in srgb, var(--tone) 60%, transparent);
    background: color-mix(in srgb, var(--tone) 9%, transparent);
  }

  .vhs .compose-step-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--vhs-font);
    font-size: 1.1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tone) !important;
  }

  .compose-step-title::before {
    content: "";
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: var(--tone);
    box-shadow: 0 0 6px var(--tone);
  }

  .compose-step-text {
    font-size: 0.75rem;
    line-height: 1.25rem;
    color: var(--vhs-dim);
  }

  .worlds {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .worlds {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .world {
    position: relative;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    border-radius: 0.7rem;
    background: #05040a;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.12),
      0 0 18px rgba(255, 95, 210, 0.08);
  }

  .world canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .world::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.6) 100%);
    pointer-events: none;
  }

  .rewind {
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.9rem;
    background: rgba(255, 255, 255, 0.03);
    font-size: 0.875rem;
    color: var(--vhs-ink);
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @keyframes flow {
    to {
      stroke-dashoffset: -16;
    }
  }

  @keyframes stream-down {
    to {
      background-position: 0 16px;
    }
  }

  @keyframes stream-right {
    to {
      background-position: 16px 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cursor,
    .wire,
    .chain-link.on,
    .stream::before {
      animation: none;
    }
  }
</style>
