<script lang="ts">
  import WorkspaceTopBar from "./WorkspaceTopBar.svelte";
  import FlowEditorShell from "./FlowEditorShell.svelte";
  import SolidityEditorShell from "./SolidityEditorShell.svelte";

  import type { EditorState } from "./editorDomain";
  import { FLOW_NONE } from "./editorDomain";
  import { computeTopBarState, reduceEditorState, type Action } from "./editorState";

  import {
    parseContractName,
    parseSoliditySnippet,
  } from "$lib/components/solidity-editor/templates/parse";
  import { renderTransformationSolidity } from "$lib/components/solidity-editor/templates/transformationTemplate";
  import { inferArgsCountFromSnippet } from "$lib/components/solidity-editor/templates/inferArgsCount";

  import Input from "$lib/components/ui/Input.svelte";

  // Single source of truth:
  let editorState: EditorState = $state({
    kind: "flow",
    selection: FLOW_NONE,
    lastSolidityDomain: "transformation",
  });

  function dispatch(action: Action): void {
    editorState = reduceEditorState(editorState, action);
  }

  const topbar = $derived(computeTopBarState(editorState));

  async function publishCurrent(): Promise<void> {
    if (editorState.kind === "flow") {
      // TODO: publish Feature
      return;
    }

    if (editorState.kind === "solidity") {
      if (editorState.domain === "transformation") {
        // TODO: publish Transformation
        return;
      }
      // TODO: publish Condition
      return;
    }
  }

  let txNameRaw = $state("AddOne");
  let txCodeRaw = $state("return x + 1;");

  const txTemplate = $derived(() => {
    const nameRes = parseContractName(txNameRaw);
    if (!nameRes.ok) return `// error: ${nameRes.error}`;

    const codeRes = parseSoliditySnippet(txCodeRaw);
    if (!codeRes.ok) return `// error: ${codeRes.error}`;

    const inferredArgsCount = inferArgsCountFromSnippet(codeRes.value);

    return renderTransformationSolidity({
      name: nameRes.value,
      argsCount: inferredArgsCount.minArgsCount,
      code: codeRes.value,
      baseImportPath: "../TransformationBase.sol",
    });
  });
</script>

<div class="workspace">
  {#if topbar !== null}
    <WorkspaceTopBar
      state={topbar}
      onOpenFlow={() => dispatch({ kind: "OpenFlow", selection: FLOW_NONE })}
      onOpenTransformationsTab={() =>
        dispatch({ kind: "OpenSolidityTab", domain: "transformation" })}
      onOpenConditionsTab={() => dispatch({ kind: "OpenSolidityTab", domain: "condition" })}
      onPublish={publishCurrent}
    />
  {/if}

  <div class="content">
    {#if editorState.kind === "flow"}
      <FlowEditorShell />
    {:else if editorState.domain === "transformation"}
      <Input label="Transformation name" bind:value={txNameRaw} />
      <SolidityEditorShell template={txTemplate()} bind:value={txCodeRaw} />
    {:else}
      <SolidityEditorShell />
    {/if}
  </div>
</div>

<style>
  .workspace {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
</style>
