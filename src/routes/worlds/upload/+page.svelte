<script lang="ts">
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";

  import { getToken } from "$lib/auth/session";
  import WalletAuthButton from "$lib/components/auth/WalletAuthButton.svelte";
  import { uploadWorldBundle, validateWorldBundle, WorldApiRequestError } from "$lib/worlds/api";
  import type { BackendWorldDescriptor, BackendWorldValidateResponse } from "$lib/worlds/contract";

  let selectedBundle = $state<File | null>(null);
  let validateResult = $state<BackendWorldValidateResponse | null>(null);
  let uploadedWorld = $state<BackendWorldDescriptor | null>(null);
  let statusText = $state("");
  let errorText = $state("");
  let validationBusy = $state(false);
  let uploadBusy = $state(false);
  let hasSession = $state(false);

  const bundleLabel = $derived(
    selectedBundle
      ? `${selectedBundle.name} · ${Math.ceil(selectedBundle.size / 1024).toLocaleString()} KB`
      : "No bundle selected",
  );
  const canValidate = $derived(Boolean(selectedBundle) && !validationBusy && !uploadBusy);
  const canUpload = $derived(
    Boolean(selectedBundle && validateResult && hasSession) && !validationBusy && !uploadBusy,
  );

  const refreshSession = () => {
    hasSession = Boolean(getToken());
  };

  const formatError = (error: unknown, fallback: string): string => {
    if (error instanceof WorldApiRequestError) return error.message;
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return fallback;
  };

  const handleBundleChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    selectedBundle = file;
    validateResult = null;
    uploadedWorld = null;
    errorText = "";
    statusText = file ? "Bundle ready for validation." : "";
  };

  const validateBundle = async () => {
    if (!selectedBundle || validationBusy) return;
    validationBusy = true;
    errorText = "";
    uploadedWorld = null;
    statusText = "Validating bundle.";
    try {
      validateResult = await validateWorldBundle(selectedBundle);
      statusText = "Bundle validated.";
    } catch (error) {
      validateResult = null;
      errorText = formatError(error, "World bundle validation failed.");
      statusText = "";
    } finally {
      validationBusy = false;
    }
  };

  const uploadBundle = async () => {
    if (!selectedBundle || !validateResult || !hasSession || uploadBusy) return;
    uploadBusy = true;
    errorText = "";
    statusText = "Uploading world.";
    try {
      uploadedWorld = await uploadWorldBundle(selectedBundle);
      statusText = "World uploaded.";
    } catch (error) {
      uploadedWorld = null;
      errorText = formatError(error, "World upload failed.");
      statusText = "";
    } finally {
      uploadBusy = false;
    }
  };

  onMount(() => {
    refreshSession();
    window.addEventListener("auth:change", refreshSession);
    window.addEventListener("storage", refreshSession);
    return () => {
      window.removeEventListener("auth:change", refreshSession);
      window.removeEventListener("storage", refreshSession);
    };
  });
</script>

<svelte:head>
  <title>Upload World · Worlds</title>
</svelte:head>

<main class="upload-page">
  <section class="upload-header">
    <a class="back-link" href={resolve("/worlds")}>Worlds</a>
    <h1>Upload World</h1>
    <p>Validate a ZIP bundle, then publish it into the backend world registry.</p>
  </section>

  <section class="upload-shell" aria-label="World bundle upload">
    <div class="upload-panel">
      <label class="file-drop">
        <span>World ZIP bundle</span>
        <strong>{bundleLabel}</strong>
        <input type="file" accept=".zip,application/zip" onchange={handleBundleChange} />
      </label>

      <div class="upload-actions">
        <button type="button" disabled={!canValidate} onclick={() => void validateBundle()}>
          {validationBusy ? "Validating" : "Validate"}
        </button>
        <button type="button" disabled={!canUpload} onclick={() => void uploadBundle()}>
          {uploadBusy ? "Uploading" : "Upload"}
        </button>
      </div>

      {#if !hasSession}
        <div class="auth-note">
          <p>Validation is public. Upload requires a services session.</p>
          <WalletAuthButton showLogout={false} />
        </div>
      {/if}

      {#if statusText}
        <p class="status" role="status" aria-live="polite">{statusText}</p>
      {/if}
      {#if errorText}
        <p class="status is-error" role="alert">{errorText}</p>
      {/if}
    </div>

    <aside class="preview-panel" aria-label="Validated world manifest">
      {#if uploadedWorld}
        <div class="success-panel">
          <span>Uploaded</span>
          <h2>{uploadedWorld.name}</h2>
          <p>{uploadedWorld.description}</p>
          <a href={resolve("/worlds/[slug]", { slug: uploadedWorld.slug })}>Open world</a>
        </div>
      {:else if validateResult}
        <div class="manifest-preview">
          <span>Validated Manifest</span>
          <h2>{validateResult.descriptor.name}</h2>
          <p>{validateResult.descriptor.description}</p>
          <dl>
            <div>
              <dt>Slug</dt>
              <dd>{validateResult.descriptor.slug}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{validateResult.descriptor.version}</dd>
            </div>
            <div>
              <dt>Surfaces</dt>
              <dd>{validateResult.descriptor.surfaces.join(", ")}</dd>
            </div>
            <div>
              <dt>Permissions</dt>
              <dd>{validateResult.descriptor.permissions.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Bundle Hash</dt>
              <dd>{validateResult.bundleHash}</dd>
            </div>
            <div>
              <dt>Manifest Hash</dt>
              <dd>{validateResult.manifestHash}</dd>
            </div>
          </dl>

          {#if validateResult.descriptor.acceptedConnectorSets.length}
            <section class="compat-list" aria-label="Accepted connector sets">
              <h3>Connector Sets</h3>
              {#each validateResult.descriptor.acceptedConnectorSets as connectorSet, index (`${index}:${connectorSet.connectors.join(",")}`)}
                <p>{connectorSet.connectors.join(", ")}</p>
                {#if connectorSet.optionalConnectors.length}
                  <small>Optional: {connectorSet.optionalConnectors.join(", ")}</small>
                {/if}
              {/each}
            </section>
          {/if}

          {#if validateResult.descriptor.acceptedFormatHashes.length}
            <section class="compat-list" aria-label="Accepted format hashes">
              <h3>Format Hashes</h3>
              {#each validateResult.descriptor.acceptedFormatHashes as hash (hash)}
                <p>{hash}</p>
              {/each}
            </section>
          {/if}

          {#if validateResult.warnings.length}
            <section class="warning-list" aria-label="Validation warnings">
              <h3>Warnings</h3>
              {#each validateResult.warnings as warning (warning)}
                <p>{warning}</p>
              {/each}
            </section>
          {/if}
        </div>
      {:else}
        <div class="empty-preview">
          <span>Bundle Contract</span>
          <p>
            The ZIP must contain a root <code>world-manifest.json</code> and the iframe entry file
            referenced by that manifest. New Worlds should declare
            <code>"chainApiVersion": 2</code>: SDK execute returns
            <code>{`{block_number, block_hash, runner, particles}`}</code>. Omission keeps the
            legacy stream-array result; simulate remains an explicit local operation under
            <code>dcn.execute</code> permission.
          </p>
        </div>
      {/if}
    </aside>
  </section>
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .upload-page {
    @apply min-h-0 flex-1 overflow-auto px-4 py-8 md:px-6 md:py-10;
    background: var(--surface-page);
    color: var(--text-primary);
  }

  .upload-header {
    @apply mx-auto max-w-6xl;
  }

  .back-link {
    @apply text-[0.68rem] uppercase tracking-[0.18em] no-underline;
    color: var(--text-muted);
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .upload-header h1 {
    @apply m-0 mt-3 text-3xl font-semibold;
  }

  .upload-header p {
    @apply m-0 mt-2 max-w-2xl text-sm leading-6;
    color: var(--text-muted);
  }

  .upload-shell {
    @apply mx-auto mt-8 grid max-w-6xl gap-4 lg:grid-cols-[0.86fr_1.14fr];
  }

  .upload-panel,
  .preview-panel {
    @apply rounded-md border p-4;
    background: var(--surface-card);
    border-color: var(--border-subtle);
  }

  .file-drop {
    @apply block cursor-pointer rounded-md border border-dashed p-4;
    border-color: var(--border-strong);
    background: var(--surface-panel-soft);
  }

  .file-drop span {
    @apply block text-[0.62rem] uppercase tracking-[0.18em];
    color: var(--text-muted);
  }

  .file-drop strong {
    @apply mt-3 block text-sm font-medium;
    color: var(--text-primary);
    word-break: break-word;
  }

  .file-drop input {
    @apply mt-4 block w-full text-sm;
    color: var(--text-muted);
  }

  .upload-actions {
    @apply mt-4 flex flex-wrap gap-2;
  }

  .upload-actions button {
    @apply rounded-md border px-3 py-2 text-[0.62rem] uppercase tracking-[0.16em];
    border-color: var(--border-strong);
    color: var(--text-secondary);
    background: var(--surface-panel-soft);
  }

  .upload-actions button:hover:enabled {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .upload-actions button:disabled {
    @apply cursor-not-allowed opacity-45;
  }

  .status {
    @apply mt-4 rounded-md border px-3 py-2 text-sm leading-6;
    border-color: var(--border-subtle);
    color: var(--text-muted);
    background: var(--surface-panel-soft);
  }

  .auth-note {
    @apply mt-4 flex flex-col items-start gap-3 rounded-md border px-3 py-3 text-sm leading-6;
    border-color: var(--border-subtle);
    color: var(--text-muted);
    background: var(--surface-panel-soft);
  }

  .auth-note p {
    @apply m-0;
  }

  .status.is-error {
    @apply border-rose-400/40 bg-rose-500/10 text-rose-200;
  }

  .preview-panel {
    @apply min-h-[28rem];
  }

  .manifest-preview > span,
  .success-panel > span,
  .empty-preview > span {
    @apply text-[0.62rem] uppercase tracking-[0.18em];
    color: var(--text-muted);
  }

  .manifest-preview h2,
  .success-panel h2 {
    @apply m-0 mt-3 text-2xl font-semibold;
  }

  .manifest-preview p,
  .success-panel p,
  .empty-preview p {
    @apply m-0 mt-3 text-sm leading-6;
    color: var(--text-muted);
  }

  .success-panel a {
    @apply mt-5 inline-flex rounded-md border px-3 py-2 text-[0.62rem] uppercase tracking-[0.16em] no-underline;
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .manifest-preview dl {
    @apply mt-5 grid gap-2;
  }

  .manifest-preview dl div {
    @apply rounded-md border px-3 py-2;
    border-color: var(--border-subtle);
    background: var(--surface-panel-soft);
  }

  .manifest-preview dt {
    @apply text-[0.58rem] uppercase tracking-[0.16em];
    color: var(--text-muted);
  }

  .manifest-preview dd {
    @apply m-0 mt-1 text-sm;
    color: var(--text-primary);
    word-break: break-word;
  }

  .compat-list,
  .warning-list {
    @apply mt-5 rounded-md border px-3 py-2;
    border-color: var(--border-subtle);
    background: var(--surface-panel-soft);
  }

  .compat-list h3,
  .warning-list h3 {
    @apply m-0 text-[0.58rem] uppercase tracking-[0.16em];
    color: var(--text-muted);
  }

  .compat-list p,
  .warning-list p {
    @apply mt-2;
  }

  .compat-list small {
    @apply mt-1 block text-xs;
    color: var(--text-muted);
  }

  .empty-preview code {
    @apply rounded border px-1 py-0.5;
    border-color: var(--border-subtle);
    background: var(--surface-panel-soft);
    color: var(--text-primary);
  }
</style>
