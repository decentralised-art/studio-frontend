<script lang="ts">
  import { resolve } from "$app/paths";
  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import AgentExercise from "./AgentExercise.svelte";
  import StudioGuidePreview from "./StudioGuidePreview.svelte";
  import TutorialApiConsole from "./TutorialApiConsole.svelte";
  import * as samples from "./codeSamples";

  const {
    route,
    lesson,
  }: {
    route: "studio" | "agent" | "api" | "sdk";
    lesson: "formats" | "publish" | "world" | "conditions";
  } = $props();
  const formatPrompt =
    "Inspect published pitch and its format information using the decentralised.art tools. Show its terminal scalar labels. Compare them with the MIDI Clip World’s requirements in the platform documentation: pitch, time, duration and velocity. Explain why our pitch-only selection is insufficient, and identify the missing streams before proposing changes. Do not create or publish anything.";
  const publishPrompt =
    "Help me publish the tutorial draft whose name I give you. First read its saved definition, owner and dependencies, simulate four values and show me the result. Use Sepolia (chain ID 11155111) and propose a fee limit. Wait for my approval before signing or sending. Keep the transaction hash; if confirmation is interrupted, check that same transaction rather than sending again. After confirmation, execute four values when the execution block includes the publication. Show the values, block number, block hash and published address.";
  const worldPrompt =
    "Read https://decentralised.art/sdk#worlds and its World-hosting instructions. Help me make a local prototype using the tutorial draft name I supply. Simulate four values and draw four circles, interpreting each pitch value as a diameter in pixels (0–127). Show the actual returned numbers beside the circles. Once the prototype works, propose a hosted World bundle and manifest accepting the pitch scalar, using the World runtime and its current supported permissions. Do not upload or publish yet; do not put keys or tokens in the bundle.";
  const conditionPrompt =
    "Inspect published pitch’s condition_name and condition_args. List up to five published conditions and read their argument counts if available. Explain how fixed arguments and the conditions of referenced connectors affect a run. An empty condition list is a valid result; don’t invent a condition. Compare the algorithmic check args[0] >= args[1] with a custom financial check that reads a recorded payment from public address A to B. Explain why the financial check needs a separate payment receipt contract and why evaluating a condition does not transfer money or start a run. Do not create or publish anything in this inspection step.";
</script>

{#if lesson === "formats"}
  {#if route === "studio"}
    <h3>Inspect what your connector supplies</h3>
    <StudioGuidePreview lesson="formats" />
    <p>
      Want to see a complete contribution in action? Open the <a href={resolve("/worlds/midi-clip")}
        >MIDI World</a
      >.
    </p>
    <ol class="short-steps">
      <li>
        Choose an available name under <strong>Compatible Connectors</strong> and click
        <strong>Load connector in world</strong> (the arrow).
      </li>
      <li>Open <strong>Runtime settings</strong>, then click <strong>Render settings</strong>.</li>
      <li>
        Look for notes in the piano roll. Loading selects the contribution; rendering runs it. An
        empty feed means there is nothing to try yet.
      </li>
    </ol>
  {:else if route === "agent"}
    <h3>Ask your agent to check compatibility</h3>
    <AgentExercise prompt={formatPrompt} label="Copy compatibility prompt" />
    <p class="check">
      <strong>Look for:</strong> pitch alone, with time, duration and velocity identified as missing.
      Ask the agent to explain a World’s units before it builds a new contribution.
    </p>
  {:else if route === "api"}
    <h3>Read the format with API calls</h3>
    <p>
      Run <strong>Inspect pitch</strong> and find <code>format_hash</code>. It identifies the stream
      labels at the ends of the reference tree. <strong>List known formats</strong> lets you browse other
      shapes of output.
    </p>
    <TutorialApiConsole lesson="formats" />
    <details>
      <summary>Read pitch’s exact format in your terminal</summary>
      <p>In Bash, with Python 3 available to extract the hash:</p>
      <CodeBlock code={samples.apiFormat} lang="bash" caption="Read the scalar labels" />
      <p>
        Look for <code>pitch:0</code> in <code>scalars</code>. A one-property format supplies no
        time, duration or velocity streams.
      </p>
    </details>
  {:else}
    <h3>Read the format in your code</h3>
    <p>
      Save this as <code>format.mjs</code> or <code>format.py</code> in your SDK project. Run
      <code>node format.mjs</code>
      or <code>python format.py</code>. No sign-in is needed.
    </p>
    <CodeBlock samples={samples.sdkFormat} />
    <p class="check">
      <strong>Look for:</strong> <code>pitch:0</code> in the scalar labels. The other printed names share
      that format; the list doesn’t tell you how a World interprets their values.
    </p>
  {/if}
{:else if lesson === "publish"}
  {#if route === "studio"}
    <h3>Publish with your wallet</h3>
    <StudioGuidePreview lesson="publish" />
  {:else if route === "agent"}
    <h3>Review the publication with your agent</h3>
    <p>
      Give the agent your saved draft’s name. Use its locally configured owner account, funded with
      Sepolia test ETH.
    </p>
    <AgentExercise prompt={publishPrompt} label="Copy publication prompt" />
  {:else if route === "api"}
    <h3>Prepare, sign, send, then check</h3>
    <p>
      Use the same Bash terminal and draft name. Sign in again with the owner if your Chain API
      token has expired. This request prepares a transaction; it does not send one.
    </p>
    <CodeBlock code={samples.apiPrepare} lang="bash" caption="1. Prepare your saved draft" />
    <p>
      Check <code>status</code>. <code>prepared</code> includes the transaction,
      <code>content_hash</code>
      and signing fields. <code>published</code> means this definition is already registered.
    </p>
    <details>
      <summary>2. Sign, send and confirm in your terminal</summary>
      <p>
        Continue only after preparation succeeds with <code>prepared</code>. Run
        <code>export DCN_DRAFT</code> so the Python helper can check the name. Use the Python environment
        and owner key from the earlier sign-in helper. Fund that owner with Sepolia test ETH.
      </p>
      <p>
        <strong>Sign locally.</strong> Read <code>publication-prepared.json</code> first: check the owner,
        destination, gas and fees. This helper refuses another chain, an expired preparation or a fee
        price above 50 gwei. It signs without sending.
      </p>
      <CodeBlock code={samples.apiSign} lang="bash" caption="Sign the prepared transaction" />
      <p>
        <strong>Send when ready.</strong> This command broadcasts the signed publication and spends
        gas. Keep <code>publication-sent.json</code> and its <code>tx_hash</code>.
      </p>
      <CodeBlock code={samples.apiSend} lang="bash" caption="Send the publication" />
      <p>
        <strong>Confirm that transaction.</strong> A <code>pending</code> result needs another
        confirmation with the same file; <code>mined</code> means publication completed. Refresh an expired
        token without sending another transaction.
      </p>
      <CodeBlock code={samples.apiConfirm} lang="bash" caption="Check the existing transaction" />
      <p>
        If sending fails or is interrupted, check the error and transaction status before sending
        again. See the <a href={resolve("/api-reference#chain-publish")}
          >publication API reference</a
        >
        for recovery. When finished, run <code>unset DCN_OWNER_KEY DCN_TOKEN</code>.
      </p>
    </details>
    <details>
      <summary>3. Read the published result</summary>
      <p>
        Once confirmation reports <code>mined</code> and the execution block has caught up, use this public
        request. Compare its values with your simulation.
      </p>
      <CodeBlock code={samples.apiExecuteDraft} lang="bash" caption="Execute four values" />
    </details>
  {:else}
    <h3>Publish your saved name from code</h3>
    <p>
      In Bash, set <code>export DCN_DRAFT='your_saved_name'</code>. Use the owner’s key at the
      earlier hidden prompt and fund that account with Sepolia test ETH. Save the script as
      <code>publish.mjs</code>
      or <code>publish.py</code>, then run <code>node publish.mjs</code> or
      <code>python publish.py</code> when you choose to publish.
    </p>
    <CodeBlock samples={samples.sdkPublish} />
    <p>
      The example refuses another chain or a fee price above 50 gwei. That is a ceiling for this
      example, not an estimate of your total fee. Its pitch and add dependencies are already
      published.
    </p>
  {/if}
  <p class="check">
    <strong>Finished means:</strong> a published address and a successful network read with the same four
    values. Keep the transaction hash and the execution block number and hash.
  </p>
  <details>
    <summary>If publication or the next run is still pending</summary>
    <p>
      A pending transaction is not a failed publication. Confirm the same transaction again. If it
      is mined but execution cannot find your connector, wait for the API’s execution block to catch
      up, then retry the read. Discovery feeds can lag too. Do not publish a second time to fix this
      delay.
    </p>
  </details>
{:else if lesson === "world"}
  {#if route === "studio"}
    <h3>Use Studio to make the World’s material</h3>
    <p>
      Studio builds connectors; the World’s own interface involves code. Use your two draft outputs
      as a brief: one value should make one circle, and the value should be its diameter in pixels.
    </p>
    <ol class="short-steps">
      <li>Open each saved draft’s tab and <strong>Simulate</strong> with <strong>N 4</strong>.</li>
      <li>
        Compare the returned values with the circle preview above. Your add 12 selection should
        produce more visibly different sizes.
      </li>
      <li>
        Give those names and this interpretation to a developer or your agent. Switch to the SDK tab
        here to make a working local prototype.
      </li>
    </ol>
  {:else if route === "agent"}
    <h3>Make a small prototype with your agent</h3>
    <AgentExercise prompt={worldPrompt} label="Copy World prototype prompt" />
    <p class="check">
      <strong>Look for:</strong> four circles drawn from the actual simulation result. With your second
      draft, the diameters should be 60, 72, 84 and 96 pixels.
    </p>
  {:else if route === "api"}
    <h3>Turn an API result into a picture</h3>
    <p>
      In your Bash terminal, keep <code>DCN_DRAFT</code> set to a saved draft’s name. This public simulation
      needs no token. Python 3 draws its returned values into a local HTML file.
    </p>
    <CodeBlock code={samples.apiRender} lang="bash" caption="Make my-world.html from real output" />
    <p class="check">
      <strong>Open <code>my-world.html</code> in a browser:</strong> you should see four circles. Repeat
      with your other saved name to change the picture. This file is a local prototype; it has not been
      uploaded as a hosted World.
    </p>
  {:else}
    <h3>Make a working local prototype</h3>
    <p>
      In Bash, set <code>export DCN_DRAFT='your_saved_name'</code>. Save this as
      <code>world-preview.mjs</code>
      or <code>world-preview.py</code> in your SDK project. It needs no signing key.
    </p>
    <CodeBlock samples={samples.sdkRender} />
    <CodeBlock samples={samples.sdkRunRender} />
    <p class="check">
      <strong>Open <code>my-world.html</code> in a browser:</strong> it should contain four circles whose
      diameters match the simulated values. Run it with your other draft’s name and compare.
    </p>
    <details>
      <summary>Turn the prototype into a hosted World</summary>
      <p>
        Move the drawing logic into a page that subscribes to the World runtime’s <code
          >onState</code
        >
        and reads <code>state.payload.executeOutput</code>. Add a manifest naming the pitch scalar
        and the required permissions, then package and validate the bundle using
        <a href={resolve("/sdk#worlds")}>Building a World</a>. Use
        <a href={resolve("/worlds/upload")}>Upload a World</a> when the bundle is ready.
      </p>
    </details>
  {/if}
{:else if route === "studio"}
  <h3>Find where a condition belongs</h3>
  <StudioGuidePreview lesson="conditions" />
{:else if route === "agent"}
  <h3>Inspect the available checks with your agent</h3>
  <AgentExercise prompt={conditionPrompt} label="Copy condition inspection prompt" />
{:else if route === "api"}
  <h3>Inspect the checks with API calls</h3>
  <p>
    Run <strong>Check pitch’s condition</strong>. An empty <code>condition_name</code> means no
    attached check. Then try <strong>Find published conditions</strong>; an empty <code>items</code> list
    is a valid result.
  </p>
  <TutorialApiConsole lesson="conditions" />
  <p>
    For a returned name, read <code>GET /condition/NAME</code> to see <code>args_count</code>. The
    <a href={resolve("/api-reference#chain-conditions")}>condition API reference</a> describes creating
    a check and supplying fixed arguments.
  </p>
{:else}
  <h3>Inspect conditions in your code</h3>
  <p>
    Save this as <code>conditions.mjs</code> or <code>conditions.py</code>, then run
    <code>node conditions.mjs</code>
    or <code>python conditions.py</code>. It reads public definitions and creates nothing.
  </p>
  <CodeBlock samples={samples.sdkConditions} />
  <p class="check">
    <strong>Look for:</strong> pitch’s attached condition reported as none. The feed may return no conditions;
    otherwise the script prints each available check’s argument count.
  </p>
{/if}

<style>
  h3 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.4;
  }
  p {
    margin: 0;
    max-width: 70ch;
    line-height: 1.8;
  }
  .short-steps {
    margin: 0;
    padding-left: 1.4rem;
    display: grid;
    gap: 0.8rem;
    max-width: 67ch;
  }
  .check {
    padding-left: 1rem;
    border-left: 2px solid var(--color-accent);
  }
  details {
    min-width: 0;
    border-block: 1px solid var(--border-subtle);
    padding-block: 0.8rem;
    display: grid;
    gap: 1rem;
  }
  details:not([open]) {
    display: block;
  }
  summary {
    color: var(--text-secondary);
    cursor: pointer;
    font-weight: 500;
  }
  details p {
    margin-block: 1rem;
  }
</style>
