<script lang="ts">
  let second = $state(false);
  const values = $derived(second ? [60, 72, 84, 96] : [60, 62, 64, 66]);
</script>

<figure class="world-output" aria-label="A circle prototype interprets the tutorial’s output">
  <div class="preview-header">
    <strong>A tiny World: one value, one circle</strong>
    <div role="group" aria-label="Circle prototype selection" data-markdown-skip>
      <button type="button" aria-pressed={!second} onclick={() => (second = false)}
        >add 2 output</button
      >
      <button type="button" aria-pressed={second} onclick={() => (second = true)}
        >add 12 output</button
      >
    </div>
  </div>
  <svg
    viewBox="0 0 440 150"
    role="img"
    aria-label={"Four circles with diameters " + values.join(", ") + " pixels"}
  >
    {#each values as value, i (i)}
      <circle cx={55 + i * 110} cy="65" r={value / 2}></circle>
      <text x={55 + i * 110} y="132" text-anchor="middle">{value} px</text>
    {/each}
  </svg>
  <figcaption>
    Here, a value means a diameter in pixels. Choose the other output to see how your selecting rule
    changes the picture. This is a local illustration of the two expected results.
  </figcaption>
</figure>

<style>
  .world-output {
    margin: 0;
    padding: clamp(1rem, 3vw, 1.6rem);
    background: linear-gradient(135deg, #252138, #162b39);
    border: 1px solid #b389ff50;
    border-radius: 1rem;
    min-width: 0;
  }
  .preview-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }
  strong {
    color: #e6d5ff !important;
    font-size: 0.95rem;
  }
  .preview-header div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  button {
    padding: 0.45rem 0.8rem;
    border: 1px solid #b389ff70;
    border-radius: 2rem;
    background: transparent !important;
    color: #e6d5ff !important;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  button[aria-pressed="true"] {
    background: #b389ff !important;
    color: #242039 !important;
  }
  button:focus-visible {
    outline: 2px solid #e6d5ff;
    outline-offset: 3px;
  }
  svg {
    display: block;
    width: 100%;
    max-height: 230px;
    margin-block: 1.5rem 0.75rem;
    overflow: visible;
  }
  circle {
    fill: #b389ff;
    fill-opacity: 0.65;
    stroke: #e6d5ff;
    stroke-width: 1;
  }
  text {
    fill: #e6d5ff !important;
    font:
      12px system-ui,
      sans-serif;
  }
  figcaption {
    color: #c6bdd8 !important;
    font-size: 0.8rem;
    line-height: 1.7;
    max-width: 65ch;
  }
</style>
