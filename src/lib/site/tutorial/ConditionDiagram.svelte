<script lang="ts">
  type Example = "financial" | "algorithmic";
  let example = $state<Example>("financial");
  let paid = $state(false);
  let supplied = $state(12);
  let minimum = $state(10);
  const passes = $derived(example === "financial" ? paid : supplied >= minimum);
  const uid = $props.id();

  function exampleKey(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    example =
      event.key === "Home"
        ? "financial"
        : event.key === "End"
          ? "algorithmic"
          : example === "financial"
            ? "algorithmic"
            : "financial";
    document.getElementById(uid + "-" + example + "-tab")?.focus();
  }

  function preview(result: boolean) {
    minimum = 10;
    supplied = result ? 12 : 8;
  }
</script>

<figure
  class="conditions"
  class:algorithmic={example === "algorithmic"}
  aria-label="A condition gates an execution request"
>
  <figcaption class="intro">
    <strong>Try two kinds of condition</strong>
  </figcaption>
  <div class="example-tabs" role="tablist" aria-label="Examples of conditions">
    <button
      id={uid + "-financial-tab"}
      type="button"
      role="tab"
      aria-selected={example === "financial"}
      aria-controls={uid + "-example"}
      tabindex={example === "financial" ? 0 : -1}
      onkeydown={exampleKey}
      onclick={() => (example = "financial")}>Financial</button
    >
    <button
      id={uid + "-algorithmic-tab"}
      type="button"
      role="tab"
      aria-selected={example === "algorithmic"}
      aria-controls={uid + "-example"}
      tabindex={example === "algorithmic" ? 0 : -1}
      onkeydown={exampleKey}
      onclick={() => (example = "algorithmic")}>Non-financial</button
    >
  </div>
  <div id={uid + "-example"} role="tabpanel" aria-labelledby={uid + "-" + example + "-tab"}>
    {#if example === "financial"}
      <p class="example-intro">
        Imagine a maker asks for a payment before their connector can be used. A custom payment
        contract sends the cryptocurrency from address A to address B and records a receipt.
      </p>
      <div class="payment-scene" class:paid>
        <div
          class="transfer"
          aria-label="Example payment from public address A to public address B"
        >
          <div class="address"><span class="avatar">A</span><span>Public address A</span></div>
          <div class="transfer-path">
            <span class="amount">0.01 ETH</span><span class="transfer-line" aria-hidden="true"
              >→</span
            ><span class="transfer-state"
              >{paid ? "Example payment recorded" : "No payment yet"}</span
            >
          </div>
          <div class="address"><span class="avatar">B</span><span>Public address B</span></div>
        </div>
        <div class="receipt">
          <svg viewBox="0 0 36 42" aria-hidden="true"
            ><path d="M7 3H29V39L25 36L21 39L17 36L13 39L7 36Z"></path><path
              d="M12 12H24M12 18H24M12 24H20"
            ></path></svg
          >
          <div>
            <strong>Example payment receipt</strong><span
              >{paid ? "paid = true" : "paid = false"}</span
            >
          </div>
          <span class="receipt-mark" aria-hidden="true">{paid ? "✓" : "—"}</span>
        </div>
        <div
          class="preview-controls"
          role="group"
          aria-label="Change the example payment receipt"
          data-markdown-skip
        >
          <button
            type="button"
            aria-label="Preview pass: Record example payment"
            aria-pressed={paid}
            onclick={() => (paid = true)}>Record example payment</button
          >
          <button
            type="button"
            aria-label="Preview fail: Clear example receipt"
            aria-pressed={!paid}
            onclick={() => (paid = false)}>Clear example receipt</button
          >
        </div>
      </div>
      <p class="boundary">
        You send the payment separately; the condition checks that it was received.
      </p>
    {:else}
      <p class="example-intro">
        A condition can also be a calculation. Here, it checks whether a supplied number meets a
        minimum. Change either fixed argument and watch the answer change.
      </p>
      <div class="argument-scene">
        <div class="argument-controls">
          <label for={uid + "-supplied"}
            ><span>Supplied number <b>{supplied}</b></span><input
              id={uid + "-supplied"}
              type="range"
              min="0"
              max="20"
              step="1"
              bind:value={supplied}
            /></label
          >
          <label for={uid + "-minimum"}
            ><span>Minimum <b>{minimum}</b></span><input
              id={uid + "-minimum"}
              type="range"
              min="0"
              max="20"
              step="1"
              bind:value={minimum}
            /></label
          >
        </div>
        <div
          class="comparison"
          aria-label={supplied + " is " + (passes ? "at least " : "less than ") + minimum}
        >
          <span class="number">{supplied}</span><span class="operator">≥</span><span class="number"
            >{minimum}</span
          ><span class="answer" class:pass={passes}>{passes ? "true" : "false"}</span>
        </div>
        <div
          class="preview-controls"
          role="group"
          aria-label="Illustrative condition result"
          data-markdown-skip
        >
          <button
            type="button"
            aria-pressed={supplied === 12 && minimum === 10}
            onclick={() => preview(true)}>Preview pass</button
          >
          <button
            type="button"
            aria-pressed={supplied === 8 && minimum === 10}
            onclick={() => preview(false)}>Preview fail</button
          >
        </div>
      </div>
      <p class="boundary">
        These two numbers are the condition’s fixed arguments. They are not automatically taken from
        the connector’s generated stream. The custom-code exercise below uses this same check.
      </p>
    {/if}
    <div class="execution-flow" class:allowed={passes}>
      <div class="flow-step request">
        <span class="step-number">1</span>
        <p class="node-title">Request a run</p>
        <p class="node-detail">Someone asks for the connector’s output.</p>
      </div>
      <span class="flow-arrow" aria-hidden="true">→</span>
      <div class="flow-step check">
        <span class="step-number">2</span>
        <p class="node-title">Check the condition</p>
        <p class="predicate">
          {example === "financial" ? "paid == true" : supplied + " >= " + minimum}
        </p>
        <p class="node-detail">Read and evaluate. No payment or other state change.</p>
      </div>
      <span class="flow-arrow" aria-hidden="true">→</span>
      <div class="flow-step outcome">
        <span class="outcome-label">{passes ? "PASS" : "FAIL"}</span>
        <p class="node-title">{passes ? "Return output" : "Reject execution"}</p>
        <p class="node-detail">
          {passes
            ? "The requested execution can complete."
            : "This request does not return output."}
        </p>
      </div>
    </div>
    <p class="preview-status" role="status">
      {passes
        ? "Preview: the check passes, so this request returns output."
        : "Preview: the check fails, so this request is rejected."}
    </p>
  </div>
  <p class="local-note">
    This illustration changes only this page. It sends no payments or network requests.
  </p>
</figure>

<style>
  .conditions {
    --accent: #ffd899;
    --ink: #f8eddf;
    --muted: #d8c7bc;
    margin: 0;
    min-width: 0;
    padding: clamp(1rem, 3vw, 1.75rem);
    border: 1px solid #c1925750;
    border-radius: 1rem;
    background: linear-gradient(135deg, #352a31, #132d3b);
    color: var(--ink) !important;
  }
  .conditions.algorithmic {
    --accent: #b8fff2;
    background: linear-gradient(135deg, #1d3339, #272d45);
    border-color: #88d6d150;
  }
  .conditions :is(p, span, strong, b, label) {
    /* Keep every foreground readable on this dark illustration in either site theme. */
    color: var(--ink) !important;
  }
  .conditions .intro {
    margin: 0 0 1.2rem;
  }
  .conditions .intro > strong {
    display: block;
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    font-weight: 600;
    line-height: 1.25;
  }
  .conditions p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.75;
  }
  .conditions .example-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.2rem;
  }
  .conditions button {
    min-height: 44px;
    padding: 0.5rem 0.85rem;
    border: 1px solid #e2cdac65;
    border-radius: 2rem;
    background: transparent !important;
    color: var(--ink) !important;
    font: inherit;
    font-size: 0.8rem;
    line-height: 1.4;
    cursor: pointer;
  }
  .conditions button[aria-selected="true"],
  .conditions button[aria-pressed="true"] {
    background: var(--accent) !important;
    color: #24313a !important;
    border-color: var(--accent);
  }
  .conditions button:focus-visible,
  .conditions input:focus-visible {
    outline: 2px solid #b8fff2;
    outline-offset: 4px;
  }
  .conditions .example-intro {
    max-width: 70ch;
    margin-bottom: 1.25rem !important;
  }
  .conditions .payment-scene,
  .conditions .argument-scene {
    padding: clamp(0.85rem, 2.5vw, 1.4rem);
    border: 1px solid #e2cdac35;
    border-radius: 0.85rem;
    background: #0d20263f;
  }
  .conditions .transfer {
    display: grid;
    grid-template-columns: 1fr 1.3fr 1fr;
    align-items: center;
    gap: 0.6rem;
  }
  .conditions .address {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
  }
  .conditions .avatar {
    display: grid;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    border: 1px solid #e2cdac70;
    border-radius: 1rem;
    background: #e2cdac10;
    color: var(--accent) !important;
    font-size: 1.5rem;
    font-weight: 600;
  }
  .conditions .transfer-path {
    display: grid;
    justify-items: center;
    text-align: center;
  }
  .conditions .amount {
    color: var(--accent) !important;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .conditions .transfer-line {
    width: 100%;
    font-size: 2rem;
    line-height: 1.4;
    color: #acb6b5 !important;
  }
  .conditions .paid .transfer-line {
    color: #b8fff2 !important;
  }
  .conditions .transfer-state {
    font-size: 0.7rem;
    color: var(--muted) !important;
  }
  .conditions .receipt {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 1rem 0;
    margin-top: 1rem;
    border-top: 1px dashed #e2cdac45;
  }
  .conditions .receipt svg {
    flex: 0 0 30px;
    width: 30px;
    height: 35px;
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }
  .conditions .receipt div {
    flex: 1;
    min-width: 0;
  }
  .conditions .receipt strong,
  .conditions .receipt div span {
    display: block;
    font-size: 0.85rem;
  }
  .conditions .receipt div span {
    margin-top: 0.2rem;
    color: var(--muted) !important;
  }
  .conditions .receipt-mark {
    font-size: 1.7rem;
    color: var(--accent) !important;
  }
  .conditions .preview-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .conditions .boundary {
    margin: 0.85rem 0 1.5rem !important;
    font-size: 0.8rem !important;
    color: var(--muted) !important;
    max-width: 70ch;
  }
  .conditions .argument-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem;
  }
  .conditions label {
    display: grid;
    gap: 0.6rem;
    font-size: 0.8rem;
  }
  .conditions label span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .conditions label b {
    color: var(--accent) !important;
    font-size: 1.25rem;
  }
  .conditions input {
    width: 100%;
    min-width: 0;
    accent-color: var(--accent);
  }
  .conditions .comparison {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: clamp(0.75rem, 2vw, 1.5rem);
    padding: 1.25rem 0;
  }
  .conditions .number {
    font-size: 2rem;
    font-weight: 600;
    color: var(--accent) !important;
  }
  .conditions .operator {
    font-size: 1.5rem;
    color: var(--muted) !important;
  }
  .conditions .answer {
    padding: 0.35rem 0.7rem;
    border-radius: 0.5rem;
    background: #ffaaa915;
    color: #ffc2b5 !important;
    font-size: 0.9rem;
  }
  .conditions .answer.pass {
    background: #b8fff215;
    color: #b8fff2 !important;
  }
  .conditions .execution-flow {
    display: grid;
    grid-template-columns: 1fr auto 1.15fr auto 1fr;
    gap: 0.65rem;
    align-items: stretch;
  }
  .conditions .flow-step {
    min-width: 0;
    padding: 0.9rem;
    border: 1px solid #e2cdac40;
    border-radius: 0.75rem;
    background: #e2cdac07;
  }
  .conditions .step-number {
    display: inline-grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 1px solid #e2cdac65;
    margin-bottom: 0.55rem;
    font-size: 0.75rem;
    color: var(--accent) !important;
  }
  .conditions .node-title {
    color: var(--ink) !important;
    font-size: 0.9rem !important;
    font-weight: 600;
    line-height: 1.4 !important;
  }
  .conditions .node-detail {
    margin-top: 0.5rem !important;
    font-size: 0.75rem !important;
    color: var(--muted) !important;
    line-height: 1.6 !important;
  }
  .conditions .predicate {
    margin-top: 0.5rem !important;
    font-size: 0.9rem !important;
    color: var(--accent) !important;
    font-variant-numeric: tabular-nums;
  }
  .conditions .flow-arrow {
    align-self: center;
    color: var(--accent) !important;
    font-size: 1.3rem;
  }
  .conditions .outcome {
    border-color: #ffc2b560;
    background: #ffc2b50b;
  }
  .conditions .allowed .outcome {
    border-color: #b8fff260;
    background: #b8fff20b;
  }
  .conditions .outcome-label {
    display: block;
    margin-bottom: 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: #ffc2b5 !important;
  }
  .conditions .allowed .outcome-label {
    color: #b8fff2 !important;
  }
  .conditions .preview-status {
    margin-top: 1rem !important;
    color: var(--accent) !important;
    font-size: 0.8rem !important;
  }
  .conditions .local-note {
    margin-top: 0.9rem !important;
    color: var(--muted) !important;
    font-size: 0.75rem !important;
  }
  @media (max-width: 650px) {
    .conditions .execution-flow {
      grid-template-columns: 1fr;
      gap: 0.45rem;
    }
    .conditions .flow-arrow {
      justify-self: center;
      rotate: 90deg;
      line-height: 1;
    }
    .conditions .flow-step {
      padding: 0.85rem;
    }
    .conditions .step-number {
      float: left;
      margin-right: 0.65rem;
      margin-bottom: 0;
    }
    .conditions .node-detail,
    .conditions .predicate {
      clear: both;
    }
  }
  @media (max-width: 420px) {
    .conditions .transfer {
      grid-template-columns: 1fr 1.1fr 1fr;
      gap: 0.3rem;
    }
    .conditions .avatar {
      width: 2.75rem;
      height: 2.75rem;
    }
    .conditions .address {
      font-size: 0.65rem;
    }
    .conditions .amount {
      font-size: 0.8rem;
    }
    .conditions .argument-controls {
      grid-template-columns: 1fr;
      gap: 0.85rem;
    }
  }
</style>
