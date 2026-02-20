<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as monaco from "monaco-editor";
  import { ensureSolidityLanguage } from "./monacoSolidity";
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
  let editor: monaco.editor.IStandaloneCodeEditor;
  let model: monaco.editor.ITextModel;

  let worker: Worker;
  let lintReqId = 0;
  let lastAppliedReqId = 0;

  function toSeverity(s: LintIssue["severity"]): monaco.MarkerSeverity {
    if (s === "error") return monaco.MarkerSeverity.Error;
    if (s === "warning") return monaco.MarkerSeverity.Warning;
    if (s === "info") return monaco.MarkerSeverity.Info;
    return monaco.MarkerSeverity.Hint;
  }

  function applyMarkers(issues: LintIssue[]) {
    if (!model) return;

    const markers: monaco.editor.IMarkerData[] = issues.map((i) => ({
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

  onMount(() => {
    ensureSolidityLanguage();

    model = monaco.editor.createModel(value ?? "", "solidity");

    editor = monaco.editor.create(el, {
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
    monaco.languages.registerCompletionItemProvider("solidity", {
      triggerCharacters: [".", " "],
      provideCompletionItems: (m, position) => {
        const word = m.getWordUntilPosition(position);
        const range: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: [
            {
              label: "pragma solidity ^0.8.0;",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "pragma solidity ^0.8.0;",
              range,
            },
            {
              label: "contract",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "contract ${1:Name} {\n\t$0\n}\n",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            },
            {
              label: "function",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "function ${1:name}(${2:args}) ${3:public} ${4:returns ()} {\n\t$0\n}\n",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
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

    const sub = model.onDidChangeContent(() => {
      const v = model.getValue();

      // update bindable prop (enables bind:value)
      value = v;

      // optional callback prop
      onChange?.(v);

      requestLint();
    });

    return () => sub.dispose();
  });

  onDestroy(() => {
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
  <div class="editor" bind:this={el}></div>
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
  }
</style>
