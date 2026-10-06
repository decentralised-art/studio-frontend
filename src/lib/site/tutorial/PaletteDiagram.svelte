<script lang="ts">
  import { onMount } from "svelte";

  type Point = [number, number];
  type Pose = { name: string; arms: Point[]; legs: Point[] };
  const diagramId = $props.id();
  const examples = [
    {
      name: "Music",
      connector: "pitch",
      accent: "#f7c86a",
      start: 60,
      meaning: "MIDI pitch",
      variants: [
        { name: "Semitones", step: 1 },
        { name: "Whole tones", step: 2 },
        { name: "Octaves", step: 12 },
      ],
    },
    {
      name: "Graphics",
      connector: "colour",
      accent: "#ff9b7a",
      start: 0,
      meaning: "colour number",
      variants: [
        { name: "Adjacent", step: 1 },
        { name: "Every second", step: 2 },
        { name: "Spread", step: 3 },
      ],
    },
    {
      name: "Game",
      connector: "pose",
      accent: "#8de58f",
      start: 0,
      meaning: "character movement",
      variants: [
        { name: "Warm up", step: 1 },
        { name: "Defence", step: 2 },
        { name: "Combo", step: 3 },
      ],
    },
  ];
  const colors = [
    "#ffd36b",
    "#f077a1",
    "#73c8ef",
    "#98d6ba",
    "#ca9bff",
    "#ff9a66",
    "#bfd265",
    "#8babe8",
    "#e79cd8",
    "#6bddd2",
    "#d8b08e",
    "#84b3c9",
    "#f3a5ac",
    "#abce97",
    "#aaa0d8",
    "#f6d0a3",
  ];
  const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const poses: Pose[] = [
    {
      name: "Idle",
      arms: [
        [-18, -47],
        [-27, -23],
        [-25, 4],
        [18, -47],
        [27, -23],
        [25, 4],
      ],
      legs: [
        [-8, -2],
        [-17, 29],
        [-23, 61],
        [8, -2],
        [17, 29],
        [23, 61],
      ],
    },
    {
      name: "Wave",
      arms: [
        [-18, -47],
        [-38, -70],
        [-39, -96],
        [18, -47],
        [32, -25],
        [25, 0],
      ],
      legs: [
        [-8, -2],
        [-14, 30],
        [-18, 61],
        [8, -2],
        [21, 28],
        [34, 61],
      ],
    },
    {
      name: "Stretch",
      arms: [
        [-18, -47],
        [-42, -46],
        [-64, -43],
        [18, -47],
        [42, -46],
        [64, -43],
      ],
      legs: [
        [-8, -2],
        [-24, 28],
        [-41, 61],
        [8, -2],
        [24, 28],
        [41, 61],
      ],
    },
    {
      name: "Kick",
      arms: [
        [-18, -47],
        [-31, -73],
        [-21, -99],
        [18, -47],
        [31, -73],
        [21, -99],
      ],
      legs: [
        [-8, -2],
        [-14, 30],
        [-16, 61],
        [8, -2],
        [26, 21],
        [39, 4],
      ],
    },
    {
      name: "Crouch",
      arms: [
        [-18, -47],
        [-27, -20],
        [-5, -6],
        [18, -47],
        [27, -20],
        [5, -6],
      ],
      legs: [
        [-8, -2],
        [-28, 23],
        [-18, 61],
        [8, -2],
        [28, 23],
        [18, 61],
      ],
    },
    {
      name: "Balance",
      arms: [
        [-18, -47],
        [-42, -35],
        [-64, -27],
        [18, -47],
        [40, -62],
        [59, -76],
      ],
      legs: [
        [-8, -2],
        [-13, 30],
        [-16, 61],
        [8, -2],
        [35, 8],
        [59, 0],
      ],
    },
    {
      name: "Turn",
      arms: [
        [-18, -47],
        [-40, -65],
        [-21, -86],
        [18, -47],
        [42, -26],
        [60, -15],
      ],
      legs: [
        [-8, -2],
        [-25, 30],
        [-37, 61],
        [8, -2],
        [4, 31],
        [-10, 61],
      ],
    },
    {
      name: "Duck",
      arms: [
        [-18, -47],
        [-39, -20],
        [-57, 6],
        [18, -47],
        [39, -20],
        [57, 6],
      ],
      legs: [
        [-8, -2],
        [-35, 18],
        [-49, 61],
        [8, -2],
        [35, 18],
        [49, 61],
      ],
    },
    {
      name: "Reach",
      arms: [
        [-18, -47],
        [-40, -66],
        [-62, -82],
        [18, -47],
        [42, -40],
        [64, -32],
      ],
      legs: [
        [-8, -2],
        [-20, 28],
        [-32, 61],
        [8, -2],
        [38, 12],
        [64, 25],
      ],
    },
    {
      name: "Jump",
      arms: [
        [-18, -47],
        [-37, -72],
        [-52, -93],
        [18, -47],
        [37, -72],
        [52, -93],
      ],
      legs: [
        [-8, -2],
        [-15, 30],
        [-16, 61],
        [8, -2],
        [15, 30],
        [16, 61],
      ],
    },
  ];

  let exampleIndex = $state(0);
  let variantIndex = $state(1);
  let particleIndex = $state(0);
  let variationsShown = 0;
  let playing = $state(true);
  let mounted = $state(false);
  let visible = $state(false);
  let documentVisible = $state(true);
  let figure: HTMLElement;
  const tabButtons: (HTMLButtonElement | undefined)[] = [];

  const example = $derived(examples[exampleIndex]);
  const variant = $derived(example.variants[variantIndex]);
  const indexes = $derived(
    Array.from({ length: 4 }, (_, index) => example.start + index * variant.step),
  );
  const palette = $derived(
    exampleIndex === 0
      ? [0, 1, 2, 3, 59, 60, 61, 62, 63, 64, 65, 66, 67, 72, 84, 96]
      : Array.from({ length: 16 }, (_, index) => index),
  );
  const activeValue = $derived(indexes[particleIndex]);
  const mobilePoint = $derived(selectedPoint(particleIndex));
  const pose = $derived(poses[activeValue % poses.length]);
  const interpreted = $derived(indexes.map((value) => interpret(value)));
  const description = $derived(
    `${example.name}: indexes ${indexes.join(", ")} select the same numbered values from ${example.connector}, a sequence starting at zero and adding one. The World interprets them as ${interpreted.join(", ")}.`,
  );

  function interpret(value: number) {
    if (exampleIndex === 0) return `${noteNames[value % 12]}${Math.floor(value / 12) - 1}`;
    if (exampleIndex === 1) return colors[value % colors.length];
    return poses[value % poses.length].name;
  }
  function tilePoint(index: number): Point {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return [522 + (column - row) * 43, 140 + (column + row) * 25];
  }
  function selectedPoint(index: number) {
    return tilePoint(palette.indexOf(indexes[index]));
  }
  function points(list: Point[]) {
    return list.map((point) => point.join(",")).join(" ");
  }
  function chooseExample(next: number) {
    playing = false;
    variationsShown = 0;
    if (exampleIndex !== next) {
      exampleIndex = next;
      variantIndex = 0;
      particleIndex = 0;
    }
  }
  function chooseVariant(next: number) {
    playing = false;
    variationsShown = 0;
    variantIndex = next;
    particleIndex = 0;
  }
  function chooseParticle(next: number) {
    playing = false;
    particleIndex = next;
  }
  function tabKey(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % examples.length;
    else if (event.key === "ArrowLeft") next = (index + examples.length - 1) % examples.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = examples.length - 1;
    else return;
    event.preventDefault();
    chooseExample(next);
    tabButtons[next]?.focus();
  }
  function advance() {
    if (particleIndex < 3) {
      particleIndex += 1;
      return;
    }
    particleIndex = 0;
    variationsShown += 1;
    if (variationsShown === example.variants.length) {
      variationsShown = 0;
      exampleIndex = (exampleIndex + 1) % examples.length;
      variantIndex = 0;
    } else variantIndex = (variantIndex + 1) % example.variants.length;
  }

  onMount(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) playing = false;
    const motionChanged = () => {
      if (motion.matches) playing = false;
    };
    const visibilityChanged = () => {
      documentVisible = !document.hidden;
    };
    visibilityChanged();
    motion.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(figure);
    mounted = true;
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  });
  $effect(() => {
    if (!mounted || !playing || !visible || !documentVisible) return;
    const timer = window.setInterval(advance, 1400);
    return () => window.clearInterval(timer);
  });
</script>

{#snippet connectorPanel()}
  <g class="connector-panel">
    <rect class="pod-shadow" x="51" y="207" width="196" height="176" rx="18"></rect>
    <rect class="pod-side" x="48" y="199" width="196" height="176" rx="18"></rect>
    <rect class="pod-top" x="48" y="192" width="196" height="176" rx="18"></rect>
    <text class="scene-label" x="64" y="222">SELECTOR CONNECTOR</text>
    <text class="connector-name source-name" x="64" y="247"
      >Start {example.start} · add {variant.step}</text
    >
    {#each indexes as value, index (index)}
      <rect
        class="index-row"
        class:current={particleIndex === index}
        x="62"
        y={257 + index * 24}
        width="169"
        height="21"
        rx="5"
      ></rect>
      <text class="index-prefix" x="73" y={272 + index * 24}>index</text>
      <text
        class="index-number"
        class:current={particleIndex === index}
        x="214"
        y={273 + index * 24}
        text-anchor="end">{value}</text
      >
    {/each}
  </g>
{/snippet}

{#snippet paletteDeck()}
  <g class="palette-deck">
    <ellipse class="deck-shadow" cx="522" cy="305" rx="225" ry="82"></ellipse>
    <path class="deck-edge" d="M308 218 L522 342 L736 218 L736 241 L522 365 L308 241 Z"></path>
    <path class="deck-face" d="M522 94 L736 218 L522 342 L308 218 Z"></path>
    <path class="deck-seam" d="M308 218 L522 342 L736 218 M522 342 V365"></path>
    {#each palette as value, index (value)}
      {@const point = tilePoint(index)}
      {@const selected = indexes.includes(value)}
      {@const current = value === activeValue}
      <g class="palette-tile" class:selected class:current>
        <path
          class="tile-side"
          d={`M${point[0] - 35} ${point[1]} l35 20 35 -20 v${selected ? 14 : 7} l-35 20 -35 -20 Z`}
        ></path>
        <path class="tile-face" d={`M${point[0]} ${point[1] - 20} l35 20 -35 20 -35 -20 Z`}></path>
        <text x={point[0]} y={point[1] + 5} text-anchor="middle">{value}</text>
        {#if current}<path class="tile-pointer" d={`M${point[0]} ${point[1] - 32} l-5 -8 h10 Z`}
          ></path>{/if}
      </g>
    {/each}
  </g>
{/snippet}

{#snippet worldResult(suffix: string)}
  <g class="world-result">
    <defs
      ><clipPath id={`${diagramId}-world-${suffix}`}
        ><rect x="775" y="166" width="176" height="174" rx="12"></rect></clipPath
      ></defs
    >
    <path class="world-plinth" d="M756 392 L859 452 L966 392 L966 403 L859 463 L756 403 Z"></path>
    <path class="world-floor" d="M859 333 L966 392 L859 452 L756 392 Z"></path>
    <rect class="world-side" x="754" y="125" width="214" height="277" rx="20"></rect>
    <rect class="world-frame" x="750" y="118" width="214" height="277" rx="20"></rect>
    <text class="scene-label" x="772" y="148">{example.meaning.toUpperCase()}</text>
    {#if exampleIndex === 0}
      {#each [60, 72, 84, 96] as value (value)}
        <line
          class="music-grid"
          x1="795"
          x2="946"
          y1={309 - (value - 60) * 3.7}
          y2={309 - (value - 60) * 3.7}
        ></line>
        <text class="axis-label" x="769" y={314 - (value - 60) * 3.7}>{value}</text>
      {/each}
      {#each indexes as value, index (index)}
        <line class="beat-guide" x1={809 + index * 38} x2={809 + index * 38} y1="173" y2="324"
        ></line>
        <rect
          class="music-note"
          class:current={particleIndex === index}
          x={795 + index * 38}
          y={304 - (value - 60) * 3.7}
          width="28"
          height="10"
          rx="4"
        ></rect>
        <text class="axis-label" x={809 + index * 38} y="344" text-anchor="middle">{index}</text>
      {/each}
    {:else if exampleIndex === 1}
      <g clip-path={`url(#${diagramId}-world-${suffix})`}>
        <rect x="775" y="166" width="176" height="174" fill={colors[indexes[0]]}></rect>
        <circle cx="928" cy="190" r="98" fill={colors[indexes[1]]}></circle>
        <path d="M758 350 L858 215 L972 350 Z" fill={colors[indexes[2]]}></path>
        <circle cx="821" cy="299" r="55" fill={colors[indexes[3]]}></circle>
        <path class="composition-line" d="M785 180 Q912 267 936 321 M786 323 Q820 192 937 181"
        ></path>
      </g>
      <rect class="composition-border" x="775" y="166" width="176" height="174" rx="12"></rect>
    {:else}
      <path class="game-path" d="M785 330 H941 M799 181 H822 M901 181 H927"></path>
      <text class="axis-label" x="858" y="181" text-anchor="middle"
        >MOVE {particleIndex + 1} / 4</text
      >
      <ellipse class="dance-floor" cx="858" cy="335" rx="76" ry="13"></ellipse>
      <g class="dancer" transform="translate(858 268)">
        <circle class="dancer-head" cx="0" cy="-76" r="12"></circle>
        <path class="dancer-body" d="M0 -61 V-5 M-18 -47 H18 M-8 -2 H8"></path>
        <polyline class="dancer-limb" points={points(pose.arms.slice(0, 3))}></polyline>
        <polyline class="dancer-limb" points={points(pose.arms.slice(3))}></polyline>
        <polyline class="dancer-limb" points={points(pose.legs.slice(0, 3))}></polyline>
        <polyline class="dancer-limb" points={points(pose.legs.slice(3))}></polyline>
      </g>
    {/if}
    <text class="world-value" x="858" y="376" text-anchor="middle"
      >{exampleIndex === 1 ? `Colour ${activeValue}` : interpreted[particleIndex]}</text
    >
  </g>
{/snippet}

<figure class="palette-diagram" style={`--example-accent: ${example.accent}`} bind:this={figure}>
  <figcaption>
    <p class="diagram-title">Sculpt a shared palette</p>
    <p class="diagram-intro">
      A connector chooses indexes. A shared palette provides values. A World gives them meaning.
    </p>
  </figcaption>

  <div class="example-tabs" role="tablist" aria-label="Example World">
    {#each examples as item, index (item.name)}
      <button
        type="button"
        disabled={!mounted}
        role="tab"
        id={`${diagramId}-tab-${index}`}
        aria-controls={`${diagramId}-panel`}
        aria-selected={exampleIndex === index}
        tabindex={exampleIndex === index ? 0 : -1}
        style={`--tab-accent: ${item.accent}`}
        bind:this={tabButtons[index]}
        onclick={() => chooseExample(index)}
        onkeydown={(event) => tabKey(event, index)}
      >
        <span class="tab-dot" aria-hidden="true"></span>{item.name}
      </button>
    {/each}
  </div>

  <div class="playback-controls">
    <p class="playback-status">
      <span class:running={playing} aria-hidden="true"></span>{playing ? "Autoplay on" : "Paused"}
    </p>
    <div class="playback-buttons" role="group" aria-label="Autoplay">
      <button type="button" disabled={!mounted || !playing} onclick={() => (playing = false)}
        >Pause</button
      >
      <button type="button" disabled={!mounted || playing} onclick={() => (playing = true)}
        >Start</button
      >
    </div>
  </div>

  <div
    id={`${diagramId}-panel`}
    role="tabpanel"
    aria-labelledby={`${diagramId}-tab-${exampleIndex}`}
    class="example-panel"
  >
    <div class="scene-wrap" class:playing>
      <svg class="desktop-scene" viewBox="0 0 1000 500" role="img" aria-label={description}>
        <g class="ground"
          ><path
            d="M16 362 L380 155 L989 508 M20 452 L486 187 L990 478 M129 500 L592 236 L990 463 M270 500 L696 257 L990 429 M2 311 L339 500 M96 254 L527 500 M215 190 L720 500 M329 124 L914 463"
          ></path></g
        >
        <text class="stage-label" x="49" y="172">1 · GENERATE INDEXES</text>
        <text class="stage-label" x="522" y="49" text-anchor="middle"
          >2 · SELECT FROM A SHARED PALETTE</text
        >
        <text class="connector-name palette-name" x="522" y="78" text-anchor="middle"
          >{example.connector}</text
        >
        <text class="stage-label" x="858" y="68" text-anchor="middle">3 · INTERPRET IN A WORLD</text
        >
        <text class="connector-name world-name" x="858" y="97" text-anchor="middle"
          >{example.name}</text
        >
        {@render paletteDeck()}
        {#each indexes as _value, index (index)}
          {@const point = selectedPoint(index)}
          <path
            class="selection-wire"
            class:current={particleIndex === index}
            d={`M242 ${268 + index * 24} C${280 + index * 10} ${268 + index * 24}, ${point[0] - 90} ${point[1] - 45}, ${point[0]} ${point[1] - 22}`}
          ></path>
        {/each}
        <path class="world-wire" d="M736 241 C781 241 718 345 750 345"></path>
        {@render connectorPanel()}
        {@render worldResult("desktop")}
        <text class="reference-label" x="75" y="407">reference → {example.connector}</text>
        <text class="palette-explanation" x="522" y="407" text-anchor="middle"
          >Start 0 · add 1 · excerpt shown</text
        >
        <text class="mapping-label" x="522" y="435" text-anchor="middle"
          >Index {activeValue} → value {activeValue}</text
        >
      </svg>
      <svg class="mobile-scene" viewBox="0 0 440 1140" role="img" aria-label={description}>
        <text class="stage-label" x="220" y="27" text-anchor="middle">1 · GENERATE INDEXES</text>
        <g transform="translate(74 -144)">{@render connectorPanel()}</g>
        <text class="reference-label" x="220" y="251" text-anchor="middle"
          >reference → {example.connector}</text
        >
        <text class="stage-label" x="220" y="303" text-anchor="middle"
          >2 · SELECT FROM A SHARED PALETTE</text
        >
        <text class="connector-name palette-name" x="220" y="332" text-anchor="middle"
          >{example.connector}</text
        >
        <g transform="translate(-302 264)">{@render paletteDeck()}</g>
        <path
          class="selection-wire current"
          d={`M220 224 C220 299, ${mobilePoint[0] - 302} 286, ${mobilePoint[0] - 302} ${mobilePoint[1] + 242}`}
        ></path>
        <text class="palette-explanation" x="220" y="662" text-anchor="middle"
          >Start 0 · add 1 · excerpt shown</text
        >
        <text class="mapping-label" x="220" y="689" text-anchor="middle"
          >Index {activeValue} → value {activeValue}</text
        >
        <text class="stage-label" x="220" y="739" text-anchor="middle"
          >3 · INTERPRET IN A WORLD</text
        >
        <text class="connector-name world-name" x="220" y="769" text-anchor="middle"
          >{example.name}</text
        >
        <g transform="translate(-638 664)">{@render worldResult("mobile")}</g>
      </svg>
    </div>

    <div class="selection-controls">
      <div class="variation-controls" role="group" aria-label="Selection variation">
        {#each example.variants as item, index (item.name)}
          <button
            type="button"
            disabled={!mounted}
            aria-pressed={variantIndex === index}
            onclick={() => chooseVariant(index)}>{item.name} <span>+{item.step}</span></button
          >
        {/each}
      </div>
      <div class="particle-controls" role="group" aria-label="Inspect a selected index">
        {#each indexes as value, index (index)}
          <button
            type="button"
            disabled={!mounted}
            aria-label={`Inspect index ${value}`}
            aria-pressed={particleIndex === index}
            onclick={() => chooseParticle(index)}>{value}</button
          >
        {/each}
      </div>
    </div>
    <output class="result" aria-live={playing ? "off" : "polite"} aria-atomic="true">
      Index <strong>{activeValue}</strong> → {example.connector} value
      <strong>{activeValue}</strong>
      → <strong>{interpreted[particleIndex]}</strong>
    </output>
  </div>

  <p class="diagram-note">
    {#if exampleIndex === 2}The game reads each selected pose number as a character’s next movement.
      Try a different selection to change its four-move sequence.
    {/if}
    Choosing a tab, variation or index pauses the diagram. {exampleIndex === 0
      ? "pitch is a published connector."
      : `${example.connector} is an illustrative connector.`} Index and value match here because each
    palette starts at zero and adds one.
  </p>
</figure>

<style>
  .palette-diagram {
    --ink: #f4ecff;
    --dim: #c1b9ce;
    --cyan: #77d7ee;
    --font: "VT323", ui-monospace, SFMono-Regular, Menlo, monospace;
    container-name: spatial-palette;
    container-type: inline-size;
    display: grid;
    gap: 1.2rem;
    margin: 0;
    padding: clamp(1rem, 2.6vw, 1.8rem);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--example-accent) 24%, transparent);
    border-radius: 1.5rem;
    color: var(--ink);
    background:
      radial-gradient(
        ellipse at 52% 40%,
        color-mix(in srgb, var(--example-accent) 8%, transparent),
        transparent 60%
      ),
      linear-gradient(145deg, #181525, #0c111b 70%);
    box-shadow:
      0 26px 70px -40px rgba(30, 21, 67, 0.7),
      inset 0 1px rgba(255, 255, 255, 0.06);
  }
  .palette-diagram .diagram-title {
    margin: 0 0 0.4rem;
    color: var(--ink) !important;
    font: 400 clamp(1.8rem, 3vw, 2.2rem)/1.1 var(--font);
  }
  .palette-diagram .diagram-intro,
  .palette-diagram .diagram-note {
    margin: 0;
    color: var(--dim) !important;
    font-size: 0.84rem;
    line-height: 1.5;
  }
  .example-tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .palette-diagram button {
    min-height: 2.75rem;
    border: 1px solid rgba(244, 236, 255, 0.14);
    border-radius: 0.55rem;
    color: var(--ink);
    font: 1.15rem/1 var(--font);
    background: rgba(255, 255, 255, 0.025);
    cursor: pointer;
  }
  .palette-diagram button:hover:not(:disabled) {
    border-color: var(--example-accent);
    background: color-mix(in srgb, var(--example-accent) 8%, transparent);
  }
  .palette-diagram button:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 4px;
  }
  .example-tabs button {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.4rem;
  }
  .example-tabs button[aria-selected="true"] {
    color: var(--tab-accent);
    border-color: var(--tab-accent);
    background: color-mix(in srgb, var(--tab-accent) 10%, transparent);
  }
  .tab-dot {
    flex: 0 0 auto;
    width: 0.35rem;
    height: 0.35rem;
    border-radius: 50%;
    background: var(--tab-accent);
  }
  .example-panel {
    min-width: 0;
  }

  .palette-diagram .example-panel {
    background-color: transparent !important;
  }
  .scene-wrap {
    position: relative;
    margin-inline: -0.5rem;
  }
  .scene-wrap svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .mobile-scene {
    display: none !important;
  }
  .mobile-scene .stage-label {
    font-size: 19px;
    letter-spacing: 0.4px;
  }
  .scene-wrap text {
    font-family: var(--font);
    font-weight: 400;
  }
  .ground {
    fill: none;
    stroke: rgba(145, 176, 195, 0.055);
    stroke-width: 1;
  }
  .stage-label {
    fill: var(--dim);
    font-size: 17px;
    letter-spacing: 0.8px;
  }
  .scene-label {
    fill: var(--dim);
    font-size: 14px;
    letter-spacing: 1px;
  }
  .connector-name {
    font-size: 23px;
  }
  .source-name {
    fill: #efabd2;
  }
  .palette-name {
    fill: var(--cyan);
  }
  .world-name {
    fill: var(--example-accent);
  }
  .pod-shadow {
    fill: #04070a;
    opacity: 0.65;
  }
  .pod-side {
    fill: #2a233b;
    stroke: #664660;
    stroke-width: 1;
  }
  .pod-top {
    fill: #201a2c;
    stroke: #b36b99;
    stroke-width: 1;
  }
  .index-row {
    fill: rgba(232, 142, 195, 0.035);
  }
  .index-row.current {
    fill: rgba(232, 142, 195, 0.16);
  }
  .index-prefix {
    fill: var(--dim);
    font-size: 17px;
  }
  .index-number {
    fill: #b697b0;
    font-size: 23px;
  }
  .index-number.current {
    fill: #ffd3ec;
  }
  .deck-shadow {
    fill: #010508;
    opacity: 0.5;
    filter: blur(14px);
  }
  .deck-edge {
    fill: #15242e;
    stroke: #325160;
    stroke-width: 1;
  }
  .deck-face {
    fill: #14242c;
    stroke: #406373;
    stroke-width: 1;
  }
  .deck-seam {
    fill: none;
    stroke: #447082;
    stroke-width: 1;
  }
  .tile-side {
    fill: #182f38;
    stroke: #355461;
    stroke-width: 1;
  }
  .tile-face {
    fill: #233d46;
    stroke: #486773;
    stroke-width: 1;
  }
  .palette-tile text {
    fill: #a1bac3;
    font-size: 18px;
  }
  .palette-tile.selected .tile-face {
    fill: color-mix(in srgb, var(--example-accent) 26%, #19343a);
    stroke: color-mix(in srgb, var(--example-accent) 68%, #426676);
  }
  .palette-tile.selected .tile-side {
    fill: color-mix(in srgb, var(--example-accent) 15%, #17252f);
  }
  .palette-tile.selected text {
    fill: var(--example-accent);
  }
  .palette-tile.current .tile-face {
    fill: color-mix(in srgb, var(--example-accent) 44%, #1e3841);
    stroke: var(--example-accent);
    stroke-width: 2;
  }
  .palette-tile.current text {
    fill: #ffffff;
  }
  .tile-pointer {
    fill: var(--example-accent);
  }
  .selection-wire {
    fill: none;
    stroke: #dd95c7;
    stroke-width: 1.4;
    opacity: 0.18;
  }
  .selection-wire.current {
    stroke: var(--example-accent);
    stroke-width: 2.3;
    stroke-dasharray: 5 9;
    opacity: 0.9;
  }
  .world-wire {
    fill: none;
    stroke: var(--example-accent);
    stroke-width: 2;
    stroke-dasharray: 5 9;
    opacity: 0.75;
  }
  .playing .selection-wire.current,
  .playing .world-wire {
    animation: reference-flow 1.4s linear infinite;
  }
  .reference-label {
    fill: #efabd2;
    font-size: 19px;
  }
  .palette-explanation {
    fill: var(--dim);
    font-size: 18px;
  }
  .mapping-label {
    fill: var(--example-accent);
    font-size: 22px;
  }
  .world-plinth {
    fill: #1d2735;
    stroke: #39495a;
    stroke-width: 1;
  }
  .world-floor {
    fill: #1a202f;
    stroke: #48576b;
    stroke-width: 1;
  }
  .world-side {
    fill: #273042;
    stroke: #647186;
    stroke-width: 1;
  }
  .world-frame {
    fill: #101923;
    stroke: color-mix(in srgb, var(--example-accent) 60%, #485c6e);
    stroke-width: 1.5;
  }
  .world-value {
    fill: var(--example-accent);
    font-size: 27px;
  }
  .music-grid {
    stroke: rgba(244, 236, 255, 0.18);
    stroke-width: 1;
  }
  .beat-guide {
    stroke: rgba(244, 236, 255, 0.07);
    stroke-width: 1;
  }
  .axis-label {
    fill: var(--dim);
    font-size: 15px;
  }
  .music-note {
    fill: var(--example-accent);
    opacity: 0.4;
  }
  .music-note.current {
    opacity: 1;
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--example-accent) 50%, transparent));
  }
  .composition-line {
    fill: none;
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 2;
  }
  .composition-border {
    fill: none;
    stroke: rgba(255, 255, 255, 0.3);
    stroke-width: 1;
  }
  .game-path {
    fill: none;
    stroke: var(--example-accent);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }
  .dance-floor {
    fill: rgba(191, 165, 255, 0.08);
    stroke: rgba(191, 165, 255, 0.3);
    stroke-width: 1;
  }
  .dancer-head {
    fill: var(--example-accent);
  }
  .dancer-body,
  .dancer-limb {
    fill: none;
    stroke: var(--example-accent);
    stroke-width: 7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .selection-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
    margin-top: 0.1rem;
  }
  .variation-controls,
  .particle-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .variation-controls button {
    padding: 0.55rem 0.75rem;
  }
  .variation-controls span {
    margin-left: 0.35rem;
    color: var(--example-accent);
  }
  .particle-controls button {
    min-width: 2.75rem;
    padding: 0.5rem;
  }
  .variation-controls button[aria-pressed="true"],
  .particle-controls button[aria-pressed="true"] {
    border-color: var(--example-accent);
    color: var(--example-accent);
    background: color-mix(in srgb, var(--example-accent) 8%, transparent);
  }
  .result {
    display: block;
    margin-top: 1rem;
    color: var(--dim);
    font: 1.15rem/1.4 var(--font);
  }
  .palette-diagram .result strong {
    color: var(--example-accent) !important;
    font-weight: 400;
  }
  .playback-controls {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding-top: 0.9rem;
    border-top: 1px solid rgba(244, 236, 255, 0.12);
  }
  .palette-diagram .playback-status {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin: 0;
    color: var(--dim) !important;
    font: 1.1rem/1 var(--font);
  }
  .playback-status span {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: #665e78;
  }
  .playback-status span.running {
    background: var(--example-accent);
  }
  .playback-buttons {
    display: flex;
    gap: 0.4rem;
  }
  .playback-buttons button {
    min-width: 4rem;
    padding: 0.5rem 0.8rem;
  }
  .playback-buttons button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .palette-diagram .diagram-note {
    font-size: 0.76rem;
  }
  @keyframes reference-flow {
    to {
      stroke-dashoffset: -28;
    }
  }
  @container spatial-palette (max-width: 41rem) {
    .desktop-scene {
      display: none !important;
    }
    .mobile-scene {
      display: block !important;
    }
    .example-tabs button {
      gap: 0.3rem;
      font-size: 1.1rem;
    }
  }
  @container spatial-palette (max-width: 23rem) {
    .example-tabs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .selection-controls {
      gap: 0.65rem;
    }
    .variation-controls {
      width: 100%;
    }
    .variation-controls button {
      flex: 1;
      padding-inline: 0.4rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .playing .selection-wire.current,
    .playing .world-wire {
      animation: none;
    }
  }
</style>
