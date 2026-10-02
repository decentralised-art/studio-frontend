<script lang="ts">
  import "$lib/site/about/vhs.css";

  type Stage = {
    id: string;
    status: string;
    tone: "green" | "cyan" | "yellow" | "magenta" | "coral";
    phase: "past" | "now" | "future";
    title: string;
    text: string;
    tags: string[];
  };

  const stages: Stage[] = [
    {
      id: "live",
      status: "Live",
      tone: "green",
      phase: "past",
      title: "The platform is live",
      text: "The PT protocol runs on Ethereum and the whole path works end to end: create drafts, simulate them for free, publish them from your own wallet and execute them on chain. Studio, the World gallery with user-created Worlds, the SDK and the MCP server are available.",
      tags: ["Protocol", "Studio", "Worlds", "SDK", "MCP"],
    },
    {
      id: "sepolia",
      status: "Now",
      tone: "cyan",
      phase: "now",
      title: "Testing on Sepolia",
      text: "Everything currently runs on the Sepolia test network, so anyone can publish and execute without real cost while we harden publication, indexing, execution and the services around them.",
      tags: ["Sepolia testnet", "Reliability"],
    },
    {
      id: "tools",
      status: "Now",
      tone: "yellow",
      phase: "now",
      title: "Better tools for creators and agents",
      text: "We keep refining Studio for exploring, comparing and running compositions, and improve the SDK and the MCP server so that developers and AI agents can work with the network more easily.",
      tags: ["Studio", "SDK", "MCP"],
    },
    {
      id: "programmes",
      status: "Next",
      tone: "magenta",
      phase: "future",
      title: "Artistic experimentation programmes",
      text: "Programmes for artists and collectives to explore what the platform makes possible: composing Worlds together with AI agents, and composing through shared on-chain operations that others can build on.",
      tags: ["Artists", "AI agents", "Worlds"],
    },
    {
      id: "mainnet",
      status: "Later",
      tone: "coral",
      phase: "future",
      title: "Ethereum Mainnet, and possibly Base",
      text: "After testing, decentralised.art moves to Ethereum Mainnet, where published operations become permanent on the main network. Base is being considered as an additional network.",
      tags: ["Ethereum Mainnet", "Base"],
    },
  ];
</script>

<div class="vhs-screen roadmap">
  <ol class="stages">
    {#each stages as stage, index (stage.id)}
      <li class={`stage tone-${stage.tone} phase-${stage.phase}`} style={`--i: ${index}`}>
        <div class="rail" aria-hidden="true">
          <span class="node"></span>
          {#if index < stages.length - 1}
            <span
              class={`segment segment-${stages[index + 1].phase === "future" ? "future" : "past"}`}
            ></span>
          {/if}
        </div>

        <div class="card">
          <div class="card-text">
            <p class="status">{stage.status}</p>
            <h3>{stage.title}</h3>
            <p class="text">{stage.text}</p>
            <ul class="tags" aria-label="Areas">
              {#each stage.tags as tag (tag)}
                <li>{tag}</li>
              {/each}
            </ul>
          </div>

          <svg class="art" viewBox="0 0 200 120" aria-hidden="true">
            {#if stage.id === "live"}
              <!-- Building blocks assemble into a working structure. -->
              {#each [[40, 78], [72, 78], [104, 78], [136, 78], [56, 50], [88, 50], [120, 50], [72, 22], [104, 22]] as [x, y], b (b)}
                <rect class="brick" {x} {y} width="28" height="24" rx="4" style={`--b: ${b}`}
                ></rect>
              {/each}
              <path class="spark" d="M100 8v6M92 11l3 4M108 11l-3 4"></path>
            {:else if stage.id === "sepolia"}
              <!-- Blocks travel along a test chain and are checked. -->
              <line class="chain-line" x1="0" y1="60" x2="200" y2="60"></line>
              <g class="conveyor">
                {#each [0, 1, 2, 3, 4, 5] as b (b)}
                  <g transform={`translate(${b * 50 - 40} 0)`}>
                    <rect class="block" x="0" y="42" width="36" height="36" rx="6"></rect>
                    <path class="check" d="M9 60l7 7 12-14"></path>
                  </g>
                {/each}
              </g>
              <circle class="probe" cx="100" cy="60" r="26"></circle>
            {:else if stage.id === "tools"}
              <!-- A Studio graph wires itself up while a terminal types. -->
              <path class="wire" d="M38 34 C 64 34, 62 62, 88 62"></path>
              <path class="wire" d="M38 90 C 64 90, 62 62, 88 62"></path>
              <rect class="tool-node" x="10" y="24" width="28" height="20" rx="4"></rect>
              <rect class="tool-node" x="10" y="80" width="28" height="20" rx="4"></rect>
              <rect class="tool-node core" x="88" y="50" width="30" height="24" rx="4"></rect>
              <rect class="terminal" x="128" y="22" width="64" height="76" rx="6"></rect>
              {#each [0, 1, 2, 3] as line (line)}
                <rect
                  class="typed"
                  x="136"
                  y={34 + line * 15}
                  width="44"
                  height="5"
                  rx="2.5"
                  style={`--l: ${line}`}
                ></rect>
              {/each}
            {:else if stage.id === "programmes"}
              <!-- People (circles) and agents (squares) gather around a growing World. -->
              <g class="world">
                {#each [0, 1, 2, 3, 4, 5] as petal (petal)}
                  <ellipse
                    class="petal"
                    cx="100"
                    cy="60"
                    rx="24"
                    ry="8"
                    transform={`rotate(${petal * 30} 100 60)`}
                  ></ellipse>
                {/each}
                <circle class="world-core" cx="100" cy="60" r="7"></circle>
              </g>
              <g class="orbit">
                <circle class="person" cx="100" cy="16" r="6"></circle>
                <rect class="agent" x="150" y="54" width="12" height="12" rx="3"></rect>
                <circle class="person" cx="100" cy="104" r="6"></circle>
                <rect class="agent" x="38" y="54" width="12" height="12" rx="3"></rect>
              </g>
            {:else}
              <!-- A test block moves onto Ethereum; Base waits as a dashed option. -->
              <rect class="test-block" x="10" y="44" width="30" height="30" rx="5"></rect>
              <path class="arrow" d="M48 59h44M84 52l8 7-8 7"></path>
              <path class="eth" d="M124 20 146 58 124 72 102 58Z M124 76 146 64 124 98 102 64Z"
              ></path>
              <circle class="base" cx="176" cy="88" r="13"></circle>
            {/if}
          </svg>
        </div>
      </li>
    {/each}
  </ol>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .stages {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .stage {
    --tone: var(--vhs-green);
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 0.9rem;
  }

  .tone-cyan {
    --tone: var(--vhs-cyan);
  }

  .tone-yellow {
    --tone: var(--vhs-yellow);
  }

  .tone-magenta {
    --tone: var(--vhs-magenta);
  }

  .tone-coral {
    --tone: var(--vhs-coral);
  }

  /* The tape: solid and lit up to where we are, dashed for what is ahead. */
  .rail {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .node {
    position: relative;
    z-index: 1;
    width: 1rem;
    height: 1rem;
    margin-top: 1.4rem;
    border: 2px solid var(--tone);
    border-radius: 999px;
    background: #0b0816;
    box-shadow: 0 0 10px color-mix(in srgb, var(--tone) 70%, transparent);
  }

  .phase-past .node {
    background: var(--tone);
  }

  .phase-now .node::after {
    content: "";
    position: absolute;
    inset: -6px;
    border: 1px solid var(--tone);
    border-radius: 999px;
    animation: now-pulse 1.8s ease-out infinite;
  }

  .segment {
    position: relative;
    flex: 1;
    width: 2px;
    margin-top: 0.3rem;
    overflow: hidden;
  }

  .segment-past {
    background: linear-gradient(
      180deg,
      var(--tone),
      color-mix(in srgb, var(--tone) 40%, transparent)
    );
  }

  .segment-past::after {
    content: "";
    position: absolute;
    left: -2px;
    width: 6px;
    height: 2.5rem;
    border-radius: 999px;
    background: linear-gradient(180deg, transparent, #fff, transparent);
    filter: blur(1px);
    animation: signal 2.4s ease-in infinite;
    animation-delay: calc(var(--i) * 0.6s);
  }

  .segment-future {
    background: repeating-linear-gradient(
      180deg,
      color-mix(in srgb, var(--tone) 55%, transparent) 0 6px,
      transparent 6px 14px
    );
    background-size: 100% 14px;
    animation: tape 1.6s linear infinite;
  }

  .card {
    display: grid;
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding: 1rem 1.1rem;
    border: 1px solid color-mix(in srgb, var(--tone) 25%, transparent);
    border-radius: 0.9rem;
    background: rgba(255, 255, 255, 0.025);
  }

  .phase-now .card {
    border-color: color-mix(in srgb, var(--tone) 55%, transparent);
    background: color-mix(in srgb, var(--tone) 6%, transparent);
  }

  @media (min-width: 768px) {
    .card {
      grid-template-columns: minmax(0, 1fr) 15rem;
      align-items: center;
    }
  }

  /* !important beats the site's light-theme text colours: this screen stays dark. */
  .roadmap .status {
    margin: 0;
    font-family: var(--vhs-font);
    font-size: 1.1rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tone) !important;
    text-shadow:
      -1px 0 rgba(255, 95, 210, 0.55),
      1px 0 rgba(103, 214, 255, 0.55);
  }

  .roadmap .card h3 {
    margin: 0.2rem 0 0.4rem;
    font-family: var(--vhs-font);
    font-size: 1.6rem;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: 0.03em;
    color: var(--vhs-ink) !important;
  }

  .roadmap .text {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.55rem;
    color: var(--vhs-dim) !important;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  .roadmap .tags li {
    padding: 0.05rem 0.5rem;
    border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
    border-radius: 999px;
    font-family: var(--vhs-font);
    font-size: 0.95rem;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, var(--tone) 85%, white) !important;
  }

  .art {
    display: block;
    width: 100%;
    max-width: 15rem;
    height: auto;
    border-radius: 0.6rem;
    background:
      radial-gradient(
        70% 80% at 50% 50%,
        color-mix(in srgb, var(--tone) 14%, transparent),
        transparent
      ),
      rgba(4, 3, 10, 0.7);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }

  .art :is(line, path, rect, circle, ellipse) {
    vector-effect: non-scaling-stroke;
  }

  /* Live: blocks drop into place, then the structure glows. */
  .brick {
    fill: color-mix(in srgb, var(--tone) 30%, #0b0816);
    stroke: var(--tone);
    stroke-width: 1.4;
    animation: brick 6s ease-out infinite;
    animation-delay: calc(var(--b) * 0.18s);
  }

  .spark {
    fill: none;
    stroke: var(--tone);
    stroke-width: 1.6;
    stroke-linecap: round;
    animation: spark 6s ease-out infinite;
  }

  /* Sepolia: blocks move along the chain and are checked as they pass. */
  .chain-line {
    stroke: color-mix(in srgb, var(--tone) 40%, transparent);
    stroke-dasharray: 3 4;
  }

  .conveyor {
    animation: conveyor 3s linear infinite;
  }

  .block {
    fill: #0b0816;
    stroke: var(--tone);
    stroke-width: 1.4;
  }

  .check {
    fill: none;
    stroke: var(--vhs-green);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .probe {
    fill: none;
    stroke: var(--tone);
    stroke-dasharray: 4 5;
    opacity: 0.6;
    transform-box: fill-box;
    transform-origin: center;
    animation: spin 8s linear infinite;
  }

  /* Tools: wires flow into Studio while a terminal types. */
  .wire {
    fill: none;
    stroke: var(--tone);
    stroke-width: 1.6;
    stroke-dasharray: 3 5;
    animation: flow 1.4s linear infinite;
  }

  .tool-node {
    fill: #0b0816;
    stroke: rgba(244, 236, 255, 0.5);
  }

  .tool-node.core {
    stroke: var(--tone);
    filter: drop-shadow(0 0 6px var(--tone));
  }

  .terminal {
    fill: rgba(3, 18, 10, 0.85);
    stroke: color-mix(in srgb, var(--vhs-green) 50%, transparent);
  }

  .typed {
    fill: var(--vhs-green);
    transform-box: fill-box;
    transform-origin: left;
    animation: type 4s steps(8) infinite;
    animation-delay: calc(var(--l) * 0.7s);
  }

  /* Programmes: contributors orbit a World that keeps growing. */
  .petal {
    fill: color-mix(in srgb, var(--tone) 35%, transparent);
    stroke: var(--tone);
    stroke-width: 1;
  }

  .world {
    transform-origin: 100px 60px;
    animation: bloom 4s ease-in-out infinite;
  }

  .world-core {
    fill: var(--vhs-yellow);
    filter: drop-shadow(0 0 6px var(--vhs-yellow));
  }

  .orbit {
    transform-origin: 100px 60px;
    animation: spin 14s linear infinite;
  }

  .person,
  .agent {
    fill: #0b0816;
    stroke-width: 1.6;
  }

  .person {
    stroke: var(--vhs-cyan);
  }

  .agent {
    stroke: var(--vhs-green);
  }

  /* Mainnet: a test block crosses over to Ethereum; Base is a dashed option. */
  .test-block {
    fill: none;
    stroke: var(--vhs-cyan);
    stroke-dasharray: 4 3;
    animation: cross 4s ease-in-out infinite;
  }

  .arrow {
    fill: none;
    stroke: color-mix(in srgb, var(--tone) 70%, transparent);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .eth {
    fill: color-mix(in srgb, var(--tone) 25%, #0b0816);
    stroke: var(--tone);
    stroke-width: 1.4;
    stroke-linejoin: round;
    animation: eth-glow 4s ease-in-out infinite;
  }

  .base {
    fill: none;
    stroke: var(--vhs-cyan);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
    animation: maybe 2.4s ease-in-out infinite;
  }

  @keyframes now-pulse {
    from {
      opacity: 0.9;
      transform: scale(0.7);
    }
    to {
      opacity: 0;
      transform: scale(1.6);
    }
  }

  @keyframes signal {
    from {
      top: -2.5rem;
    }
    to {
      top: 100%;
    }
  }

  @keyframes tape {
    to {
      background-position: 0 14px;
    }
  }

  @keyframes brick {
    0% {
      opacity: 0;
      transform: translateY(-18px);
    }
    12%,
    85% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(0);
    }
  }

  @keyframes spark {
    0%,
    45% {
      opacity: 0;
    }
    55%,
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes conveyor {
    to {
      transform: translateX(-50px);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes flow {
    to {
      stroke-dashoffset: -16;
    }
  }

  @keyframes type {
    0% {
      transform: scaleX(0);
    }
    40%,
    85% {
      transform: scaleX(1);
    }
    100% {
      transform: scaleX(0);
    }
  }

  @keyframes bloom {
    0%,
    100% {
      transform: scale(0.75) rotate(0deg);
    }
    50% {
      transform: scale(1.05) rotate(30deg);
    }
  }

  @keyframes cross {
    0%,
    15% {
      transform: translateX(0);
      opacity: 1;
    }
    60% {
      transform: translateX(96px);
      opacity: 0.2;
    }
    61%,
    100% {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes eth-glow {
    0%,
    50% {
      filter: none;
    }
    65%,
    80% {
      filter: drop-shadow(0 0 8px var(--tone));
    }
    100% {
      filter: none;
    }
  }

  @keyframes maybe {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 0.9;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .roadmap *,
    .roadmap *::before,
    .roadmap *::after {
      animation: none !important;
    }
  }
</style>
