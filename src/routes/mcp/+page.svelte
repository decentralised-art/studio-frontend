<script lang="ts">
  import { resolve } from "$app/paths";

  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import DocsLayout, { type DocsSectionGroup } from "$lib/site/docs/DocsLayout.svelte";
  import * as samples from "$lib/site/docs/mcpSamples";
  import Seo from "$lib/seo/Seo.svelte";
  import { techArticleJsonLd } from "$lib/seo/site";

  const description =
    "Connect your AI agent to decentralised.art. The MCP server gives Claude, Codex, Cursor and other MCP hosts tools to explore the network, create and simulate operations, publish them on chain and execute connectors.";

  const groups: DocsSectionGroup[] = [
    {
      label: "Getting started",
      sections: [
        { id: "overview", label: "Overview" },
        { id: "installation", label: "Installation" },
        { id: "connect", label: "Connect your agent" },
        { id: "verify", label: "Check the connection" },
      ],
    },
    {
      label: "Guides",
      sections: [
        { id: "workflow", label: "Working with your agent" },
        { id: "prompts", label: "Example prompts" },
        { id: "configuration", label: "Configuration" },
        { id: "publishing", label: "Publishing safely" },
        { id: "results", label: "Results and errors" },
        { id: "security", label: "Keys and security" },
      ],
    },
    {
      label: "Reference",
      sections: [
        { id: "tools", label: "Tools" },
        { id: "resources", label: "Resources" },
        { id: "cli", label: "Command line" },
        { id: "versions", label: "Versions and source" },
      ],
    },
  ];

  type Tool = { name: string; args: string; text: string; login?: boolean };

  const toolGroups: { title: string; tools: Tool[] }[] = [
    {
      title: "Discover and read",
      tools: [
        {
          name: "core.get_connector",
          args: "name",
          text: "A connector's definition, owner, address and format hash.",
        },
        {
          name: "core.get_transformation",
          args: "name",
          text: "Name, args_count, owner and address.",
        },
        { name: "core.get_condition", args: "name", text: "Name, args_count, owner and address." },
        { name: "core.connector_exists", args: "name", text: "Whether a connector exists." },
        {
          name: "core.transformation_exists",
          args: "name",
          text: "Whether a transformation exists.",
        },
        { name: "core.condition_exists", args: "name", text: "Whether a condition exists." },
        {
          name: "core.list_formats",
          args: "limit, after",
          text: "Format hashes known to the network.",
        },
        {
          name: "core.get_format",
          args: "format_hash, limit, after",
          text: "Connectors and scalar labels that share one format.",
        },
        {
          name: "core.get_account",
          args: "address, limit, after_connectors, after_transformations, after_conditions",
          text: "What an address has published.",
        },
        {
          name: "core.get_feed_page",
          args: "limit, before, type, include_unfinalized",
          text: "Newest-first page of chain events.",
        },
        {
          name: "core.get_feed_stream_replay",
          args: "since_seq, limit",
          text: "A bounded replay of the live event stream, for catching up.",
        },
        {
          name: "core.get_nonce",
          args: "address",
          text: "The login nonce and sign-in message for an address.",
        },
      ],
    },
    {
      title: "Create drafts",
      tools: [
        {
          name: "core.create_transformation",
          args: "payload",
          text: "Create a transformation draft: name and Solidity body. No gas.",
          login: true,
        },
        {
          name: "core.create_condition",
          args: "payload",
          text: "Create a condition draft: name and Solidity body. No gas.",
          login: true,
        },
        {
          name: "core.create_connector",
          args: "payload",
          text: "Create a connector draft from dimensions, an optional condition and running instances. No gas.",
          login: true,
        },
        {
          name: "core.build_parent_connector",
          args: "name, child_names",
          text: "Build (but not create) a connector payload with one dimension per child connector.",
        },
      ],
    },
    {
      title: "Run",
      tools: [
        {
          name: "core.simulate_connector",
          args: "connector_name, particles_count, dynamic_ri",
          text: 'Run drafts in the server\'s local EVM. Returns particles with execution_mode "simulation".',
        },
        {
          name: "core.execute_connector",
          args: "connector_name, particles_count, dynamic_ri",
          text: 'Run a published connector on chain at a pinned block. Returns particles with block_number, block_hash, runner, registry and execution_mode "chain".',
        },
      ],
    },
    {
      title: "Publish",
      tools: [
        {
          name: "core.prepare_publication",
          args: "kind, name",
          text: "Show the transaction and fees a publication would need. Signs and sends nothing.",
          login: true,
        },
        {
          name: "core.publish_entity",
          args: "kind, name, max_fee_per_gas, max_total_fee, record_path, chain_id, max_confirm_attempts",
          text: "Sign locally, relay once and confirm. Spends the owner's gas. See Publishing safely.",
          login: true,
        },
        {
          name: "core.confirm_publication",
          args: "kind, name, content_hash, tx_hash",
          text: "Check the receipt of a publication already sent. Never sends another.",
          login: true,
        },
      ],
    },
    {
      title: "Helpers",
      tools: [
        {
          name: "core.ensure_preflight",
          args: "required_connectors, preferred_transformation_pairs",
          text: "Log in, check that the given connectors exist, and pick an available add/subtract transformation pair.",
          login: true,
        },
        {
          name: "core.resolve_transformation_pair",
          args: "pairs",
          text: "Pick the first add/subtract transformation pair that exists on the network.",
        },
      ],
    },
  ];
</script>

<Seo
  title="MCP"
  {description}
  path="/mcp"
  markdownPath="/mcp.md"
  type="article"
  jsonLd={[techArticleJsonLd("/mcp", "MCP", description)]}
/>

<DocsLayout title="MCP" {description} {groups}>
  <section>
    <h2 id="overview">Overview</h2>
    <p>
      The <strong>decentralised.art MCP server</strong> connects AI agents to the network through
      the <a href="https://modelcontextprotocol.io">Model Context Protocol</a>. Add it to an MCP
      host such as Claude Code, Claude Desktop, Codex, Cursor or VS Code, and your agent can work
      with the network directly:
    </p>
    <ul>
      <li>
        find and read connectors, transformations, conditions, formats, accounts and new events;
      </li>
      <li>create its own operations as drafts and simulate them for free;</li>
      <li>publish them on chain from your account, within fee limits you set;</li>
      <li>execute published connectors and keep verifiable results.</li>
    </ul>
    <p>
      The server runs on your computer and talks to the public chain API at
      <code>https://api.decentralised.art/chain</code>. Your agent does not need to run inside this
      website: it works from any environment that can start the server. Reading, simulating and
      executing need no account; creating and publishing need a private key that stays on your
      machine.
    </p>
    <p>
      The server's tools are format-agnostic: they handle values and structure, not what the values
      mean. Interpreting results as notes, images or motion is up to the agent and the Worlds it
      feeds. If you are writing code rather than working with an agent, use the
      <a href={resolve("/sdk")}>SDK</a>; both reach the same API.
    </p>
    <p>
      Your agent can also read this documentation directly:
      <a href={resolve("/llms.txt")} data-sveltekit-reload>llms.txt</a> lists every docs page in
      markdown (add <code>.md</code> to a page's address, as in
      <a href={resolve("/[page=markdownPage].md", { page: "mcp" })} data-sveltekit-reload>/mcp.md</a
      >), and <a href={resolve("/llms-full.txt")} data-sveltekit-reload>llms-full.txt</a> contains all
      of it in one file.
    </p>
  </section>

  <section>
    <h2 id="installation">Installation</h2>
    <p>
      The server is installed from source. You need <strong>Python 3.10 or later</strong> and
      <code>git</code>; <code>make</code> is used on macOS and Linux. The setup creates a private virtual
      environment inside the folder, so nothing is installed system-wide.
    </p>
    <CodeBlock samples={samples.install} />
    <p>
      Keep the folder where it is: your MCP host starts the server from it. The examples below use
      <code>/path/to/mcp</code> for that folder; replace it with the full path on your machine.
    </p>
  </section>

  <section>
    <h2 id="connect">Connect your agent</h2>
    <p>
      Register the server with your host. Every host needs the same three things: the Python inside
      the folder's virtual environment, the arguments <code
        >-m decentralised_art_mcp.server stdio</code
      >, and the environment variables from <a href="#configuration">Configuration</a>.
    </p>
    <CodeBlock samples={samples.hosts} />
    <p>
      Restart the host, or open a new session, after adding the server; hosts usually load MCP
      servers only at start-up. <code>PRIVATE_KEY</code> is optional: leave it out to use the server for
      reading, simulating and executing only.
    </p>
    <h3>Sharing a project configuration</h3>
    <p>
      Claude Code can read servers from a <code>.mcp.json</code> file committed with a project. Never
      put a key in that file; reference an environment variable instead:
    </p>
    <CodeBlock code={samples.projectConfig} lang="json" caption=".mcp.json" />
  </section>

  <section>
    <h2 id="verify">Check the connection</h2>
    <p>Ask your agent something that needs the network, for example:</p>
    <ul>
      <li><em>“Use the decentralised.art MCP to list the formats on the network.”</em></li>
      <li><em>“Read the core.primer resource and summarise how execution works.”</em></li>
    </ul>
    <p>
      If the tools do not appear, check that the path to <code>.venv/bin/python</code> is absolute
      and that you restarted the host. To test the server on its own, open it in the
      <a href="https://modelcontextprotocol.io/docs/tools/inspector">MCP Inspector</a>:
    </p>
    <CodeBlock code={samples.inspector} lang="bash" caption="Terminal" />
  </section>

  <section>
    <h2 id="workflow">Working with your agent</h2>
    <p>
      A good session builds on what others have published rather than starting from nothing. The
      agent should show you what exists, explain it, and agree with you before it spends anything. A
      typical path:
    </p>
    <ol>
      <li>
        <strong>Discover.</strong> Browse the feed, formats and accounts; read the operations that look
        useful.
      </li>
      <li>
        <strong>Understand.</strong> Read connector graphs and run published connectors with
        <code>core.execute_connector</code> to see what they produce.
      </li>
      <li>
        <strong>Compose.</strong> Create your own transformations, conditions and connectors as drafts,
        reusing published ones by name.
      </li>
      <li>
        <strong>Try.</strong> Run the drafts with <code>core.simulate_connector</code>. This is
        free.
      </li>
      <li>
        <strong>Publish.</strong> When you are happy, publish dependencies first, then the connector that
        uses them, with explicit fee limits.
      </li>
      <li>
        <strong>Run on chain.</strong> Execute the published connector and keep the whole result, with
        its block, runner and registry, as the reference for what the network produced.
      </li>
    </ol>
    <p>
      Drafts, simulation and publication follow the same rules as everywhere on the platform; see
      <a href={resolve("/sdk")}>SDK → Core concepts</a> for transformations, conditions, dimensions and
      running instances.
    </p>
  </section>

  <section>
    <h2 id="prompts">Example prompts</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>You ask</th><th>The agent uses</th></tr></thead>
        <tbody>
          <tr>
            <td>“What has been published on decentralised.art recently? Explain each connector.”</td
            >
            <td><code>core.get_feed_page</code>, <code>core.get_connector</code></td>
          </tr>
          <tr>
            <td
              >“Run the pitch connector for 16 steps on chain and show me the values with the
              block.”</td
            >
            <td><code>core.execute_connector</code></td>
          </tr>
          <tr>
            <td>
              “Create a transformation shift_up that adds its first argument, then a connector that
              uses add and shift_up, and simulate 16 steps.”
            </td>
            <td>
              <code>core.create_transformation</code>, <code>core.create_connector</code>,
              <code>core.simulate_connector</code>
            </td>
          </tr>
          <tr>
            <td>“What would publishing shift_up cost?”</td>
            <td><code>core.prepare_publication</code></td>
          </tr>
          <tr>
            <td>
              “Publish shift_up with at most 50 gwei per gas and 0.005 ETH in total, recorded in
              publications/shift_up.json.”
            </td>
            <td><code>core.publish_entity</code></td>
          </tr>
          <tr>
            <td>“Which connectors share pitch's format?”</td>
            <td><code>core.get_connector</code>, <code>core.get_format</code></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 id="configuration">Configuration</h2>
    <p>The server reads these environment variables when it starts:</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Variable</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr>
            <td><code>API_BASE</code></td>
            <td><code>https://api.decentralised.art/chain</code></td>
            <td>The chain API to use.</td>
          </tr>
          <tr>
            <td><code>PRIVATE_KEY</code></td>
            <td>none</td>
            <td>
              Ethereum key for logging in, creating drafts and publishing. Not needed for reading,
              simulating or executing.
            </td>
          </tr>
          <tr>
            <td><code>DECENTRALISED_ART_TIMEOUT</code></td>
            <td><code>15</code></td>
            <td>Seconds per API request, between 0.1 and 120.</td>
          </tr>
          <tr>
            <td><code>DECENTRALISED_ART_ARTIFACT_ROOT</code></td>
            <td><code>decentralised-art-mcp-artifacts</code></td>
            <td>
              Folder for publication records. Use an absolute path; a relative one depends on where
              the host starts the server.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Tools that call the API also accept <code>api_base</code> and <code>timeout</code> arguments
      to override these for a single call, and authenticated tools accept <code>private_key</code>.
      Prefer the environment variable for keys, so they never appear in the conversation.
    </p>
    <p>
      The server logs in to the chain API by signing the issued sign-in message with your key. That
      login is separate from signing in to this website.
    </p>
  </section>

  <section>
    <h2 id="publishing">Publishing safely</h2>
    <p>
      <code>core.publish_entity</code> is the only tool that spends anything. It publishes one draft under
      your address and pays the gas from your account. It is built so that an agent cannot overspend or
      publish twice by accident:
    </p>
    <ul>
      <li>
        <strong>Fee limits are required.</strong> <code>max_fee_per_gas</code> caps the price per
        unit of gas and <code>max_total_fee</code> caps the whole transaction (gas limit × max fee), both
        in wei. The tool refuses to sign anything above them.
      </li>
      <li>
        <strong>Every publication has a record.</strong> <code>record_path</code> is a file inside
        <code>DECENTRALISED_ART_ARTIFACT_ROOT</code>. The transaction is written to it before it is
        sent. Calling the tool again with the same record only confirms that transaction; it never
        sends another.
      </li>
      <li>
        <strong>Only zero-value transactions to the expected chain.</strong> The tool checks the
        owner, the chain (<code>chain_id</code>, Sepolia <code>11155111</code> by default) and that no
        value is transferred before it signs.
      </li>
      <li>
        <strong>Your key never leaves your machine.</strong> The transaction is signed locally and the
        API relays it; no RPC endpoint of your own is needed.
      </li>
    </ul>
    <CodeBlock code={samples.publishCall} lang="json" caption="Tool call" />
    <p>
      For reference: 50 gwei is <code>50000000000</code> wei and 0.005 ETH is
      <code>5000000000000000</code> wei.
    </p>
    <h3>Rules for agents</h3>
    <ul>
      <li>
        <strong>Inspect first.</strong> Use <code>core.prepare_publication</code> to see the fees, and
        confirm them with the person before publishing.
      </li>
      <li>
        <strong>Dependencies first.</strong> Transformations, conditions and child connectors must
        be published before the connector that uses them. Otherwise the call fails and lists them
        under
        <code>missing</code> or <code>mismatched</code>.
      </li>
      <li>
        <strong>One publication at a time per owner.</strong> Publications from one address share a nonce,
        so separate sessions must not publish for the same key in parallel.
      </li>
      <li>
        <strong>Pending is not failure.</strong> If a publication is still pending or its outcome is
        unknown, the tool returns <code>publication_pending</code> with the transaction hash.
        Confirm it with the same record, or with <code>core.confirm_publication</code>, before doing
        anything else.
      </li>
      <li>
        <strong>Mined is not instantly executable.</strong> Execution reads the chain at a safe block,
        so a freshly mined connector can take a short while to become available. Retry the execution;
        do not republish, and never present a simulation as an on-chain result.
      </li>
    </ul>
  </section>

  <section>
    <h2 id="results">Results and errors</h2>
    <p>
      Every tool returns the same envelope, as structured content and as JSON text. A successful
      call carries <code>data</code>:
    </p>
    <CodeBlock code={samples.toolCall} lang="json" caption="Tool call" />
    <CodeBlock code={samples.toolResult} lang="json" caption="Result" />
    <p>A failed call is marked as an error and carries <code>error</code> instead:</p>
    <CodeBlock code={samples.toolError} lang="json" caption="Error" />
    <div class="table-wrap">
      <table>
        <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr
            ><td><code>validation_error</code></td><td
              >Invalid or missing arguments, or a fee or chain check refused to sign.</td
            ></tr
          >
          <tr
            ><td><code>auth_configuration_error</code></td><td
              >The tool needs a key and none, or an invalid one, is configured.</td
            ></tr
          >
          <tr>
            <td><code>http_error</code></td>
            <td
              >The API rejected the request. <code>details.status_code</code> holds the status, and
              publication conflicts list <code>missing</code> and <code>mismatched</code> dependencies.</td
            >
          </tr>
          <tr
            ><td><code>publication_pending</code></td><td
              >A publication is pending or its outcome is unknown. <code>details</code> holds the transaction
              to confirm.</td
            ></tr
          >
          <tr
            ><td><code>tool_not_found</code>, <code>resource_not_found</code></td><td
              >Unknown tool or resource name.</td
            ></tr
          >
          <tr
            ><td><code>internal_tool_error</code></td><td>Unexpected failure inside the server.</td
            ></tr
          >
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 id="security">Keys and security</h2>
    <ul>
      <li>
        Use a <strong>dedicated key</strong> for your agent, funded only with what it should be able to
        spend. During testing, publications use Sepolia test ETH.
      </li>
      <li>
        Give the key to the server through <code>PRIVATE_KEY</code> or the host's secret settings, not
        in a prompt. Keep it out of files you commit or share.
      </li>
      <li>Leave the key out entirely if the agent only needs to explore, simulate and execute.</li>
      <li>
        The server never sends your key anywhere. It signs the sign-in message and publication
        transactions locally.
      </li>
    </ul>
  </section>

  <section>
    <h2 id="tools">Tools</h2>
    <p>
      All tools live in the <code>core</code> namespace. Every tool that calls the API also accepts
      <code>api_base</code> and <code>timeout</code>; tools marked <strong>Login</strong> accept
      <code>private_key</code> and need a key from it or from the environment.
    </p>
    {#each toolGroups as group (group.title)}
      <h3>{group.title}</h3>
      <div class="table-wrap">
        <table class="tool-table">
          <thead><tr><th>Tool and arguments</th><th>Description</th></tr></thead>
          <tbody>
            {#each group.tools as tool (tool.name)}
              <tr>
                <td>
                  <code>{tool.name}</code>
                  <span class="tool-args">{tool.args}</span>
                </td>
                <td>
                  {#if tool.login}<span class="tool-login">Login</span>{/if}
                  {tool.text}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
    <p>
      Draft payloads use the same fields as the API: see
      <a href={resolve("/sdk")}>SDK → Creating operations</a>. Running-instance overrides (<code
        >dynamic_ri</code
      >) and step counts (1–65536) work as described in
      <a href={resolve("/sdk")}>SDK → Executing on chain</a>.
    </p>
  </section>

  <section>
    <h2 id="resources">Resources</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Resource</th><th>Description</th></tr></thead>
        <tbody>
          <tr>
            <td
              ><code>core.primer</code><br /><code>decentralised-art://resource/core.primer</code
              ></td
            >
            <td>
              A short primer for agents: connectors, dimensions, running instances, the draft →
              simulate → publish → execute lifecycle, and the publication rules above. Ask your
              agent to read it at the start of a session.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 id="cli">Command line</h2>
    <p>
      The same tools can be called without an MCP host, which is useful for scripts and for checking
      a setup:
    </p>
    <CodeBlock code={samples.cli} lang="bash" caption="Terminal" />
    <p>
      The repository's <code>make</code> targets wrap the common tasks: <code>make install</code>,
      <code>make smoke</code>, <code>make test</code>, <code>make stdio</code> (run the server),
      <code>make mcpb</code> (Claude Desktop bundle), <code>make list-tools</code> and
      <code>make list-resources</code>.
    </p>
  </section>

  <section>
    <h2 id="versions">Versions and source</h2>
    <ul>
      <li>
        Source and issues:
        <a href="https://github.com/decentralised-art/mcp">github.com/decentralised-art/mcp</a>.
        Update with <code>git pull</code> followed by <code>make install</code>, then restart your
        host. When upgrading from a version before 0.2.0, follow the upgrade notes in the README:
        some names changed.
      </li>
      <li>
        Requests and responses are checked against the OpenAPI contracts in
        <a href="https://github.com/decentralised-art/api-spec">api-spec</a>, packaged with the
        server.
      </li>
      <li>
        Related: the <a href={resolve("/sdk")}>SDK</a> for code, the
        <a href={resolve("/api-reference")}>API reference</a> for endpoints, and
        <a href={resolve("/api-status")}>API status</a> for the live services.
      </li>
    </ul>
  </section>
</DocsLayout>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .tool-table td:first-child {
    width: 50%;
  }

  .tool-args {
    display: block;
    margin-top: 0.3rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  .tool-login {
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
