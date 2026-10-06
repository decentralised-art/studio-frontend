<script lang="ts">
  import { resolve } from "$app/paths";

  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import TutorialApiConsole from "$lib/site/tutorial/TutorialApiConsole.svelte";
  import * as samples from "$lib/site/tutorial/codeSamples";

  const {
    route,
    lesson,
  }: {
    route: "api" | "sdk";
    lesson: "first-run" | "starting-value" | "draft";
  } = $props();
</script>

{#if route === "api" && lesson === "first-run"}
  <h3>Run four values with API calls</h3>
  <p>
    An <strong>API</strong> is a way to ask the platform to do something by sending a request. Try
    it here: choose <strong>Inspect pitch</strong>, then <strong>Run request</strong>. Its
    definition includes add with argument 1. Next, choose <strong>Run four values</strong> and run that
    request too.
  </p>
  <p>
    This console sends only the public requests in this exercise. No account, wallet or transaction
    fee is needed. It shows the actual API response when you run a request.
  </p>
  <TutorialApiConsole lesson="first-run" />
  <p class="code-checkpoint">
    Look for <strong>0, 1, 2, 3</strong> in <code>particles</code>, at path <code>/pitch:0</code>.
    The response’s <code>block_number</code> and <code>block_hash</code> identify the blockchain snapshot
    used for this run.
  </p>
  <details class="terminal-details">
    <summary>Run the same requests in your own terminal</summary>
    <div class="terminal-steps">
      <p>
        Use Bash on macOS, Linux or Windows with WSL. Type <code>bash</code> to open that shell.
        You’ll need <code>curl</code> version 7.76 or newer; check with <code>curl --version</code>.
        Paste each block below, then press Enter. Keep this terminal open for the later exercises.
      </p>
      <CodeBlock code={samples.apiRead} lang="bash" caption="1. Read pitch" />
      <CodeBlock code={samples.apiFirstRun} lang="bash" caption="2. Generate four values" />
      <p>
        <code>DCN_API</code> stores the API’s address. The second command sends a JSON message:
        <code>connector_name</code> chooses pitch, <code>particles_count</code> asks for four
        values, and <code>dynamic_ri</code> sets the run’s Start and Shift. Position
        <code>"0"</code>
        means the root connector you’re running. The <code>--fail-with-body</code> option reports an
        unsuccessful request while keeping the API’s error message visible.
        <a href={resolve("/api-reference#chain-run")}>See the execution API reference</a>.
      </p>
    </div>
  </details>
{:else if route === "api" && lesson === "starting-value"}
  <h3>Change Start with an API call</h3>
  <p>
    Run <strong>Start at 10</strong> below. Then choose <strong>Compare with Start 0</strong>
    and run again. Look for 10, 11, 12, 13 in the first result and 0, 1, 2, 3 in the second. Only
    <code>start_point</code> changes; pitch still adds 1.
  </p>
  <TutorialApiConsole lesson="starting-value" />
  <details class="terminal-details">
    <summary>Run this in your own terminal</summary>
    <div class="terminal-steps">
      <p>In the same Bash terminal, send the request with <code>start_point</code> set to 10:</p>
      <CodeBlock code={samples.apiStartingValue} lang="bash" caption="Start 10, Shift 0" />
    </div>
  </details>
{:else if route === "sdk" && lesson === "first-run"}
  <h3>Run four values with the SDK</h3>
  <p>
    The <strong>SDK (software development kit)</strong> gives your code functions for calling the platform’s
    API. Choose JavaScript or Python below. This first script reads pitch and runs it; no account, wallet
    or transaction fee is needed.
  </p>
  <p>
    <strong>1. Install.</strong> Use Node.js 18 or newer for JavaScript, or Python 3.9 or newer. Open
    a Bash terminal on macOS, Linux or Windows with WSL, in a new project folder, and run the installation
    command for your language. The Python commands also create and activate an environment for this project.
  </p>
  <CodeBlock samples={samples.sdkInstall} />
  <p>
    <strong>2. Save the script.</strong> Copy the code into <code>first-run.mjs</code> for
    JavaScript or <code>first-run.py</code> for Python, in that same folder.
  </p>
  <CodeBlock samples={samples.sdkFirstRun} />
  <p><strong>3. Run it.</strong> In the same terminal:</p>
  <CodeBlock samples={samples.sdkRunFirst} />
  <p class="code-checkpoint">
    Look for <code>/pitch:0</code> with <strong>0, 1, 2, 3</strong>, followed by the execution block
    number. If the package can’t be found, check that you installed it in this folder and, for
    Python, that the environment is still active.
  </p>
{:else if route === "sdk" && lesson === "starting-value"}
  <h3>Change Start in your code</h3>
  <p>
    Replace your <code>first-run.mjs</code> or <code>first-run.py</code> script with this version,
    then run it again. It runs pitch twice, with Start 0 and then Start 10. Position
    <code>"0"</code> in the settings means the root connector you’re running.
  </p>
  <CodeBlock samples={samples.sdkStartingValue} />
  <CodeBlock samples={samples.sdkRunFirst} />
  <p class="code-checkpoint">
    Compare <strong>0, 1, 2, 3</strong> with <strong>10, 11, 12, 13</strong>. Only
    <code>start_point</code> changes; pitch still adds 1.
  </p>
{:else if route === "api" && lesson === "draft"}
  <h3>Build the relationship with API calls</h3>
  <p>
    This step uses your own terminal, where you can sign in with the draft’s owner account. Open a
    terminal and type <code>bash</code> to begin.
  </p>
  <p>
    Draft creation needs a <strong>Chain API access token</strong>: proof that you’ve signed in with
    the account that will own the draft. Get one using the helper below, or follow the
    <a href={resolve("/api-reference#authentication")}>API authentication guide</a> if you already
    have a wallet-signing flow. Store the returned <code>access_token</code> in the Bash variable
    <code>DCN_TOKEN</code>. A services sign-in token won’t work here.
  </p>
  <details class="terminal-details">
    <summary>Get a Chain API token in the terminal</summary>
    <div class="terminal-steps">
      <p>
        This helper uses the Python SDK to sign in; the exercise requests still use curl. You need
        Python 3.9 or newer and the private key of the test account you want to use. In your Bash
        terminal, install the helper’s package:
      </p>
      <CodeBlock code={samples.apiTokenInstall} lang="bash" caption="Install the sign-in helper" />
      <p>
        Run the following block, then enter your test account’s private key at the hidden prompt.
        Enter it as the prompt’s answer, rather than pasting it into a command or chat. The key
        stays on your computer and signs a message; it isn’t sent to the API.
      </p>
      <CodeBlock code={samples.signingAccount} lang="bash" caption="Choose the signing account" />
      <CodeBlock code={samples.apiToken} lang="bash" caption="Sign in and keep the token locally" />
    </div>
  </details>
  <p>
    <strong>1. Create the draft.</strong> Run this in the same Bash terminal. It gives your draft a
    new name, references pitch, and fixes the referenced stream at Start 60, Shift 0. In
    <code>static_ri</code>, position <code>"2"</code> is that referenced pitch stream: the root is 0 and
    its selecting dimension is 1.
  </p>
  <CodeBlock code={samples.apiCreateDraft} lang="bash" caption="Save your selection" />
  <p>
    Check that the response includes your new <code>name</code> and <code>address: "0x0"</code>.
    That address means the draft is saved but unpublished. If you get <code>401</code>, sign in
    again: the Chain API token lasts five minutes. Don’t continue to simulation until creation
    succeeds.
  </p>
  <p><strong>2. Simulate it.</strong> This request needs no token:</p>
  <CodeBlock code={samples.apiSimulateDraft} lang="bash" caption="Test the saved draft" />
  <p>
    Simulation returns a list of streams, with <code>path</code> and <code>data</code>, rather than
    the execution response’s <code>particles</code> wrapper and block information. When you’ve
    finished with the account, run <code>unset DCN_OWNER_KEY DCN_TOKEN</code>.
  </p>
{:else if route === "sdk" && lesson === "draft"}
  <h3>Build the relationship in your code</h3>
  <p>
    This script signs in, creates a uniquely named draft and simulates it. Use the private key of
    the test account you want to own the draft. It signs a message locally; the key isn’t sent to
    the API. No test ETH is needed for this step.
  </p>
  <p>
    <strong>1. Choose the account.</strong> In your project’s terminal, type <code>bash</code> to open
    Bash, then run the block below. Enter the key at the hidden prompt as its answer, rather than pasting
    it into a command or chat. For Python, keep your project environment active.
  </p>
  <CodeBlock code={samples.signingAccount} lang="bash" caption="Keep the signing key local" />
  <p>
    <strong>2. Save the script.</strong> Create <code>draft.mjs</code> for JavaScript or
    <code>draft.py</code> for Python. Position <code>"2"</code> in <code>static_ri</code>
    fixes the referenced pitch stream; the root is 0 and its selecting dimension is 1.
  </p>
  <CodeBlock samples={samples.sdkDraft} />
  <p><strong>3. Run it.</strong> The script prints the draft’s name, address and output:</p>
  <CodeBlock samples={samples.sdkRunDraft} />
  <p>
    The address should be <code>0x0</code>: this is a saved, unpublished draft. Simulation returns
    streams directly, without an execution block. If sign-in fails, check the account key and the
    API’s error message before retrying. When you’ve finished with the account, run
    <code>unset DCN_OWNER_KEY</code>.
  </p>
{/if}

<style lang="postcss">
  .terminal-details {
    min-width: 0;
    padding-block: 0.8rem;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  summary {
    cursor: pointer;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .terminal-steps {
    display: grid;
    gap: 1rem;
    padding-top: 1rem;
    min-width: 0;
  }

  .code-checkpoint {
    padding-left: 1.1rem;
    border-left: 2px solid var(--color-accent);
  }
</style>
