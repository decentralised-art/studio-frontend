<script lang="ts">
  import "../about/vhs.css";

  const steps = [
    {
      id: "draft",
      title: "Create a draft",
      label: "Signed in · no gas",
      text: "Compose new operations and reuse existing ones.",
      tone: "cyan",
    },
    {
      id: "simulate",
      title: "Simulate",
      label: "No transaction",
      text: "Test the draft in the server’s local test environment.",
      tone: "magenta",
    },
    {
      id: "publish",
      title: "Publish",
      label: "Sepolia ETH for gas",
      text: "Publish referenced operations first, then their parent.",
      tone: "yellow",
    },
    {
      id: "execute",
      title: "Execute",
      label: "Read only · no gas",
      text: "Read published values; a compatible World gives them meaning.",
      tone: "green",
    },
  ] as const;
</script>

<figure class="vhs-screen lifecycle" aria-label="From a draft to output in a World">
  <div class="screen-heading">
    <span class="screen-label">From an idea to the network</span>
  </div>

  <ol class="steps">
    {#each steps as step, index (step.id)}
      <li class={`step tone-${step.tone}`}>
        <div class="step-top">
          <span class="step-number" aria-hidden="true">0{index + 1}</span>
          <svg class="step-art" viewBox="0 0 128 86" aria-hidden="true">
            {#if step.id === "draft"}
              <path class="wire" d="M26 23C51 23 44 59 70 59M26 62H70M92 59C109 59 103 23 119 23"
              ></path>
              <rect x="6" y="13" width="25" height="20" rx="4"></rect>
              <rect x="6" y="52" width="25" height="20" rx="4"></rect>
              <rect class="filled" x="69" y="45" width="28" height="28" rx="5"></rect>
              <circle cx="117" cy="23" r="8"></circle>
            {:else if step.id === "simulate"}
              <rect x="6" y="11" width="115" height="65" rx="7"></rect>
              <path class="wire" d="M6 26H121"></path>
              <circle class="filled" cx="15" cy="19" r="2"></circle>
              <circle class="filled" cx="24" cy="19" r="2"></circle>
              <path d="M17 54L29 42L41 60L53 47L65 53L77 37L90 46L108 40"></path>
              <path class="baseline" d="M17 66H108"></path>
            {:else if step.id === "publish"}
              <path class="wire" d="M19 56H111M46 56V27H83V56"></path>
              <rect x="7" y="43" width="25" height="25" rx="5"></rect>
              <rect x="52" y="14" width="25" height="25" rx="5"></rect>
              <rect class="filled" x="97" y="43" width="25" height="25" rx="5"></rect>
              <path d="M61 49V68M54 59L61 68L68 59"></path>
              <path class="spark" d="M109 23V32M105 28H114"></path>
            {:else}
              <circle cx="64" cy="43" r="32"></circle>
              <ellipse class="wire" cx="64" cy="43" rx="15" ry="32"></ellipse>
              <path class="wire" d="M34 33H94M34 53H94"></path>
              <path class="filled" d="M55 31L77 43L55 55Z"></path>
              <circle class="satellite" cx="15" cy="23" r="3"></circle>
              <circle class="satellite" cx="111" cy="64" r="3"></circle>
            {/if}
          </svg>
        </div>
        <h3>{step.title}</h3>
        <p class="step-label">{step.label}</p>
        <p class="step-text">{step.text}</p>
        {#if index < steps.length - 1}
          <span class="next" aria-hidden="true">→</span>
        {/if}
      </li>
    {/each}
  </ol>

  <figcaption>
    Publication sends a Sepolia transaction. Draft creation, simulation and read-only execution do
    not send one. After publication, wait for the operation to become available at the execution
    block.
  </figcaption>
</figure>

<style>
  .lifecycle {
    gap: 1.2rem;
  }

  .screen-heading {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-family: var(--vhs-font);
    font-size: 1.2rem;
    line-height: 1.15;
  }

  .lifecycle .screen-label {
    color: var(--vhs-cyan) !important;
  }

  .lifecycle .steps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .step {
    position: relative;
    min-width: 0;
    padding: 0.85rem;
    border: 1px solid color-mix(in srgb, var(--tone) 38%, transparent);
    border-radius: 0.7rem;
    background: color-mix(in srgb, var(--tone) 5%, transparent);
  }

  .tone-cyan {
    --tone: var(--vhs-cyan);
  }

  .tone-magenta {
    --tone: var(--vhs-magenta);
  }

  .tone-yellow {
    --tone: var(--vhs-yellow);
  }

  .tone-green {
    --tone: var(--vhs-green);
  }

  .step-top {
    position: relative;
    margin-bottom: 0.65rem;
  }

  .lifecycle .step-number {
    position: absolute;
    left: 0;
    top: 0;
    color: var(--tone) !important;
    font-family: var(--vhs-font);
    font-size: 1rem;
  }

  .step-art {
    display: block;
    width: 100%;
    height: 86px;
    fill: none;
    stroke: var(--tone);
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--tone) 25%, transparent));
  }

  .wire {
    opacity: 0.45;
  }

  .filled {
    fill: color-mix(in srgb, var(--tone) 16%, transparent);
  }

  .baseline {
    opacity: 0.25;
  }

  .satellite,
  .spark {
    opacity: 0.75;
  }

  .lifecycle h3 {
    margin: 0;
    /* The screen stays dark in both themes; override the site's light-theme headings. */
    color: var(--vhs-ink) !important;
    font-family: var(--vhs-font);
    font-size: 1.45rem;
    font-weight: 400;
    line-height: 1.1;
  }

  .lifecycle p {
    margin: 0;
  }

  .lifecycle .step-label {
    margin-top: 0.4rem;
    color: var(--tone) !important;
    font-family: var(--vhs-font);
    font-size: 1.02rem;
    line-height: 1.15;
  }

  .lifecycle .step-text {
    margin-top: 0.7rem;
    color: var(--vhs-ink) !important;
    font-size: 0.8rem;
    line-height: 1.55;
  }

  .lifecycle .next {
    position: absolute;
    top: 50%;
    right: -1.1rem;
    color: var(--vhs-dim) !important;
    font-family: var(--vhs-font);
    font-size: 1.25rem;
  }

  .lifecycle figcaption {
    max-width: 72ch;
    color: var(--vhs-dim) !important;
    font-size: 0.8rem;
    line-height: 1.55;
  }

  @media (max-width: 680px) {
    .lifecycle .steps {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
    }

    .step {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      column-gap: 1rem;
      align-content: center;
    }

    .step-top {
      grid-row: 1 / 4;
      align-self: center;
      margin-bottom: 0;
    }

    .step-art {
      height: 74px;
    }

    .step-number {
      top: -0.4rem;
    }

    .next {
      top: auto;
      bottom: -1.35rem;
      left: 50%;
      right: auto;
      transform: translateX(-50%) rotate(90deg);
    }
  }
</style>
