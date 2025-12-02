<script lang="ts">
  type InputHandler = (
    event: Event & {
      currentTarget: HTMLInputElement;
      target: HTMLInputElement;
    }
  ) => void;

  let {
    label = "",
    help = "",
    id,
    type = "text",
    value = $bindable(""),
    placeholder = "",
    className = "",
    inputClassName = "",
    error,
    disabled = false,
    oninput, // optional handler from parent
  }: {
    label?: string;
    help?: string;
    id?: string;
    type?: string;
    value?: string;
    placeholder?: string;
    className?: string; // wrapper
    inputClassName?: string; // input element
    error?: string;
    disabled?: boolean;
    oninput?: InputHandler;
  } = $props();

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;

    // update $bindable value so bind:value works
    value = target.value;

    // call parent oninput if provided
    (oninput as InputHandler | undefined)?.(
      event as Event & {
        currentTarget: HTMLInputElement;
        target: HTMLInputElement;
      }
    );
  }
</script>

<div class={`flex flex-col gap-1 text-sm ${className}`}>
  {#if label}
    <label for={id} class="text-xs font-medium text-white/70">
      {label}
    </label>
  {/if}

  <input
    {id}
    {type}
    {placeholder}
    {disabled}
    {value}
    oninput={handleInput}
    class={`w-full rounded-md border bg-white/5 px-3 py-1.5 text-sm text-white
            placeholder:text-white/30 outline-none transition
            focus:ring-2 focus:ring-emerald-400/70 focus:border-emerald-400/70
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-red-500/80 focus:ring-red-500/70" : "border-white/15"}
            ${inputClassName}`}
  />

  {#if error}
    <p class="text-xs text-red-400 mt-0.5">{error}</p>
  {:else if help}
    <p class="text-xs text-white/50 mt-0.5">{help}</p>
  {/if}
</div>
