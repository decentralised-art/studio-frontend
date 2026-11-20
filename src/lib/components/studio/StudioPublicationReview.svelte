<script lang="ts">
  import { onMount } from "svelte";

  type PublicationRow = {
    key: string;
    name: string;
    kind: string;
    status: string;
    detail?: string;
    fee?: string;
    explorerUrl?: string;
  };

  type Props = {
    title: string;
    stage: "planning" | "review" | "running" | "paused" | "complete";
    rows: PublicationRow[];
    summary?: string;
    feeSummary?: string;
    note?: string;
    problem?: string;
    activity?: string;
    actionLabel?: string;
    stopRequested?: boolean;
    recoveryName?: string;
    onRecover?: (hash: string) => void;
    onAction: () => void;
    onClose: () => void;
    onPause: () => void;
  };

  const id = $props.id();
  let {
    title,
    stage,
    rows,
    summary,
    feeSummary,
    note,
    problem,
    activity,
    actionLabel,
    stopRequested = false,
    recoveryName,
    onRecover,
    onAction,
    onClose,
    onPause,
  }: Props = $props();

  let dialog: HTMLDialogElement;
  let heading: HTMLHeadingElement;
  let transactionHash = $state("");

  onMount(() => {
    const element = dialog;
    element.showModal();
    heading.focus();
    return () => element.close();
  });

  const handleCancel = (event: Event) => {
    event.preventDefault();
    if (stage !== "running") onClose();
  };
</script>

<dialog bind:this={dialog} aria-labelledby={`${id}-heading`} oncancel={handleCancel}>
  <div class="publication-review">
    <header>
      <h2 bind:this={heading} id={`${id}-heading`} tabindex="-1">Review publication</h2>
      <p class="publication-root">{title}</p>
    </header>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Allow keyboard scrolling of long publication plans.) -->
    <div class="publication-body" role="region" aria-label="Publication details" tabindex="0">
      {#if summary || feeSummary}
        <div class="publication-summary" role="status">
          {#if summary}<p>{summary}</p>{/if}
          {#if feeSummary}<p class="publication-fees">{feeSummary}</p>{/if}
        </div>
      {/if}
      {#if note}<p class="publication-note">{note}</p>{/if}
      {#if problem}<p class="publication-problem" role="alert">{problem}</p>{/if}
      {#if activity}
        <p class="publication-activity" role="status">{activity}</p>
      {:else if stage === "planning"}
        <p class="publication-activity" role="status">Checking publication dependencies…</p>
      {/if}

      {#if recoveryName && onRecover && stage !== "running" && stage !== "planning"}
        <details class="publication-recovery">
          <summary>Recover a transaction hash</summary>
          <form
            onsubmit={(event) => {
              event.preventDefault();
              onRecover?.(transactionHash);
            }}
          >
            <label>
              Wallet transaction hash for {recoveryName}
              <input
                bind:value={transactionHash}
                placeholder="0x…"
                spellcheck="false"
                autocomplete="off"
                required
              />
            </label>
            <button type="submit">Save hash</button>
          </form>
        </details>
      {/if}
      {#if rows.length}
        <ol role="list" aria-label="Publication order">
          {#each rows as row (row.key)}
            <li>
              <div class="publication-entity">
                <span class="publication-name">{row.name}</span>
                <span class="publication-kind">{row.kind}</span>
              </div>
              <div class="publication-state">
                <span>{row.status}</span>
                {#if row.detail}<p class="publication-note">{row.detail}</p>{/if}
              </div>
              {#if row.fee || row.explorerUrl}
                <div class="publication-cost">
                  {#if row.fee}<span>{row.fee}</span>{/if}
                  {#if row.explorerUrl}
                    <a
                      href={row.explorerUrl}
                      aria-label={`View transaction for ${row.name}`}
                      target="_blank"
                      rel="external noopener noreferrer">View transaction ↗</a
                    >
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </div>

    <footer>
      {#if stage === "running"}
        <button type="button" onclick={onPause} disabled={stopRequested}>
          {stopRequested ? "Pausing after current…" : "Pause after current"}
        </button>
      {:else}
        <button type="button" onclick={onClose}>Close</button>
      {/if}
      {#if actionLabel}
        <button type="button" class="primary" onclick={onAction}>{actionLabel}</button>
      {/if}
    </footer>
  </div>
</dialog>

<style>
  dialog {
    width: min(calc(100% - 2rem), 48rem);
    max-height: calc(100dvh - 2rem);
    margin: auto;
    padding: 0;
    overflow: hidden;
    color: var(--text-primary);
    background: var(--surface-page);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-soft);
    font-family: var(--font-sans);
  }

  dialog::backdrop {
    background: rgb(2 6 23 / 60%);
  }

  .publication-recovery {
    margin-block: 0 1rem;
  }

  .publication-recovery summary {
    cursor: pointer;
  }

  .publication-recovery form {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.5rem;
    margin-block-start: 0.6rem;
  }

  .publication-recovery label {
    display: grid;
    flex: 1 1 15rem;
    gap: 0.25rem;
  }

  .publication-recovery input {
    width: 100%;
    min-width: 0;
    padding: 0.45rem 0.6rem;
    color: var(--text-primary);
    background: var(--surface-inset, var(--surface-page));
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    font: inherit;
  }

  .publication-review {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 2rem - 2px);
  }

  header,
  footer {
    flex: none;
    padding: 1rem 1.25rem;
  }

  header {
    border-bottom: 1px solid var(--border-subtle);
  }

  header h2 {
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.25;
  }

  header h2:focus {
    outline: none;
  }

  .publication-root {
    margin-top: 0.3rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }

  .publication-body {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    line-height: 1.45;
  }

  .publication-summary p + p {
    margin-top: 0.25rem;
  }

  .publication-summary,
  .publication-fees,
  .publication-cost {
    font-variant-numeric: tabular-nums;
  }

  .publication-summary {
    font-weight: 600;
  }

  .publication-fees {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .publication-note {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  .publication-body > .publication-note,
  .publication-activity {
    margin-top: 0.5rem;
  }

  .publication-problem {
    margin: 0.75rem 0;
    padding: 0.625rem 0.75rem;
    overflow-wrap: anywhere;
    border: 1px solid var(--border-strong);
    border-radius: 0.375rem;
    background: var(--surface-panel-soft);
  }

  .publication-activity {
    color: var(--text-secondary);
  }

  ol {
    margin-top: 0.875rem;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--border-subtle);
  }

  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(5rem, 0.6fr);
    gap: 0.375rem 1rem;
    align-items: start;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--border-subtle);
    overflow-wrap: anywhere;
  }

  .publication-entity,
  .publication-cost {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .publication-name {
    font-weight: 600;
  }

  .publication-kind,
  .publication-cost {
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }

  .publication-kind {
    text-transform: capitalize;
  }

  .publication-state .publication-note {
    margin-top: 0.125rem;
  }

  .publication-cost {
    text-align: right;
  }

  .publication-cost a {
    color: var(--color-accent-strong);
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    border-top: 1px solid var(--border-subtle);
  }

  button {
    min-height: 2.5rem;
    padding: 0.375rem 0.875rem;
    color: var(--text-primary);
    background: var(--surface-panel-soft);
    border: 1px solid var(--border-strong);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
  }

  button:hover:not(:disabled) {
    cursor: pointer;
    background: var(--surface-card-hover);
  }

  button:disabled {
    color: var(--text-muted);
  }

  .primary {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .primary:hover:not(:disabled) {
    background: var(--surface-card-hover);
  }

  .publication-body:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  :is(a, button):focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 36rem) {
    dialog {
      width: calc(100% - 1rem);
      max-height: calc(100dvh - 1rem);
    }

    .publication-review {
      max-height: calc(100dvh - 1rem - 2px);
    }

    header,
    footer,
    .publication-body {
      padding-inline: 0.875rem;
    }

    li {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      column-gap: 0.625rem;
    }

    .publication-cost {
      grid-column: 2;
      text-align: left;
    }
  }
</style>
