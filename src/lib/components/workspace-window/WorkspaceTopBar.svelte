<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import type { TopBarState, SolidityDomain } from "./editorDomain";

  type Props = {
    readonly state: TopBarState;

    readonly onOpenFlow: () => void;
    readonly onOpenTransformationsTab: () => void;
    readonly onOpenConditionsTab: () => void;

    readonly onPublish: () => void | Promise<void>;
  };

  const { state, onOpenFlow, onOpenTransformationsTab, onOpenConditionsTab, onPublish }: Props =
    $props();

  function titleLabel(mode: "flow" | "solidity", domain: SolidityDomain): string {
    if (mode === "flow") return "Flow Editor";
    return domain === "transformation" ? "Transformations" : "Conditions";
  }

  function publishLabel(mode: "flow" | "solidity", domain: SolidityDomain): string {
    if (mode === "flow") return "Publish Feature";
    return domain === "transformation" ? "Publish Transformation" : "Publish Condition";
  }
</script>

<div class="topbar">
  <div class="left">
    <div class="divider"></div>
    <div class="title">{titleLabel(state.mode, state.solidityDomain)}</div>
  </div>

  <div class="right">
    <Button variant="subtle" onclick={onPublish}
      >{publishLabel(state.mode, state.solidityDomain)}</Button
    >

    <div class="seg" role="tablist" aria-label="Editors">
      <Button variant={state.mode === "flow" ? "primary" : "ghost"} onclick={onOpenFlow}>
        Feature
      </Button>

      <Button
        variant={state.mode === "solidity" && state.solidityDomain === "transformation"
          ? "primary"
          : "ghost"}
        onclick={onOpenTransformationsTab}
      >
        Transformation
      </Button>

      <Button
        variant={state.mode === "solidity" && state.solidityDomain === "condition"
          ? "primary"
          : "ghost"}
        onclick={onOpenConditionsTab}
      >
        Condition
      </Button>
    </div>
  </div>
</div>

<style>
  .topbar {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(20, 20, 24, 0.85);
    backdrop-filter: blur(10px);
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    gap: 32px; /* space between Publish button and tab group */
  }

  .divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.12);
  }

  .title {
    font-weight: 600;
    opacity: 0.95;
    white-space: nowrap;
  }

  .seg {
    display: inline-flex;
    overflow: hidden;
    gap: 12px; /* space BETWEEN buttons */
  }
</style>
