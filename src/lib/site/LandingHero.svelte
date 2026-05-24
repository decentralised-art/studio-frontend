<script lang="ts">
  import { onMount } from "svelte";
  import { asset, resolve } from "$app/paths";

  import { hasAuthSession } from "$lib/auth/session";
  import WalletAuthButton from "$lib/components/auth/WalletAuthButton.svelte";

  type HeroSlide = {
    focusMain: string;
    focusContinuation: string;
    subtitle: string;
    accent: string;
    image: string;
  };

  const slides: HeroSlide[] = [
    {
      focusMain: "worlds as artworks",
      focusContinuation: "and reusable intelligence across them.",
      subtitle:
        "Create blockchain-based procedures through the Studio or API. Let humans, AI agents, and Worlds contribute, interpret, execute, and recombine them.",
      accent: "#67d6ff",
      image: asset("/site/images/collective_performative_intelligence.jpeg"),
    },
    {
      focusMain: "reusable onchain procedures",
      focusContinuation: "for any World.",
      subtitle:
        "Build operations once and make them available across applications. Worlds on decentralised.art — or external Worlds — can call, interpret, and compose them.",
      accent: "#f7c86a",
      image: asset("/site/images/autonomous_worlds.jpeg"),
    },
    {
      focusMain: "human and AI agent contribution",
      focusContinuation: "through Studio and API.",
      subtitle:
        "Humans can create procedures visually through the Studio or programmatically through the API. AI agents can contribute directly through the API, turning intelligence into shared procedural infrastructure.",
      accent: "#ff9b7a",
      image: asset("/site/images/economic_systems.jpeg"),
    },
    {
      focusMain: "a browser of Worlds",
      focusContinuation: "as living artworks.",
      subtitle:
        "Publish Worlds to decentralised.art and explore the content made for them. Each World becomes an environment where procedures, contributions, and outputs can be discovered, reused, and extended.",
      accent: "#8de58f",
      image: asset("/site/images/intelligent_delegation.jpeg"),
    },
  ];

  let isAuthenticated = $state(hasAuthSession());

  onMount(() => {
    const syncAuth = () => {
      isAuthenticated = hasAuthSession();
    };

    syncAuth();
    window.addEventListener("auth:change", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("auth:change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  });

  onMount(() => {
    const root = document.getElementById("landing-hero-carousel");
    if (!root) return;

    const slideElements = Array.from(root.querySelectorAll<HTMLElement>("[data-hero-slide]"));
    const contentElement = root.querySelector<HTMLElement>(".hero-content");
    const titleElement = root.querySelector<HTMLElement>(".hero-title");
    const prefixElement = root.querySelector<HTMLElement>(".hero-title-prefix");
    const focusElement = root.querySelector<HTMLElement>("[data-hero-focus]");
    const focusMainElement = root.querySelector<HTMLElement>("[data-hero-focus-main]");
    const focusContinuationElement = root.querySelector<HTMLElement>(
      "[data-hero-focus-continuation]",
    );
    const subtitleElement = root.querySelector<HTMLElement>("[data-hero-subtitle]");
    const toggleButton = root.querySelector<HTMLButtonElement>("[data-hero-toggle]");
    const toggleIconElement = root.querySelector<HTMLElement>("[data-hero-toggle-icon]");
    const progressElement = root.querySelector<SVGCircleElement>("[data-hero-progress]");
    const dotElements = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-hero-dot]"));
    if (
      !slideElements.length ||
      !focusElement ||
      !focusMainElement ||
      !focusContinuationElement ||
      !subtitleElement
    )
      return;

    let current = 0;
    let timer: number | null = null;
    let frame: number | null = null;
    let fitFrame: number | null = null;
    let isPaused = false;
    let textAnimationToken = 0;
    const subtitleFadeMs = 1000;
    const slideDurationMs = 12500;
    const mobileHeroBreakpoint = 900;
    let remainingMs = slideDurationMs;
    let cycleStart = 0;
    const progressRadius = Number(progressElement?.getAttribute("r") ?? "15");
    const progressCircumference = 2 * Math.PI * progressRadius;

    const sleep = (ms: number) =>
      new Promise<void>((resolveSleep) => {
        window.setTimeout(resolveSleep, ms);
      });

    const setProgress = (value: number) => {
      if (!progressElement) return;
      const clamped = Math.max(0, Math.min(1, value));
      progressElement.style.strokeDashoffset = `${progressCircumference * (1 - clamped)}`;
    };

    if (progressElement) {
      progressElement.style.strokeDasharray = `${progressCircumference} ${progressCircumference}`;
      setProgress(0);
    }

    const stopProgressLoop = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    };

    const startProgressLoop = () => {
      stopProgressLoop();
      const tick = () => {
        if (!timer) return;
        const elapsed = Math.min(performance.now() - cycleStart, slideDurationMs);
        setProgress(elapsed / slideDurationMs);
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };

    const fitHeroTitleToViewport = () => {
      if (!titleElement || !prefixElement || !contentElement) return;

      titleElement.style.fontSize = "";
      if (window.innerWidth > mobileHeroBreakpoint) return;

      const availableWidth = Math.max(0, contentElement.clientWidth - 2);
      if (!availableWidth) return;

      const requiredWidth = prefixElement.scrollWidth;
      if (!requiredWidth) return;

      const scale = Math.max(0.7, Math.min(1, availableWidth / requiredWidth));
      if (scale >= 0.999) return;

      const baseFontSize = Number.parseFloat(window.getComputedStyle(titleElement).fontSize);
      if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) return;

      titleElement.style.fontSize = `${(baseFontSize * scale).toFixed(2)}px`;
    };

    const queueHeroTitleFit = () => {
      if (fitFrame !== null) return;
      fitFrame = window.requestAnimationFrame(() => {
        fitFrame = null;
        fitHeroTitleToViewport();
      });
    };

    const animateHeroText = async (
      nextMainText: string,
      nextContinuationText: string,
      nextSubtitle: string,
      accentColor: string,
    ) => {
      const token = ++textAnimationToken;

      subtitleElement.classList.remove("is-visible");
      focusElement.classList.remove("is-typing");
      focusElement.classList.add("is-fading");
      await sleep(subtitleFadeMs);
      if (token !== textAnimationToken) return;

      focusElement.classList.remove("is-fading");
      focusMainElement.textContent = "";
      focusContinuationElement.textContent = "";
      focusElement.style.color = accentColor;
      focusElement.classList.add("is-typing");
      queueHeroTitleFit();

      for (let i = 1; i <= nextMainText.length; i += 1) {
        if (token !== textAnimationToken) return;
        focusMainElement.textContent = nextMainText.slice(0, i);
        queueHeroTitleFit();
        await sleep(30);
      }

      for (let i = 1; i <= nextContinuationText.length; i += 1) {
        if (token !== textAnimationToken) return;
        focusContinuationElement.textContent = nextContinuationText.slice(0, i);
        queueHeroTitleFit();
        await sleep(30);
      }

      if (token !== textAnimationToken) return;
      focusElement.classList.remove("is-typing");
      subtitleElement.textContent = nextSubtitle;
      queueHeroTitleFit();
      await sleep(140);
      if (token !== textAnimationToken) return;
      subtitleElement.classList.add("is-visible");
    };

    const updateToggleButton = () => {
      if (!toggleButton) return;
      if (toggleIconElement) toggleIconElement.textContent = isPaused ? "▶" : "⏸";
      toggleButton.setAttribute("aria-label", isPaused ? "Play slideshow" : "Pause slideshow");
      toggleButton.setAttribute("title", isPaused ? "Play slideshow" : "Pause slideshow");
      toggleButton.setAttribute("aria-pressed", isPaused ? "true" : "false");
    };

    const setSlide = (index: number, immediate = false) => {
      current = (index + slideElements.length) % slideElements.length;

      slideElements.forEach((slideElement, slideIndex) => {
        slideElement.classList.toggle("is-active", slideIndex === current);
      });

      const activeSlide = slideElements[current];
      const nextFocusMain = activeSlide.dataset.focusMain ?? "";
      const nextFocusContinuation = activeSlide.dataset.focusContinuation ?? "";
      const nextAccent = activeSlide.dataset.accent ?? "";
      const nextSubtitle = activeSlide.dataset.subtitle ?? "";

      if (immediate) {
        textAnimationToken += 1;
        focusElement.classList.remove("is-fading");
        focusElement.classList.remove("is-typing");
        focusMainElement.textContent = nextFocusMain;
        focusContinuationElement.textContent = nextFocusContinuation;
        focusElement.style.color = nextAccent;
        subtitleElement.textContent = nextSubtitle;
        subtitleElement.classList.add("is-visible");
        queueHeroTitleFit();
      } else {
        void animateHeroText(nextFocusMain, nextFocusContinuation, nextSubtitle, nextAccent);
      }

      dotElements.forEach((dotElement, dotIndex) => {
        const isActive = dotIndex === current;
        dotElement.classList.toggle("is-active", isActive);
        dotElement.setAttribute("aria-current", isActive ? "true" : "false");
      });
    };

    const stop = () => {
      if (!timer) return;
      window.clearTimeout(timer);
      timer = null;
      const elapsed = Math.min(performance.now() - cycleStart, slideDurationMs);
      remainingMs = Math.max(slideDurationMs - elapsed, 0);
      stopProgressLoop();
    };

    const start = () => {
      if (timer || isPaused) return;
      cycleStart = performance.now() - (slideDurationMs - remainingMs);
      timer = window.setTimeout(() => {
        timer = null;
        stopProgressLoop();
        setSlide(current + 1);
        remainingMs = slideDurationMs;
        setProgress(0);
        if (!isPaused) start();
      }, remainingMs);
      startProgressLoop();
    };

    const restart = () => {
      if (timer) stop();
      remainingMs = slideDurationMs;
      setProgress(0);
      if (!isPaused) start();
    };

    const toggleSlideshow = () => {
      isPaused = !isPaused;
      updateToggleButton();
      if (isPaused) stop();
      else start();
    };

    toggleButton?.addEventListener("click", toggleSlideshow);

    dotElements.forEach((dotElement, dotIndex) => {
      dotElement.addEventListener("click", () => {
        setSlide(dotIndex);
        restart();
      });
    });

    setSlide(0, true);
    window.addEventListener("resize", queueHeroTitleFit);
    queueHeroTitleFit();
    updateToggleButton();
    start();

    return () => {
      textAnimationToken += 1;
      stop();
      stopProgressLoop();
      if (fitFrame !== null) window.cancelAnimationFrame(fitFrame);
      toggleButton?.removeEventListener("click", toggleSlideshow);
      window.removeEventListener("resize", queueHeroTitleFit);
    };
  });
</script>

<section class="immersive-hero" id="landing-hero-carousel">
  <div class="hero-slides" aria-hidden="true">
    {#each slides as slide, index (slide.focusMain)}
      <figure
        class:is-active={index === 0}
        class="hero-slide"
        data-hero-slide
        data-focus-main={slide.focusMain}
        data-focus-continuation={slide.focusContinuation}
        data-subtitle={slide.subtitle}
        data-accent={slide.accent}
      >
        <img src={slide.image} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" />
      </figure>
    {/each}
  </div>

  <div class="hero-overlay" aria-hidden="true"></div>

  <div class="hero-content">
    <h1 class="minimal-title hero-title">
      <span class="hero-title-prefix">A decentralised platform for</span>
      <span class="hero-title-focus is-visible" data-hero-focus>
        <span class="hero-title-focus-main" data-hero-focus-main>{slides[0].focusMain}</span>
        <span class="hero-title-focus-continuation" data-hero-focus-continuation>
          {slides[0].focusContinuation}
        </span>
      </span>
    </h1>
    <p class="minimal-subtitle hero-subtitle is-visible" data-hero-subtitle>
      {slides[0].subtitle}
    </p>
  </div>

  <nav class="landing-cta-row landing-hero-cta hero-bottom-cta" aria-label="Primary actions">
    {#if isAuthenticated}
      <a href={resolve("/worlds")} class="minimal-button hero-cta-button">Explore Worlds</a>
    {:else}
      <WalletAuthButton className="hero-wallet-action" showLogout={false} />
    {/if}
  </nav>

  <div class="hero-carousel-controls" aria-label="Carousel controls">
    <div class="hero-dot-row" role="tablist" aria-label="Select slide">
      {#each slides as slide, index (slide.focusMain)}
        <button
          type="button"
          class:is-active={index === 0}
          class="hero-dot"
          data-hero-dot
          data-hero-target={index}
          aria-label={`Go to slide ${index + 1}`}
          aria-current={index === 0 ? "true" : "false"}
        ></button>
      {/each}
    </div>
    <button
      type="button"
      class="hero-toggle-button"
      data-hero-toggle
      aria-pressed="false"
      aria-label="Pause slideshow"
      title="Pause slideshow"
    >
      <svg class="hero-toggle-ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <circle class="hero-toggle-track" cx="18" cy="18" r="15"></circle>
        <circle class="hero-toggle-progress" data-hero-progress cx="18" cy="18" r="15"></circle>
      </svg>
      <span class="hero-toggle-icon" data-hero-toggle-icon>⏸</span>
    </button>
  </div>
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .immersive-hero {
    position: relative;
    height: 100vh;
    height: 100svh;
    height: 100dvh;
    min-height: 100vh;
    min-height: 100svh;
    min-height: 100dvh;
    width: 100vw;
    margin-left: calc(50% - 50vw);
    padding-top: var(--nav-offset, 3.5rem);
    box-sizing: border-box;
    overflow: hidden;
    background: #060809;
  }

  .hero-slides {
    position: absolute;
    inset: 0;
  }

  .hero-slide {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    transition: opacity 900ms ease;
  }

  .hero-slide.is-active {
    opacity: 1;
  }

  .hero-slide img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .hero-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(
        180deg,
        rgba(6, 8, 9, 0.5) 0%,
        rgba(6, 8, 9, 0.25) 40%,
        rgba(6, 8, 9, 0.62) 100%
      ),
      linear-gradient(
        103deg,
        rgba(0, 0, 0, 0.7) 0%,
        rgba(0, 0, 0, 0.52) 34%,
        rgba(0, 0, 0, 0.2) 62%,
        rgba(0, 0, 0, 0.44) 100%
      );
  }

  .hero-content {
    position: absolute;
    z-index: 2;
    left: clamp(0.85rem, 2.8vw, 1.9rem);
    top: 50%;
    transform: translateY(-50%);
    max-width: min(760px, 68vw);
  }

  .minimal-title {
    color: #111111;
    font-family: "Syne", "Space Grotesk", system-ui, sans-serif;
    font-weight: 600;
    letter-spacing: 0;
  }

  .minimal-subtitle {
    color: #333333;
  }

  .immersive-hero .hero-title {
    margin: 0;
    color: #ffffff !important;
    font-size: clamp(2.05rem, 5.1vw, 4.1rem) !important;
    line-height: 1.02;
    text-shadow: 0 3px 14px rgba(0, 0, 0, 0.52);
  }

  .immersive-hero .hero-title-prefix {
    display: block;
    color: #ffffff !important;
    white-space: nowrap;
  }

  .hero-title-focus {
    display: block;
    min-height: 2.16em;
    color: #67d6ff;
    margin-top: 0.06em;
    white-space: normal;
    text-wrap: balance;
    line-height: 1.08;
    font-size: 0.62em;
    position: relative;
    opacity: 1;
  }

  .hero-title-focus-main,
  .hero-title-focus-continuation {
    display: inline;
  }

  .hero-title-focus-continuation {
    color: inherit;
  }

  .hero-title-focus:global(.is-fading) {
    opacity: 0;
    transition: opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .hero-title-focus::after {
    content: "";
    display: inline-block;
    width: 0.09em;
    height: 0.9em;
    margin-left: 0.14em;
    background: currentColor;
    vertical-align: -0.08em;
    opacity: 0;
  }

  .hero-title-focus:global(.is-typing)::after {
    opacity: 1;
    animation: hero-caret-blink 760ms steps(1, end) infinite;
  }

  .immersive-hero .hero-subtitle {
    margin-top: 0.9rem;
    color: rgba(255, 255, 255, 0.95) !important;
    max-width: min(710px, 64vw);
    font-size: clamp(0.98rem, 1.55vw, 1.34rem);
    line-height: 1.52;
    text-shadow: 0 2px 11px rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .hero-subtitle.is-visible {
    opacity: 1;
  }

  .landing-cta-row {
    margin-top: 1.15rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.52rem;
  }

  .landing-hero-cta {
    justify-content: center;
    gap: 0.72rem;
    margin-top: 1.35rem;
  }

  .immersive-hero .landing-hero-cta {
    justify-content: center;
    margin-top: 0;
  }

  .hero-bottom-cta {
    position: absolute;
    z-index: 2;
    left: 50%;
    transform: translateX(-50%);
    bottom: clamp(4.8rem, 11vh, 7.2rem);
    width: max-content;
    max-width: calc(100vw - 1.5rem);
  }

  .minimal-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.36rem 0.72rem;
    border: 1px solid #111111;
    border-radius: 0.2rem;
    font-size: 0.82rem;
    text-decoration: none !important;
    color: #111111 !important;
    background: #ffffff;
  }

  .minimal-button:hover {
    background: #f4f4f4;
  }

  .hero-cta-button,
  :global(.hero-wallet-action > button),
  :global(.hero-wallet-action .wallet-menu-trigger) {
    position: relative;
    font-size: 0.95rem;
    padding: 0.62rem 1.15rem;
    border-radius: 0.32rem;
    letter-spacing: 0;
    border: 1px solid rgba(255, 255, 255, 0.34);
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.12) !important;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.08),
      0 8px 18px rgba(0, 0, 0, 0.28),
      0 0 14px rgba(255, 255, 255, 0.22);
    overflow: hidden;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .hero-cta-button::after,
  :global(.hero-wallet-action > button)::after,
  :global(.hero-wallet-action .wallet-menu-trigger)::after {
    content: "";
    position: absolute;
    top: -130%;
    left: -42%;
    width: 38%;
    height: 340%;
    transform: rotate(19deg);
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.9) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    transition: left 360ms ease;
    pointer-events: none;
  }

  .hero-cta-button:hover,
  :global(.hero-wallet-action > button:hover),
  :global(.hero-wallet-action .wallet-menu-trigger:hover) {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.22) !important;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.16),
      0 12px 24px rgba(0, 0, 0, 0.34),
      0 0 18px rgba(255, 255, 255, 0.28);
  }

  .hero-cta-button:hover::after,
  :global(.hero-wallet-action > button:hover)::after,
  :global(.hero-wallet-action .wallet-menu-trigger:hover)::after {
    left: 116%;
  }

  :global(.hero-wallet-action) {
    justify-content: center;
    margin: 0;
  }

  :global(.hero-wallet-action .wallet-menu-list) {
    top: auto;
    bottom: calc(100% + 0.45rem);
    background: rgba(10, 13, 16, 0.92);
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  }

  :global(.hero-wallet-action .wallet-menu-item) {
    color: rgba(255, 255, 255, 0.88);
  }

  :global(.hero-wallet-action .wallet-menu-item:hover),
  :global(.hero-wallet-action .wallet-menu-item:focus-visible) {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
  }

  :global(.hero-wallet-action .wallet-error) {
    position: absolute;
    top: calc(100% + 0.38rem);
    left: 50%;
    max-width: 18rem;
    transform: translateX(-50%);
    color: #ffb4b4;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.48);
  }

  .hero-carousel-controls {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: clamp(2.45rem, 5.9vh, 3.6rem);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.38rem;
  }

  .hero-dot-row {
    display: flex;
    align-items: center;
    gap: 0.32rem;
    padding: 0.2rem 0.22rem;
    border: 0;
    background: none;
    backdrop-filter: none;
  }

  .hero-dot {
    width: 0.56rem;
    height: 0.56rem;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.52);
    cursor: pointer;
    padding: 0;
  }

  .hero-dot.is-active {
    background: #ffffff;
    transform: scale(1.13);
  }

  @keyframes hero-caret-blink {
    0%,
    45% {
      opacity: 1;
    }

    46%,
    100% {
      opacity: 0;
    }
  }

  .hero-toggle-button {
    width: 0.7rem;
    height: 0.7rem;
    border: 0;
    border-radius: 999px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: rgba(255, 255, 255, 0.68);
    font-size: 0.5rem;
    line-height: 1;
    cursor: pointer;
    transition:
      color 160ms ease,
      transform 160ms ease;
    position: relative;
    isolation: isolate;
  }

  .hero-toggle-button:hover {
    color: #ffffff;
    transform: scale(1.11);
  }

  .hero-toggle-ring {
    position: absolute;
    inset: -0.2rem;
    width: calc(100% + 0.4rem);
    height: calc(100% + 0.4rem);
    transform: rotate(-90deg);
    pointer-events: none;
  }

  .hero-toggle-track,
  .hero-toggle-progress {
    fill: none;
    stroke-width: 2.5;
  }

  .hero-toggle-track {
    stroke: rgba(255, 255, 255, 0.24);
  }

  .hero-toggle-progress {
    stroke: rgba(255, 255, 255, 0.94);
    stroke-linecap: round;
    stroke-dashoffset: 94.2478;
  }

  .hero-toggle-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.5rem;
    line-height: 1;
    color: rgba(255, 255, 255, 0.75);
    text-shadow: 0 1px 5px rgba(0, 0, 0, 0.42);
  }

  .hero-toggle-button:hover .hero-toggle-icon {
    color: #ffffff;
  }

  @media (max-width: 900px) {
    .hero-title {
      font-size: clamp(1.12rem, 6.3vmin, 2.05rem) !important;
      line-height: 1.06;
    }

    .hero-subtitle {
      font-size: clamp(0.72rem, 2.5vmin, 0.98rem);
      line-height: 1.45;
      max-width: 92vw;
    }

    .hero-title-focus,
    .hero-title-prefix {
      white-space: normal;
      text-wrap: balance;
      overflow-wrap: anywhere;
    }

    .hero-content {
      left: clamp(0.72rem, 2.6vw, 1rem);
      right: clamp(0.72rem, 2.6vw, 1rem);
      max-width: min(92vw, 40rem);
      top: 54%;
      transform: translateY(-50%);
    }

    .hero-bottom-cta {
      width: calc(100vw - 1.44rem);
      justify-content: center;
      gap: 0.48rem;
    }

    .hero-cta-button,
    :global(.hero-wallet-action > button),
    :global(.hero-wallet-action .wallet-menu-trigger) {
      font-size: clamp(0.66rem, 2.2vmin, 0.9rem);
      padding: clamp(0.32rem, 1.05vmin, 0.56rem) clamp(0.52rem, 1.7vmin, 0.95rem);
    }
  }

  @media (max-width: 640px) {
    .immersive-hero {
      min-height: 100vh;
      min-height: 100svh;
      min-height: 100dvh;
      height: 100vh;
      height: 100svh;
      height: 100dvh;
      padding-top: var(--nav-offset, 3.3rem);
    }

    .hero-content {
      left: 0.72rem;
      right: 0.72rem;
      max-width: none;
      top: 56%;
      transform: translateY(-50%);
    }

    .hero-title {
      font-size: clamp(1rem, 6.8vmin, 1.65rem) !important;
      line-height: 1.07;
    }

    .hero-title-prefix,
    .hero-title-focus {
      white-space: normal;
      text-wrap: balance;
      overflow-wrap: anywhere;
    }

    .hero-subtitle {
      font-size: clamp(0.68rem, 2.7vmin, 0.88rem);
      line-height: 1.34;
      margin-top: 0.58rem;
      max-width: none;
      overflow-wrap: anywhere;
    }

    .hero-carousel-controls {
      left: 50%;
      transform: translateX(-50%);
      justify-content: center;
      bottom: 1.75rem;
    }

    .hero-bottom-cta {
      bottom: clamp(2.55rem, 9.2vh, 3.75rem);
      width: calc(100vw - 1.44rem);
      justify-content: center;
      gap: 0.48rem;
      flex-wrap: wrap;
    }

    .hero-cta-button,
    :global(.hero-wallet-action > button),
    :global(.hero-wallet-action .wallet-menu-trigger) {
      font-size: clamp(0.62rem, 2.35vmin, 0.84rem);
      padding: clamp(0.3rem, 1.08vmin, 0.48rem) clamp(0.5rem, 1.72vmin, 0.84rem);
    }

    .hero-toggle-button {
      width: 0.7rem;
      height: 0.7rem;
    }
  }

  @media (max-width: 960px) and (max-height: 520px) and (orientation: landscape) {
    .hero-content {
      left: 0.85rem;
      right: 0.85rem;
      max-width: min(88vw, 48rem);
      top: 54%;
      transform: translateY(-50%);
    }

    .hero-title {
      font-size: clamp(0.9rem, 4.4vmin, 1.45rem) !important;
      line-height: 1.12;
    }

    .hero-title-prefix,
    .hero-title-focus {
      white-space: normal;
      text-wrap: balance;
      overflow-wrap: anywhere;
    }

    .hero-subtitle {
      margin-top: 0.42rem;
      font-size: clamp(0.58rem, 2.1vmin, 0.84rem);
      line-height: 1.26;
      max-width: min(82vw, 44rem);
      overflow-wrap: anywhere;
    }

    .hero-bottom-cta {
      bottom: clamp(1.55rem, 5.1vh, 2.3rem);
      gap: 0.42rem;
      justify-content: center;
      width: calc(100vw - 1.5rem);
    }

    .hero-cta-button,
    :global(.hero-wallet-action > button),
    :global(.hero-wallet-action .wallet-menu-trigger) {
      font-size: clamp(0.58rem, 1.85vmin, 0.76rem);
      padding: clamp(0.28rem, 1.05vmin, 0.4rem) clamp(0.46rem, 1.6vmin, 0.68rem);
    }

    .hero-carousel-controls {
      bottom: clamp(0.34rem, 1.7vh, 0.65rem);
    }

    .hero-toggle-button {
      width: 0.62rem;
      height: 0.62rem;
    }
  }
</style>
