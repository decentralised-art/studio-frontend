<script lang="ts">
  import { resolve } from "$app/paths";
  import { onMount, tick } from "svelte";

  type Props = {
    lesson: "first-run" | "starting-value";
    rootId: string;
    ready: boolean;
    selected: boolean;
    start: number;
    shift: number;
    samples: number;
    panel: string;
    busy: boolean;
    values: unknown[];
    resultAt: number | null;
    runMode: "execute" | "simulate" | null;
    error: string | null;
    onclose: () => void;
  };
  const {
    lesson,
    rootId,
    ready,
    selected,
    start,
    shift,
    samples,
    panel,
    busy,
    values,
    resultAt,
    runMode,
    error,
    onclose,
  }: Props = $props();
  let step = $state(0);
  let runBaseline = $state<number | null>(null);
  let mounted = $state(false);
  let compact = $state(false);
  let rectangle = $state<{ left: number; top: number; width: number; height: number } | null>(null);
  let position = $state({ left: 16, top: 90 });
  let heading = $state<HTMLHeadingElement>();
  const expectedStart = $derived(lesson === "starting-value" ? 10 : 0);
  const expected = $derived([
    expectedStart,
    expectedStart + 1,
    expectedStart + 2,
    expectedStart + 3,
  ]);
  const method = $derived(lesson === "first-run" ? "Execute on the Network" : "Simulate");
  const matched = $derived(
    ready &&
      resultAt !== null &&
      resultAt !== runBaseline &&
      !busy &&
      runMode === (lesson === "first-run" ? "execute" : "simulate") &&
      values.length === 4 &&
      values.every((value, index) => String(value) === String(expected[index])),
  );
  const steps = $derived([
    {
      title: "Select pitch on the canvas",
      text: "Click the pitch connector once. It’s a shared rule that adds 1. This walkthrough needs no account or wallet.",
      done: ready && selected,
    },
    {
      title: "Open the Inspector",
      text:
        panel === "inspector"
          ? "The Inspector is open. This is where you can choose how a run begins."
          : "Click the information button to open the Inspector for pitch.",
      done: ready && selected && panel === "inspector",
    },
    {
      title: lesson === "starting-value" ? "Change Start to 10" : "Begin at zero",
      text:
        "In Running instance, set Start to " +
        expectedStart +
        " and Shift to 0. These settings affect this run; they don’t change the shared definition.",
      done: ready && selected && start === expectedStart && shift === 0 && panel === "inspector",
    },
    {
      title: "Open Run + Publish",
      text: "Click the play button to see the run controls. We’ll use a public run, so you can leave the creation and publication controls alone.",
      done: ready && panel === "runner",
    },
    {
      title: "Ask for four values",
      text: "Set N to 4. N is the number of values you want this run to return.",
      done: ready && panel === "runner" && samples === 4,
    },
    {
      title: "Click " + method,
      text:
        "Before you run it, predict the result: starting at " +
        expectedStart +
        " and adding 1 should give " +
        expected.join(", ") +
        ". Click the highlighted button to try it.",
      done: matched,
    },
    {
      title: "Check what came back",
      text:
        lesson === "starting-value"
          ? "You got 10, 11, 12, 13. The rule stayed the same; you moved its starting point. After closing the guide, try Start 60 and predict the next four values."
          : "You got 0, 1, 2, 3 under /pitch:0. You’ve run a real shared connector. Return to your Tutorial tab to try a different starting point.",
      done: matched,
    },
  ]);
  const current = $derived(steps[step]);

  function target() {
    if (!ready || compact) return null;
    if (step === 0)
      return document.querySelector('.svelte-flow__node[data-id="' + CSS.escape(rootId) + '"]');
    if (step === 1) return document.querySelector('[aria-label="Toggle inspector panel"]');
    if (step === 2) return document.querySelector('[data-tutorial="running-settings"]');
    if (step === 3) return document.querySelector('[aria-label="Toggle run panel"]');
    if (step === 4) return document.querySelector("#run-samples-panel");
    if (step === 5)
      return document.querySelector(
        '[data-tutorial="' + (lesson === "first-run" ? "execute" : "simulate") + '"]',
      );
    return document.querySelector(".runner-output");
  }
  function locate() {
    if (!mounted || document.hidden) return;
    compact = window.innerWidth < 1024;
    const element = target();
    const rect = element?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) {
      rectangle = null;
      position = { left: Math.max(12, (window.innerWidth - 340) / 2), top: 90 };
      return;
    }
    rectangle = {
      left: rect.left - 5,
      top: rect.top - 5,
      width: rect.width + 10,
      height: rect.height + 10,
    };
    const width = Math.min(340, window.innerWidth - 24);
    const left =
      rect.left >= width + 28
        ? rect.left - width - 18
        : Math.min(rect.right + 18, window.innerWidth - width - 12);
    const top = Math.min(Math.max(76, rect.top - 10), Math.max(76, window.innerHeight - 330));
    position = { left: Math.max(12, left), top };
  }
  async function move(next: number) {
    if (next > step && !current.done) return;
    step = next;
    if (next === 5) runBaseline = resultAt;
    await tick();
    target()?.scrollIntoView({ block: "nearest", inline: "nearest" });
    locate();
    heading?.focus({ preventScroll: true });
  }
  onMount(() => {
    mounted = true;
    locate();
    const timer = window.setInterval(locate, 300);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onclose();
    };
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    window.addEventListener("keydown", escape);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
      window.removeEventListener("keydown", escape);
    };
  });
</script>

{#if rectangle}
  <div
    class="guide-highlight"
    aria-hidden="true"
    style:left={rectangle.left + "px"}
    style:top={rectangle.top + "px"}
    style:width={rectangle.width + "px"}
    style:height={rectangle.height + "px"}
  ></div>
{/if}
<aside
  class="studio-guide"
  role="region"
  aria-label="Studio guided tutorial"
  style:left={position.left + "px"}
  style:top={position.top + "px"}
>
  <div class="guide-meta">
    <span>Tutorial · {step + 1} of {steps.length}</span><button
      type="button"
      aria-label="Close guided tutorial"
      onclick={onclose}>×</button
    >
  </div>
  {#if compact}
    <div class="guide-copy">
      <h2>Give the Studio a little more room</h2>
      <p>
        This walkthrough uses the canvas and Inspector side by side. Widen this window or open it on
        a laptop or desktop to follow the steps.
      </p>
      <p>
        You can still explore the interactive examples in the <a href={resolve("/tutorial")}
          >Tutorial</a
        >.
      </p>
    </div>
  {:else}
    <div class="guide-copy" aria-live="polite" aria-atomic="true">
      <h2 tabindex="-1" bind:this={heading}>{current.title}</h2>
      <p>{current.text}</p>
    </div>
    {#if !ready}
      <p class="guide-notice">
        Waiting for published pitch to load. If loading fails, use Refresh network library or reopen
        this walkthrough later.
      </p>
    {:else if step > 0 && !selected && step < 3}
      <p class="guide-notice">Select pitch again to see its settings.</p>
    {:else if step === 5}
      {#if busy}<p class="guide-notice" role="status">
          Running… we’ll check the returned values when it finishes.
        </p>
      {:else if error}<p class="guide-notice" role="status">
          The run failed: {error} Check the message in Run + Publish, then retry.
        </p>
      {:else if resultAt !== null && resultAt !== runBaseline && !matched}
        <p class="guide-notice" role="status">
          This run hasn’t matched the exercise yet. Go Back and check Start {expectedStart}, Shift 0
          and N 4, then use {method} again.
        </p>
      {/if}
    {/if}
    <div class="guide-actions">
      {#if step > 0}<button type="button" onclick={() => move(step - 1)}>Back</button>{/if}
      {#if step === steps.length - 1}
        <button class="guide-next" type="button" onclick={onclose}>Finish walkthrough</button>
      {:else}
        <button
          class="guide-next"
          type="button"
          disabled={!current.done}
          onclick={() => move(step + 1)}
        >
          {step === 5 ? "Check my result" : "Next"}
        </button>
      {/if}
    </div>
  {/if}
  <p class="guide-footnote">
    {compact
      ? "Resize the window to continue this lesson."
      : current.done && step < 5
        ? "Ready — this step is set."
        : "You’re using the real Studio controls."}
  </p>
</aside>

<style>
  .guide-highlight {
    position: fixed;
    pointer-events: none;
    z-index: 10000;
    border: 2px solid #50e1c4;
    border-radius: 8px;
    box-shadow:
      0 0 0 4px #50e1c428,
      0 0 28px #50e1c43d;
  }
  .studio-guide {
    position: fixed;
    z-index: 10001;
    width: min(340px, calc(100vw - 24px));
    padding: 1.1rem;
    border: 1px solid #50e1c4;
    border-radius: 1rem;
    background: linear-gradient(140deg, #203d3b, #15282d);
    color: #f0fffa !important;
    box-shadow: 0 16px 50px #0005;
    font:
      14px/1.6 system-ui,
      sans-serif;
  }
  .guide-meta {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
    color: #abdfd0;
    font-size: 11px;
    letter-spacing: 0.04em;
  }
  .studio-guide button {
    padding: 0.4rem 0.7rem;
    border: 1px solid #638b83 !important;
    border-radius: 0.4rem;
    background: transparent !important;
    color: #f0fffa !important;
    cursor: pointer;
    font: inherit;
  }
  .guide-meta button {
    font-size: 22px;
    line-height: 1;
    padding: 0.2rem 0.5rem;
  }
  .studio-guide h2 {
    margin: 0.7rem 0 0.5rem;
    color: #f0fffa !important;
    font-size: 19px;
    line-height: 1.3;
  }
  .studio-guide p {
    margin: 0.5rem 0;
    color: #d2e6e0 !important;
  }
  .guide-notice {
    border-left: 2px solid #f7cc80;
    padding-left: 0.7rem;
    font-size: 12px;
  }
  .guide-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  .studio-guide .guide-next {
    background: #50e1c4 !important;
    color: #102925 !important;
    border-color: #50e1c4 !important;
    font-weight: 600;
  }
  .studio-guide button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .studio-guide button:focus-visible {
    outline: 2px solid #f7cc80;
    outline-offset: 3px;
  }
  .studio-guide .guide-footnote {
    margin-bottom: 0;
    font-size: 11px;
    color: #abdfd0 !important;
  }
  .studio-guide a {
    color: #50e1c4 !important;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  @media (max-width: 1023px) {
    .studio-guide {
      top: auto !important;
      left: 12px !important;
      bottom: 12px;
    }
  }
</style>
