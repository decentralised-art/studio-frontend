<script lang="ts">
  import { resolve } from "$app/paths";
  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import AgentExercise from "./AgentExercise.svelte";
  import StudioGuidePreview from "./StudioGuidePreview.svelte";
  import * as samples from "./customElementSamples";

  const { route }: { route: "studio" | "agent" | "api" | "sdk" } = $props();
  const customPrompt =
    "Read the decentralised.art documentation and inspect existing transformations and conditions before creating anything. For this tutorial exercise, create local elements under unique generated names: a transformation with Solidity function body `return (x + 1) % 4;` and a condition with body `return args[0] >= args[1];`. They require 0 and 2 arguments respectively. Make two local connectors referencing published pitch and the new transformation, fixing referenced pitch at Start 60, Shift 0 (static_ri position 2). Attach the new condition with fixed arguments [12,10] to one connector and [8,10] to the other. Simulate six values. The passing run should return 60,61,62,63,60,61; the other should reject the whole run because its condition fails. Report actual results and distinguish a failed condition from authentication or compilation errors. Keep all names and source snippets. Use my locally configured owner account; do not publish, send cryptocurrency or request my private key in chat.";
</script>

<p>
  Try a loop that chooses the first four values of <code>pitch</code>, then starts again. Add a
  threshold condition: it allows the run when the supplied value is at least 10. These are two
  reusable elements; the connector chooses their arguments and how to combine them.
</p>

<details class="source-details">
  <summary>The two Solidity snippets used in this exercise</summary>
  <p>
    The platform accepts a <strong>function body</strong> in <code>sol_src</code> and builds the contract
    around it. Paste the body, without a full contract, imports or Markdown fences.
  </p>
  <CodeBlock code={samples.cycleSource} lang="ts" caption="Transformation body · 0 arguments" />
  <p>
    <code>x</code> is the current unsigned 32-bit value. The remainder operator <code>%</code>
    makes 3 lead back to 0. Starting at 0, the selection indexes are 0, 1, 2, 3, 0, 1.
  </p>
  <CodeBlock code={samples.thresholdSource} lang="ts" caption="Condition body · 2 arguments" />
  <p>
    A condition receives signed 32-bit <code>args</code> and returns <code>true</code> or
    <code>false</code>. Using <code>args[1]</code> makes this condition require two arguments. Here they
    are fixed inputs from the connector: the supplied value and its minimum. This code does not read the
    generated notes, an account balance or a sensor.
  </p>
</details>

{#if route === "studio"}
  <h3>Create and try both elements in Studio</h3>
  <p>
    Sign in before opening a new draft. The guide uses the editable Solidity pane and the real
    <strong>Create locally</strong> controls. These saves need no Sepolia ETH.
  </p>
  <StudioGuidePreview lesson="custom-elements" />
  <details>
    <summary>Try the failing condition after the guided run</summary>
    <p>
      Saving a connector fixes its definition. To try different arguments, make a second connector
      and reuse the transformation and condition you just saved. Keep their generated names handy.
    </p>
    <ol>
      <li>Open a new connector tab and give its root a new, unique name.</li>
      <li>
        Add published <code>pitch</code> to the flow and connect the root’s D1 outlet to pitch’s inlet,
        just as in the guided exercise.
      </li>
      <li>
        In <strong>Local → Transformations</strong>, drag your saved loop onto the root’s D1 row.
        Select the root, find your threshold in <strong>Local → Conditions</strong>, and click
        <strong>Add to flow</strong>.
      </li>
      <li>
        In the root’s Inspector, set <strong>Condition arguments → Args</strong> to
        <code>8, 10</code>. Select referenced pitch, set <strong>Start</strong> to 60 and keep
        <strong>Shift</strong> at 0. Click its <strong>Open</strong> running-instance control to
        switch it to <strong>Static</strong>.
      </li>
      <li>
        In <strong>Run + Publish</strong>, set <strong>N</strong> to 6, click
        <strong>Create locally</strong>, then <strong>Simulate</strong>.
      </li>
    </ol>
    <p>
      This time the run should be rejected: 8 is below 10. A failed condition stops the whole run;
      it does not return a smaller set of notes. Your first saved connector still uses
      <code>12, 10</code>.
    </p>
  </details>
{:else if route === "agent"}
  <h3>Build and check the example with your agent</h3>
  <p>
    Use the MCP setup and locally configured owner account from your earlier draft exercise. Ask the
    agent to show you both the code and its actual test results.
  </p>
  <AgentExercise prompt={customPrompt} label="Copy custom-elements prompt" />
{:else if route === "api"}
  <h3>Create local elements with API calls</h3>
  <p>
    Use Bash and your owner’s <code>DCN_TOKEN</code> from the draft exercise. Sign in again if the Chain
    API token has expired. Keep the same terminal open for all three steps.
  </p>
  <CodeBlock
    code={samples.apiCreateElements}
    lang="bash"
    caption="1. Create the transformation and condition"
  />
  <p>
    Check that both requests succeed before continuing. Each returns its name and local address
    <code>0x0</code>. A compilation error means the element was not created; a name conflict needs a
    fresh name.
  </p>
  <CodeBlock
    code={samples.apiCreateAllowed}
    lang="bash"
    caption="2. Attach them to a connector and simulate six values"
  />
  <details>
    <summary>3. Create a second connector whose condition fails</summary>
    <p>
      The only change to the rule is its first condition argument: 8 instead of 12. The new name
      keeps the passing draft available.
    </p>
    <CodeBlock code={samples.apiCreateBlocked} lang="bash" caption="Compare 8 against 10" />
    <p>
      Creation should succeed; simulation should return an error because the condition is not met.
      An authentication or missing-element error is a setup problem, not a successful test of the
      condition.
    </p>
  </details>
{:else}
  <h3>Create and test the elements in your code</h3>
  <p>
    In your SDK project, save this as <code>custom-elements.mjs</code> or
    <code>custom-elements.py</code>. Use the owner key already configured locally in
    <code>DCN_OWNER_KEY</code>. Run <code>node custom-elements.mjs</code> or
    <code>python custom-elements.py</code>. The script saves local drafts and simulates them; it
    sends no blockchain transaction.
  </p>
  <CodeBlock samples={samples.sdkCustomElements} />
{/if}

<p class="check">
  <strong>Check your result:</strong> with <code>12, 10</code>, the pitch stream should contain
  <code>60, 61, 62, 63, 60, 61</code>. The condition checks the fixed arguments before the connector
  produces its values. The transformation then repeats indexes 0–3, selecting those values from
  pitch’s stream beginning at 60.
</p>

<details>
  <summary>Keep the experiment, or make it reusable on the network</summary>
  <p>
    Keep the source snippets alongside your saved names. Inspection endpoints return argument counts
    and runtime bytecode when available; they do not return Solidity source.
  </p>
  <p>
    You have created local simulation elements. To make the connector available on the blockchain,
    publish its custom transformation and condition before publishing the connector that refers to
    them. Follow the <a href={resolve("/tutorial#publish")}>publication exercise</a> for each
    element, using the appropriate kind (<code>transformation</code>, <code>condition</code>, then
    <code>connector</code>). Each publication is a separate transaction with gas fees.
  </p>
  <p>
    For the complete function signatures and request fields, see
    <a href={resolve("/sdk#concepts")}>SDK concepts</a> and
    <a href={resolve("/api-reference")}>the API reference</a>.
  </p>
</details>

<style>
  h3 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.5;
  }
  p {
    margin: 0;
    max-width: 70ch;
    line-height: 1.8;
    color: var(--text-secondary);
  }
  code {
    font-size: 0.88em;
    color: var(--text-primary);
  }
  details {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.1rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--color-accent) 4%, transparent);
  }
  details > :not(summary) {
    margin-top: 1rem;
  }
  summary {
    cursor: pointer;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.6;
  }
  .check {
    padding-left: 1rem;
    border-left: 2px solid var(--color-accent);
  }
  ol {
    padding-left: 1.4rem;
    color: var(--text-secondary);
    line-height: 1.8;
  }
  li + li {
    margin-top: 0.65rem;
  }
  a {
    color: var(--color-accent);
    text-underline-offset: 0.2em;
  }
</style>
