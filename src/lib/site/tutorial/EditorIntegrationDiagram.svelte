<script lang="ts">
  type Route = "standalone" | "hosted";

  let route = $state<Route>("standalone");
  const standalone = $derived(route === "standalone");
  const actions = [
    { id: "draft", name: "Create drafts", authoring: true },
    { id: "simulate", name: "Simulate", authoring: false },
    { id: "publish", name: "Publish", authoring: true },
    { id: "execute", name: "Execute", authoring: false },
  ];
</script>

<figure class="editor-blueprint" aria-label="Two ways to integrate a World editor">
  <figcaption class="intro">
    <span class="eyeline">The interface is yours to design</span>
    <strong>A World can be a workspace.</strong>
    <span class="lede">Let people arrange a movement, shape a scene or compose a score.</span>
  </figcaption>

  <div class="route-controls" role="group" aria-label="World integration route">
    <button type="button" aria-pressed={standalone} onclick={() => (route = "standalone")}>
      Standalone app
    </button>
    <button type="button" aria-pressed={!standalone} onclick={() => (route = "hosted")}>
      Hosted World
    </button>
  </div>

  <div class="route-map" class:hosted={!standalone}>
    <div class="station workspace">
      <div class="illustration">
        <svg viewBox="0 0 170 114" aria-hidden="true">
          <rect class="window" x="15" y="18" width="140" height="86" rx="7"></rect>
          <path class="wire" d="M15 36H155"></path>
          <circle class="dot" cx="25" cy="27" r="2"></circle>
          <circle class="dot" cx="33" cy="27" r="2"></circle>
          <circle class="dot" cx="41" cy="27" r="2"></circle>
          <rect class="drawing" x="24" y="45" width="59" height="50" rx="4"></rect>
          <path class="faint" d="M28 85H79M53 50V92"></path>
          <circle class="avatar" cx="54" cy="57" r="5"></circle>
          <path class="avatar" d="M54 63L52 77L43 89M52 77L64 89M53 68L37 64M53 68L68 58"></path>
          <path class="slider" d="M98 53H142M98 69H142M98 85H142"></path>
          <circle class="knob" cx="115" cy="53" r="4"></circle>
          <circle class="knob" cx="134" cy="69" r="4"></circle>
          <circle class="knob" cx="106" cy="85" r="4"></circle>
          {#if !standalone}
            <rect class="boundary" x="5" y="6" width="160" height="105" rx="12"></rect>
            <rect class="badge" x="118" y="2" width="36" height="16" rx="4"></rect>
            <text class="badge-word" x="136" y="13" text-anchor="middle">ZIP</text>
          {/if}
        </svg>
      </div>
      <strong class="nameplate">{standalone ? "Your World editor" : "Your uploaded World"}</strong>
      <span class="station-copy">
        {standalone ? "An application you control" : "A platform-hosted application"}
      </span>
    </div>

    <div class="connector" aria-hidden="true"><span>→</span></div>

    <div class="station sdk">
      <div class="illustration">
        <svg viewBox="0 0 170 114" aria-hidden="true">
          <path class="faint" d="M14 57H47M123 57H156M85 15V31M85 83V105"></path>
          <circle class="orbit" cx="85" cy="57" r="42"></circle>
          <rect class="sdk-box" x="44" y="32" width="82" height="50" rx="11"></rect>
          <text class="sdk-word" x="85" y="63" text-anchor="middle">SDK</text>
          <circle class="port" cx="44" cy="57" r="4"></circle>
          <circle class="port" cx="126" cy="57" r="4"></circle>
          {#if standalone}
            <path class="sign-wire" d="M85 82V103"></path>
            <circle class="sign-dot" cx="85" cy="104" r="4"></circle>
          {:else}
            <path class="broker" d="M35 92H135M35 87V97M135 87V97"></path>
          {/if}
        </svg>
      </div>
      <strong class="nameplate">{standalone ? "Full SDK" : "World runtime SDK"}</strong>
      <span class="station-copy">
        {standalone ? "Your app makes requests" : "The host brokers supported requests"}
      </span>
    </div>

    <div class="connector" aria-hidden="true"><span>→</span></div>

    <div class="station network">
      <div class="illustration">
        <svg viewBox="0 0 170 114" aria-hidden="true">
          <path
            class="network-wire"
            d="M32 32L82 55L139 27M82 55L126 91M82 55L35 91M139 27L126 91M32 32L35 91"
          ></path>
          <circle class="orbit" cx="82" cy="55" r="36"></circle>
          <circle class="network-node" cx="32" cy="32" r="11"></circle>
          <circle class="network-node" cx="139" cy="27" r="9"></circle>
          <circle class="network-node" cx="126" cy="91" r="11"></circle>
          <circle class="network-node" cx="35" cy="91" r="8"></circle>
          <circle class="network-root" cx="82" cy="55" r="18"></circle>
          <path class="root-mark" d="M74 55H90M82 47V63"></path>
        </svg>
      </div>
      <strong class="nameplate">Shared operations</strong>
      <span class="station-copy">Discover, read and build on the network</span>
    </div>
  </div>

  <div class="access">
    <svg viewBox="0 0 28 28" aria-hidden="true">
      {#if standalone}
        <circle cx="9" cy="10" r="5"></circle>
        <path d="M13 14L23 24M19 20L22 17M22 23L25 20"></path>
      {:else}
        <path d="M14 3L24 7V14C24 20 18 24 14 26C10 24 4 20 4 14V7Z"></path>
        <path d="M9 14L13 18L20 10"></path>
      {/if}
    </svg>
    <span>
      {#if standalone}
        <strong>Your sign-in and signing flow</strong>
        <span>Sign in to create drafts. Sign a transaction to publish.</span>
      {:else}
        <strong>Access through the host</strong>
        <span>The current bridge exposes discovery, reads, simulation and execution.</span>
      {/if}
    </span>
  </div>

  <ul class="capabilities" aria-label="Actions available through this integration">
    {#each actions as action (action.id)}
      {@const available = standalone || !action.authoring}
      <li class:unavailable={!available}>
        <span class="cap-mark" aria-hidden="true">{available ? "✓" : "—"}</span>
        <span class="cap-name">{action.name}</span>
        <span class="cap-state">{available ? "Available" : "Needs extension"}</span>
      </li>
    {/each}
  </ul>

  <output class="summary" aria-live="polite" aria-atomic="true">
    {#if standalone}
      Standalone app: author and run operations with the full SDK and a signing account.
    {:else}
      Hosted World: creating drafts and publishing need an extended host bridge and trusted signing.
    {/if}
  </output>
</figure>

<style>
  .editor-blueprint {
    --blue-ink: #1b3558;
    --blue-dim: #4b6380;
    --blue-line: #b7cbe3;
    --blue-accent: #315fba;
    display: grid;
    gap: 1.15rem;
    min-width: 0;
    margin: 0;
    padding: clamp(1.15rem, 3vw, 2rem);
    overflow: hidden;
    border: 1px solid #bdcfe7;
    border-radius: 1.4rem;
    background: radial-gradient(circle at 100% 0%, #dbe7ff 0, transparent 42%), #edf3fc;
    color: var(--blue-ink) !important;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  .intro {
    display: grid;
    gap: 0.5rem;
  }

  .eyeline {
    color: var(--blue-dim);
    font-family: ui-monospace, monospace;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .editor-blueprint strong {
    color: var(--blue-ink) !important;
  }

  .editor-blueprint .intro strong {
    font-size: clamp(1.55rem, 3vw, 2.15rem);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.045em;
  }

  .lede {
    color: var(--blue-dim);
    font-size: 0.85rem;
    line-height: 1.55;
  }

  .route-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .route-controls button {
    min-height: 2.65rem;
    padding: 0.4rem 0.9rem;
    border: 1px solid #abc1dd;
    border-radius: 0.55rem;
    background: #f5f8fd;
    color: var(--blue-dim);
    font-size: 0.8rem;
    font-weight: 650;
    cursor: pointer;
  }

  .route-controls button[aria-pressed="true"] {
    border-color: var(--blue-accent);
    background: var(--blue-accent);
    color: #fff;
  }

  .route-controls button:focus-visible {
    outline: 2px solid var(--blue-ink);
    outline-offset: 3px;
  }

  .route-map {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1.7rem minmax(0, 1fr) 1.7rem minmax(0, 1fr);
    align-items: start;
    gap: 0.3rem;
    padding: 0.45rem 0.2rem 0.75rem;
    border-block: 1px solid #bdcfe778;
    background-image: radial-gradient(#91b0d22e 1px, transparent 1px);
    background-size: 12px 12px;
  }

  .station {
    display: grid;
    justify-items: center;
    gap: 0.3rem;
    min-width: 0;
    text-align: center;
  }

  .illustration {
    width: min(100%, 190px);
  }
  .illustration svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .nameplate {
    font-size: 0.85rem;
    font-weight: 650;
    line-height: 1.4;
  }
  .station-copy {
    max-width: 12rem;
    color: var(--blue-dim);
    font-size: 0.7rem;
    line-height: 1.5;
  }

  .connector {
    display: grid;
    place-items: center;
    height: 7rem;
    color: #6f91bd;
    font-size: 1.6rem;
  }

  .window {
    fill: #f9fbff;
    stroke: #89a9d1;
    stroke-width: 1.4;
  }
  .wire,
  .faint {
    fill: none;
    stroke: #b3c8e3;
    stroke-width: 1;
  }
  .faint {
    stroke-dasharray: 2 3;
  }
  .dot {
    fill: #93b0d6;
  }
  .drawing {
    fill: #eaf1fc;
  }
  .avatar {
    fill: none;
    stroke: #466eab;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }
  .slider {
    fill: none;
    stroke: #a8bfdc;
    stroke-linecap: round;
    stroke-width: 2;
  }
  .knob {
    fill: #5a80bd;
    stroke: #f9fbff;
    stroke-width: 1.5;
  }
  .boundary {
    fill: none;
    stroke: #6687b3;
    stroke-dasharray: 3 4;
    stroke-width: 1.2;
  }
  .badge {
    fill: #dae7fb;
    stroke: #a4bddc;
  }
  .badge-word {
    fill: #3a5b89;
    font-family: ui-monospace, monospace;
    font-size: 8px;
  }
  .orbit {
    fill: none;
    stroke: #b0c6e3;
    stroke-dasharray: 2 5;
  }
  .sdk-box {
    fill: #315fba;
    stroke: #204b9b;
    stroke-width: 1.2;
  }
  .sdk-word {
    fill: #fff;
    font-family: ui-monospace, monospace;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 2px;
  }
  .port {
    fill: #edf3fc;
    stroke: #315fba;
    stroke-width: 1.5;
  }
  .sign-wire {
    stroke: #6584bb;
    stroke-dasharray: 2 3;
  }
  .sign-dot {
    fill: #6584bb;
  }
  .broker {
    fill: none;
    stroke: #6687b3;
    stroke-width: 1.3;
  }
  .network-wire {
    fill: none;
    stroke: #83a4cf;
    stroke-width: 1.2;
  }
  .network-node {
    fill: #d6e5f9;
    stroke: #7095c8;
    stroke-width: 1.4;
  }
  .network-root {
    fill: #507aca;
    stroke: #315fba;
    stroke-width: 1.3;
  }
  .root-mark {
    fill: none;
    stroke: #fff;
    stroke-linecap: round;
    stroke-width: 1.8;
  }

  .access {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .access svg {
    flex-shrink: 0;
    width: 1.65rem;
    height: 1.65rem;
    fill: none;
    stroke: #466eab;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }

  .access > span {
    display: grid;
    gap: 0.15rem;
  }
  .access strong {
    font-size: 0.78rem;
    font-weight: 650;
  }
  .access span span {
    color: var(--blue-dim);
    font-size: 0.72rem;
    line-height: 1.5;
  }

  .editor-blueprint .capabilities {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .editor-blueprint .capabilities li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.1rem 0.4rem;
    padding: 0.55rem 0.6rem;
    border: 1px solid #adc2df;
    border-radius: 0.5rem;
    background: #ffffff85;
    color: var(--blue-ink) !important;
  }

  .cap-mark {
    grid-row: span 2;
    color: #315fba;
    font-size: 1.15rem;
  }
  .editor-blueprint .cap-name {
    color: var(--blue-ink) !important;
    font-size: 0.72rem;
    font-weight: 650;
    line-height: 1.4;
  }
  .cap-state {
    color: var(--blue-dim);
    font-size: 0.62rem;
    line-height: 1.4;
  }
  .editor-blueprint .capabilities .unavailable {
    border-style: dashed;
    background: transparent;
  }
  .unavailable .cap-mark {
    color: #6e819b;
  }

  .summary {
    padding-top: 0.2rem;
    color: var(--blue-dim);
    font-size: 0.75rem;
    line-height: 1.6;
  }

  @media (max-width: 560px) {
    .route-map {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.1rem;
      padding-block: 0.7rem;
    }
    .station {
      grid-template-columns: 7.2rem minmax(0, 1fr);
      justify-items: start;
      align-items: center;
      column-gap: 0.75rem;
      text-align: left;
    }
    .illustration {
      grid-row: span 2;
      width: 100%;
    }
    .nameplate {
      align-self: end;
      font-size: 0.85rem;
    }
    .station-copy {
      align-self: start;
      font-size: 0.72rem;
    }
    .connector {
      height: 1.3rem;
      width: 7.2rem;
      font-size: 1.35rem;
    }
    .connector span {
      transform: rotate(90deg);
    }
    .editor-blueprint .capabilities {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
