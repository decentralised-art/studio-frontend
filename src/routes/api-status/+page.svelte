<script lang="ts">
  import { onMount } from "svelte";

  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
  import Seo from "$lib/seo/Seo.svelte";

  const description =
    "Live checks for representative endpoints on https://api.decentralised.art/chain. Reachability does not guarantee full end-to-end behaviour.";

  type Probe = {
    key: string;
    label: string;
    url: string;
    method: "GET" | "OPTIONS";
  };

  type ProbeResult = {
    code: string;
    latency: string;
    state: string;
  };

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const probes: Probe[] = [
    {
      key: "version",
      label: "/version",
      url: "https://api.decentralised.art/chain/version",
      method: "GET",
    },
    {
      key: "nonce",
      label: "/nonce/<address>",
      url: `https://api.decentralised.art/chain/nonce/${zeroAddress}`,
      method: "GET",
    },
    {
      key: "auth",
      label: "/auth (OPTIONS)",
      url: "https://api.decentralised.art/chain/auth",
      method: "OPTIONS",
    },
    {
      key: "execute",
      label: "/execute (OPTIONS)",
      url: "https://api.decentralised.art/chain/execute",
      method: "OPTIONS",
    },
  ];

  let results = $state<Record<string, ProbeResult>>({});
  let status = $state("checking...");
  let averageLatency = $state("-");
  let successRate = $state("-");
  let lastRefresh = $state("-");
  let buildVersion = $state("-");
  let buildTimestamp = $state("-");

  const runProbe = async (probe: Probe): Promise<{ ok: boolean; latency: number }> => {
    const started = performance.now();
    try {
      const response = await fetch(probe.url, { method: probe.method, cache: "no-cache" });
      const latency = Math.round(performance.now() - started);
      const ok = response.status >= 200 && response.status < 400;
      results = {
        ...results,
        [probe.key]: {
          code: String(response.status),
          latency: `${latency} ms`,
          state: ok ? "ok" : "degraded",
        },
      };

      if (probe.key === "version" && ok) {
        const json = await response.json();
        buildVersion = typeof json.version === "string" ? json.version : "-";
        buildTimestamp = typeof json.build_timestamp === "string" ? json.build_timestamp : "-";
      }
      return { ok, latency };
    } catch {
      const latency = Math.round(performance.now() - started);
      results = {
        ...results,
        [probe.key]: {
          code: "ERR",
          latency: `${latency} ms`,
          state: "offline",
        },
      };
      return { ok: false, latency };
    }
  };

  const pollAll = async () => {
    const runs = [];
    for (const probe of probes) {
      runs.push(await runProbe(probe));
    }
    const successes = runs.filter((run) => run.ok).length;
    const latencySum = runs.reduce((sum, run) => sum + run.latency, 0);
    status = successes > 0 ? "online" : "offline";
    averageLatency = runs.length > 0 ? `${Math.round(latencySum / runs.length)} ms` : "-";
    successRate = runs.length > 0 ? `${Math.round((successes / runs.length) * 100)}%` : "-";
    lastRefresh = new Date().toLocaleTimeString();
  };

  onMount(() => {
    void pollAll();
    const interval = window.setInterval(() => void pollAll(), 10000);
    return () => window.clearInterval(interval);
  });
</script>

<Seo title="API status" {description} path="/api-status" />

<SiteContentPage
  eyebrow="API"
  title="API Status"
  description="Live checks for representative endpoints on https://api.decentralised.art/chain. Reachability does not guarantee full end-to-end behaviour."
  links={[{ href: "https://api.decentralised.art/chain/", label: "Open API" }]}
>
  <dl class="status-grid" aria-live="polite">
    <div>
      <dt>API Status</dt>
      <dd>{status}</dd>
    </div>
    <div>
      <dt>Avg Latency</dt>
      <dd>{averageLatency}</dd>
    </div>
    <div>
      <dt>Success Rate</dt>
      <dd>{successRate}</dd>
    </div>
    <div>
      <dt>Last Refresh</dt>
      <dd>{lastRefresh}</dd>
    </div>
  </dl>

  <table class="status-table">
    <thead>
      <tr>
        <th>Endpoint</th>
        <th>HTTP</th>
        <th>Latency</th>
        <th>State</th>
      </tr>
    </thead>
    <tbody>
      {#each probes as probe (probe.key)}
        {@const result = results[probe.key]}
        <tr>
          <td><code>{probe.label}</code></td>
          <td>{result?.code ?? "-"}</td>
          <td>{result?.latency ?? "-"}</td>
          <td>{result?.state ?? "-"}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p>
    <code>version: {buildVersion}</code>
    <code>build_timestamp: {buildTimestamp}</code>
  </p>
</SiteContentPage>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .status-grid {
    @apply grid gap-3 md:grid-cols-4;
  }

  .status-grid div {
    @apply rounded-md border p-4;
    background: var(--surface-card);
    border-color: var(--border-subtle);
  }

  .status-grid dt {
    @apply text-xs uppercase tracking-[0.18em];
    color: var(--text-faint);
  }

  .status-grid dd {
    @apply m-0 mt-2 text-xl font-semibold;
    color: var(--text-primary);
  }

  .status-table {
    @apply w-full border-collapse overflow-hidden rounded-md border text-sm;
    border-color: var(--border-subtle);
  }

  .status-table th,
  .status-table td {
    @apply border px-3 py-3 text-left;
    border-color: var(--border-subtle);
  }

  .status-table th {
    color: var(--text-primary);
  }
</style>
