<script lang="ts">
  const uid = $props.id();
  const increments = [1, 3];

  let start = $state(0);
  let shift = $state(0);
  let locked = $state(false);

  const values = $derived.by(() => {
    const sequence = [Number(start)];
    for (let index = 0; index < 5; index += 1) {
      sequence.push(sequence[index] + increments[(shift + index) % increments.length]);
    }
    return sequence;
  });
  const operations = $derived(values.slice(1).map((_, index) => increments[(shift + index) % 2]));
  const desktopPoints = $derived(
    values.map((value) => ({ x: 58 + value * 39, y: 275 - value * 8 })),
  );
  const mobilePoints = $derived(
    values.map((value, index) => ({ x: index % 2 === 0 ? 108 : 222, y: 55 + value * 24 })),
  );

  const desktopPath = $derived(desktopPoints.map((point) => `${point.x},${point.y}`).join(" "));
  const mobilePath = $derived(mobilePoints.map((point) => `${point.x},${point.y}`).join(" "));
</script>

<figure class="ri-workbench" aria-labelledby={`${uid}-title`}>
  <figcaption class="workbench-heading">
    <p class="workbench-title" id={`${uid}-title`}>Same rule. A different place to begin.</p>
    <p class="workbench-intro">
      The connector repeats <strong>+1, then +3</strong>. Choose its first value and where to enter
      that cycle.
    </p>
  </figcaption>

  <div class="workbench-layout">
    <div class="controls">
      <div class="start-control">
        <label for={`${uid}-start`}>
          <span class="control-number" aria-hidden="true">1</span>
          Starting value
          <output class="start-readout" for={`${uid}-start`}>{start}</output>
        </label>
        <input
          id={`${uid}-start`}
          type="range"
          min="0"
          max="4"
          step="1"
          bind:value={start}
          disabled={locked}
        />
        <div class="ruler-labels" aria-hidden="true">
          {#each [0, 1, 2, 3, 4] as value (value)}
            <span>{value}</span>
          {/each}
        </div>
      </div>

      <div class="cycle-control" role="group" aria-label="First transformation in the cycle">
        <p class="control-heading">
          <span class="control-number" aria-hidden="true">2</span>
          Enter the cycle
        </p>
        <div class="cycle-track">
          <button
            class="cycle-button"
            type="button"
            aria-label="Start the cycle with +1"
            aria-pressed={shift === 0}
            disabled={locked}
            onclick={() => (shift = 0)}
          >
            <span class="entry-mark" aria-hidden="true">↓</span>
            <span class="operation">+1</span>
            <span class="operation-hint">{shift === 0 ? "First" : "Then"}</span>
          </button>
          <span class="cycle-arrow" aria-hidden="true">⇄</span>
          <button
            class="cycle-button"
            type="button"
            aria-label="Start the cycle with +3"
            aria-pressed={shift === 1}
            disabled={locked}
            onclick={() => (shift = 1)}
          >
            <span class="entry-mark" aria-hidden="true">↓</span>
            <span class="operation">+3</span>
            <span class="operation-hint">{shift === 1 ? "First" : "Then"}</span>
          </button>
        </div>
        <p class="cycle-note">Apply one operation per step, then repeat.</p>
      </div>

      <button
        class="lock-button"
        type="button"
        aria-label="Preview creator-fixed running instance"
        aria-pressed={locked}
        onclick={() => (locked = !locked)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="2"></rect>
          {#if locked}
            <path d="M8 10V7A4 4 0 0 1 16 7V10"></path>
          {:else}
            <path d="M8 10V7A4 4 0 0 1 16 7"></path>
          {/if}
          <path d="M12 14V17"></path>
        </svg>
        <span>{locked ? "Fixed by the creator" : "Try fixing these settings"}</span>
      </button>
      <p class="lock-note" role="status">
        {#if locked}
          This position’s starting value and cycle entry are fixed together. Click again to return
          to the open preview.
        {:else}
          These settings are open: the person running the connector can choose them.
        {/if}
      </p>
    </div>

    <div class="path-space" data-markdown-skip>
      <p class="path-heading">Follow this run</p>
      <svg class="path-desktop" viewBox="0 0 700 355" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-desk`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f1f7ed"></stop>
            <stop offset="1" stop-color="#dce9d8"></stop>
          </linearGradient>
        </defs>
        <path class="board-edge" d="M20 257L634 129L680 208L66 336V347L20 268Z"></path>
        <path class="board" d="M20 257L634 129L680 208L66 336Z" fill={`url(#${uid}-desk)`}></path>
        <g class="ruler" fill="none">
          {#each Array.from({ length: 16 }, (_, value) => value) as value (value)}
            <path d={`M${58 + value * 39} ${306 - value * 8}l-5 -8`}></path>
            <text x={61 + value * 39} y={322 - value * 8} text-anchor="middle">{value}</text>
          {/each}
        </g>
        <path class="unused-path" d="M58 275L643 155"></path>
        <polyline class="active-path" points={desktopPath}></polyline>
        {#each desktopPoints.slice(0, -1) as point, index (index)}
          <text
            class="step-operation"
            x={(point.x + desktopPoints[index + 1].x) / 2}
            y={(point.y + desktopPoints[index + 1].y) / 2 - 30}
            text-anchor="middle">+{operations[index]}</text
          >
        {/each}
        {#each desktopPoints as point, index (index)}
          <g class="bead" class:first={index === 0} transform={`translate(${point.x} ${point.y})`}>
            <ellipse class="bead-shadow" cx="0" cy="10" rx="22" ry="8"></ellipse>
            <circle class="bead-side" cy="5" r="19"></circle>
            <circle class="bead-face" r="19"></circle>
            <text class="bead-value" y="7" text-anchor="middle">{values[index]}</text>
          </g>
        {/each}
        <g class="start-pointer">
          <path d={`M${desktopPoints[0].x} ${desktopPoints[0].y - 26}v-42l35 -13`}></path>
          <text x={desktopPoints[0].x + 43} y={desktopPoints[0].y - 80}>First value</text>
        </g>
      </svg>

      <svg class="path-mobile" viewBox="0 0 310 455" aria-hidden="true">
        <path class="board-edge" d="M67 21L277 38V439L67 422L50 406V6Z"></path>
        <path class="board mobile-board" d="M50 6L260 23V422L50 405Z"></path>
        <g class="ruler">
          {#each Array.from({ length: 16 }, (_, value) => value) as value (value)}
            <path d={`M51 ${55 + value * 24}h12`}></path>
            <text x="38" y={60 + value * 24} text-anchor="end">{value}</text>
          {/each}
        </g>
        <polyline class="active-path" points={mobilePath}></polyline>
        {#each mobilePoints.slice(0, -1) as point, index (index)}
          <text
            class="step-operation"
            x={(point.x + mobilePoints[index + 1].x) / 2 + (index % 2 === 0 ? 11 : -11)}
            y={(point.y + mobilePoints[index + 1].y) / 2 - 8}
            text-anchor="middle">+{operations[index]}</text
          >
        {/each}
        {#each mobilePoints as point, index (index)}
          <g class="bead" class:first={index === 0} transform={`translate(${point.x} ${point.y})`}>
            <ellipse class="bead-shadow" cx="0" cy="9" rx="24" ry="9"></ellipse>
            <circle class="bead-side" cy="5" r="21"></circle>
            <circle class="bead-face" r="21"></circle>
            <text class="bead-value" y="7" text-anchor="middle">{values[index]}</text>
          </g>
        {/each}
        <g class="start-pointer">
          <path d={`M${mobilePoints[0].x} ${mobilePoints[0].y - 26}v-15h45`}></path>
          <text x={mobilePoints[0].x + 52} y={mobilePoints[0].y - 35}>First value</text>
        </g>
      </svg>
      <output class="sequence-output" aria-live="polite" aria-atomic="true">
        <span class="output-label">Output</span>
        <span>{values.join(" → ")}</span>
      </output>
    </div>
  </div>

  <p class="workbench-note">
    A <strong>running instance</strong> chooses the starting value and cycle entry at a position in the
    connector. Fixing that position saves both settings together; a run cannot override them. This is
    a local illustration.
  </p>
</figure>

<style>
  .ri-workbench {
    --bench-ink: #213c32;
    --bench-muted: #5b6f61;
    --bench-green: #36745b;
    --bench-mint: #9cddbf;
    container-name: running-instance;
    container-type: inline-size;
    margin: 0;
    padding: clamp(1.1rem, 3vw, 1.9rem);
    border: 1px solid #d1dacb;
    border-radius: 1.3rem;
    color: var(--bench-ink) !important;
    background: #f9f8f1 !important;
    box-shadow: 0 14px 45px -28px rgba(38, 70, 48, 0.5);
  }

  .ri-workbench .workbench-title {
    margin: 0;
    color: var(--bench-ink) !important;
    font-size: clamp(1.35rem, 3vw, 1.75rem);
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: -0.035em;
  }

  .ri-workbench .workbench-intro {
    max-width: 62ch;
    margin: 0.65rem 0 0;
    color: var(--bench-muted) !important;
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .ri-workbench strong {
    color: var(--bench-ink) !important;
  }

  .workbench-layout {
    display: grid;
    grid-template-columns: 218px minmax(0, 1fr);
    gap: clamp(1.1rem, 3vw, 2rem);
    align-items: center;
    margin-top: 1.65rem;
  }

  .controls {
    display: grid;
    gap: 1.3rem;
    min-width: 0;
  }

  .start-control label,
  .ri-workbench .control-heading {
    display: flex;
    gap: 0.55rem;
    align-items: center;
    margin: 0;
    color: var(--bench-ink) !important;
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .ri-workbench .control-number {
    display: grid;
    flex-shrink: 0;
    width: 1.4rem;
    height: 1.4rem;
    place-items: center;
    border: 1px solid #bed2c4;
    border-radius: 50%;
    color: var(--bench-green) !important;
    font-size: 0.7rem;
  }

  .start-readout {
    display: grid;
    width: 2rem;
    height: 2rem;
    margin-left: auto;
    place-items: center;
    border: 1px solid #aecfbd;
    border-radius: 0.45rem;
    background: #e3f3e8;
    color: var(--bench-ink) !important;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
  }

  .ri-workbench input[type="range"] {
    display: block;
    width: 100%;
    height: 1.5rem;
    margin: 0.75rem 0 0;
    padding: 0 !important;
    accent-color: var(--bench-green);
    background: transparent !important;
    cursor: pointer;
  }

  .ruler-labels {
    display: flex;
    justify-content: space-between;
    padding-inline: 0.25rem;
    color: var(--bench-muted) !important;
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }

  .cycle-track {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 0.6rem;
  }

  .ri-workbench .cycle-button {
    display: grid;
    flex: 1;
    min-height: 5.3rem;
    gap: 0.1rem;
    padding: 0.3rem 0.5rem 0.55rem;
    border: 1px solid #ccd7c9;
    border-radius: 0.6rem;
    color: var(--bench-ink) !important;
    background: #f4f5ed;
    box-shadow: 0 4px 0 #d6dfd1;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      border-color 150ms ease;
  }

  .ri-workbench .cycle-button[aria-pressed="true"] {
    border-color: #6a9d7f;
    background: #dcf0e2;
    box-shadow: 0 4px 0 #b5ceb9;
  }

  .entry-mark {
    height: 1rem;
    color: var(--bench-green) !important;
    font-size: 1.15rem;
    line-height: 1;
    visibility: hidden;
  }

  [aria-pressed="true"] .entry-mark {
    visibility: visible;
  }

  .ri-workbench .operation {
    color: var(--bench-ink) !important;
    font-size: 1.55rem;
    font-weight: 650;
    line-height: 1.15;
  }

  .ri-workbench .operation-hint {
    color: var(--bench-muted) !important;
    font-size: 0.65rem;
    line-height: 1.25;
  }

  .cycle-arrow {
    color: var(--bench-green) !important;
    font-size: 1.5rem;
  }

  .ri-workbench .cycle-note {
    margin: 0.7rem 0 0;
    color: var(--bench-muted) !important;
    font-size: 0.73rem;
    line-height: 1.45;
  }

  .ri-workbench .lock-button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    min-height: 44px;
    padding: 0.55rem 0.7rem;
    border: 1px solid #ccd7c9;
    border-radius: 0.5rem;
    color: var(--bench-ink) !important;
    background: #eeefe5;
    text-align: left;
    font-size: 0.76rem;
    font-weight: 550;
    line-height: 1.4;
    cursor: pointer;
  }

  .ri-workbench .lock-button[aria-pressed="true"] {
    border-color: #8a9f8b;
    background: #dfe7d8;
  }

  .lock-button svg {
    flex-shrink: 0;
    width: 19px;
    height: 19px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
  }

  .ri-workbench .lock-note {
    margin: -0.75rem 0 0;
    color: var(--bench-muted) !important;
    font-size: 0.71rem;
    line-height: 1.5;
  }

  .ri-workbench :is(button, input):focus-visible {
    outline: 2px solid var(--bench-green);
    outline-offset: 4px;
  }

  .ri-workbench :is(button, input):disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .path-space {
    min-width: 0;
  }

  .ri-workbench .path-heading {
    margin: 0;
    color: var(--bench-muted) !important;
    font-size: 0.75rem;
    font-weight: 550;
  }

  .path-desktop {
    display: block;
    width: 100%;
    margin-top: -0.75rem;
    overflow: visible;
  }

  .path-mobile {
    display: none;
  }

  .board-edge {
    fill: #c8d5bf;
    stroke: #bac9af;
    stroke-width: 1;
    stroke-linejoin: round;
  }

  .board {
    stroke: #c1d2b7;
    stroke-width: 1;
    stroke-linejoin: round;
  }

  .ruler path {
    fill: none;
    stroke: #93aa89;
    stroke-width: 1;
  }

  .ruler text {
    fill: #5f7654;
    stroke: none;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .unused-path {
    fill: none;
    stroke: #bacdb1;
    stroke-width: 4;
    stroke-linecap: round;
    stroke-dasharray: 1 8;
  }

  .active-path {
    fill: none;
    stroke: #578c69;
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .step-operation {
    fill: #3b684d;
    font-size: 16px;
    font-weight: 600;
  }

  .bead-shadow {
    fill: #829d77;
    opacity: 0.2;
  }

  .bead-side {
    fill: #c3cdba;
    stroke: #829c75;
    stroke-width: 1.1;
  }

  .bead-face {
    fill: #fbfaf0;
    stroke: #829c75;
    stroke-width: 1.1;
  }

  .first .bead-face {
    fill: var(--bench-mint);
    stroke: #397258;
    stroke-width: 1.5;
  }

  .first .bead-side {
    fill: #6da98a;
    stroke: #397258;
  }

  .bead-value {
    fill: #213c32;
    font-size: 20px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .start-pointer path {
    fill: none;
    stroke: #52866a;
    stroke-width: 1.3;
    stroke-linecap: round;
  }

  .start-pointer text {
    fill: #3a694f;
    font-size: 14px;
    font-weight: 550;
  }

  .sequence-output {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 0.3rem;
    padding: 0.8rem 0.5rem;
    border-top: 1px solid #d7dfce;
    color: var(--bench-ink) !important;
    font-size: clamp(0.76rem, 1.7vw, 1rem);
    font-variant-numeric: tabular-nums;
    line-height: 1.5;
  }

  .ri-workbench .output-label {
    color: var(--bench-muted) !important;
    font-size: 0.72rem;
  }

  .ri-workbench .workbench-note {
    margin: 1.4rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid #d7dfce;
    color: var(--bench-muted) !important;
    font-size: 0.78rem;
    line-height: 1.55;
  }

  @container running-instance (max-width: 690px) {
    .workbench-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
      margin-top: 1.2rem;
    }

    .controls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .lock-button,
    .lock-note {
      grid-column: 1 / -1;
    }

    .ri-workbench .lock-note {
      margin-top: -0.5rem;
    }

    .path-desktop {
      margin-top: -2.7rem;
    }
  }

  @container running-instance (max-width: 420px) {
    .controls {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.15rem;
    }

    .cycle-track {
      max-width: 230px;
      margin-inline: auto;
    }

    .path-desktop {
      display: none;
    }

    .path-mobile {
      display: block;
      width: min(100%, 310px);
      margin: 0.5rem auto 0;
    }

    .mobile-board {
      fill: #e5efdd;
    }

    .sequence-output {
      gap: 0.35rem;
      font-size: 0.81rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cycle-button {
      transition: none;
    }
  }
</style>
