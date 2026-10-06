<script lang="ts">
  import { resolve } from "$app/paths";

  import Seo from "$lib/seo/Seo.svelte";
  import { techArticleJsonLd } from "$lib/seo/site";
  import DocsLayout, { type DocsSectionGroup } from "$lib/site/docs/DocsLayout.svelte";
  import AgentExercise from "$lib/site/tutorial/AgentExercise.svelte";
  import DraftSelectionDiagram from "$lib/site/tutorial/DraftSelectionDiagram.svelte";
  import TutorialWorkshopPath from "$lib/site/tutorial/TutorialWorkshopPath.svelte";
  import WorldOutputPreview from "$lib/site/tutorial/WorldOutputPreview.svelte";
  import ConditionDiagram from "$lib/site/tutorial/ConditionDiagram.svelte";
  import ConditionExamplesPath from "$lib/site/tutorial/ConditionExamplesPath.svelte";
  import CustomElementsPath from "$lib/site/tutorial/CustomElementsPath.svelte";
  import EconomyDiagram from "$lib/site/tutorial/EconomyDiagram.svelte";
  import EditorIntegrationDiagram from "$lib/site/tutorial/EditorIntegrationDiagram.svelte";
  import LifecycleDiagram from "$lib/site/tutorial/LifecycleDiagram.svelte";
  import MultidimensionalPath from "$lib/site/tutorial/MultidimensionalPath.svelte";
  import PaletteDiagram from "$lib/site/tutorial/PaletteDiagram.svelte";
  import RunningInstanceDiagram from "$lib/site/tutorial/RunningInstanceDiagram.svelte";
  import StudioGuidePreview from "$lib/site/tutorial/StudioGuidePreview.svelte";
  import TutorialCodePath from "$lib/site/tutorial/TutorialCodePath.svelte";
  import WorldInterpretationDiagram from "$lib/site/tutorial/WorldInterpretationDiagram.svelte";

  const description =
    "Make your first contribution on decentralised.art: run a shared connector, create and test your own selection, and learn how Worlds give its values meaning.";

  const groups: DocsSectionGroup[] = [
    {
      label: "Your first contribution",
      sections: [
        { id: "first-run", label: "Run a shared connector" },
        { id: "palettes", label: "Make a selection" },
        { id: "running-settings", label: "Choose running settings" },
        { id: "create-draft", label: "Create and test a draft" },
      ],
    },
    {
      label: "When you’re ready for more",
      sections: [
        { id: "formats", label: "Use values in a World" },
        { id: "multidimensional", label: "Combine dimensions" },
        { id: "publish", label: "Publish your contribution" },
        { id: "world-editors", label: "Build your own World" },
        { id: "conditions", label: "Financial and algorithmic conditions" },
        { id: "custom-elements", label: "Create your own rules in Solidity" },
        { id: "networks", label: "Sepolia and Mainnet" },
        { id: "economies", label: "How makers shape an economy" },
      ],
    },
  ];

  const learningRoutes = [
    { id: "studio", label: "Use Studio" },
    { id: "agent", label: "Use an AI agent" },
    { id: "api", label: "Use API calls" },
    { id: "sdk", label: "Use the SDK" },
  ] as const;
  let learningRoute = $state<"studio" | "agent" | "api" | "sdk">("studio");
  let copiedPrompt = $state("");
  let copyError = $state("");

  const setupPrompt =
    "Read https://decentralised.art/mcp and follow its installation and connection instructions to install and register the decentralised.art MCP server for this agent. Set it up without a private key for now. Tell me if I need to restart the app or open a new session, then help me check that the decentralised.art tools are available.";
  const explorePrompt =
    "Read the decentralised.art primer and check that your platform tools are available. Inspect the published pitch connector and explain its rule in plain language. Execute four values with its default running settings: start 0, shift 0. Show the returned values, their paths and the execution block. I expect 0, 1, 2, 3. This is a read-only exercise; do not create or publish anything yet.";
  const draftPrompt =
    "Help me create a uniquely named draft connector with one dimension that references published pitch and uses published add with argument 2. Keep the new root and its selecting dimension at start 0, shift 0. In this new connector, store the referenced pitch stream’s fixed running instance at start 60, shift 0 (fixed running instance at position 2; root is position 0 and selecting dimension is position 1). Save the draft, then simulate four values. Indexes 0, 2, 4, 6 should select 60, 62, 64, 66. Show the draft name, values and output paths retaining the pitch reference. Explain any failure before retrying. Do not publish.";
  const runningPrompt =
    "Using the published pitch connector, execute four values with Start 0 and Shift 0. Then change only the root running instance's Start to 10 and execute four values again. Show both requests and both returned sequences, and explain why the second should be 10, 11, 12, 13. This is a public read-only exercise: no signing account, draft creation or publication is needed.";

  const copy = async (id: string, prompt: string) => {
    copiedPrompt = "";
    copyError = "";
    try {
      await navigator.clipboard.writeText(prompt);
      copiedPrompt = id;
    } catch {
      copyError = id;
    }
  };
</script>

<Seo
  title="Tutorial"
  {description}
  path="/tutorial"
  markdownPath="/tutorial.md"
  type="article"
  jsonLd={[techArticleJsonLd("/tutorial", "Tutorial", description)]}
/>

<svelte:head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=swap" />
</svelte:head>

{#snippet routeTabs(label: string)}
  <div class="learning-route" role="group" aria-label={label} data-markdown-skip>
    {#each learningRoutes as route (route.id)}
      <button
        type="button"
        aria-pressed={learningRoute === route.id}
        onclick={() => (learningRoute = route.id)}>{route.label}</button
      >
    {/each}
  </div>
{/snippet}

<DocsLayout eyebrow="Learn by making" title="Tutorial" {groups}>
  <p>
    This tutorial helps you learn the basics of using the platform in practice. For the main ideas
    behind the platform, see the <a href={resolve("/about")}>About section</a>.
  </p>
  <section class="tutorial-section" aria-labelledby="first-run">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>01</span>
      <h2 id="first-run">Run your first shared connector</h2>
    </div>
    <p>
      Let’s start with a small piece you can make your own. We’ll borrow a shared sequence of
      numbers, choose values from it, and save that choice as a new draft. By the end of the first
      four sections, you’ll have a draft you can test and a second version to compare with it. You
      don’t need to code or have used the platform before.
    </p>
    <p>
      A <strong>connector</strong> holds rules for producing numbers and can use other connectors. A
      <strong>World</strong> is an application that gives those numbers a creative meaning: notes in a
      score, colours in a drawing, or moves in a game. We’ll work with the numbers first. Turning them
      into a complete piece in a World comes later.
    </p>
    <p>
      Our shared connector is called <strong>pitch</strong>. It starts with a number and keeps
      adding 1. You can explore all the illustrations on this page without an account; they’re local
      examples and don’t save or publish anything. To try the real connector, choose your route
      below. You can switch routes above each exercise; your choice updates the whole tutorial.
    </p>

    {@render routeTabs("Follow the tutorial with")}

    <div class="follow-panel" hidden={learningRoute !== "studio"}>
      <h3>Run four values in Studio</h3>
      <p>
        Studio is our visual editor. Open it in your browser; a larger screen gives its canvas more
        room. For this first exercise, just open the connector and run it. You don’t need an
        account, a wallet or transaction fees.
      </p>
      <StudioGuidePreview lesson="first-run" />
    </div>

    <div class="follow-panel" hidden={learningRoute !== "agent"}>
      <h3>Run four values with your agent</h3>
      <p>
        <strong>Before you begin:</strong> you need an AI agent that supports
        <strong>MCP (Model Context Protocol)</strong>, the connection that gives it platform tools.
      </p>
      <p>
        Your agent can often handle the setup for you, if it can run commands and update its MCP
        settings. Point it to <a href={resolve("/mcp")}>our MCP page</a> and ask it to install and connect
        the server. You can use this prompt:
      </p>
      <blockquote class="agent-prompt">{setupPrompt}</blockquote>
      <div class="prompt-action" data-markdown-skip>
        <button type="button" onclick={() => copy("setup", setupPrompt)}
          >{copiedPrompt === "setup" ? "Copied" : "Copy MCP setup prompt"}</button
        >
        {#if copyError === "setup"}<span role="status">Select the prompt and copy it manually.</span
          >{/if}
      </div>
      <p>
        If your agent can’t configure the connection itself, follow the
        <a href={resolve("/mcp#installation")}>MCP installation guide</a>. After setup, restart the
        agent or open a new session if needed, then ask it to confirm that the decentralised.art
        tools are available. Reading and executing a published connector need no account.
      </p>
      <p>Once the tools are connected, give your agent this prompt:</p>
      <blockquote class="agent-prompt">{explorePrompt}</blockquote>
      <div class="prompt-action" data-markdown-skip>
        <button type="button" onclick={() => copy("explore", explorePrompt)}
          >{copiedPrompt === "explore" ? "Copied" : "Copy exploration prompt"}</button
        >
        {#if copyError === "explore"}<span role="status"
            >Select the prompt and copy it manually.</span
          >{/if}
      </div>
      <p>
        If the agent can’t find the tools, return to the installation guide and check the server
        registration before asking it to run anything.
      </p>
    </div>
    <div class="follow-panel" hidden={learningRoute !== "api"}>
      <TutorialCodePath route="api" lesson="first-run" />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "sdk"}>
      <TutorialCodePath route="sdk" lesson="first-run" />
    </div>
  </section>

  <section class="tutorial-section" aria-labelledby="palettes">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>02</span>
      <h2 id="palettes">Choose values from shared material</h2>
    </div>
    <p>
      Your new connector can use another connector’s sequence and choose values from it. For
      example, it could choose the first, third, fifth and seventh values from pitch. Each position
      has a number called an <strong>index</strong>, counting from 0. Those positions are indexes 0,
      2, 4 and 6. Choosing them doesn’t change the shared pitch connector.
    </p>
    <p>
      A <strong>transformation</strong> is a rule that changes a number. For example,
      <strong>add</strong> with argument 2 adds 2 at each step. A <strong>dimension</strong> has its own
      sequence of transformations. Without a reference, its numbers are output values. When it references
      another connector, its numbers choose indexes in the referenced sequence: 0, 2, 4, 6 chooses every
      second position.
    </p>
    <p>
      Try a different tab or selection below. The moving links show the choice travelling from your
      rule, through the shared sequence, to the World’s interpretation. Click any control to stop
      the animation and take a closer look; use <strong>Start</strong> to resume it.
    </p>

    <PaletteDiagram />

    <p>
      <strong>An index and its selected value can be different.</strong> When pitch starts at 0, index
      2 selects value 2. When it starts at 60, index 2 selects value 62. The music illustration above
      selects indexes starting at 60 from a sequence starting at 0. In our draft below, we’ll reach the
      same values by starting the referenced sequence at 60 and selecting indexes from 0. The World receives
      the selected values, whichever route produced them.
    </p>

    <h3 id="running-settings">Choose where a run begins</h3>
    <p>Let’s try one change in the real system before looking at the diagram.</p>
    {@render routeTabs("Choose how to change the starting value")}
    <div class="follow-panel" hidden={learningRoute !== "studio"}>
      <StudioGuidePreview lesson="starting-value" />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "agent"}>
      <blockquote class="agent-prompt">{runningPrompt}</blockquote>
      <div class="prompt-action" data-markdown-skip>
        <button type="button" onclick={() => copy("running", runningPrompt)}
          >{copiedPrompt === "running" ? "Copied" : "Copy starting-value prompt"}</button
        >
        {#if copyError === "running"}<span role="status"
            >Select the prompt and copy it manually.</span
          >{/if}
      </div>
      <p class="checkpoint">
        <strong>Compare the results:</strong> 0, 1, 2, 3 becomes 10, 11, 12, 13. Only the starting point
        changed.
      </p>
    </div>
    <div class="follow-panel" hidden={learningRoute !== "api"}>
      <TutorialCodePath route="api" lesson="starting-value" />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "sdk"}>
      <TutorialCodePath route="sdk" lesson="starting-value" />
    </div>
    <RunningInstanceDiagram />

    <p>
      An <strong>open</strong> running instance lets the person running the connector choose these
      settings. A <strong>static</strong> running instance fixes Start and Shift together for one position
      in the connector’s tree of references. A run cannot override that fixed pair. In the next exercise,
      we’ll fix the referenced pitch stream while leaving our new connector’s own settings open.
    </p>
  </section>

  <section class="tutorial-section" aria-labelledby="create-draft">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>03</span>
      <h2 id="create-draft">Make a draft and test your choice</h2>
    </div>
    <p>
      Let’s save your own selection of <strong>60, 62, 64, 66</strong>. Your new connector selects
      indexes 0, 2, 4, 6 from pitch, whose referenced stream starts at 60. The shared rule stays the
      same; your selecting rule is new.
    </p>
    <DraftSelectionDiagram />
    <p>
      Saving a draft requires a signing account to identify its creator. <strong
        >Create locally</strong
      >
      saves an unpublished definition on the platform server. <strong>Simulate</strong> tests it there.
      Neither spends a blockchain transaction fee (gas).
    </p>
    {@render routeTabs("Choose how to create a draft")}
    <div class="follow-panel" hidden={learningRoute !== "studio"}>
      <h3>Build the relationship in Studio</h3>
      <p>
        The guide starts with a blank tab and points to each real control. Before saving, you’ll
        need the <a href="https://metamask.io/download" target="_blank" rel="noopener noreferrer"
          >MetaMask browser extension</a
        > and a wallet account. Sign in before building so the draft belongs to your account’s Studio
        session. No test ETH is needed.
      </p>
      <StudioGuidePreview lesson="draft" />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "agent"}>
      <h3>Build the relationship with your agent</h3>
      <p>
        Configure the owner’s signing account locally using the <a
          href={resolve("/mcp#configuration")}>MCP account configuration guide</a
        >. Keep its key out of chat. Then give your agent this prompt:
      </p>
      <AgentExercise prompt={draftPrompt} label="Copy draft prompt" />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "api"}>
      <TutorialCodePath route="api" lesson="draft" />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "sdk"}>
      <TutorialCodePath route="sdk" lesson="draft" />
    </div>
    <p class="checkpoint">
      <strong>Check your draft:</strong> keep its saved name and look for 60, 62, 64, 66 in the simulation
      output, with a path retaining the pitch reference. It is saved and tested, but still unpublished.
    </p>
    <details class="technical-detail">
      <summary>If your draft doesn’t give those values</summary>
      <ul>
        <li>
          <strong>0, 2, 4, 6:</strong> the referenced pitch needs Start 60, Shift 0, set to static before
          saving.
        </li>
        <li>
          <strong>The gap is wrong:</strong> set add’s argument to 2 on your new root’s D1, rather than
          on shared pitch.
        </li>
        <li>
          <strong>Simulation won’t start:</strong> check that creation succeeded. Simulate the saved name;
          Execute on the Network needs publication.
        </li>
        <li>
          <strong>Sign-in expired or failed:</strong> unlock MetaMask and sign in again, or refresh your
          Chain API token. That token lasts five minutes.
        </li>
        <li>
          <strong>Pitch or add is missing:</strong> refresh the network library, or check the API’s error
          when reading its definition. Retry later if the service is unavailable.
        </li>
        <li>
          <strong>Name reserved:</strong> choose a new unique name. Saved definitions cannot be overwritten;
          correcting an already saved draft also needs a new name.
        </li>
      </ul>
    </details>
    <h3>Try one change</h3>
    <p>
      What happens if your selector adds <strong>12</strong> instead of 2? Keep the referenced pitch at
      Start 60, Shift 0. Predict the four values, then make a second draft with a new name.
    </p>
    {@render routeTabs("Choose how to try another selection")}
    <div class="follow-panel" hidden={learningRoute !== "studio"}>
      <StudioGuidePreview lesson="selection" />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "agent"}>
      <AgentExercise
        prompt={draftPrompt
          .replace("argument 2.", "argument 12.")
          .replace(
            "Indexes 0, 2, 4, 6 should select 60, 62, 64, 66.",
            "Indexes 0, 12, 24, 36 should select 60, 72, 84, 96. Use a different name from the first draft.",
          )}
        label="Copy second selection prompt"
      />
    </div>
    <div class="follow-panel" hidden={learningRoute !== "api"}>
      <p>
        In the creation command above, change <code>"args": [2]</code> to <code>"args": [12]</code>.
        Run creation again; it chooses a new name. Then run the simulation command for that name.
        Sign in again first if the token has expired.
      </p>
    </div>
    <div class="follow-panel" hidden={learningRoute !== "sdk"}>
      <p>
        In <code>draft.mjs</code> or <code>draft.py</code>, change <code>step = 2</code> to
        <code>step = 12</code> and run it again. It signs in and chooses a new name each time. Enter the
        key at the hidden prompt again if you already unset it.
      </p>
    </div>
    <p class="checkpoint">
      <strong>Look for 60, 72, 84, 96.</strong> Your two selectors now choose different values from the
      same shared sequence. Keep both names so you can compare their output.
    </p>
  </section>

  <section class="tutorial-section" aria-labelledby="formats">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>04</span>
      <h2 id="formats">Give your values a place in a World</h2>
    </div>
    <p>
      So far, our connector has had one dimension. You can give a connector several dimensions, each
      with its own rules and references. This is a <strong>multidimensional connector</strong>: one
      definition can supply several properties together. For example, a musical contribution could
      supply pitch, time, duration and velocity; a painting contribution could supply red, green and
      blue. The World interprets the values that the connector produces.
    </p>
    <WorldInterpretationDiagram />
    <h3 id="multidimensional">Put two dimensions in one connector</h3>
    <p>
      Let’s keep our earlier pitch selection and add another dimension. In the new connector,
      <strong>D1</strong> selects 60, 62, 64, 66 from pitch. <strong>D2</strong> is a
      <strong>scalar dimension</strong>: it uses add with argument 1 to produce 0, 1, 2, 3 directly.
      You’ll save one draft and simulate both dimensions in one run. A World you build could read D2
      as start times for the pitches in D1.
    </p>
    {@render routeTabs("Choose how to combine dimensions")}
    {#each learningRoutes as route (route.id)}
      <div class="follow-panel" hidden={learningRoute !== route.id}>
        <MultidimensionalPath route={route.id} />
      </div>
    {/each}
    <p class="checkpoint">
      <strong>Check both output paths:</strong> <code>/your_name:0/pitch:0</code> contains 60, 62,
      64, 66, and <code>/your_name:1</code> contains 0, 1, 2, 3. Replace
      <code>your_name</code> with your draft’s name. Studio labels dimensions D1 and D2; output paths
      count them from 0. Adding D2 leaves D1’s selection unchanged.
    </p>
    <details class="technical-detail">
      <summary>Why is the fixed running instance still at position 2?</summary>
      <p>
        The referenced pitch still uses fixed running instance <code>"2"</code>: root 0, selecting
        D1 at 1, pitch’s scalar dimension at 2. D2 comes after that branch, at position 3, and keeps
        its default Start 0, Shift 0. These are positions in the reference tree, distinct from the
        dimension numbers in the output paths.
      </p>
    </details>
    <p>
      <strong>Before contributing to a World, check its instructions:</strong> which properties it
      reads, what the numbers mean, and how it groups them. Our two-dimensional draft demonstrates
      how to combine properties; it is not yet a complete contribution for the MIDI World. That
      World needs streams labelled pitch, time, duration and velocity. D2 here is a scalar of your
      own connector, so its label is <code>your_name:1</code>, not <code>time:0</code>.
    </p>
    {@render routeTabs("Choose how to check a World’s inputs")}
    {#each learningRoutes as route (route.id)}
      <div class="follow-panel" hidden={learningRoute !== route.id}>
        <TutorialWorkshopPath route={route.id} lesson="formats" />
      </div>
    {/each}
    <details class="technical-detail">
      <summary>What a compatible format tells you</summary>
      <p>
        A <strong>scalar</strong> stream produces values directly instead of selecting from another
        connector. A <strong>format hash</strong> identifies the names and dimensions of the scalar streams
        at the ends of a connector’s reference tree. A World uses it to recognise a vocabulary.
      </p>
      <p>
        The format doesn’t validate units, ranges or grouping. The World defines those conventions.
        Network values are unsigned whole numbers; negative or fractional quantities need an
        encoding.
      </p>
      <p>
        A dimension can reference a multidimensional connector too. Its selecting indexes then
        choose positions across that connector’s output streams. A connector can therefore contain
        both direct scalar dimensions and references that supply several streams.
      </p>
    </details>
  </section>

  <section class="tutorial-section" aria-labelledby="publish">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>05</span>
      <h2 id="publish">Publish when you’re ready to share</h2>
    </div>
    <p>
      This step is optional. Publication gives your saved connector a permanent blockchain address
      so others can run and reference it. Review its rules and fixed settings first: the published
      definition cannot be edited.
    </p>
    <p>
      You’ll need <strong>Sepolia test ETH</strong> in its owner’s account for gas. Sepolia is
      Ethereum’s test network. You don’t need mainnet ETH; a
      <a href="https://sepolia-faucet.pk910.de/" target="_blank" rel="noopener noreferrer"
        >Sepolia faucet</a
      > can supply test funds.
    </p>
    <LifecycleDiagram />
    {@render routeTabs("Choose how to publish a contribution")}
    {#each learningRoutes as route (route.id)}
      <div class="follow-panel" hidden={learningRoute !== route.id}>
        <TutorialWorkshopPath route={route.id} lesson="publish" />
      </div>
    {/each}
    <p>
      Publication preserves your definition. It doesn’t add the other streams a World may require.
    </p>
  </section>

  <section class="tutorial-section" aria-labelledby="world-editors">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>06</span>
      <h2 id="world-editors">If you want to build a World of your own</h2>
    </div>
    <p>
      You decide what the numbers become. Let’s start with a small drawing prototype: each selected
      value sets a circle’s diameter in pixels. Your first draft gives similar sizes; your second
      spreads them further apart.
    </p>
    <WorldOutputPreview />
    {@render routeTabs("Choose how to prototype a World")}
    {#each learningRoutes as route (route.id)}
      <div class="follow-panel" hidden={learningRoute !== route.id}>
        <TutorialWorkshopPath route={route.id} lesson="world" />
      </div>
    {/each}
    <h3>Choose where your editor will run</h3>
    <p>
      A World can include an editor for drawing, composing or arranging movements. A standalone app
      with the full SDK can create, simulate, publish and execute operations with the appropriate
      signing setup. A hosted World currently has a smaller set of supported calls. Try the two
      options below.
    </p>
    <EditorIntegrationDiagram />
    <details class="technical-detail">
      <summary>What changes when you upload a World?</summary>
      <p>
        An uploaded World runs in a sandbox: an isolated environment connected through a controlled
        host bridge. Its runtime SDK supports discovery, reads, simulation and execution. It does
        not currently expose draft creation or publication. Including the full SDK in the bundle
        does not bypass that boundary; a publishing editor needs an extended bridge and a trusted
        signing flow.
      </p>
      <p>
        Package the interface, interpretation code and manifest using the <a
          href={resolve("/sdk#world-host")}>World-hosting guide</a
        >. Users can make contributions in Studio or with an agent while the hosted World reads
        them.
      </p>
    </details>
    <p>
      <strong>Leave room for the next person:</strong> offer a shared source for each property, and explain
      its units and ranges. That is the palette approach we practised here: a way to design reusable connectors,
      rather than a separate platform object.
    </p>
  </section>

  <section class="tutorial-section" aria-labelledby="conditions">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>07</span>
      <h2 id="conditions">When should a connector be allowed to run?</h2>
    </div>
    <p>
      A <strong>condition</strong> is a rule that answers yes or no before a connector produces its values.
      It can be financial, such as requiring a recorded cryptocurrency payment, or non-financial, such
      as checking whether an algorithmic requirement is met. The connector’s creator chooses the rule
      and attaches it to their connector.
    </p>
    <p>
      For a financial example, imagine that <strong
        >public address A must pay public address B</strong
      >
      before a connector can run. A custom payment contract could forward that payment and keep a receipt.
      The condition would read that receipt when someone requests a run. Sending the payment and checking
      it are two separate actions.
    </p>
    <ConditionDiagram />
    {@render routeTabs("Choose how to explore conditions")}
    {#each learningRoutes as route (route.id)}
      <div class="follow-panel" hidden={learningRoute !== route.id}>
        <ConditionExamplesPath route={route.id} />
      </div>
    {/each}
    <p class="checkpoint">
      <strong>Try making the algorithmic check yourself next.</strong> We’ll write
      <code>return args[0] &gt;= args[1];</code>, attach it with <code>[12, 10]</code>, and test a
      connector. A second draft with <code>[8, 10]</code> should be rejected.
    </p>
    <details class="technical-detail">
      <summary>What happens when the connector runs?</summary>
      <p>
        The runner checks the connector and each connector it references. If a required condition
        returns false, the whole request fails. If they all pass, the runner evaluates the
        transformations and returns the requested values. A condition permits a requested run;
        passing it does not start a run automatically.
      </p>
      <p>
        A condition receives the arguments stored in the connector’s definition. It is not
        automatically given the generated numbers or the reader’s wallet address. Our payment
        example checks a specified A-to-B payment; once it is recorded, that check passes for anyone
        requesting that connector. Personal access rules need a design that identifies the
        participant explicitly.
      </p>
      <p>
        A payment condition needs evidence it can read on chain. A recipient’s balance alone does
        not prove which address paid it. The payment contract, receipt format and condition must be
        developed together; this illustration is a possible design. Simulation uses a local Ethereum
        Virtual Machine whose balances and external contracts can differ from Sepolia. Test a
        published state-dependent condition at the execution block you intend to use.
      </p>
    </details>
    <h3>Bring information from outside the blockchain</h3>
    <p>
      Makers could also develop transactions with <strong>blockchain oracles</strong>: services that
      bring external data onto the blockchain. A transaction would store a weather reading, an
      environmental measurement or a result from a public API. Custom transformations and conditions
      could then read that data as part of their evaluation.
    </p>
    <p>
      A World could change its colours with the air quality, or allow an operation only when a
      recorded temperature reaches a threshold. This requires a suitable oracle integration;
      Solidity does not fetch an API directly during a run. The maker must decide which source to
      trust and how fresh its data must be. Learn more about
      <a
        href="https://ethereum.org/developers/docs/oracles/"
        target="_blank"
        rel="noopener noreferrer">how Ethereum oracles work</a
      >.
    </p>
  </section>

  <section class="tutorial-section" aria-labelledby="custom-elements">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>08</span>
      <h2 id="custom-elements">Create your own transformations and conditions</h2>
    </div>
    <p>
      Start by looking for a rule you can reuse. As more transformations, conditions and connectors
      using them are published, you can build more by combining what is already there. You only need
      new code when the available elements don’t express your idea.
    </p>
    <p>
      You can always add a custom rule in <strong>Solidity</strong>, the language used for these
      smart contracts. A transformation takes a number and returns another number. A condition takes
      its fixed arguments and returns true or false. Studio, an agent, the API and the SDK all
      create the same kinds of elements.
    </p>
    <p>
      Let’s create a repeating selection and the algorithmic check above. The selection will cycle
      through indexes <code>0, 1, 2, 3, 0, 1</code>. Referencing pitch from 60 will give
      <code>60, 61, 62, 63, 60, 61</code>. We’ll save and simulate drafts first, without publishing.
    </p>
    {@render routeTabs("Choose how to create custom elements")}
    {#each learningRoutes as route (route.id)}
      <div class="follow-panel" hidden={learningRoute !== route.id}>
        <CustomElementsPath route={route.id} />
      </div>
    {/each}
    <p class="checkpoint">
      <strong>Reuse your new rules too.</strong> Other connectors can use these elements by name. To
      make them available on the network, publish the transformation and condition before the
      connector that references them, following the <a href="#publish">publication step</a>.
      Publication is permanent and costs gas.
    </p>
  </section>

  <section class="tutorial-section" aria-labelledby="networks">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>09</span>
      <h2 id="networks">Practise on Sepolia. What changes on Mainnet?</h2>
    </div>
    <p>
      The platform currently uses <strong>Sepolia</strong>, an Ethereum test network. Published
      elements are real smart contracts, but payments and gas use test ETH intended for
      experimentation. This is where you can try your rules and economic ideas before putting funds
      with real value at stake.
    </p>
    <div class="network-comparison" role="group" aria-label="Sepolia and Mainnet comparison">
      <article class="network-card">
        <span class="network-label">Today · practise</span>
        <h3>Sepolia</h3>
        <dl>
          <div>
            <dt>Chain ID</dt>
            <dd>11155111</dd>
          </div>
          <div>
            <dt>Funds</dt>
            <dd>Test ETH from a faucet</dd>
          </div>
          <div>
            <dt>Gas and payments</dt>
            <dd>Use test funds</dd>
          </div>
          <div>
            <dt>Your elements</dt>
            <dd>Published on Sepolia</dd>
          </div>
        </dl>
      </article>
      <article class="network-card mainnet-card">
        <span class="network-label">Future deployment · real funds</span>
        <h3>Ethereum Mainnet</h3>
        <dl>
          <div>
            <dt>Chain ID</dt>
            <dd>1</dd>
          </div>
          <div>
            <dt>Funds</dt>
            <dd>ETH with real monetary value</dd>
          </div>
          <div>
            <dt>Gas and payments</dt>
            <dd>Spend real funds</dd>
          </div>
          <div>
            <dt>Your elements</dt>
            <dd>Need a Mainnet deployment</dd>
          </div>
        </dl>
      </article>
    </div>
    <p>
      The ideas stay the same: create rules, combine them in connectors, and let Worlds interpret
      the results. The chain state changes. Sepolia balances, contracts, payment receipts and oracle
      data do not automatically move to Mainnet. The platform and its dependencies need production
      deployments, and contributions need to reference elements on that network.
    </p>
    <p class="checkpoint">
      <strong>For this tutorial, keep using Sepolia.</strong> Studio’s publication flow and our
      signing examples expect it. Changing your wallet to Mainnet alone does not migrate the
      platform. A future Mainnet release will need its own endpoints, contract configuration and
      migration instructions. See Ethereum’s
      <a
        href="https://ethereum.org/developers/docs/networks/"
        target="_blank"
        rel="noopener noreferrer">network guide</a
      > for the difference between test networks and Mainnet.
    </p>
  </section>

  <section class="tutorial-section" aria-labelledby="economies">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true" data-markdown-skip>10</span>
      <h2 id="economies">How makers shape an economy</h2>
    </div>
    <p>
      A connector’s creator chooses whether to attach a condition. They can share it without a
      payment requirement, or require a recorded payment before it runs. A World’s creator chooses
      which connectors and formats the World accepts, and how their values become something you can
      see, hear or use. Accepting a connector does not change the conditions its creator attached.
    </p>
    <EconomyDiagram />
    <p>
      An economy can grow from these choices across the network. Some makers might offer freely
      shared materials; others might ask for contributions to their work. Custom payment contracts
      could divide a payment between collaborators. A connector that references someone else’s
      connector must still satisfy that connector’s condition. Payment rules do not make public
      blockchain data private, and payments or royalty splits need their own implementation.
    </p>
    <h3>What is free, and what costs gas?</h3>
    <p>
      <strong>Gas</strong> is Ethereum’s fee for processing a blockchain transaction. It is separate from
      any payment a maker chooses to require. A connector with no financial condition can be free to run
      even though publishing it cost its maker gas.
    </p>
    <div class="fee-table-wrap">
      <table class="fee-table">
        <caption>Blockchain fees for the workflow in this tutorial</caption>
        <thead><tr><th scope="col">Action</th><th scope="col">Blockchain gas fee?</th></tr></thead>
        <tbody>
          <tr><th scope="row">Browse definitions and read published elements</th><td>No</td></tr>
          <tr><th scope="row">Sign in, create local drafts and simulate</th><td>No</td></tr>
          <tr
            ><th scope="row">Execute on the Network through this platform’s read API</th><td
              >No — it reads a recorded block without sending a transaction</td
            ></tr
          >
          <tr
            ><th scope="row">Publish a transformation, condition or connector</th><td
              >Yes — the publishing account pays gas</td
            ></tr
          >
          <tr
            ><th scope="row">Send a payment or update a payment receipt on chain</th><td
              >Yes — plus the payment amount, if any</td
            ></tr
          >
          <tr
            ><th scope="row">Request or record an oracle update on chain</th><td
              >Yes — the integration may also charge a service fee</td
            ></tr
          >
        </tbody>
      </table>
    </div>
    <p>
      A read-only run evaluates transformations and conditions without spending the reader’s ETH. If
      you build another contract that calls them inside a blockchain transaction, that transaction
      does use gas. The same distinction applies on Sepolia and Mainnet; the funds used to pay
      differ. Hosting, external services and an AI agent’s own charges are separate from these
      blockchain fees. Ethereum’s <a
        href="https://ethereum.org/developers/docs/gas/"
        target="_blank"
        rel="noopener noreferrer">gas guide</a
      > explains how transaction fees work.
    </p>
    <p class="checkpoint">
      <strong>Help people understand what they’re using:</strong> identify which connectors require a
      payment, which address receives it, and what that payment permits. If you build a World, explain
      the requirements of the connectors it accepts.
    </p>
    <div class="tutorial-next">
      <a href={resolve("/studio")}>Continue in Studio →</a>
      <a href={resolve("/mcp")}>Work with your agent →</a>
      <a href={resolve("/api-reference")}>Explore the API →</a>
      <a href={resolve("/sdk#worlds")}>Build your World →</a>
    </div>
  </section>
</DocsLayout>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .tutorial-section {
    @apply grid gap-5;
    padding-bottom: 2rem;
    min-width: 0;
  }

  .tutorial-section p {
    @apply m-0;
    max-width: 70ch;
  }

  .section-heading {
    @apply flex items-baseline gap-3;
    min-width: 0;
  }

  .section-heading h2 {
    @apply mt-4 mb-0 text-2xl font-semibold;
    padding-top: 0;
    border-top: 0;
    scroll-margin-top: 6rem;
  }

  .section-number {
    color: var(--text-faint);
    font-family: "VT323", ui-monospace, monospace;
    font-size: 1.75rem;
  }

  .learning-route {
    @apply flex flex-wrap gap-2;
  }

  .learning-route button {
    @apply rounded-full border px-5 py-2.5 text-sm font-semibold;
    color: var(--text-secondary);
    border-color: var(--border-subtle);
    background: transparent;
    cursor: pointer;
  }

  .learning-route button[aria-pressed="true"] {
    color: var(--text-primary);
    background: var(--color-accent-soft);
    border-color: var(--color-accent);
  }

  .learning-route button:hover,
  .prompt-action button:hover {
    background: var(--surface-card-hover);
  }

  .learning-route button:focus-visible,
  .prompt-action button:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
  }

  .tutorial-section .follow-panel {
    @apply grid gap-4;
    max-width: 48rem;
    background: transparent !important;
  }

  .follow-panel[hidden] {
    display: none;
  }

  .follow-panel h3 {
    @apply m-0 text-base;
  }

  .checkpoint {
    padding-left: 1.1rem;
    border-left: 2px solid var(--color-accent);
  }

  .agent-prompt {
    @apply m-0 px-5 py-4;
    max-width: 48rem;
    border-left: 2px solid var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 10%, var(--surface-page));
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .prompt-action {
    @apply flex flex-wrap items-center gap-3;
  }

  .prompt-action button {
    @apply rounded-md border px-3 py-2 text-xs font-semibold;
    border-color: var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .prompt-action span {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .technical-detail {
    max-width: 48rem;
    padding-block: 0.8rem;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  .technical-detail summary {
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    padding-right: 0.5rem;
  }

  .technical-detail p {
    margin-top: 1rem;
  }

  .network-comparison {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .network-card {
    min-width: 0;
    padding: 1.3rem;
    border: 1px solid #4c806f;
    border-radius: 1rem;
    background: linear-gradient(145deg, #203c3b, #192a35);
    color: #edf9f1;
  }

  .network-card.mainnet-card {
    border-color: #8e7653;
    background: linear-gradient(145deg, #493b32, #302938);
  }

  .network-card h3 {
    margin: 0.6rem 0 1.3rem;
    color: #edf9f1 !important;
    font-size: 1.25rem;
  }

  .network-comparison .network-label {
    color: #c2d4cc !important;
    font-size: 0.75rem;
  }

  .network-card dl {
    display: grid;
    gap: 1rem;
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .network-card dt {
    color: #c2d4cc;
    font-size: 0.75rem;
  }

  .network-card dd {
    margin: 0.15rem 0 0;
    color: #edf9f1;
  }

  .fee-table-wrap {
    overflow-x: auto;
    min-width: 0;
  }

  .fee-table {
    width: 100%;
    margin: 0;
    border-collapse: collapse;
    font-size: 0.85rem;
    line-height: 1.7;
  }

  .fee-table caption {
    margin-bottom: 0.75rem;
    text-align: left;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .fee-table :is(th, td) {
    padding: 0.8rem;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--border-subtle);
  }

  .fee-table tbody th {
    width: 48%;
    font-weight: 500;
  }

  @media (max-width: 650px) {
    .network-comparison {
      grid-template-columns: 1fr;
    }
    .fee-table :is(th, td) {
      padding: 0.6rem 0.35rem;
    }
  }

  .tutorial-next {
    @apply mt-2 flex flex-wrap gap-4;
  }

  .tutorial-next a {
    @apply py-2 text-sm font-semibold;
  }

  @media (max-width: 480px) {
    .tutorial-section {
      padding-bottom: 1rem;
    }

    .section-heading {
      gap: 0.6rem;
    }
  }
</style>
