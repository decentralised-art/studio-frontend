<script lang="ts">
  import { resolve } from "$app/paths";

  import ApiEndpoint from "$lib/site/docs/ApiEndpoint.svelte";
  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import DocsLayout, { type DocsSectionGroup } from "$lib/site/docs/DocsLayout.svelte";
  import {
    CHAIN_BASE,
    SERVICES_BASE,
    chainGroups,
    chainSchemas,
    type FieldRow,
  } from "$lib/site/docs/apiReference";
  import { servicesGroups, servicesSchemas } from "$lib/site/docs/servicesApiReference";
  import Seo from "$lib/seo/Seo.svelte";
  import { techArticleJsonLd } from "$lib/seo/site";

  const description =
    "Reference for the decentralised.art HTTP APIs: the chain API for operations, simulation, publication and execution, and the services API for sign-in, profiles and Worlds.";

  const groups: DocsSectionGroup[] = [
    {
      label: "Getting started",
      sections: [
        { id: "overview", label: "Overview" },
        { id: "authentication", label: "Authentication" },
        { id: "conventions", label: "Conventions" },
      ],
    },
    {
      label: "Chain API",
      sections: chainGroups.map((group) => ({ id: group.id, label: group.title })),
    },
    {
      label: "Services API",
      sections: servicesGroups.map((group) => ({ id: group.id, label: group.title })),
    },
    {
      label: "Reference",
      sections: [
        { id: "chain-schemas", label: "Chain schemas" },
        { id: "services-schemas", label: "Services schemas" },
        { id: "specification", label: "Specification" },
      ],
    },
  ];

  const quickStart = `# Read a connector
curl ${CHAIN_BASE}/connector/pitch

# Run it on chain for four steps (no login, no gas)
curl -X POST ${CHAIN_BASE}/execute \\
  -H "Content-Type: application/json" \\
  -d '{"connector_name":"pitch","particles_count":4}'`;

  const chainError = `{ "message": "Connector not found" }`;
</script>

<Seo
  title="API reference"
  {description}
  path="/api-reference"
  type="article"
  jsonLd={[techArticleJsonLd("/api-reference", "API reference", description)]}
/>

{#snippet fieldTable(fields: FieldRow[])}
  <div class="table-wrap">
    <table>
      <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
      <tbody>
        {#each fields as row, index (`${row.name}-${index}`)}
          <tr>
            <td style={`padding-left: ${0.75 + row.depth * 1.1}rem`}>
              <code>{row.name}</code>{#if row.required}<span class="required">required</span>{/if}
            </td>
            <td>
              {#if row.ref}
                <a class="type-link" href={`#schema-${row.ref}`}>{row.type}</a>
              {:else}
                <span class="type">{row.type}</span>
              {/if}
            </td>
            <td>{row.description}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

<DocsLayout title="API reference" {description} {groups}>
  <section>
    <h2 id="overview">Overview</h2>
    <p>decentralised.art has two HTTP APIs. Both speak JSON over HTTPS.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>API</th><th>Base URL</th><th>What it does</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>Chain API</strong></td>
            <td><code>{CHAIN_BASE}</code></td>
            <td>
              Connectors, transformations and conditions: reading them, creating drafts, simulating,
              publishing on chain and executing. Also accounts, formats and the event feed.
            </td>
          </tr>
          <tr>
            <td><strong>Services API</strong></td>
            <td><code>{SERVICES_BASE}</code></td>
            <td>Sign-in, user profiles, follows, and publishing and serving Worlds.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Reading needs no account. The <a href={resolve("/sdk")}>SDK</a> wraps the chain API for
      JavaScript and Python, and the <a href={resolve("/mcp")}>MCP server</a> offers it to AI
      agents. For the ideas behind it, see <a href={resolve("/about")}>About</a>.
    </p>
    <CodeBlock code={quickStart} lang="bash" caption="Try it" />
  </section>

  <section>
    <h2 id="authentication">Authentication</h2>
    <p>
      Each API has its own sign-in, and both prove that you control an Ethereum address by signing a
      message. Send the resulting token as <code>Authorization: Bearer &lt;token&gt;</code>.
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th></th><th>Chain API</th><th>Services API</th></tr></thead>
        <tbody>
          <tr>
            <td>Needed for</td>
            <td>Creating drafts and publishing</td>
            <td>Your profile, follows, and uploading Worlds</td>
          </tr>
          <tr>
            <td>Steps</td>
            <td>
              <code>GET /nonce/&#123;address&#125;</code>, sign
              <code>Login nonce: &lt;nonce&gt;</code>, then <code>POST /auth</code>
            </td>
            <td>
              <code>POST /auth/siwe/challenge</code>, sign the message, then
              <code>POST /auth/siwe/verify</code>
            </td>
          </tr>
          <tr
            ><td>Signature</td><td>EIP-191 personal_sign</td><td
              >Sign-In with Ethereum (EIP-4361), signed with EIP-191</td
            ></tr
          >
          <tr><td>Token</td><td>JWT access token</td><td>Session token</td></tr>
          <tr><td>Valid for</td><td>5 minutes</td><td>24 hours, or until sign-out</td></tr>
        </tbody>
      </table>
    </div>
    <p>The two tokens are not interchangeable. Reading, simulating and executing need neither.</p>
  </section>

  <section>
    <h2 id="conventions">Conventions</h2>
    <h3>Names and addresses</h3>
    <ul>
      <li>
        Operation names start with a letter or underscore and contain letters, digits and
        underscores, up to 128 characters. They are global and cannot be changed.
      </li>
      <li>
        Addresses are 40 hexadecimal characters, with or without <code>0x</code>. The chain API
        returns owner addresses in lowercase without <code>0x</code>; the services API returns
        checksummed addresses with <code>0x</code>.
      </li>
      <li>A draft reports the address <code>"0x0"</code> until it is published.</li>
    </ul>
    <h3>Field names</h3>
    <p>
      The chain API and the user endpoints use snake_case (<code>format_hash</code>,
      <code>display_name</code>). World endpoints use camelCase (<code>entryUrn</code>,
      <code>acceptedFormatHashes</code>). Publication transactions use the Ethereum JSON-RPC
      spelling with hex quantities (<code>chainId</code>, <code>maxFeePerGas</code>).
    </p>
    <h3>Pagination</h3>
    <ul>
      <li>
        Chain API lists take a required <code>limit</code> (1–256) and return a cursor. Pass
        <code>cursor.next_after</code> back as <code>after</code> (or, for the feed,
        <code>cursor.next_before</code> as <code>before</code>) while <code>cursor.has_more</code> is
        true.
      </li>
      <li>Services API lists take a zero-based <code>page</code> and a <code>limit</code>.</li>
    </ul>
    <h3>Errors</h3>
    <p>
      Errors use HTTP status codes. Chain API errors carry a JSON body with a
      <code>message</code>; publication errors can add <code>status</code>, <code>tx_hash</code>,
      <code>missing</code> and <code>mismatched</code>. Services API errors carry the status, and
      World endpoints add a plain-text message.
    </p>
    <CodeBlock code={chainError} lang="json" caption="Chain API error" />
  </section>

  <section>
    <h2 class="api-heading">Chain API</h2>
    <p>
      Base URL <code>{CHAIN_BASE}</code>. This part of the reference is generated from the
      <a href="#specification">OpenAPI specification</a>.
    </p>
  </section>

  {#each chainGroups as group (group.id)}
    <section>
      <h2 id={group.id}>{group.title}</h2>
      <p>{group.intro}</p>
      {#each group.endpoints as endpoint (endpoint.id)}
        <ApiEndpoint {endpoint} />
      {/each}
    </section>
  {/each}

  <section>
    <h2 class="api-heading">Services API</h2>
    <p>Base URL <code>{SERVICES_BASE}</code>.</p>
  </section>

  {#each servicesGroups as group (group.id)}
    <section>
      <h2 id={group.id}>{group.title}</h2>
      <p>{group.intro}</p>
      {#each group.endpoints as endpoint (endpoint.id)}
        <ApiEndpoint {endpoint} />
      {/each}
    </section>
  {/each}

  <section>
    <h2 id="chain-schemas">Chain schemas</h2>
    <p>Object types used by the chain API, from its OpenAPI specification.</p>
    {#each chainSchemas as schema (schema.name)}
      <div class="schema" id={`schema-${schema.name}`}>
        <h3>{schema.name}</h3>
        {#if schema.description}<p>{schema.description}</p>{/if}
        {#if schema.oneOf}
          <p>
            One of:
            {#each schema.oneOf as option, index (option)}
              <a class="type-link" href={`#schema-${option}`}>{option}</a>{index <
              schema.oneOf.length - 1
                ? ", "
                : ""}
            {/each}
          </p>
        {/if}
        {#if schema.fields.length > 0}
          {@render fieldTable(schema.fields)}
        {/if}
      </div>
    {/each}
  </section>

  <section>
    <h2 id="services-schemas">Services schemas</h2>
    {#each servicesSchemas as schema (schema.name)}
      <div class="schema" id={`schema-${schema.name}`}>
        <h3>{schema.name}</h3>
        <p>{schema.description}</p>
        {@render fieldTable(schema.fields)}
      </div>
    {/each}
  </section>

  <section>
    <h2 id="specification">Specification</h2>
    <ul>
      <li>
        The chain API is specified in OpenAPI 3.0 in
        <a href="https://github.com/decentralised-art/api-spec">decentralised-art/api-spec</a>,
        which is also published as
        <a href="https://decentralised-art.github.io/api-spec/">browsable docs</a>. The live server
        reports its version at <code>GET /version</code> (currently 0.4.0).
      </li>
      <li>
        The services API is documented here from
        <a href="https://github.com/decentralised-art/services-backend">services-backend</a>.
      </li>
      <li>
        Live availability of both APIs is on <a href={resolve("/api-status")}>API status</a>.
      </li>
    </ul>
  </section>
</DocsLayout>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .schema {
    scroll-margin-top: 4.5rem;
  }

  .required {
    margin-left: 0.4rem;
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #c2410c;
  }

  .type,
  .type-link {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.76rem;
    white-space: nowrap;
  }

  .type {
    color: var(--text-muted);
  }

  .api-heading {
    font-size: 1.9rem !important;
  }
</style>
