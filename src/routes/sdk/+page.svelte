<script lang="ts">
  import { resolve } from "$app/paths";

  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import DocsLayout, { type DocsSectionGroup } from "$lib/site/docs/DocsLayout.svelte";
  import * as samples from "$lib/site/docs/sdkSamples";
  import Seo from "$lib/seo/Seo.svelte";
  import { techArticleJsonLd } from "$lib/seo/site";

  const description =
    "Official JavaScript/TypeScript and Python SDKs for decentralised.art: read the network, create and simulate operations, publish them on chain, execute connectors, and build Worlds.";

  const groups: DocsSectionGroup[] = [
    {
      label: "Getting started",
      sections: [
        { id: "overview", label: "Overview" },
        { id: "installation", label: "Installation" },
        { id: "quick-start", label: "Quick start" },
        { id: "concepts", label: "Core concepts" },
      ],
    },
    {
      label: "Guides",
      sections: [
        { id: "lifecycle", label: "From draft to the network" },
        { id: "configuration", label: "Configuration" },
        { id: "authentication", label: "Authentication" },
        { id: "reading", label: "Reading the network" },
        { id: "feed", label: "Feed and live updates" },
        { id: "creating", label: "Creating operations" },
        { id: "simulating", label: "Simulating" },
        { id: "publishing", label: "Publishing" },
        { id: "executing", label: "Executing on chain" },
        { id: "errors", label: "Errors" },
      ],
    },
    {
      label: "Worlds",
      sections: [
        { id: "worlds", label: "Building a World" },
        { id: "world-manifest", label: "World manifest" },
        { id: "world-runtime", label: "World runtime API" },
        { id: "world-host", label: "Hosting Worlds" },
      ],
    },
    {
      label: "Reference",
      sections: [
        { id: "reference", label: "Client methods" },
        { id: "cli", label: "Python CLI" },
        { id: "versions", label: "Versions and source" },
      ],
    },
  ];

  const methods = [
    ["version()", "version()", "", "Chain API version and build timestamp."],
    ["getNonce(address)", "get_nonce(address)", "", "One-time login nonce for an address."],
    [
      "loginWithWallet(wallet)",
      "login_with_account(account)",
      "",
      "Sign the login nonce and store the access token. The wallet or account also becomes the default publication signer.",
    ],
    [
      "loginWithSignature(address, message, signature)",
      "login_with_signature(address, message, signature)",
      "",
      "Log in with a signature produced elsewhere.",
    ],
    [
      "listAccounts({ limit, after })",
      "list_accounts(limit=, after=)",
      "",
      "Accounts that own published operations.",
    ],
    [
      "accountInfo(address, opts)",
      "account_info(address, ...)",
      "",
      "Connectors, transformations and conditions owned by an address, each with its own cursor.",
    ],
    ["connectorExists(name)", "connector_exists(name)", "", "true, or false on 404."],
    [
      "connectorGet(name)",
      "connector_get(name)",
      "",
      "Connector definition, owner, address and format hash.",
    ],
    ["connectorPost(request)", "connector_post(request)", "Login", "Create a connector draft."],
    ["transformationExists(name)", "transformation_exists(name)", "", "true, or false on 404."],
    [
      "transformationGet(name)",
      "transformation_get(name)",
      "",
      "Name, args_count, owner and address.",
    ],
    [
      "transformationPost(request)",
      "transformation_post(request)",
      "Login",
      "Create a transformation draft.",
    ],
    ["conditionExists(name)", "condition_exists(name)", "", "true, or false on 404."],
    ["conditionGet(name)", "condition_get(name)", "", "Name, args_count, owner and address."],
    ["conditionPost(request)", "condition_post(request)", "Login", "Create a condition draft."],
    [
      "simulate(name, count, dynamicRi?)",
      "simulate(name, count, dynamic_ri=)",
      "",
      "Run a connector in the server's local EVM. Returns output streams.",
    ],
    [
      "execute(name, count, dynamicRi?)",
      "execute(name, count, dynamic_ri=)",
      "",
      "Run a published connector on chain at a pinned block.",
    ],
    [
      "publish(kind, name, opts)",
      "publish(kind, name, account=, ...)",
      "Login",
      "Prepare, sign offline, relay and confirm until mined.",
    ],
    [
      "publishPrepare(kind, name, { relay })",
      "publish_prepare(kind, name, relay=)",
      "Login",
      "Unsigned publication transaction, or the existing identical publication.",
    ],
    [
      "publishSend(kind, request)",
      "publish_send(kind, name, content_hash, raw_tx)",
      "Login",
      "Broadcast an offline-signed transaction through the server.",
    ],
    [
      "publishConfirm(kind, request)",
      "publish_confirm(kind, name, content_hash, tx_hash)",
      "Login",
      "Look the receipt up once: mined, or pending.",
    ],
    ["listFormats({ limit, after })", "list_formats(limit=, after=)", "", "Known format hashes."],
    [
      "formatInfo(hash, opts)",
      "format_info(hash, ...)",
      "",
      "Connectors and scalar labels for one format.",
    ],
    ["feed(opts)", "feed(...)", "", "Newest-first page of chain events."],
    [
      "feedStream({ sinceSeq, limit })",
      "feed_stream(since_seq=, limit=)",
      "",
      "Server-Sent Events stream of new events.",
    ],
    ["accessToken", "access_token", "", "The current bearer token, if logged in."],
  ];
</script>

<Seo
  title="SDK"
  {description}
  path="/sdk"
  markdownPath="/sdk.md"
  type="article"
  jsonLd={[techArticleJsonLd("/sdk", "SDK", description)]}
/>

<DocsLayout title="SDK" {description} {groups}>
  <section>
    <h2 id="overview">Overview</h2>
    <p>
      The decentralised.art SDK is a typed client for the chain API at
      <code>https://api.decentralised.art/chain</code>. It comes in two languages with the same
      capabilities:
    </p>
    <ul>
      <li>
        <strong>JavaScript / TypeScript</strong> (package <code>decentralised-art</code>), for
        browsers, Node.js and other modern runtimes. It also contains the
        <a href="#worlds">World runtime and host</a>.
      </li>
      <li>
        <strong>Python</strong> (<code>decentralised-art</code>, imported as
        <code>decentralised_art</code>), for scripts, notebooks, services and agents.
      </li>
    </ul>
    <p>With it you can:</p>
    <ul>
      <li>read connectors, transformations, conditions, formats, accounts and the event feed;</li>
      <li>create your own operations as drafts and simulate them for free;</li>
      <li>publish them on chain from your own wallet;</li>
      <li>execute published connectors and get verifiable results;</li>
      <li>build Worlds that interpret those results inside the platform.</li>
    </ul>
    <p>
      Both clients are generated from the platform's OpenAPI specification, so request and response
      types match the API exactly. Agents can also use the <a href={resolve("/mcp")}>MCP server</a>,
      which offers the same operations as tools.
    </p>
    <div class="callout">
      <p>
        The SDK covers the <strong>chain API</strong>. Profiles, follows and World uploads belong to
        the separate services API, which uses Sign-In with Ethereum sessions; the SDK does not wrap
        it.
      </p>
    </div>
  </section>

  <section>
    <h2 id="installation">Installation</h2>
    <p>
      The SDK is distributed as GitHub release assets. JavaScript needs a runtime with
      <code>fetch</code> (modern browsers, Node.js 18 or later). Python needs version 3.9 or later.
    </p>
    <CodeBlock samples={samples.install} />
    <p>
      For production, pin a release so installs are reproducible. Replace <code>vX.Y.Z</code> with a
      version from the
      <a href="https://github.com/decentralised-art/sdk/releases">release list</a>:
    </p>
    <CodeBlock samples={samples.installPinned} />
    <p>
      The Python package already depends on <code>eth-account</code> for signing. In JavaScript,
      bring any wallet library; the examples use <a href="https://docs.ethers.org/v6/">ethers</a> v6.
    </p>
  </section>

  <section>
    <h2 id="quick-start">Quick start</h2>
    <p>
      Reading and executing need no account. This reads the published <code>pitch</code> connector and
      runs it on chain for eight steps:
    </p>
    <CodeBlock samples={samples.quickStart} />
    <p>
      Every code sample on this page has a JavaScript and a Python version. The tab you choose is
      remembered across the page.
    </p>
  </section>

  <section>
    <h2 id="concepts">Core concepts</h2>
    <p>
      For the ideas behind the platform, see <a href={resolve("/about")}>About</a>. This is what
      they mean for the SDK.
    </p>
    <h3>Transformations</h3>
    <p>
      A transformation is a small Solidity function that derives the next value from the current
      one. You write only its body. It receives <code>x</code> (a <code>uint32</code>) and
      <code>args</code> (a <code>uint32[]</code>) and returns a <code>uint32</code>. Its number of
      arguments, <code>args_count</code>, is derived from the highest <code>args[i]</code> it uses.
    </p>
    <h3>Conditions</h3>
    <p>
      A condition is a Solidity function body that receives <code>args</code> (an
      <code>int32[]</code>) and returns a <code>bool</code>. It is checked every time the connector
      it guards runs. When it returns <code>false</code>, the run stops with
      <code>ConditionNotMet</code>.
    </p>
    <h3>Connectors and dimensions</h3>
    <p>A connector is the runnable unit. It has one or more ordered <strong>dimensions</strong>.</p>
    <ul>
      <li>
        Each dimension has an ordered list of transformation calls (a name plus its arguments).
        Applied step by step, they generate that dimension's space of values.
      </li>
      <li>
        A dimension can point to another connector, its <code>composite</code>. The dimension's
        values are then passed to that connector as indexes, so it reads its own space at exactly
        those points. This is how connected connectors narrow a space down.
      </li>
      <li>
        A dimension without a composite is an open slot. A parent connector can fill open slots of
        its composites with <code>bindings</code> (slot id to connector name).
      </li>
      <li>A connector can be guarded by one condition, with its own arguments.</li>
    </ul>
    <h3>Running instances</h3>
    <p>
      A running instance controls where generation starts on a branch:
      <code>start_point</code> is the first index and <code>transformation_shift</code> offsets which
      transformation is applied first. Positions are numbered depth-first: 0 is the connector itself,
      then each dimension in order, with a composite's dimensions numbered right after the dimension that
      leads to it.
    </p>
    <p>
      A connector can fix running instances when it is created (<code>static_ri</code>), and a run
      can set others (<code>dynamic_ri</code>). A run cannot override a position the connector has
      already fixed; that run fails.
    </p>
    <h3>Particles and paths</h3>
    <p>
      A run returns one stream of values per output path, for example
      <code>{`{ path: "/pitch:0", data: [0, 1, 2, …] }`}</code>. The path names the connector and
      dimension that produced it; nested connectors extend it, as in
      <code>/phrase:0/pitch:0</code>. What the numbers mean (a pitch, a time, a colour, a speed) is
      up to the World that interprets them.
    </p>
    <h3>Formats</h3>
    <p>
      Every connector has a <code>format_hash</code> describing the shape of its output. Connectors with
      the same format produce compatible streams, so a World that accepts one can accept the others.
    </p>
    <h3>Names, drafts and published operations</h3>
    <p>
      Names are global. They start with a letter or underscore, contain only letters, digits and
      underscores, and are at most 128 characters long. A created operation cannot be changed or
      overwritten: create a new name for a new version. A draft reports <code>address</code>
      <code>"0x0"</code>; a published operation reports its contract address.
    </p>
  </section>

  <section>
    <h2 id="lifecycle">From draft to the network</h2>
    <p>Operations move through four distinct steps. Each one is its own call.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Step</th><th>Methods</th><th>Login</th><th>Gas</th><th>Where it runs</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Create</td>
            <td
              ><code>transformationPost</code>, <code>conditionPost</code>,
              <code>connectorPost</code></td
            >
            <td>Yes</td>
            <td>No</td>
            <td>Stored on the server as your draft</td>
          </tr>
          <tr>
            <td>Simulate</td>
            <td><code>simulate</code></td>
            <td>No</td>
            <td>No</td>
            <td>The server's local EVM</td>
          </tr>
          <tr>
            <td>Publish</td>
            <td
              ><code>publish</code>, or <code>publishPrepare</code> +
              <code>publishConfirm</code></td
            >
            <td>Yes, as the owner</td>
            <td>Yes, paid by the owner</td>
            <td>Ethereum (Sepolia during testing)</td>
          </tr>
          <tr>
            <td>Execute</td>
            <td><code>execute</code></td>
            <td>No</td>
            <td>No</td>
            <td>A read-only call to the chain at a pinned block</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Publishing is the only step that costs anything, and the cost is network gas paid from your
      own wallet. The server never holds your key.
    </p>
  </section>

  <section>
    <h2 id="configuration">Configuration</h2>
    <p>
      Both clients default to <code>https://api.decentralised.art/chain</code>. Set the
      <code>DECENTRALISED_ART_API_BASE</code> environment variable, or pass a base URL, to target another
      deployment, such as a local chain backend.
    </p>
    <CodeBlock samples={samples.configure} />
  </section>

  <section>
    <h2 id="authentication">Authentication</h2>
    <p>
      Reading, simulating and executing need no login. Creating and publishing need a bearer token,
      which you get by signing a one-time nonce with your Ethereum key:
    </p>
    <ol>
      <li>The client asks for a nonce for your address.</li>
      <li>You sign the message <code>Login nonce: &lt;nonce&gt;</code> (EIP-191).</li>
      <li>The server returns an access token, which the client stores and sends from then on.</li>
    </ol>
    <CodeBlock samples={samples.loginWallet} />
    <p>
      If you sign somewhere else (a hardware wallet, another service), submit the signature
      yourself:
    </p>
    <CodeBlock samples={samples.loginSignature} />
    <div class="callout callout-warning">
      <p>
        <strong>Access tokens are short-lived</strong>, currently five minutes. When a protected
        call returns <code>401</code>, log in again. Your drafts stay on the server; they belong to
        your address, not to the token.
      </p>
    </div>
    <p>
      The address you log in with owns everything you create, and only that address can publish it.
    </p>
  </section>

  <section>
    <h2 id="reading">Reading the network</h2>
    <p>
      Every operation can be read by name. Lookups return both published operations and drafts;
      check <code>address</code> to tell them apart. Transformation and condition lookups return their
      argument count but never their Solidity source.
    </p>
    <CodeBlock samples={samples.reading} />
    <h3>Pagination</h3>
    <p>
      List methods use cursors. Pass the <code>next_after</code> value of one page as
      <code>after</code> for the next, while <code>has_more</code> is true. Page sizes default to 50.
    </p>
    <CodeBlock samples={samples.pagination} />
  </section>

  <section>
    <h2 id="feed">Feed and live updates</h2>
    <p>
      The feed lists chain events newest first: <code>connector_added</code>,
      <code>transformation_added</code> and <code>condition_added</code>. Each item carries a
      compact payload (<code>type</code>, <code>name</code>, <code>owner</code>); read the full
      definition through the matching lookup.
    </p>
    <p>
      Items move through the statuses <code>observed</code>, <code>safe</code> and
      <code>finalized</code> as the chain confirms them, or become <code>removed</code> after a reorganisation.
      By default the feed includes items that are not finalized yet; ask for finalized items only when
      you need settled history.
    </p>
    <CodeBlock samples={samples.feed} />
    <h3>Live stream</h3>
    <p>
      <code>feedStream</code> opens a Server-Sent Events stream. It first replays events after
      <code>since_seq</code> (up to <code>limit</code>), sends a <code>stream_meta</code> event,
      then delivers new events as they happen. Remember the last <code>stream_seq</code> you processed
      and pass it back when you reconnect.
    </p>
    <CodeBlock samples={samples.feedStream} />
  </section>

  <section>
    <h2 id="creating">Creating operations</h2>
    <p>
      Creating an operation stores it on the server as your draft. Nothing is sent to the chain and
      it costs nothing. Creation fails with <code>409</code> if the name is already taken on chain.
    </p>
    <h3>Transformations</h3>
    <CodeBlock samples={samples.createTransformation} />
    <h3>Conditions</h3>
    <CodeBlock samples={samples.createCondition} />
    <h3>Connectors</h3>
    <p>
      A connector refers to transformations and conditions by name. They can be your drafts or
      published operations from anyone.
    </p>
    <CodeBlock samples={samples.createConnector} />
    <p>
      To build on another connector, point a dimension at it as a <code>composite</code>. A
      connector can also fix running instances with <code>static_ri</code>:
    </p>
    <CodeBlock samples={samples.createComposite} />
    <div class="table-wrap">
      <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>name</code></td><td>Required. Unique name for the connector.</td></tr>
          <tr>
            <td><code>dimensions</code></td>
            <td>
              Required, at least one. Each has <code>transformations</code> (ordered
              <code>{`{ name, args }`}</code> calls), and optionally <code>composite</code> and
              <code>bindings</code>.
            </td>
          </tr>
          <tr>
            <td><code>condition_name</code></td>
            <td>Optional. A condition checked on every run. Empty or omitted means none.</td>
          </tr>
          <tr
            ><td><code>condition_args</code></td><td
              >Optional. Integer arguments for the condition.</td
            ></tr
          >
          <tr>
            <td><code>static_ri</code></td>
            <td>
              Optional. Fixed running instances keyed by position (<code>"0"</code>,
              <code>"1"</code>, …).
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 id="simulating">Simulating</h2>
    <p>
      Simulation runs a connector in the server's local EVM, so you can try drafts before paying for
      anything. It also uses published operations your drafts depend on. It takes the same arguments
      as <code>execute</code> and returns the output streams.
    </p>
    <CodeBlock samples={samples.simulate} />
    <p>
      Simulation results have no chain provenance: they show what a connector would produce, not
      what the network has recorded.
    </p>
  </section>

  <section>
    <h2 id="publishing">Publishing</h2>
    <p>
      Publishing records a draft on chain under your address. You pay the gas from your own wallet;
      the transaction never transfers any other value. The server rebuilds exactly the definition it
      stored when you created the draft, so the published operation matches what you simulated.
    </p>
    <h3>Publish with a local key</h3>
    <p>
      <code>publish</code> does everything in one call and needs no chain RPC endpoint: it prepares the
      transaction, signs it locally with the wallet or account you logged in with, lets the server broadcast
      it, and confirms it until it is mined. If the registry already holds exactly this operation, it
      returns without signing anything.
    </p>
    <CodeBlock samples={samples.publishRelay} />
    <h3>Publish from a browser wallet</h3>
    <p>
      Browser wallets such as MetaMask send transactions themselves and cannot sign offline, so
      <code>publish</code> stops with an explanation before anything is signed or sent. Use the two-step
      flow instead: prepare the transaction, let the wallet send it, then confirm it.
    </p>
    <CodeBlock code={samples.publishBrowser.code} lang="ts" caption="JavaScript" />
    <h3>Step by step</h3>
    <p>
      The steps behind <code>publish</code> are available separately, for custom signers. With
      <code>relay</code>, the prepared answer also contains the account nonce and fees needed to
      sign offline.
    </p>
    <CodeBlock samples={samples.publishSteps} />
    <h3>Rules to know</h3>
    <ul>
      <li>
        <strong>Dependencies first.</strong> A connector can only be published once every
        transformation, condition and connector it uses is published with the same definition.
        Otherwise preparing fails with <code>409</code> and lists them under <code>missing</code>
        and <code>mismatched</code>. Dependencies are never published automatically.
      </li>
      <li>
        <strong>One at a time per owner.</strong> Publications from one address share a nonce. Publish
        serially, and resolve a pending publication before preparing the next.
      </li>
      <li>
        <strong>Keep the transaction hash.</strong> If a confirmation is interrupted, confirm again with
        the same hash. Do not prepare and send a new transaction.
      </li>
      <li>
        <strong>Mined is not instantly executable.</strong> Execution reads the chain at a safe block,
        so a just-mined operation can take a short while to become available. Retry the execution later
        instead of publishing again.
      </li>
      <li>
        <strong>Fee and chain limits.</strong> <code>maxFeePerGas</code> and <code>chainId</code>
        make <code>publish</code> refuse to sign anything more expensive, or for another chain.
        During testing, publications go to Sepolia (chain id <code>11155111</code>).
      </li>
    </ul>
  </section>

  <section>
    <h2 id="executing">Executing on chain</h2>
    <p>
      <code>execute</code> runs a published connector through the on-chain runner. It is a read-only call:
      no login, no transaction and no gas. The result is pinned to a block, so anyone can check it by
      calling the same runner at the same block.
    </p>
    <CodeBlock samples={samples.execute} />
    <div class="table-wrap">
      <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
          <tr
            ><td><code>particles</code></td><td
              >Output streams: <code>{`{ path, data }`}</code> per path.</td
            ></tr
          >
          <tr
            ><td><code>block_number</code>, <code>block_hash</code></td><td
              >The block the call was pinned to.</td
            ></tr
          >
          <tr
            ><td><code>runner</code></td><td>Address of the runner contract that executed it.</td
            ></tr
          >
        </tbody>
      </table>
    </div>
    <p>
      The step count must be between 1 and 65536. Running instances (up to 4096) are keyed by
      position, as described in <a href="#concepts">Core concepts</a>. Keep the block and runner
      together with the values whenever you store or share a result.
    </p>
  </section>

  <section>
    <h2 id="errors">Errors</h2>
    <p>
      A response outside the 2xx range raises <code>DecentralisedArtApiError</code>, carrying the
      HTTP status and the decoded response body. Network failures surface as the runtime's own
      errors.
    </p>
    <CodeBlock samples={samples.errors} />
    <div class="table-wrap">
      <table>
        <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr
            ><td><code>400</code></td><td
              >Invalid request, or the runner rejected the execution (for example a condition was
              not met).</td
            ></tr
          >
          <tr><td><code>401</code></td><td>Missing or expired access token. Log in again.</td></tr>
          <tr
            ><td><code>403</code></td><td
              >You do not own the operation, or publication is disabled on this server.</td
            ></tr
          >
          <tr><td><code>404</code></td><td>No operation with that name.</td></tr>
          <tr>
            <td><code>409</code></td>
            <td>
              The name is taken on chain, dependencies are missing or different, or the account
              nonce is already in use.
            </td>
          </tr>
          <tr
            ><td><code>503</code></td><td
              >The chain provider or artifact storage is temporarily unavailable. Retry later.</td
            ></tr
          >
        </tbody>
      </table>
    </div>
    <p>
      A pending publication is not an error: <code>publishConfirm</code> returns it with
      <code>status: "pending"</code> (HTTP 202).
    </p>
  </section>

  <section>
    <h2 id="worlds">Building a World</h2>
    <p>
      A World is a web page that interprets connector output as sound, image or interaction. It is a
      static bundle (HTML, JavaScript, CSS and assets) that the platform shows in a sandboxed
      iframe, on its World page and inside Studio.
    </p>
    <p>
      A World cannot reach the network on its own. It talks to the page that hosts it through the
      <strong>World runtime</strong>, and the host makes each call on its behalf, but only if the
      World's manifest grants the permission for it. The World never holds a token or a key.
    </p>
    <h3>Bundle layout</h3>
    <p>
      Upload a ZIP with <code>world-manifest.json</code> at its root, the HTML entry file it names, and
      everything the page loads. Limits: 25 MB compressed, 100 MB extracted, 1000 files.
    </p>
    <CodeBlock code={samples.worldZip} lang="bash" caption="Packaging" />
    <h3>Entry script</h3>
    <p>
      Import the runtime the platform serves instead of bundling it, so every World uses the same
      build. Subscribe to state, then announce that the World is ready:
    </p>
    <CodeBlock code={samples.worldScript} lang="ts" caption="world.js" />
    <p>
      Upload the ZIP from <a href={resolve("/worlds/upload")}>Upload a World</a> while signed in. The
      upload page validates the bundle before publishing it to the gallery.
    </p>
  </section>

  <section>
    <h2 id="world-manifest">World manifest</h2>
    <CodeBlock code={samples.worldManifest} lang="json" caption="world-manifest.json" />
    <div class="table-wrap">
      <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>schemaVersion</code></td><td>Required. Currently <code>1</code>.</td></tr>
          <tr
            ><td><code>slug</code></td><td
              >Required. Lowercase letters, digits and dashes, up to 80 characters.</td
            ></tr
          >
          <tr
            ><td><code>name</code>, <code>version</code>, <code>description</code></td><td
              >Required. Shown in the gallery and on the World page.</td
            ></tr
          >
          <tr
            ><td><code>entry</code></td><td
              >Required. Path of the HTML entry file inside the ZIP.</td
            ></tr
          >
          <tr><td><code>runtime</code></td><td>Required. Always <code>"iframe"</code>.</td></tr>
          <tr>
            <td><code>surfaces</code></td>
            <td>
              Required, at least one: <code>"world-page"</code> (its own page) and/or
              <code>"studio-plugin"</code> (inside Studio).
            </td>
          </tr>
          <tr
            ><td><code>permissions</code></td><td
              >What the World may ask the host to do. See below.</td
            ></tr
          >
          <tr>
            <td><code>acceptedConnectorSets</code></td>
            <td>
              Connector names the World understands, with optional extras. Declare these or
              <code>acceptedFormatHashes</code>; at least one is required.
            </td>
          </tr>
          <tr><td><code>acceptedFormatHashes</code></td><td>Formats the World understands.</td></tr>
          <tr>
            <td><code>valueLimits</code></td>
            <td>
              Optional ranges for <code>particlesCount</code> and for values on specific output paths.
              The host enforces the step count range on every call.
            </td>
          </tr>
          <tr
            ><td><code>preview</code></td><td
              >Gallery image inside the ZIP: PNG, JPEG or WebP, up to 8 MB.</td
            ></tr
          >
          <tr>
            <td><code>shortDescription</code>, <code>heroLabel</code>, <code>accentColor</code></td>
            <td>Optional presentation details.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <h3>Permissions</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Permission</th><th>Allows</th></tr></thead>
        <tbody>
          <tr>
            <td><code>decentralised.art.connectors.read</code></td>
            <td
              ><code>connectorGet</code>, <code>connectorExists</code>, <code>listFormats</code>,
              <code>formatInfo</code></td
            >
          </tr>
          <tr>
            <td><code>decentralised.art.transformations.read</code></td>
            <td><code>transformationGet</code>, <code>transformationExists</code></td>
          </tr>
          <tr>
            <td><code>decentralised.art.conditions.read</code></td>
            <td><code>conditionGet</code>, <code>conditionExists</code></td>
          </tr>
          <tr><td><code>decentralised.art.social.read</code></td><td><code>feed</code></td></tr>
          <tr
            ><td><code>decentralised.art.execute</code></td><td
              ><code>execute</code>, <code>simulate</code></td
            ></tr
          >
          <tr><td><code>browser.audio</code></td><td>Playing audio.</td></tr>
          <tr><td><code>browser.downloads</code></td><td>Offering files for download.</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 id="world-runtime">World runtime API</h2>
    <p>
      <code>createWorldSdk(options)</code> returns the object a World uses for everything. Create it once.
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Option</th><th>Description</th></tr></thead>
        <tbody>
          <tr
            ><td><code>worldId</code></td><td>Required. The World's id, echoed in every message.</td
            ></tr
          >
          <tr><td><code>requestTimeoutMs</code></td><td>Timeout per call. Default 15000.</td></tr>
          <tr>
            <td><code>channelToken</code></td>
            <td
              >Defaults to the <code>worldChannel</code> URL parameter the host adds. Rarely needed.</td
            >
          </tr>
          <tr>
            <td><code>targetOrigin</code>, <code>expectedOrigin</code></td>
            <td>Restrict which origin messages go to and come from. Inferred by default.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Method</th><th>Description</th></tr></thead>
        <tbody>
          <tr
            ><td><code>ready()</code></td><td
              >Tell the host the World is listening. Calls before this are rejected.</td
            ></tr
          >
          <tr
            ><td><code>onState(callback)</code></td><td
              >Receive state from the host. Returns an unsubscribe function.</td
            ></tr
          >
          <tr
            ><td><code>reportRendered(requestId?)</code></td><td
              >Tell the host a state has been rendered.</td
            ></tr
          >
          <tr
            ><td><code>reportError(message)</code></td><td
              >Report an unrecoverable error to the host.</td
            ></tr
          >
          <tr>
            <td
              ><code>connectorGet</code>, <code>transformationGet</code>, <code>conditionGet</code>,
              and their <code>…Exists</code> versions</td
            >
            <td>Read operations. Results are cached for the life of the World.</td>
          </tr>
          <tr
            ><td><code>listFormats</code>, <code>formatInfo</code>, <code>feed</code></td><td
              >Same as on the client; page size 1–100.</td
            ></tr
          >
          <tr>
            <td><code>execute</code>, <code>simulate</code></td>
            <td>Run a connector. Up to 100 running instances per call.</td>
          </tr>
          <tr
            ><td><code>dispose()</code></td><td>Stop listening and reject calls still in flight.</td
            ></tr
          >
        </tbody>
      </table>
    </div>
    <CodeBlock code={samples.worldCalls} lang="ts" caption="Inside a World" />
    <h3>State from the platform</h3>
    <p>
      When the platform shows a World, it pushes state whose <code>payload</code> describes the current
      composition. The fields a World usually needs:
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
          <tr
            ><td><code>executeOutput</code></td><td
              >Output streams to interpret: <code>{`[{ path, data }]`}</code>.</td
            ></tr
          >
          <tr><td><code>connectorName</code></td><td>The connector that produced them.</td></tr>
          <tr><td><code>particlesCount</code></td><td>Number of steps.</td></tr>
          <tr>
            <td><code>executionMode</code></td>
            <td
              ><code>"execute"</code> for on-chain results, <code>"simulate"</code> for simulation.</td
            >
          </tr>
          <tr
            ><td><code>executionProvenance</code></td><td
              >Block and runner of an on-chain result.</td
            ></tr
          >
          <tr
            ><td><code>surface</code></td><td
              ><code>"world-page"</code> or <code>"studio-plugin"</code>.</td
            ></tr
          >
        </tbody>
      </table>
    </div>
    <p>Treat any other fields as optional; more may be added over time.</p>
    <h3>Call errors</h3>
    <p>
      A rejected call throws <code>WorldRpcCallError</code> with a <code>code</code>:
      <code>permission_denied</code> (missing permission), <code>bad_request</code> (invalid
      arguments, or a call before <code>ready()</code>), <code>unknown_method</code>,
      <code>host_error</code> (the API call failed; <code>status</code> holds its HTTP status) or
      <code>timeout</code>.
    </p>
  </section>

  <section>
    <h2 id="world-host">Hosting Worlds</h2>
    <p>
      To show Worlds in your own application, use the host side,
      <code>createWorldHost</code> from <code>decentralised-art/worlds/host</code>. It answers a
      World's calls with your client, enforces the World's permissions and value limits, and pushes
      state to it.
    </p>
    <CodeBlock code={samples.worldHost} lang="ts" caption="Host page" />
    <ul>
      <li>
        Load the World in an iframe with <code>sandbox="allow-scripts"</code> and without
        <code>allow-same-origin</code>, so it cannot reach your page or its storage.
      </li>
      <li>
        Each mount gets a random channel token, added to the iframe URL by
        <code>worldUrl()</code>. Messages without it are ignored in both directions.
      </li>
      <li>
        Pass the permissions and value limits from the World's validated manifest, never from the
        World itself.
      </li>
    </ul>
  </section>

  <section>
    <h2 id="reference">Client methods</h2>
    <p>
      The JavaScript client is <code>DecentralisedArtClient</code>; the Python client is
      <code>decentralised_art.Client</code>. Responses use the API's field names (<code
        >format_hash</code
      >, <code>block_number</code>, …) in both languages. Python returns typed models with a
      <code>to_dict()</code> method.
    </p>
    <div class="table-wrap">
      <table class="method-table">
        <thead><tr><th>Method</th><th>Description</th></tr></thead>
        <tbody>
          {#each methods as [jsName, pyName, auth, text] (jsName)}
            <tr>
              <td>
                <span class="method-lang">JS</span> <code>{jsName}</code><br />
                <span class="method-lang">PY</span> <code>{pyName}</code>
              </td>
              <td>
                {#if auth}<span class="method-auth">Login</span>{/if}
                {text}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 id="cli">Python CLI</h2>
    <p>
      The Python package installs a small command, <code>decentralised-art-auth</code>, for quick
      checks against an API. It prints JSON.
    </p>
    <CodeBlock code={samples.cli} lang="bash" caption="Terminal" />
  </section>

  <section>
    <h2 id="versions">Versions and source</h2>
    <ul>
      <li>
        Source, issues and releases:
        <a href="https://github.com/decentralised-art/sdk">github.com/decentralised-art/sdk</a>.
      </li>
      <li>
        The clients are generated from the OpenAPI contracts in
        <a href="https://github.com/decentralised-art/api-spec">api-spec</a>, and a release is tied
        to one version of them. The live API reports its own version through <code>version()</code>.
      </li>
      <li>
        Endpoint-level details are in the <a href={resolve("/api-reference")}>API reference</a>, and
        the current state of the services is on <a href={resolve("/api-status")}>API status</a>.
      </li>
    </ul>
  </section>
</DocsLayout>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .method-table td:first-child {
    width: 55%;
    line-height: 2;
  }

  .method-table td:first-child code {
    white-space: normal;
  }

  .method-lang {
    display: inline-block;
    width: 1.6rem;
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }

  .method-auth {
    display: inline-block;
    margin-right: 0.35rem;
    padding: 0 0.4rem;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-accent);
  }
</style>
