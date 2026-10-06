<script lang="ts">
  import { asset, resolve } from "$app/paths";

  type Lesson =
    | "first-run"
    | "starting-value"
    | "draft"
    | "selection"
    | "formats"
    | "publish"
    | "conditions"
    | "custom-elements";
  const { lesson, connector = "pitch" }: { lesson: Lesson; connector?: string } = $props();
  const previews = {
    "first-run": {
      title: "Your first run, with a guide",
      height: 400,
      description: "Prompts point to the controls as you run four values from pitch.",
      alt: "Studio screenshot: a tutorial popup beside pitch highlights Execute on the Network.",
      label: "Try the guided Studio walkthrough ↗",
    },
    "starting-value": {
      title: "Try a different starting point",
      height: 520,
      description: "The guide shows where to change Start, then helps you check the result.",
      alt: "Studio screenshot: the Change Start to 10 tutorial popup highlights Running instance in the Inspector.",
      label: "Change the starting value in Studio ↗",
    },
    draft: {
      title: "Build your first selection, with a guide",
      height: 553,
      description: "Connect pitch, choose your rule, then save and test a real draft.",
      alt: "Studio screenshot: the draft walkthrough points to the selecting rule in the Inspector.",
      label: "Create and test a draft in Studio ↗",
    },
    selection: {
      title: "Try a second selection",
      height: 553,
      description: "Make a new draft with add 12 and compare its four values.",
      alt: "Studio screenshot: a tutorial popup explains how to select every twelfth value.",
      label: "Try add 12 in Studio ↗",
    },
    formats: {
      title: "See what a connector supplies",
      height: 553,
      description: "Inspect the real definition before choosing a World for it.",
      alt: "Studio screenshot: the tutorial highlights pitch’s Protocol JSON view.",
      label: "Inspect the format in Studio ↗",
    },
    publish: {
      title: "From a saved draft to the network",
      height: 553,
      description: "Review your draft, publish when you choose, then check a network run.",
      alt: "Studio screenshot: a tutorial popup highlights Simulate to check a saved draft before publication.",
      label: "Open the publication guide in Studio ↗",
    },
    conditions: {
      title: "Run a connector with a real condition",
      height: 553,
      description:
        "Inspect the threshold’s fixed arguments, predict its answer, then run four values.",
      alt: "Studio screenshot: a tutorial popup highlights the published threshold connector’s condition arguments, 12 and 10.",
      label: "Try a published condition in Studio ↗",
    },
    "custom-elements": {
      title: "Write a rule, then use it",
      height: 553,
      description: "Create Solidity snippets, attach them to a connector and test six values.",
      alt: "Studio screenshot: a tutorial popup points to the editable Solidity snippet for a custom transformation.",
      label: "Create custom elements in Studio ↗",
    },
  };
  const preview = $derived(previews[lesson]);
</script>

<figure class="studio-guide-preview">
  <img
    src={asset(`/site/images/tutorial/studio-guide-${lesson}.png`)}
    alt={preview.alt}
    width="960"
    height={preview.height}
    loading="lazy"
    decoding="async"
  />
  <figcaption>
    <div class="preview-copy">
      <strong>{preview.title}</strong>
      <p>{preview.description}</p>
    </div>
    <a
      class="guided-link"
      href={resolve(
        lesson === "draft" ||
          lesson === "selection" ||
          lesson === "publish" ||
          lesson === "custom-elements"
          ? `/studio?lesson=${lesson}`
          : `/studio?network_kind=connector&network_id=${encodeURIComponent(connector)}&lesson=${lesson}`,
      )}
      target="_blank"
      rel="noopener noreferrer">{preview.label}</a
    >
  </figcaption>
</figure>

<style>
  .studio-guide-preview {
    overflow: hidden;
    margin: 0;
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--color-accent) 35%, var(--border-subtle));
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--color-accent) 5%, var(--surface-page));
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    border-bottom: 1px solid var(--border-subtle);
    background: #050c17;
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 1.5rem;
    padding: clamp(1rem, 3vw, 1.3rem);
  }

  .preview-copy {
    flex: 1 1 15rem;
  }

  strong {
    display: block;
    color: var(--text-primary);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .studio-guide-preview p {
    margin: 0.4rem 0 0;
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.6;
  }

  .studio-guide-preview .guided-link {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    max-width: 100%;
    padding: 0.8rem 1rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 50%, transparent);
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--color-accent) 12%, var(--surface-page));
    color: color-mix(in srgb, var(--color-accent-strong) 85%, var(--text-primary));
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none !important;
  }

  .guided-link:hover {
    background: color-mix(in srgb, var(--color-accent) 20%, var(--surface-page));
  }

  .guided-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
  }
</style>
