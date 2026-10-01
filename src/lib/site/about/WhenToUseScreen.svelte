<script lang="ts">
  import "$lib/site/about/vhs.css";

  const constellationNodes = [
    [20, 72],
    [50, 40],
    [82, 64],
    [112, 28],
    [144, 56],
    [176, 24],
    [160, 86],
    [104, 88],
  ] as const;
  const constellationEdges = [
    [0, 1],
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 4],
    [3, 5],
    [4, 6],
    [2, 7],
    [7, 6],
  ] as const;

  const contributors = [
    { x: 18, y: 18, agent: false },
    { x: 18, y: 82, agent: true },
    { x: 182, y: 18, agent: true },
    { x: 182, y: 82, agent: false },
    { x: 100, y: 10, agent: false },
  ];
  const sharedBlocks = Array.from({ length: 9 }, (_, index) => ({
    x: 86 + (index % 3) * 10,
    y: 40 + Math.floor(index / 3) * 10,
  }));
</script>

<h2 id="when-to-use">When do I want to use decentralised.art?</h2>

<div class="vhs-screen when-screen">
  <div class="when-intro">
    <p>
      You use decentralised.art when you want behaviours to outlive apps, teams, and servers. When
      you care that an operation keeps working tomorrow, under explicit <strong>conditions</strong>,
      with no third party deciding whether it still runs.
    </p>
  </div>

  <ol class="reasons" aria-labelledby="when-to-use">
    <li class="reason tone-cyan">
      <svg class="reason-art" viewBox="0 0 200 100" aria-hidden="true">
        {#each [18, 42, 66] as y, index (y)}
          <g class="server" style={`--i: ${index}`}>
            <line class="link" x1="50" y1={y + 8} x2="124" y2="50"></line>
            <rect class="box" x="20" {y} width="30" height="16" rx="3"></rect>
            <circle class="led" cx="27" cy={y + 8} r="2"></circle>
          </g>
        {/each}
        <circle class="pulse" cx="142" cy="50" r="18"></circle>
        <path class="address" d="M142 32 157.6 41v18L142 68 126.4 59V41Z"></path>
        <circle class="address-core" cx="142" cy="50" r="5"></circle>
      </svg>
      <h4>Persistence matters</h4>
      <p>
        You want the operation to remain available as a stable reference (an address), not a link to
        a repo or a server that can disappear.
      </p>
    </li>

    <li class="reason tone-green">
      <svg class="reason-art" viewBox="0 0 200 100" aria-hidden="true">
        <g class="plug">
          <path class="cable" d="M8 50h20"></path>
          <rect class="plug-body" x="28" y="43" width="12" height="14" rx="2"></rect>
          <path class="prongs" d="M40 46h5M40 54h5"></path>
        </g>
        <path class="socket" d="M58 42v16"></path>
        <circle class="orbit" cx="112" cy="50" r="30"></circle>
        <g class="orbiters">
          <circle cx="142" cy="50" r="3.4"></circle>
          <circle cx="82" cy="50" r="2.4"></circle>
        </g>
        <circle class="core" cx="112" cy="50" r="9"></circle>
        <rect class="switch" x="160" y="42" width="30" height="16" rx="8"></rect>
        <circle class="switch-knob" cx="168" cy="50" r="5.5"></circle>
      </svg>
      <h4>Autonomy matters</h4>
      <p>
        You want execution to depend on the operation’s own logic and <strong>conditions</strong>,
        not on platform admins, service uptime, or API policy changes.
      </p>
    </li>

    <li class="reason tone-yellow">
      <svg class="reason-art" viewBox="0 0 200 100" aria-hidden="true">
        {#each [28, 50, 72] as y, index (y)}
          <line class="track" x1="14" y1={y} x2="100" y2={y}></line>
          <line class="threshold" x1={52 + index * 12} y1={y - 6} x2={52 + index * 12} y2={y + 6}
          ></line>
          <circle
            class="knob"
            cx="20"
            cy={y}
            r="5"
            style={`--to: ${32 + index * 12}px; --i: ${index}`}
          ></circle>
        {/each}
        <rect class="gate gate-top" x="140" y="16" width="8" height="34" rx="2"></rect>
        <rect class="gate gate-bottom" x="140" y="50" width="8" height="34" rx="2"></rect>
        <circle class="value" cx="118" cy="50" r="4"></circle>
      </svg>
      <h4>Conditioning matters</h4>
      <p>
        You need behaviours that trigger or constrain actions based on time, state, permissions,
        thresholds, identity, payments, governance signals, or external event feeds.
      </p>
    </li>

    <li class="reason tone-magenta">
      <svg class="reason-art" viewBox="0 0 200 100" aria-hidden="true">
        {#each constellationEdges as [from, to], index (`${from}-${to}`)}
          <line
            class="edge"
            x1={constellationNodes[from][0]}
            y1={constellationNodes[from][1]}
            x2={constellationNodes[to][0]}
            y2={constellationNodes[to][1]}
            pathLength="1"
            style={`--i: ${index}`}
          ></line>
        {/each}
        {#each constellationNodes as [x, y], index (`${x}-${y}`)}
          <circle class="star" cx={x} cy={y} r="4" style={`--i: ${index}`}></circle>
        {/each}
      </svg>
      <h4>Composability matters</h4>
      <p>
        You expect many small mechanisms to be chained through dependencies, forks, and reuse into
        larger constellations.
      </p>
    </li>

    <li class="reason tone-coral">
      <svg class="reason-art" viewBox="0 0 200 100" aria-hidden="true">
        {#each sharedBlocks as block, index (index)}
          <rect
            class="block"
            x={block.x}
            y={block.y}
            width="8"
            height="8"
            rx="1.5"
            style={`--i: ${index}`}
          ></rect>
        {/each}
        {#each contributors as person, index (index)}
          <rect
            class="module"
            x={person.x - 3}
            y={person.y - 3}
            width="6"
            height="6"
            rx="1"
            style={`--dx: ${100 - person.x}px; --dy: ${50 - person.y}px; --i: ${index}`}
          ></rect>
          {#if person.agent}
            <rect class="author" x={person.x - 6} y={person.y - 6} width="12" height="12" rx="3"
            ></rect>
          {:else}
            <circle class="author" cx={person.x} cy={person.y} r="6"></circle>
          {/if}
        {/each}
      </svg>
      <h4>Multi-author contribution matters (humans + agents)</h4>
      <p>
        You want many contributors to add interoperable modules, and agents to assemble them through
        an API.
      </p>
    </li>
  </ol>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  /* Same spacing as the About page's other section headings. */
  h2#when-to-use {
    margin-top: 1rem;
  }

  .when-intro {
    display: grid;
    gap: 0.6rem;
    max-width: 48rem;
  }

  /* !important beats the site's light-theme heading and paragraph colours: this screen stays dark. */

  .when-screen .when-intro p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.65rem;
    color: var(--vhs-dim) !important;
  }

  .when-screen strong {
    font-weight: 600;
    color: var(--vhs-ink);
  }

  .reasons {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  @media (min-width: 640px) {
    .reasons {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .reason:last-child {
      grid-column: span 2;
    }
  }

  @media (min-width: 1024px) {
    .reasons {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .reason,
    .reason:last-child {
      grid-column: span 2;
    }

    .reason:nth-child(n + 4) {
      grid-column: span 3;
    }
  }

  .reason {
    --tone: var(--vhs-cyan);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 0.75rem 1rem;
    border: 1px solid color-mix(in srgb, var(--tone) 22%, transparent);
    border-radius: 0.9rem;
    background: rgba(255, 255, 255, 0.025);
  }

  .tone-green {
    --tone: var(--vhs-green);
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

  .reason-art {
    display: block;
    width: 100%;
    height: auto;
    max-height: 9rem;
    border-radius: 0.6rem;
    background:
      radial-gradient(
        70% 80% at 50% 50%,
        color-mix(in srgb, var(--tone) 12%, transparent),
        transparent
      ),
      rgba(4, 3, 10, 0.7);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }

  .when-screen .reason h4 {
    margin: 0.25rem 0 0;
    padding: 0 0.25rem;
    font-family: var(--vhs-font);
    font-size: 1.3rem;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--tone) !important;
  }

  .when-screen .reason p {
    margin: 0;
    padding: 0 0.25rem;
    font-size: 0.82rem;
    line-height: 1.35rem;
    color: var(--vhs-dim) !important;
  }

  /* Shared drawing styles: each illustration is drawn in its card's tone. */
  .reason-art :is(line, path, rect, circle) {
    vector-effect: non-scaling-stroke;
  }

  /* Persistence: servers come and go; the address stays lit. */
  .link {
    stroke: color-mix(in srgb, var(--tone) 45%, transparent);
    stroke-dasharray: 3 4;
  }

  .box {
    fill: rgba(18, 11, 34, 0.9);
    stroke: rgba(244, 236, 255, 0.4);
  }

  .led {
    fill: var(--vhs-green);
  }

  .server {
    animation: server-life 6s ease-in-out infinite;
    animation-delay: calc(var(--i) * -2s);
  }

  .address {
    fill: color-mix(in srgb, var(--tone) 22%, transparent);
    stroke: var(--tone);
    stroke-width: 1.6;
    filter: drop-shadow(0 0 6px var(--tone));
  }

  .address-core {
    fill: var(--tone);
  }

  .pulse {
    fill: none;
    stroke: var(--tone);
    transform-box: fill-box;
    transform-origin: center;
    animation: pulse 2.4s ease-out infinite;
  }

  /* Autonomy: the plug is pulled and the switch flips, but the process keeps orbiting. */
  .cable,
  .prongs {
    fill: none;
    stroke: rgba(244, 236, 255, 0.5);
    stroke-width: 1.6;
  }

  .plug {
    animation: unplug 5s ease-in-out infinite;
  }

  .plug-body {
    fill: rgba(18, 11, 34, 0.9);
    stroke: rgba(244, 236, 255, 0.5);
  }

  .socket {
    stroke: rgba(244, 236, 255, 0.35);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .orbit {
    fill: none;
    stroke: color-mix(in srgb, var(--tone) 40%, transparent);
    stroke-dasharray: 4 5;
  }

  .orbiters {
    fill: var(--tone);
    transform-origin: 112px 50px;
    animation: spin 3.2s linear infinite;
    filter: drop-shadow(0 0 4px var(--tone));
  }

  .core {
    fill: var(--tone);
    filter: drop-shadow(0 0 8px var(--tone));
  }

  .switch {
    fill: rgba(18, 11, 34, 0.9);
    stroke: rgba(244, 236, 255, 0.4);
  }

  .switch-knob {
    fill: rgba(244, 236, 255, 0.7);
    animation: flip 5s steps(1) infinite;
  }

  /* Conditioning: when every slider reaches its threshold, the gate opens and a value passes. */
  .track {
    stroke: rgba(244, 236, 255, 0.2);
    stroke-width: 2;
    stroke-linecap: round;
  }

  .threshold {
    stroke: color-mix(in srgb, var(--tone) 70%, transparent);
    stroke-width: 1.4;
  }

  .knob {
    fill: var(--tone);
    animation: slide 4.5s ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.15s);
  }

  .gate {
    fill: color-mix(in srgb, var(--tone) 30%, rgba(18, 11, 34, 0.9));
    stroke: var(--tone);
  }

  .gate-top {
    animation: gate-up 4.5s ease-in-out infinite;
  }

  .gate-bottom {
    animation: gate-down 4.5s ease-in-out infinite;
  }

  .value {
    fill: var(--tone);
    filter: drop-shadow(0 0 5px var(--tone));
    animation: pass 4.5s ease-in-out infinite;
  }

  /* Composability: small mechanisms link up into a larger constellation. */
  .edge {
    stroke: var(--tone);
    stroke-width: 1.4;
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
    animation: draw-edge 7s ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.35s);
  }

  .star {
    fill: rgba(18, 11, 34, 0.9);
    stroke: var(--tone);
    stroke-width: 1.6;
    filter: drop-shadow(0 0 4px var(--tone));
  }

  /* Multi-author: people (circles) and agents (squares) add modules to a shared structure. */
  .author {
    fill: rgba(18, 11, 34, 0.9);
    stroke: var(--tone);
    stroke-width: 1.6;
  }

  .module {
    fill: var(--tone);
    animation: deliver 4s ease-in infinite;
    animation-delay: calc(var(--i) * 0.8s);
  }

  .block {
    fill: var(--tone);
    filter: drop-shadow(0 0 3px var(--tone));
    animation: build 7.2s ease-out infinite;
    animation-delay: calc(var(--i) * 0.5s);
  }

  @keyframes server-life {
    0%,
    55% {
      opacity: 1;
    }
    65%,
    85% {
      opacity: 0.1;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes pulse {
    from {
      opacity: 0.8;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(2);
    }
  }

  @keyframes unplug {
    0%,
    35% {
      transform: translateX(13px);
    }
    50%,
    90% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(13px);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes flip {
    0% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(14px);
    }
  }

  @keyframes slide {
    0%,
    10% {
      transform: translateX(0);
    }
    45%,
    80% {
      transform: translateX(var(--to));
    }
    100% {
      transform: translateX(0);
    }
  }

  @keyframes gate-up {
    0%,
    45% {
      transform: translateY(0);
    }
    55%,
    80% {
      transform: translateY(-14px);
    }
    92%,
    100% {
      transform: translateY(0);
    }
  }

  @keyframes gate-down {
    0%,
    45% {
      transform: translateY(0);
    }
    55%,
    80% {
      transform: translateY(14px);
    }
    92%,
    100% {
      transform: translateY(0);
    }
  }

  @keyframes pass {
    0%,
    52% {
      transform: translateX(0);
      opacity: 1;
    }
    78% {
      transform: translateX(66px);
      opacity: 1;
    }
    84% {
      transform: translateX(66px);
      opacity: 0;
    }
    85%,
    100% {
      transform: translateX(0);
      opacity: 0;
    }
  }

  @keyframes draw-edge {
    0% {
      stroke-dashoffset: 1;
      opacity: 1;
    }
    25%,
    80% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
    100% {
      stroke-dashoffset: 0;
      opacity: 0;
    }
  }

  @keyframes deliver {
    0% {
      transform: translate(0, 0);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    70% {
      transform: translate(var(--dx), var(--dy));
      opacity: 1;
    }
    80%,
    100% {
      transform: translate(var(--dx), var(--dy));
      opacity: 0;
    }
  }

  @keyframes build {
    0% {
      opacity: 0.12;
    }
    15%,
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0.12;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reason-art * {
      animation: none !important;
    }

    .module {
      opacity: 0;
    }
  }
</style>
