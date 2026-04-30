<script lang="ts">
  type InputHandler = (
    event: Event & {
      currentTarget: HTMLInputElement;
      target: HTMLInputElement;
    },
  ) => void;

  let {
    label = "",
    help = "",
    id,
    type = "text",
    value = $bindable(""),
    placeholder = "",
    min,
    max,
    step,
    inputmode,
    error,
    disabled = false,
    oninput, // optional handler from parent
    onblur, // optional handler from parent
  }: {
    label?: string;
    help?: string;
    id?: string;
    type?: string;
    value?: string;
    placeholder?: string;
    min?: number | string;
    max?: number | string;
    step?: number | string;
    inputmode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
    error?: string;
    disabled?: boolean;
    oninput?: InputHandler;
    onblur?: InputHandler;
  } = $props();

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;

    // update $bindable value so bind:value works
    value = target.value;

    // call parent oninput if provided
    oninput?.(
      event as Event & {
        currentTarget: HTMLInputElement;
        target: HTMLInputElement;
      },
    );
  }

  function handleBlur(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;

    value = target.value; // ensure final value sync
    onblur?.(
      event as Event & {
        currentTarget: HTMLInputElement;
        target: HTMLInputElement;
      },
    );
  }
</script>

<div class="flex flex-col gap-1 text-sm">
  {#if label}
    <label for={id} class="input-label">
      {label}
    </label>
  {/if}

  <input
    {id}
    {type}
    {placeholder}
    {min}
    {max}
    {step}
    {inputmode}
    {disabled}
    {value}
    oninput={handleInput}
    onblur={handleBlur}
    class={`input ${error ? "input-has-error" : ""}`}
  />

  {#if error}
    <p class="input-error">{error}</p>
  {:else if help}
    <p class="input-help">{help}</p>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .input {
    @apply w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2;
    background: var(--surface-input);
    border-color: var(--border-subtle);
    color: var(--text-primary);
    --tw-ring-color: var(--focus-ring);
  }

  .input::placeholder {
    color: var(--text-faint);
  }

  .input:focus-visible {
    border-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
  }

  .input-has-error {
    @apply border-red-500/80 focus-visible:ring-red-500/70;
  }

  .input-label {
    @apply text-xs font-medium uppercase tracking-[0.18em];
    color: var(--text-muted);
  }

  .input-help {
    @apply text-[0.7rem] mt-1;
    color: var(--text-faint);
  }

  .input-error {
    @apply text-[0.7rem] text-red-400 mt-1;
  }
</style>
