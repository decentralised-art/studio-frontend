<script lang="ts">
  import { resolve } from "$app/paths";
  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import AgentExercise from "./AgentExercise.svelte";
  import StudioGuidePreview from "./StudioGuidePreview.svelte";
  import * as samples from "./codeSamples";

  const { route }: { route: "studio" | "agent" | "api" | "sdk" } = $props();
  const prompt =
    "Use the decentralised.art tools to create a uniquely named local draft connector with two dimensions in this order: D1 references published pitch and uses published add with argument 2; D2 is a direct scalar with published add and argument 1, without a composite reference. Keep the root and dimensions at Start 0, Shift 0. Store the referenced pitch's static running instance at position 2, Start 60, Shift 0. Save one connector and simulate four values in one request. Show both output paths: /NAME:0/pitch:0 should contain 60, 62, 64, 66 and /NAME:1 should contain 0, 1, 2, 3. Replace NAME with the saved name. Explain how the two dimensions belong to one definition and how a World could interpret the second stream as times for the pitches in the first. This is not yet the MIDI World's complete format. Use my locally configured signing account for creation. Do not publish.";
</script>

{#if route === "studio"}
  <h3>Build both dimensions in Studio</h3>
  <p>
    Stay signed in with the account you used to save your earlier draft. The guide starts a new
    connector, shows how to change <strong>Dimensions</strong> to 2, and checks both returned streams.
    Saving and simulation need no test ETH.
  </p>
  <StudioGuidePreview lesson="dimensions" />
{:else if route === "agent"}
  <h3>Ask your agent to make a two-dimensional draft</h3>
  <p>Use the signing account configured for the earlier draft, then give your agent this prompt:</p>
  <AgentExercise {prompt} label="Copy multidimensional connector prompt" />
{:else if route === "api"}
  <h3>Create two dimensions with one API request</h3>
  <p>
    In the Bash terminal from <a href={resolve("/tutorial#create-draft")}>the draft exercise</a>,
    refresh <code>DCN_TOKEN</code> with the sign-in helper if needed. The <code>dimensions</code>
    array below contains both dimensions of one connector. The second has no <code>composite</code>;
    its rule produces values directly.
  </p>
  <CodeBlock
    code={samples.apiCreateDimensions}
    lang="bash"
    caption="Save one two-dimensional draft"
  />
  <p>After creation succeeds, simulate that saved name once:</p>
  <CodeBlock code={samples.apiSimulateDraft} lang="bash" caption="Generate both output streams" />
{:else}
  <h3>Create both dimensions in your code</h3>
  <p>
    Use your SDK project and the owner key from
    <a href={resolve("/tutorial#create-draft")}>the draft exercise</a>. If you cleared the key,
    enter it again at that exercise’s hidden prompt. Save this as
    <code>dimensions.mjs</code> or <code>dimensions.py</code>, then run
    <code>node dimensions.mjs</code> or <code>python dimensions.py</code>. The two array entries are
    saved in one definition; one simulation returns both streams.
  </p>
  <CodeBlock samples={samples.sdkDimensions} />
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
</style>
