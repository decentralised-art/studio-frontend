<script lang="ts">
  import { resolve } from "$app/paths";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  const slogans = [
    "Become a part of music's connected future.",
    "Join a creative network of human and post-human creators.",
    "Imagine a collective musical intelligence.",
    "Explore the potential of interconnected musical structures.",
  ];
  const longestSlogan = slogans.reduce((longest, current) =>
    current.length > longest.length ? current : longest,
  );

  const typingDelay = 110;
  const erasingDelay = 100;
  const holdDelay = 2000;

  let typedText = $state(slogans[0] ?? "");
  let wordIndex = $state(0);
  let isTyping = $state(true);

  $effect(() => {
    if (slogans.length === 0) return;

    const word = slogans[wordIndex % slogans.length];
    let timer: ReturnType<typeof setTimeout>;

    if (isTyping) {
      if (typedText.length < word.length) {
        timer = setTimeout(() => {
          typedText = word.slice(0, typedText.length + 1);
        }, typingDelay);
      } else {
        timer = setTimeout(() => {
          isTyping = false;
        }, holdDelay);
      }
    } else if (typedText.length > 0) {
      timer = setTimeout(() => {
        typedText = word.slice(0, typedText.length - 1);
      }, erasingDelay);
    } else {
      isTyping = true;
      wordIndex += 1;
    }

    return () => clearTimeout(timer);
  });
</script>

<SectionShell variant="subtle">
  <div
    class="pointer-events-none absolute -top-32 right-0 h-[30rem] w-[30rem] rounded-full
    bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_60%)]
    blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-40 left-0 h-[28rem] w-[28rem] rounded-full
    bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.22),_transparent_65%)]
    blur-3xl"
  ></div>

  <div class="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
    <div class="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div class="space-y-8">
        <div class="space-y-6">
          <span class="mono-label">Decentralized Creative Network</span>
          <div class="relative py-8 sm:py-10" aria-live="polite">
            <div
              class="typewriter-text text-4xl font-semibold leading-tight sm:text-6xl opacity-0 select-none"
              aria-hidden="true"
            >
              {longestSlogan}
            </div>
            <h1
              class="typewriter-text text-4xl font-semibold leading-tight sm:text-6xl absolute inset-0"
            >
              {typedText}
              <span class="typewriter-caret" aria-hidden="true"></span>
            </h1>
          </div>
          <p class="max-w-xl text-sm text-white/70 sm:text-base">
            Hypermusic.ai is a compositional infrastructure for collective performative
            intelligence. Build on interoperable creative contributions and let the network sing
            back.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <Button
            variant="subtle"
            onclick={() => {
              window.location.href = `${resolve("/login")}?register=1`;
            }}
          >
            Get started →
          </Button>
          <Button
            variant="subtle"
            onclick={() => {
              window.location.href = resolve("/explore");
            }}
            >Explore particles
          </Button>
        </div>
      </div>

      <div class="space-y-4">
        <div
          class="rounded-[1.75rem] border border-white/10 bg-black/70 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.8)]"
        >
          <div class="flex items-center justify-between">
            <p class="mono-label">Live network pulse</p>
            <span class="text-xs text-emerald-300">Active</span>
          </div>
          <div class="mt-4 space-y-4">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-sm font-semibold text-white">256 PTs connected</p>
              <p class="text-xs text-white/50">Streaming across 19 active views.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-sm font-semibold text-white">42 remix clusters</p>
              <p class="text-xs text-white/50">Human and agent creators co-authoring.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-sm font-semibold text-white">8 new particles</p>
              <p class="text-xs text-white/50">Generated in the last 60 minutes.</p>
            </div>
          </div>
        </div>

        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <p class="text-xs uppercase tracking-[0.3em] text-white/50">Manifesto</p>
          <p class="mt-3 text-sm text-white/70">
            Every performative transaction is a reusable, inspectable step in a shared musical
            lineage.
          </p>
        </div>
      </div>
    </div>
  </div>
</SectionShell>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .typewriter-text {
    text-shadow: 0 0 30px rgba(16, 185, 129, 0.25);
  }

  .typewriter-caret {
    display: inline-block;
    width: 0.65ch;
    height: 1em;
    margin-left: 0.15ch;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.8);
    animation: blink 1s steps(2, end) infinite;
    translate: 0 0.1em;
  }

  @keyframes blink {
    0%,
    55% {
      opacity: 1;
    }
    56%,
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .typewriter-caret {
      animation: none;
    }
  }

  .mono-label {
    @apply text-[0.7rem] font-mono tracking-[0.28em] uppercase text-white/40;
  }
</style>
