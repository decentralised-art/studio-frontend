<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api.js";
  import type { LintIssue } from "./lintWorker";
  import { buildServicesApiUrl } from "$lib/url/url";

  // Svelte 5 props
  let {
    value = $bindable(""),
    readOnly = false,
    lintMode = "server" as "server" | "light",
    lintEndpoint = buildServicesApiUrl("/solidity/lint"),
    onChange,
  } = $props<{
    value?: string;
    readOnly?: boolean;
    lintMode?: "server" | "light";
    lintEndpoint?: string;
    onChange?: (value: string) => void;
  }>();

  let el: HTMLDivElement;
  let monaco: typeof Monaco | null = null;
  let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
  let model: Monaco.editor.ITextModel | null = null;

  let worker: Worker | null = null;
  let contentSubscription: { dispose: () => void } | null = null;
  let lintReqId = 0;
  let lastAppliedReqId = 0;
  let destroyed = false;
  let editorLoading = $state(true);
  let editorError = $state<string | null>(null);

  function toSeverity(s: LintIssue["severity"]) {
    const monacoApi = monaco;
    if (!monacoApi) return 1;
    if (s === "error") return monacoApi.MarkerSeverity.Error;
    if (s === "warning") return monacoApi.MarkerSeverity.Warning;
    if (s === "info") return monacoApi.MarkerSeverity.Info;
    return monacoApi.MarkerSeverity.Hint;
  }

  function applyMarkers(issues: LintIssue[]) {
    if (!monaco || !model) return;

    const markers: Monaco.editor.IMarkerData[] = issues.map((i) => ({
      message: i.code ? `${i.message} (${i.code})` : i.message,
      severity: toSeverity(i.severity),
      startLineNumber: i.line,
      startColumn: i.column,
      endLineNumber: i.endLine ?? i.line,
      endColumn: i.endColumn ?? i.column + 1,
    }));

    monaco.editor.setModelMarkers(model, "solidity-lint", markers);
  }

  function requestLint() {
    if (!worker || !model) return;
    const id = ++lintReqId;
    worker.postMessage({
      id,
      code: model.getValue(),
      mode: lintMode,
      endpoint: lintEndpoint,
    });
  }

  async function setupEditor() {
    try {
      const [monacoModule, solidityLanguage] = await Promise.all([
        import("monaco-editor/esm/vs/editor/editor.api.js"),
        import("./monacoSolidity"),
      ]);

      if (destroyed || !el) return;

      const monacoApi = monacoModule;
      monaco = monacoApi;
      solidityLanguage.ensureSolidityLanguage();

      model = monacoApi.editor.createModel(value ?? "", "solidity");

      editor = monacoApi.editor.create(el, {
        model,
        readOnly,
        automaticLayout: true,

        stickyScroll: { enabled: !readOnly },

        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        tabSize: 2,
        insertSpaces: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        renderValidationDecorations: "on",
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: false },
      });

      // Completion items must include `range` (newer Monaco typings)
      monacoApi.languages.registerCompletionItemProvider("solidity", {
        triggerCharacters: [".", " "],
        provideCompletionItems: (m, position) => {
          const word = m.getWordUntilPosition(position);
          const range: Monaco.IRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          return {
            suggestions: [
              {
                label: "pragma solidity ^0.8.0;",
                kind: monacoApi.languages.CompletionItemKind.Snippet,
                insertText: "pragma solidity ^0.8.0;",
                range,
              },
              {
                label: "contract",
                kind: monacoApi.languages.CompletionItemKind.Snippet,
                insertText: "contract ${1:Name} {\n\t$0\n}\n",
                insertTextRules: monacoApi.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
              },
              {
                label: "function",
                kind: monacoApi.languages.CompletionItemKind.Snippet,
                insertText:
                  "function ${1:name}(${2:args}) ${3:public} ${4:returns ()} {\n\t$0\n}\n",
                insertTextRules: monacoApi.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
              },
            ],
          };
        },
      });

      worker = new Worker(new URL("./lintWorker.ts", import.meta.url), {
        type: "module",
      });

      worker.onmessage = (ev: MessageEvent<{ id: number; issues: LintIssue[] }>) => {
        const { id, issues } = ev.data;
        if (id < lastAppliedReqId) return; // ignore stale responses
        lastAppliedReqId = id;
        applyMarkers(issues);
      };

      requestLint();

      contentSubscription = model.onDidChangeContent(() => {
        if (!model) return;
        const v = model.getValue();

        // update bindable prop (enables bind:value)
        value = v;

        // optional callback prop
        onChange?.(v);

        requestLint();
      });
    } catch (error) {
      if (!destroyed)
        editorError = error instanceof Error ? error.message : "Editor failed to load.";
    } finally {
      if (!destroyed) editorLoading = false;
    }
  }

  onMount(() => {
    void setupEditor();
  });

  onDestroy(() => {
    destroyed = true;
    contentSubscription?.dispose();
    worker?.terminate();
    editor?.dispose();
    model?.dispose();
  });

  // External updates -> editor
  $effect(() => {
    if (!model) return;
    const current = model.getValue();
    if (value !== current) {
      model.setValue(value ?? "");
      requestLint();
    }
  });

  // Prop updates -> editor options
  $effect(() => {
    editor?.updateOptions({ readOnly });
  });
</script>

<div class="wrap" class:readonly={readOnly}>
  <div class="editor" bind:this={el}>
    {#if editorLoading}
      <div class="editor-status">Loading editor...</div>
    {:else if editorError}
      <div class="editor-status error">{editorError}</div>
    {/if}
  </div>
</div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }

  /* Greyed-out look */
  .wrap.readonly {
    background: rgba(255, 255, 255, 0.03);
  }

  .wrap.readonly::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.18);
    pointer-events: none;
  }

  .editor {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    overflow: hidden;
    position: relative;
  }

  .editor-status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.62);
    font-size: 0.875rem;
  }

  .editor-status.error {
    color: #ffb4b4;
    padding: 1rem;
    text-align: center;
    overflow-wrap: anywhere;
  }
</style>
