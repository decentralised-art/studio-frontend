<script lang="ts">
  import CodeBlock from "$lib/site/docs/CodeBlock.svelte";
  import type { Auth, Endpoint, FieldRow } from "$lib/site/docs/apiReference";

  const { endpoint }: { endpoint: Endpoint } = $props();

  const authLabels: Record<Auth, string> = {
    none: "No auth",
    chain: "Chain bearer token",
    session: "Session",
    "session-owner": "Session · owner only",
  };

  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /** Escapes the text, then turns `code` spans into <code> elements. */
  const inline = (text: string) =>
    escapeHtml(text).replace(/`([^`]+)`/g, (_, code: string) => `<code>${code}</code>`);

  const statusTone = (status: string) =>
    status.startsWith("2") ? "ok" : status.startsWith("4") ? "client" : "server";

  const hasLocation = $derived(endpoint.params.some((param) => param.location));
</script>

{#snippet typeCell(row: FieldRow)}
  {#if row.ref}
    <a class="type-link" href={`#schema-${row.ref}`}>{row.type}</a>
  {:else}
    <span class="type">{row.type}</span>
  {/if}
{/snippet}

<article class="endpoint" id={endpoint.id}>
  <header class="endpoint-head">
    <span class={`method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
    <code class="endpoint-path">{endpoint.path}</code>
    <span class={`auth auth-${endpoint.auth}`}>{authLabels[endpoint.auth]}</span>
  </header>
  <h3 class="endpoint-summary">{endpoint.summary}</h3>
  {#if endpoint.description}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- inline() escapes the text first -->
    <p>{@html inline(endpoint.description)}</p>
  {/if}
  {#if endpoint.also}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- inline() escapes the text first -->
    <p class="endpoint-also">{@html inline(endpoint.also)}</p>
  {/if}

  {#if endpoint.params.length > 0}
    <h4>Parameters</h4>
    <div class="table-wrap">
      <table>
        <thead>
          <tr
            ><th>Name</th>{#if hasLocation}<th>In</th>{/if}<th>Type</th><th>Description</th></tr
          >
        </thead>
        <tbody>
          {#each endpoint.params as param (param.name)}
            <tr>
              <td>
                <code>{param.name}</code>{#if param.required}<span class="required">required</span
                  >{/if}
              </td>
              {#if hasLocation}<td>{param.location}</td>{/if}
              <td>{@render typeCell(param)}</td>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- inline() escapes the text first -->
              <td>{@html inline(param.description)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if endpoint.body}
    <h4>
      Request body <span class="content-type">{endpoint.body.contentType}</span>
      {#if endpoint.body.ref}<a class="type-link" href={`#schema-${endpoint.body.ref}`}
          >{endpoint.body.ref}</a
        >{/if}
    </h4>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          {#each endpoint.body.fields as row, index (`${row.name}-${index}`)}
            <tr>
              <td style={`padding-left: ${0.75 + row.depth * 1.1}rem`}>
                <code>{row.name}</code>{#if row.required}<span class="required">required</span>{/if}
              </td>
              <td>{@render typeCell(row)}</td>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- inline() escapes the text first -->
              <td>{@html inline(row.description)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <h4>Responses</h4>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Status</th><th>Description</th><th>Body</th></tr></thead>
      <tbody>
        {#each endpoint.responses as response (response.status)}
          <tr>
            <td
              ><span class={`status status-${statusTone(response.status)}`}>{response.status}</span
              ></td
            >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- inline() escapes the text first -->
            <td>{@html inline(response.description)}</td>
            <td>
              {#if response.ref}
                <a class="type-link" href={`#schema-${response.ref}`}>{response.type}</a>
              {:else if response.type}
                <span class="type">{response.type}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if endpoint.example}
    <CodeBlock code={endpoint.example.request} lang="bash" caption="Request" />
    {#if endpoint.example.response}
      <CodeBlock
        code={endpoint.example.response}
        lang={endpoint.example.responseLang ?? "json"}
        caption={endpoint.example.illustrative ? "Response (illustrative)" : "Response"}
      />
    {/if}
  {/if}
</article>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .endpoint {
    margin: 1.75rem 0 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px dashed var(--border-subtle);
    scroll-margin-top: 4.5rem;
  }

  .endpoint-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.65rem;
  }

  .method {
    display: inline-block;
    min-width: 3.4rem;
    padding: 0.18rem 0.5rem;
    border-radius: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-align: center;
    color: #fff;
  }

  .method-get {
    background: #1f7a4d;
  }

  .method-head {
    background: #4b5563;
  }

  .method-post {
    background: #2563eb;
  }

  .method-patch {
    background: #b45309;
  }

  .method-delete {
    background: #b91c1c;
  }

  .endpoint .endpoint-path {
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .auth {
    margin-left: auto;
    padding: 0.1rem 0.5rem;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .auth-chain,
  .auth-session,
  .auth-session-owner {
    border-color: color-mix(in srgb, var(--color-accent) 45%, transparent);
    color: var(--color-accent);
  }

  .endpoint .endpoint-summary {
    margin: 0.75rem 0 0.25rem;
    font-size: 1.05rem;
  }

  .endpoint h4 {
    margin: 1.25rem 0 0.4rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-primary) !important;
  }

  .content-type {
    margin-left: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--text-muted);
  }

  .endpoint-also {
    font-size: 0.85rem;
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

  h4 .type-link {
    margin-left: 0.4rem;
    letter-spacing: 0;
    text-transform: none;
  }

  .status {
    display: inline-block;
    min-width: 2.6rem;
    padding: 0.05rem 0.4rem;
    border-radius: 0.35rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    font-weight: 700;
    text-align: center;
  }

  .status-ok {
    background: color-mix(in srgb, #1f7a4d 16%, transparent);
    color: #1f9d5c;
  }

  .status-client {
    background: color-mix(in srgb, #b45309 16%, transparent);
    color: #d97706;
  }

  .status-server {
    background: color-mix(in srgb, #b91c1c 16%, transparent);
    color: #ef4444;
  }
</style>
