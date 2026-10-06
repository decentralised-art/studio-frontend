<script lang="ts">
  let model = $state<"open" | "payment">("open");
</script>

<figure
  class="economy-artboard"
  aria-label="Connector creators choose conditions; World creators choose which outputs to use"
>
  <figcaption>
    <span class="eyeline">The connector creator’s choice</span>
    <strong>Share it openly, or give it a condition.</strong>
    <p>Explore two ways a connector creator can make the same values available.</p>
  </figcaption>
  <div class="choices" role="group" aria-label="Explore a connector creator’s choice">
    <button type="button" aria-pressed={model === "open"} onclick={() => (model = "open")}
      >Open to everyone</button
    >
    <button type="button" aria-pressed={model === "payment"} onclick={() => (model = "payment")}
      >Require a recorded payment</button
    >
  </div>
  <div class="economy-flow">
    <div class="person">
      <span aria-hidden="true">✳</span><strong>Someone requests a run</strong>
      <p>A person, World or agent</p>
    </div>
    <span class="arrow" aria-hidden="true">→</span>
    <div class="material">
      <span class="material-label">The connector creator sets the rule</span>
      <strong>{model === "open" ? "No condition" : "Did address A pay address B?"}</strong>
      <p>
        {model === "open"
          ? "Anyone can request its values."
          : "A custom condition checks a recorded receipt for the required payment."}
      </p>
      <div class="values" aria-label="Example values">60 <span>62</span> 64 <span>66</span></div>
    </div>
    <span class="arrow" aria-hidden="true">→</span>
    <div class="work">
      <span aria-hidden="true">◈</span><strong>A World uses the returned values</strong>
      <p>
        Its creator chooses the connectors and formats it supports, and how to show, play or use
        their values.
      </p>
    </div>
  </div>
  <p class="fee-note" role="status">
    {model === "open"
      ? "Reading or simulating the connector needs no blockchain gas fee. Publishing it requires gas."
      : "The payment is a separate transaction: its sender pays the required amount and gas. Checking its receipt through the read API needs no blockchain gas fee. Publishing the connector also requires gas."}
  </p>
  <p class="boundary">
    {model === "open"
      ? "This connector has no condition. If it uses another connector, that connector’s conditions still apply."
      : "This example checks a fixed A-to-B payment. Once it is recorded, anyone can run the connector. A custom payment contract must record the receipt; an ordinary transfer is not automatically recognised."}
  </p>
</figure>

<style>
  .economy-artboard {
    display: grid;
    gap: 1.4rem;
    margin: 0;
    padding: clamp(1rem, 3vw, 1.8rem);
    border: 1px solid #7c6e95;
    border-radius: 1.2rem;
    color: #f5edf9 !important;
    background: radial-gradient(ellipse at 0% 0%, #493e65, transparent 70%), #242c3d;
    min-width: 0;
  }
  figcaption {
    display: grid;
    gap: 0.6rem;
  }
  .eyeline {
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    color: #cdc4dc !important;
  }
  .economy-artboard .material-label {
    color: #d0badc !important;
  }
  figcaption > strong {
    font-size: clamp(1.2rem, 3vw, 1.6rem);
    line-height: 1.4;
  }
  strong {
    color: #f5edf9 !important;
  }
  .economy-artboard p {
    margin: 0;
    color: #cdc4dc !important;
    font-size: 0.85rem;
    line-height: 1.8;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  button {
    font: inherit;
    font-size: 0.8rem;
    padding: 0.6rem 0.85rem;
    border: 1px solid #ac8bcc;
    border-radius: 0.5rem;
    color: #f5edf9 !important;
    background: transparent !important;
    cursor: pointer;
  }
  button[aria-pressed="true"] {
    background: #d4b1e9 !important;
    color: #292339 !important;
  }
  button:focus-visible {
    outline: 2px solid #ffcd7c;
    outline-offset: 4px;
  }
  .economy-flow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.4fr) auto minmax(0, 1fr);
    gap: 0.7rem;
    align-items: center;
    padding-block: 0.8rem;
  }
  .person,
  .work {
    display: grid;
    gap: 0.5rem;
    text-align: center;
    font-size: 0.8rem;
  }
  .person > span,
  .work > span {
    display: grid;
    place-items: center;
    margin: 0 auto 0.5rem;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: #ac8bcc28;
    font-size: 1.8rem;
    color: #f6ce8a;
  }
  .person p,
  .work p {
    font-size: 0.75rem;
  }
  .arrow {
    color: #ccafdb;
    font-size: 1.5rem;
  }
  .material {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid #ad8cc4;
    border-radius: 0.8rem;
    background: #c39dd014;
    font-size: 0.85rem;
  }
  .material-label {
    color: #d0badc;
    font-size: 0.7rem;
  }
  .material p {
    font-size: 0.75rem;
  }
  .values {
    display: flex;
    justify-content: space-around;
    gap: 0.35rem;
    padding: 0.7rem 0.2rem;
    font-variant-numeric: tabular-nums;
    font-size: 1.05rem;
    color: #f6ce8a;
    border-block: 1px solid #ad8cc450;
  }
  .values span {
    color: #d7b5eb;
  }
  .fee-note {
    padding-left: 0.8rem;
    border-left: 2px solid #f6ce8a;
  }
  .economy-artboard .boundary {
    font-size: 0.75rem;
  }
  @media (max-width: 650px) {
    .economy-flow {
      grid-template-columns: 1fr;
      justify-items: center;
      gap: 0.85rem;
    }
    .arrow {
      transform: rotate(90deg);
    }
    .material {
      width: 100%;
      box-sizing: border-box;
    }
    .person,
    .work {
      max-width: 28ch;
    }
  }
</style>
