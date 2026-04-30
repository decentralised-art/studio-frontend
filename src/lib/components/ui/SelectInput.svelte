<script lang="ts">
  type SelectHandler = (
    event: Event & {
      currentTarget: HTMLSelectElement;
      target: HTMLSelectElement;
    },
  ) => void;

  type SelectOption = Readonly<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;

  let {
    label = "",
    help = "",
    id,
    value = $bindable(""),
    options = [],
    placeholder,
    placeholderValue = "all",
    error,
    disabled = false,
    onchange,
    onblur,
  }: {
    label?: string;
    help?: string;
    id?: string;
    value?: string;
    options?: readonly SelectOption[];
    placeholder?: string;
    placeholderValue?: string;
    error?: string;
    disabled?: boolean;
    onchange?: SelectHandler;
    onblur?: SelectHandler;
  } = $props();

  function handleChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;

    value = target.value;

    onchange?.(event as Event & { currentTarget: HTMLSelectElement; target: HTMLSelectElement });
  }

  function handleBlur(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;

    value = target.value;

    onblur?.(event as Event & { currentTarget: HTMLSelectElement; target: HTMLSelectElement });
  }
</script>

<div class="field">
  {#if label}
    <label for={id} class="input-label">{label}</label>
  {/if}

  <div class="select-wrap">
    <select
      {id}
      {disabled}
      {value}
      onchange={handleChange}
      onblur={handleBlur}
      class={`select ${error ? "select-error" : ""}`}
    >
      {#if placeholder}
        <option value={placeholderValue}>{placeholder}</option>
      {/if}

      {#each options as opt (opt.value)}
        <option value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      {/each}
    </select>

    <!-- custom arrow -->
    <span class="select-icon" aria-hidden="true">▾</span>
  </div>

  {#if error}
    <p class="input-error">{error}</p>
  {:else if help}
    <p class="input-help">{help}</p>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  /* ---------- field ---------- */

  .field {
    @apply flex flex-col gap-1 text-sm;
  }

  .input-label {
    @apply text-xs font-medium uppercase tracking-[0.18em];
    color: var(--text-muted);
  }

  /* ---------- select ---------- */

  .select-wrap {
    @apply relative;
  }

  .select {
    @apply w-full rounded-lg border pl-3 pr-4 py-2 text-sm
      focus:outline-none focus-visible:ring-2
      disabled:opacity-50 disabled:cursor-not-allowed;
    background: var(--surface-input);
    border-color: var(--border-subtle);
    color: var(--text-primary);
    --tw-ring-color: var(--focus-ring);

    /* hide native arrow */
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  .select-error {
    @apply border-red-500/80
      focus-visible:ring-red-500/70
      focus-visible:border-red-500/80;
  }

  /* ---------- custom arrow ---------- */

  .select-icon {
    @apply pointer-events-none absolute
      right-4 top-1/2 -translate-y-1/2
      text-xs;
    color: var(--text-muted);
  }

  /* ---------- help / error ---------- */

  .input-help {
    @apply text-[0.7rem] mt-1;
    color: var(--text-faint);
  }

  .input-error {
    @apply text-[0.7rem] text-red-400 mt-1;
  }
</style>
