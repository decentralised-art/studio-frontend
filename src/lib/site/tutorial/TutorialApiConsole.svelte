<script lang="ts">
  import { onDestroy, tick } from "svelte";

  import { CHAIN_BASE } from "$lib/site/docs/apiReference";
  import { examples, expectedValues } from "./conditionExampleSamples";

  type Command = {
    label: string;
    path: string;
    body?: {
      connector_name: string;
      particles_count: number;
      dynamic_ri: Record<string, { start_point: number; transformation_shift: number }>;
    };
    expected?: number[];
    expectedRejection?: boolean;
  };
  type Entry = { id: number; command: string; output: string; status: string; failed: boolean };

  const {
    lesson,
  }: {
    lesson: "first-run" | "starting-value" | "formats" | "conditions" | "condition-examples";
  } = $props();
  const run = (start: number, label: string): Command => ({
    label,
    path: "/execute",
    body: {
      connector_name: "pitch",
      particles_count: 4,
      dynamic_ri: { "0": { start_point: start, transformation_shift: 0 } },
    },
    expected: [start, start + 1, start + 2, start + 3],
  });
  const commands = $derived<Command[]>(
    lesson === "first-run"
      ? [{ label: "Inspect pitch", path: "/connector/pitch" }, run(0, "Run four values")]
      : lesson === "starting-value"
        ? [run(10, "Start at 10"), run(0, "Compare with Start 0")]
        : lesson === "formats"
          ? [
              { label: "Inspect pitch", path: "/connector/pitch" },
              { label: "List known formats", path: "/formats?limit=10" },
            ]
          : lesson === "condition-examples"
            ? examples.flatMap((example) => [
                {
                  label: `${example.label} · allowed`,
                  path: "/execute",
                  body: { connector_name: example.pass, particles_count: 4, dynamic_ri: {} },
                  expected: expectedValues,
                },
                {
                  label: `${example.label} · blocked`,
                  path: "/execute",
                  body: { connector_name: example.fail, particles_count: 4, dynamic_ri: {} },
                  expectedRejection: true,
                },
              ])
            : [
                { label: "Check pitch’s condition", path: "/connector/pitch" },
                {
                  label: "Find published conditions",
                  path: "/feed?type=condition_added&limit=5&include_unfinalized=0",
                },
              ],
  );
  let selected = $state(0);
  const command = $derived(commands[selected]);
  const shellCommand = (item: Command) => {
    const curl = `curl --silent --show-error --fail-with-body ${CHAIN_BASE}${item.path}`;
    return item.body
      ? `${curl} \\\n  -H 'Content-Type: application/json' \\\n  --data '${JSON.stringify(item.body)}'`
      : curl;
  };
  const currentRows = (text: string) => Math.max(3, text.split("\n").length + 2);

  let entries = $state<Entry[]>([]);
  let output = $state<HTMLDivElement | null>(null);
  let nextId = 0;
  let busy = $state(false);
  let copied = $state(false);
  let copyError = $state(false);
  let controller: AbortController | undefined;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const matches = (response: unknown, expected: number[]) => {
    if (!response || typeof response !== "object" || !("particles" in response)) return false;
    const particles = response.particles;
    return (
      Array.isArray(particles) &&
      particles.some(
        (stream) =>
          typeof stream?.path === "string" &&
          stream.path.endsWith("/pitch:0") &&
          Array.isArray(stream.data) &&
          stream.data.length === expected.length &&
          stream.data.every((value: unknown, index: number) => value === expected[index]),
      )
    );
  };

  const execute = async () => {
    if (busy) return;
    const current = command;
    const entry: Entry = {
      id: nextId++,
      command: shellCommand(current),
      output: "",
      status: "",
      failed: false,
    };
    busy = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 25000);
    try {
      const response = await fetch(`${CHAIN_BASE}${current.path}`, {
        method: current.body ? "POST" : "GET",
        ...(current.body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(current.body),
            }
          : {}),
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      const raw = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
        entry.output = JSON.stringify(parsed, null, 2);
      } catch {
        entry.output = raw || "The API returned an empty response.";
      }
      entry.failed = !response.ok;
      entry.status = `HTTP ${response.status}`;
      if (current.expectedRejection) {
        const conditionRejected =
          response.status === 400 &&
          parsed !== null &&
          typeof parsed === "object" &&
          "message" in parsed &&
          parsed.message === "Execution rejected: Condition not met";
        entry.failed = !conditionRejected;
        entry.status += conditionRejected
          ? " · Expected result: the condition blocked this run."
          : response.ok
            ? " · Unexpected result: this condition should block the run."
            : " · A different error occurred. Read the response below.";
      } else if (response.ok && current.expected) {
        if (matches(parsed, current.expected)) {
          entry.status += ` · Result matches: ${current.expected.join(", ")}`;
        } else {
          entry.failed = true;
          entry.status += " · Unexpected result: check the returned path and values.";
        }
      } else if (!response.ok) {
        entry.status += " · Request failed. Read the response below, then retry when ready.";
      }
    } catch (error) {
      entry.failed = true;
      entry.status = "Request failed";
      entry.output =
        error instanceof Error && error.name === "AbortError"
          ? "The request timed out. Try again, or copy the command to your own terminal."
          : "Couldn’t reach the API. Check your connection and retry, or copy the command to your own terminal.";
    } finally {
      clearTimeout(timeout);
      controller = undefined;
      entries = [...entries.slice(-3), entry];
      busy = false;
      await tick();
      if (output) {
        const latest = output.lastElementChild as HTMLElement | null;
        output.scrollTop = latest?.offsetTop ?? 0;
      }
    }
  };

  const copy = async () => {
    copied = false;
    copyError = false;
    try {
      await navigator.clipboard.writeText(shellCommand(command));
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1600);
    } catch {
      copyError = true;
    }
  };

  onDestroy(() => {
    controller?.abort();
    clearTimeout(copyTimer);
  });
</script>

<div class="api-console" role="group" aria-label="Tutorial API console" data-markdown-skip>
  <div class="console-heading">
    <span>decentralised.art / API console</span>
    <span class="request-kind">Live requests</span>
  </div>
  <div class="command-options" role="group" aria-label="Tutorial commands">
    {#each commands as item, index (item.label)}
      <button
        type="button"
        aria-pressed={selected === index}
        disabled={busy}
        onclick={() => {
          selected = index;
          copied = false;
          copyError = false;
        }}>{item.label}</button
      >
    {/each}
  </div>
  <form
    class="command-form"
    onsubmit={(event) => {
      event.preventDefault();
      void execute();
    }}
  >
    <div class="command-preview">
      <span class="shell-prompt" aria-hidden="true">$</span>
      <textarea
        readonly
        aria-label="Selected curl command"
        value={shellCommand(command)}
        rows={currentRows(shellCommand(command))}
      ></textarea>
    </div>
    <div class="command-actions">
      <button type="submit" class="run-request" disabled={busy}
        >{busy ? "Sending…" : "Run request"}<span aria-hidden="true"> ↵</span></button
      >
      <button type="button" class="copy-command" onclick={copy}
        >{copied ? "Copied" : "Copy curl command"}</button
      >
      {#if copyError}<span role="status">Select the command above to copy it.</span>{/if}
    </div>
  </form>
  <div class="console-output" aria-busy={busy} bind:this={output}>
    {#if entries.length === 0}
      <p class="console-hint">Choose a command above, then run it to see the real API response.</p>
    {/if}
    {#each entries as entry (entry.id)}
      <div class="result-entry" class:failed={entry.failed}>
        <details>
          <summary>Request sent</summary>
          <pre><code>{entry.command}</code></pre>
        </details>
        <p class="result-status">{entry.status}</p>
        <textarea
          class="result-json"
          readonly
          aria-label="API response"
          value={entry.output}
          rows={Math.min(entry.output.split("\n").length, 18)}
        ></textarea>
      </div>
    {/each}
  </div>
  <p class="console-notice" role="status" aria-live="polite">
    {busy ? "Sending the selected request to the public API…" : (entries.at(-1)?.status ?? "Ready")}
  </p>
</div>

<style lang="postcss">
  .api-console {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #344c5f;
    border-radius: 0.85rem;
    background: #101c27 !important;
    color: #d9e7f0 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78rem;
    line-height: 1.6;
  }

  .console-heading,
  .command-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
  }

  .console-heading {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #344c5f;
    background: #172938 !important;
  }

  .api-console .request-kind,
  .api-console .shell-prompt,
  .api-console .result-status {
    color: #8de8c1 !important;
  }

  .command-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 1rem 1rem 0;
  }

  .api-console button {
    padding: 0.45rem 0.7rem;
    border: 1px solid #486277;
    border-radius: 0.35rem;
    background: transparent !important;
    color: #d9e7f0 !important;
    font: inherit;
    cursor: pointer;
  }

  .api-console button[aria-pressed="true"] {
    border-color: #8de8c1;
    color: #8de8c1 !important;
  }

  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  button:focus-visible,
  textarea:focus-visible {
    outline: 2px solid #8de8c1;
    outline-offset: 3px;
  }

  .command-form {
    padding: 1rem;
  }

  .command-preview {
    display: grid;
    grid-template-columns: 0.8rem minmax(0, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .command-preview textarea {
    field-sizing: content;
    min-height: 3rem;
    max-height: 16rem;
  }

  .command-actions {
    justify-content: flex-start;
  }

  .command-actions .run-request {
    background: #8de8c1 !important;
    border-color: #8de8c1;
    color: #101c27 !important;
    font-weight: 600;
  }

  .api-console pre,
  .api-console code,
  .api-console textarea {
    margin: 0;
    padding: 0;
    border: 0 !important;
    background: transparent !important;
    color: #d9e7f0 !important;
    font: inherit;
  }

  pre,
  textarea {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 23rem;
    overflow: auto;
  }

  textarea {
    display: block;
    width: 100%;
    resize: vertical;
  }

  .console-output {
    position: relative;
    padding: 0 1rem;
    max-height: 23rem;
    overflow-y: auto;
  }

  .api-console .console-hint,
  .api-console .console-notice,
  .api-console summary {
    color: #a5baca !important;
  }

  .result-entry {
    padding: 0.85rem 0;
    border-top: 1px solid #344c5f;
  }

  summary {
    cursor: pointer;
    margin-bottom: 0.5rem;
  }

  .result-status {
    margin: 0.5rem 0 !important;
  }

  .api-console .failed .result-status {
    color: #ffb7a5 !important;
  }

  .console-notice {
    padding: 0.65rem 1rem;
    margin: 0.85rem 0 0 !important;
    border-top: 1px solid #344c5f;
    font-size: 0.7rem;
  }
</style>
