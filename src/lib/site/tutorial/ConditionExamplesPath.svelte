<script lang="ts">
  import { resolve } from "$app/paths";
  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import AgentExercise from "./AgentExercise.svelte";
  import StudioGuidePreview from "./StudioGuidePreview.svelte";
  import TutorialApiConsole from "./TutorialApiConsole.svelte";
  import * as samples from "./conditionExampleSamples";

  const { route }: { route: "studio" | "agent" | "api" | "sdk" } = $props();
  const prompt =
    "Read the published conditions tutorial_threshold_v1 and tutorial_divisible_v1, then inspect these four published connectors: tutorial_threshold_pass_v1, tutorial_threshold_fail_v1, tutorial_divisible_pass_v1, tutorial_divisible_fail_v1. Explain each connector’s fixed condition arguments. Execute four values from each using public reads; no sign-in or wallet is needed. Both passing examples should return the pitch stream 60,62,64,66 and an execution block. The threshold compares [12,10] versus [8,10]; divisibility compares [12,3] versus [14,3]. Show actual results and error bodies. Verify that a blocked run failed because its condition was not met, rather than a missing connector, network problem or other error. Do not create, publish or send a transaction.";
</script>

<p>
  Try two published conditions on the same selection you used earlier: every second pitch value,
  beginning at 60. Each pair changes only the condition’s fixed arguments. You can run these
  examples without signing in.
</p>

{#if route === "studio"}
  <h3>See a real condition in Studio</h3>
  <StudioGuidePreview lesson="conditions" connector="tutorial_threshold_pass_v1" />
  <div class="example-pairs">
    {#each samples.examples as example (example.condition)}
      <div class="example-pair">
        <h4>{example.label}</h4>
        <p>{example.explanation}</p>
        <a
          href={resolve(`/studio?network_kind=connector&network_id=${example.pass}`)}
          target="_blank"
          rel="noopener noreferrer">Open {example.passLabel} ↗</a
        >
        <a
          href={resolve(`/studio?network_kind=connector&network_id=${example.fail}`)}
          target="_blank"
          rel="noopener noreferrer">Open {example.failLabel} ↗</a
        >
      </div>
    {/each}
  </div>
  <p>
    In either example, select the root connector and open <strong>Inspector → Node</strong> to see
    <strong>Condition arguments</strong>. In <strong>Run + Publish</strong>, set
    <strong>N</strong> to 4 and click <strong>Execute on the Network</strong>. The saved arguments
    stay fixed when you run it.
  </p>
{:else if route === "agent"}
  <h3>Ask your agent to compare both outcomes</h3>
  <AgentExercise {prompt} label="Copy published-conditions prompt" />
{:else if route === "api"}
  <h3>Try the allowed and blocked requests here</h3>
  <p>
    Choose a threshold or divisibility request, then click <strong>Run request</strong>. These are
    public reads of the actual published connectors; they create no transaction and need no token.
  </p>
  <TutorialApiConsole lesson="condition-examples" />
  <details>
    <summary>Run the same comparisons in your terminal</summary>
    <CodeBlock code={samples.apiThreshold} lang="bash" caption="Threshold · 12 ≥ 10 and 8 < 10" />
    <CodeBlock code={samples.apiDivisible} lang="bash" caption="Divisibility · 12 ÷ 3 and 14 ÷ 3" />
    <p>
      The blocked requests intentionally return a non-success HTTP status, so curl reports an error.
      Read the response body to check that the condition caused the refusal.
    </p>
  </details>
{:else}
  <h3>Compare the published examples in your code</h3>
  <p>
    Save this in your SDK project as <code>condition-examples.mjs</code> or
    <code>condition-examples.py</code>. Run <code>node condition-examples.mjs</code> or
    <code>python condition-examples.py</code>. No owner key or login is needed.
  </p>
  <CodeBlock samples={samples.sdkConditions} />
  <p>
    The script prints each connector’s fixed arguments and checks the passing values. For blocked
    requests it prints the API’s actual error; read its reason before treating it as a successful
    condition test.
  </p>
{/if}

<p class="check">
  <strong>Look for:</strong> <code>60, 62, 64, 66</code> when 12 meets the minimum of 10, or when 12
  divides by 3 exactly. With 8 below 10, or 14 not divisible by 3, the condition should reject the
  whole run. Its response says <strong>Execution rejected: Condition not met</strong>. An
  unavailable server or missing connector is a different problem.
</p>

<details>
  <summary>See the rules and inspect their published definitions</summary>
  <p>The creator supplied these Solidity function bodies for the two examples:</p>
  <CodeBlock code={samples.thresholdSource} lang="ts" caption={samples.thresholdName} />
  <CodeBlock code={samples.divisibleSource} lang="ts" caption={samples.divisibleName} />
  <p>
    Both take two signed integer arguments. The divisibility rule rejects zero or negative divisors.
    Their published definitions report <code>args_count: 2</code> and an on-chain address. Inspection
    does not return Solidity source; keep source with your own creations.
  </p>
  <CodeBlock code={samples.apiDefinitions} lang="bash" caption="Read both condition definitions" />
</details>

<style>
  h3,
  h4 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.5;
  }
  h4 {
    font-size: 0.92rem;
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
  .example-pairs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  .example-pair {
    display: grid;
    gap: 0.65rem;
    padding: 1rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--color-accent) 5%, transparent);
  }
  .example-pair p {
    font-size: 0.86rem;
  }
  .example-pair a {
    font-size: 0.86rem;
  }
  details {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
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
  a {
    color: var(--color-accent);
    text-underline-offset: 0.2em;
  }
  @media (max-width: 640px) {
    .example-pairs {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
