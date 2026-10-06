<script lang="ts">
  let step = $state(2);
  const indexes = $derived([0, step, step * 2, step * 3]);
</script>

<figure class="draft-selection" aria-label="A selector chooses four values from pitch">
  <div class="diagram-heading">
    <strong>Your rule → shared pitch → your output</strong>
    <div role="group" aria-label="Preview a selecting rule" data-markdown-skip>
      <button type="button" aria-pressed={step === 2} onclick={() => (step = 2)}>add 2</button>
      <button type="button" aria-pressed={step === 12} onclick={() => (step = 12)}>add 12</button>
    </div>
  </div>
  <div class="selector">
    <span class="rule">Start 0<br /><b>add {step}</b></span>
    <span class="arrow" aria-hidden="true">→</span>
    <div class="columns">
      {#each indexes as index (index)}
        <div class="column">
          <span class="index">index {index}</span>
          <span class="link" aria-hidden="true">↓</span>
          <span class="value">{60 + index}</span>
        </div>
      {/each}
    </div>
  </div>
  <figcaption>
    Pitch starts at 60 and adds 1: value = 60 + index. Your selecting rule changes the indexes, so
    it changes which values you get. This preview runs here in the page.
  </figcaption>
</figure>

<style>
  .draft-selection {
    margin: 0;
    padding: clamp(1rem, 3vw, 1.75rem);
    border: 1px solid #c1925750;
    border-radius: 1rem;
    background: linear-gradient(130deg, #352a31, #132d3b);
    color: #ffe4ad !important;
    min-width: 0;
  }
  .diagram-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.9rem;
    margin-bottom: 1.75rem;
  }
  strong {
    color: #ffe4ad !important;
    font-size: 0.95rem;
  }
  .diagram-heading div {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.4rem 0.8rem;
    border: 1px solid #d6b58580;
    border-radius: 2rem;
    background: transparent !important;
    color: #ffe4ad !important;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
  }
  button[aria-pressed="true"] {
    color: #2b2330 !important;
    background: #ffe4ad !important;
  }
  button:focus-visible {
    outline: 2px solid #91dfdd;
    outline-offset: 3px;
  }
  .selector {
    display: flex;
    align-items: center;
    gap: 1.2rem;
  }
  .rule {
    padding: 1rem;
    border: 1px solid #ffe4ad50;
    border-radius: 0.75rem;
    font-size: 0.85rem;
    text-align: center;
    color: #e8cdb4 !important;
  }
  b {
    font-size: 1.2rem;
    color: #ffe4ad !important;
  }
  .arrow {
    font-size: 1.7rem;
    color: #d6b585 !important;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(0.5rem, 2vw, 1.2rem);
    flex: 1;
    min-width: 0;
  }
  .column {
    display: grid;
    gap: 0.3rem;
    text-align: center;
    min-width: 0;
  }
  .index {
    color: #c4b5ce !important;
    font-size: 0.8rem;
  }
  .link {
    color: #88d6d1 !important;
    font-size: 1.3rem;
  }
  .value {
    padding: 0.65rem 0.25rem;
    border: 1px solid #88d6d170;
    border-radius: 0.65rem;
    background: #88d6d112;
    color: #b8fff2 !important;
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    font-weight: 600;
  }
  figcaption {
    color: #d9c8bf !important;
    margin-top: 1.5rem;
    max-width: 65ch;
    font-size: 0.8rem;
    line-height: 1.7;
  }
  @media (max-width: 500px) {
    .selector {
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .rule {
      padding: 0.6rem 1rem;
    }
    .columns {
      flex-basis: 100%;
    }
    .index {
      font-size: 0.75rem;
    }
  }
</style>
