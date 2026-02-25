<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  import {
    Background,
    SvelteFlow,
    type Connection,
    type Edge,
    type NodeTypes,
    type OnConnect,
    type OnSelectionChange,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";

  import Button from "$lib/components/ui/Button.svelte";
  import DockPanel from "$lib/components/ui/DockPanel.svelte";
  import CreateParticleExplorer from "$lib/components/create/CreateParticleExplorer.svelte";
  import FlowInstanceBridge from "$lib/components/studio/FlowInstanceBridge.svelte";
  import StudioDimensionNode from "$lib/components/studio/StudioDimensionNode.svelte";
  import StudioFeatureNode from "$lib/components/studio/StudioFeatureNode.svelte";
  import StudioConditionNode from "$lib/components/studio/StudioConditionNode.svelte";
  import StudioLibraryList from "$lib/components/studio/StudioLibraryList.svelte";
  import StudioParticleNode from "$lib/components/studio/StudioParticleNode.svelte";
  import StudioPluginNode from "$lib/components/studio/StudioPluginNode.svelte";
  import StudioTransformationNode from "$lib/components/studio/StudioTransformationNode.svelte";
  import SolidityEditorShell from "$lib/components/workspace-window/SolidityEditorShell.svelte";
  import {
    parseContractName,
    parseSoliditySnippet,
  } from "$lib/components/solidity-editor/templates/parse";
  import { renderTransformationSolidity } from "$lib/components/solidity-editor/templates/transformationTemplate";
  import { renderConditionSolidity } from "$lib/components/solidity-editor/templates/conditionTemplate";
  import { inferArgsCountFromSnippet } from "$lib/components/solidity-editor/templates/inferArgsCount";
  import { mockParticleViews, type ExploreParticle } from "$lib/data/exploreParticles";
  import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";
  import {
    type MockFeatureDef,
    type MockParticleDef,
    type MockRunConfig,
    type MockRunningInstance,
  } from "$lib/particles/mockPtNetwork";
  import { buildStudioRuntime, runStudioParticle } from "$lib/studio/studioRuntime";
  import {
    fetchChainOwnedStudioSnapshot,
    fetchChainParticleForStudio,
    type ChainStudioSyncResult,
  } from "$lib/studio/chainStudioAdapter";
  import { getMe, loginWithMockChainAccount } from "$lib/auth/api";
  import { clearChainToken, getChainToken } from "$lib/auth/session";
  import {
    ChainApiRequestError,
    type ChainApiPostResult,
    postChainConditionDetailed,
    postChainFeatureDetailed,
    postChainParticleDetailed,
    postChainTransformationDetailed,
  } from "$lib/chain/registryApi";
  import { mockPlugins, type LibraryItem } from "$lib/data/studioLibrary";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";

  type PanelMode = "open" | "hidden";
  type RightPanelMode = "assistant" | "inspector" | "both" | "hidden";
  type InspectorTab = "node" | "api";

  let leftMode = $state<PanelMode>("open");
  let rightMode = $state<RightPanelMode>("hidden");
  let inspectorTab = $state<InspectorTab>("node");
  let inspectorAuto = $state(true);
  let topMode = $state<PanelMode>("open");
  let bottomMode = $state<PanelMode>("open");
  let savedModes = $state<{
    left: PanelMode;
    right: RightPanelMode;
    top: PanelMode;
    bottom: PanelMode;
  } | null>(null);

  type StudioNodeKind =
    | "particle"
    | "feature"
    | "dimension"
    | "transformation"
    | "condition"
    | "plugin"
    | "agent";

  type TransformationInstance = {
    id: string;
    name: string;
    args: number[];
    status: "draft" | "network";
  };

  type StudioNodeData = {
    label: string;
    kind: StudioNodeKind;
    particleId?: string;
    sourceId?: string;
    viewId?: string;
    dimensions?: number;
    parentFeatureId?: string;
    dimensionIndex?: number;
    transformations?: TransformationInstance[];
    networkId?: string;
    fromNetwork?: boolean;
    pluginOutput?: PtOutputFeature[];
    pluginTargets?: string[];
    riStart?: number;
    riShift?: number;
    riLocked?: boolean;
  };
  type StudioNode = {
    id: string;
    position: { x: number; y: number };
    data: StudioNodeData;
    selected?: boolean;
    type?: string;
    draggable?: boolean;
  };

  type RuntimeTransformationDef = {
    argc: number;
    run: (x: number, args: number[]) => number;
  };

  type RuntimeConditionDef = {
    argc: number;
    check: (args: number[]) => boolean;
  };

  type DeployedRegistry = {
    features: Record<string, MockFeatureDef>;
    particles: Record<string, MockParticleDef>;
    transformations: Record<string, RuntimeTransformationDef>;
    conditions: Record<string, RuntimeConditionDef>;
  };

  let nodes = $state.raw<StudioNode[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let selectedParticleId = $state<ExploreParticle["id"] | undefined>(undefined);
  let selectedNodeId = $state<string | null>(null);
  let selectedViewId = $state<"all" | string>("all");
  let explorerSource = $state<"network" | "toolbox">("network");
  let libraryTab = $state<"particles" | "features" | "transformations" | "conditions" | "plugins">(
    "particles",
  );
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let leftTabsEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLDivElement | null>(null);
  let screenToFlowPosition:
    | ((client: { x: number; y: number }) => { x: number; y: number })
    | null = null;
  let getZoom: (() => number) | null = null;
  let fitView: ((options?: { padding?: number; duration?: number }) => void) | null = null;
  let clearConfirmOpen = $state(false);
  let runOutputByTab = $state<Record<string, PtOutputFeature[]>>({});
  let runWarningsByTab = $state<Record<string, string[]>>({});
  let runTimestampByTab = $state<Record<string, number>>({});
  let compileWarningsByTab = $state<Record<string, string[]>>({});
  let compileTimestampByTab = $state<Record<string, number>>({});
  let deployTimestampByTab = $state<Record<string, number>>({});
  let chainSyncBusy = $state(false);
  let chainSyncStatus = $state<string | null>(null);
  let chainSyncError = $state<string | null>(null);
  let chainDeployBusy = $state(false);
  let chainDeployStatus = $state<string | null>(null);
  let chainDeployError = $state<string | null>(null);
  type DeployTraceEntry = {
    id: string;
    method: "POST";
    path: string;
    requestBody: unknown;
    responseStatus: number | null;
    responseBody: unknown;
    ok: boolean;
    at: number;
  };
  let deployTraceEntries = $state<DeployTraceEntry[]>([]);
  let apiEditorText = $state("");
  let apiEditorError = $state<string | null>(null);
  let apiEditorStatus = $state<string | null>(null);
  let apiEditorFocused = $state(false);
  let apiEditorLiveApply = $state(true);
  let compiledTransformationsByTab = $state<
    Record<string, Record<string, RuntimeTransformationDef>>
  >({});
  let runSamplesCount = $state(12);
  let transformationEditorOpen = $state(false);
  let transformationEditorDimensionId = $state<string | null>(null);
  let transformationEditorIndex = $state<number | null>(null);
  let transformationEditorId = $state<string | null>(null);
  let transformationEditorStatus = $state<TransformationInstance["status"]>("draft");
  let transformationEditorLocked = $state(false);
  let transformationDraftName = $state("");
  let transformationDraftArgs = $state("");
  let transformationDraftCode = $state("return x + (args[0] ?? 0);");
  let transformationDraftError = $state<string | null>(null);
  const transformationCodeById = new SvelteMap<string, string>();
  let conditionEditorOpen = $state(false);
  let conditionEditorNodeId = $state<string | null>(null);
  let conditionEditorStatus = $state<"draft" | "network">("draft");
  let conditionEditorLocked = $state(false);
  let conditionDraftName = $state("");
  let conditionDraftCode = $state("return true;");
  let conditionDraftError = $state<string | null>(null);
  const conditionCodeById = new SvelteMap<string, string>();

  const transformationEditorReadOnly = $derived.by(
    () => transformationEditorStatus === "network" || transformationEditorLocked,
  );
  const conditionEditorReadOnly = $derived.by(
    () => conditionEditorStatus === "network" || conditionEditorLocked,
  );

  let deployedRegistry = $state<DeployedRegistry>({
    features: {},
    particles: {},
    transformations: {},
    conditions: {},
  });
  let deployedParticleRIs = $state<
    Record<string, { start: number; shift: number; locked: boolean }[]>
  >({});

  let deployedLibrary = $state<{
    features: LibraryItem[];
    transformations: LibraryItem[];
    conditions: LibraryItem[];
    plugins: LibraryItem[];
  }>({
    features: [],
    transformations: [],
    conditions: [],
    plugins: [],
  });

  let deployedParticles = $state<ExploreParticle[]>([]);

  type StudioTab = {
    id: string;
    label: string;
    particleId?: string;
  };

  const tabGraphs = new SvelteMap<string, { nodes: StudioNode[]; edges: Edge[] }>();

  type ToolboxLibrary = {
    particles: string[];
    feature: string[];
    transformation: string[];
    condition: string[];
    plugin: string[];
  };

  type QuickNodeKind =
    | "feature"
    | "transformation"
    | "condition"
    | "plugin"
    | "agent"
    | "dimension";

  const titleize = (value: string) =>
    value
      .split("-")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");

  const normalizeKey = (value: string) => value.toLowerCase().replace(/[\s-_]+/g, "");

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const isValidChainName = (value: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);

  const toInt = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return undefined;
    const num = Number(value);
    if (!Number.isFinite(num)) return undefined;
    return Math.max(0, Math.trunc(num));
  };

  const toContractName = (label: string) => {
    const cleaned = label.replace(/[^A-Za-z0-9]+/g, " ").trim();
    const parts = cleaned.length ? cleaned.split(/\s+/) : [];
    let name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
    if (!name) name = "Transformation";
    if (/^[0-9]/.test(name)) name = `Tx${name}`;
    return name;
  };

  const toConditionContractName = (label: string) => {
    const name = toContractName(label);
    return name === "Transformation" ? "Condition" : name;
  };

  const parseArgsInput = (value: string) =>
    value
      .split(",")
      .map((segment) => Number(segment.trim()))
      .filter((num) => Number.isFinite(num))
      .map((num) => Math.trunc(num));

  const transformationArgsArray = $derived.by(() => parseArgsInput(transformationDraftArgs));

  const transformationTemplate = $derived.by(() => {
    const contractName = toContractName(transformationDraftName);
    const nameRes = parseContractName(contractName);
    if (!nameRes.ok) return `// error: ${nameRes.error}`;

    const codeRes = parseSoliditySnippet(transformationDraftCode);
    if (!codeRes.ok) return `// error: ${codeRes.error}`;

    const inferred = inferArgsCountFromSnippet(codeRes.value);
    const argsCount = Math.max(transformationArgsArray.length, inferred.minArgsCount);

    return renderTransformationSolidity({
      name: nameRes.value,
      argsCount,
      code: codeRes.value,
      baseImportPath: "../TransformationBase.sol",
    });
  });

  const transformationArgsWarning = $derived.by(() => {
    const codeRes = parseSoliditySnippet(transformationDraftCode);
    if (!codeRes.ok) return null;
    const inferred = inferArgsCountFromSnippet(codeRes.value);
    if (inferred.minArgsCount <= transformationArgsArray.length) return null;
    return `Snippet references args[${inferred.maxIndex}]. Provide at least ${inferred.minArgsCount} argument(s).`;
  });

  const defaultDraftCode = "return x + (args[0] ?? 0);";
  const defaultConditionDraftCode = "return true;";

  const getTransformationCode = (id: string) => transformationCodeById.get(id) ?? defaultDraftCode;
  const getConditionCode = (id: string) => conditionCodeById.get(id) ?? defaultConditionDraftCode;

  const conditionTemplate = $derived.by(() => {
    const contractName = toConditionContractName(conditionDraftName);
    const nameRes = parseContractName(contractName);
    if (!nameRes.ok) return `// error: ${nameRes.error}`;

    const codeRes = parseSoliditySnippet(conditionDraftCode);
    if (!codeRes.ok) return `// error: ${codeRes.error}`;

    const inferred = inferArgsCountFromSnippet(codeRes.value);
    const argsCount = inferred.minArgsCount;
    return renderConditionSolidity({
      name: nameRes.value,
      argsCount,
      code: codeRes.value,
      baseImportPath: "../ConditionBase.sol",
    });
  });

  const conditionArgsInfo = $derived.by(() => {
    const codeRes = parseSoliditySnippet(conditionDraftCode);
    if (!codeRes.ok) return null;
    const inferred = inferArgsCountFromSnippet(codeRes.value);
    return `Inferred condition args count: ${inferred.minArgsCount}`;
  });

  const compileTransformationCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return { ok: false as const, error: "Transformation code is empty." };
    if (!/\breturn\b/.test(trimmed)) {
      return {
        ok: false as const,
        error: "Mock compiler expects a return statement.",
      };
    }
    try {
      const fn = new Function("x", "args", `"use strict"; ${trimmed}`) as (
        x: number,
        args: number[],
      ) => number;
      return { ok: true as const, value: fn };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid transformation code.";
      return { ok: false as const, error: message };
    }
  };

  const compileConditionCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return { ok: false as const, error: "Condition code is empty." };
    if (!/\breturn\b/.test(trimmed)) {
      return {
        ok: false as const,
        error: "Mock compiler expects a return statement.",
      };
    }
    try {
      const fn = new Function("args", `"use strict"; ${trimmed}`) as (args: number[]) => unknown;
      return {
        ok: true as const,
        value: (args: number[]) => Boolean(fn(args)),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid condition code.";
      return { ok: false as const, error: message };
    }
  };

  const createStudioTab = (label: string, particleId?: string): StudioTab => {
    const id = `tab-${crypto.randomUUID()}`;
    tabGraphs.set(id, { nodes: [], edges: [] });
    return { id, label, particleId };
  };

  const initialTab = createStudioTab("Untitled Particle");
  let tabs = $state<StudioTab[]>([initialTab]);
  let activeTabId = $state<string>(initialTab.id);
  const activeTab = $derived.by(() => tabs.find((tab) => tab.id === activeTabId) ?? null);
  const activeTabReadOnly = $derived.by(() => Boolean(activeTab?.particleId));
  const activeRunOutput = $derived.by(() => runOutputByTab[activeTabId]);
  const activeRunWarnings = $derived.by(() => runWarningsByTab[activeTabId] ?? []);
  const activeRunTimestamp = $derived.by(() => runTimestampByTab[activeTabId] ?? null);
  const activeCompileWarnings = $derived.by(() => compileWarningsByTab[activeTabId] ?? []);
  const activeCompileTimestamp = $derived.by(() => compileTimestampByTab[activeTabId] ?? null);
  const activeDeployTimestamp = $derived.by(() => deployTimestampByTab[activeTabId] ?? null);

  const panelSize = (mode: PanelMode, open: string) => (mode === "hidden" ? "0px" : open);

  const getNodeStatusLabel = (node: StudioNode) => (node.data.fromNetwork ? "Network" : "Draft");

  const leftSize = $derived.by(() => panelSize(leftMode, "280px"));
  const hasSelection = $derived.by(() => selectedNodeId !== null || activeTab !== null);
  const inspectorCanShow = $derived.by(() => inspectorTab === "api" || hasSelection);
  const assistantVisible = $derived.by(() => rightMode === "assistant" || rightMode === "both");
  const inspectorVisible = $derived.by(
    () => inspectorCanShow && (rightMode === "inspector" || rightMode === "both"),
  );
  const rightSize = $derived.by(() => (assistantVisible || inspectorVisible ? "300px" : "0px"));
  const topSize = $derived.by(() => "auto");
  const bottomSize = $derived.by(() => panelSize(bottomMode, "max-content"));

  const nodeTypes: NodeTypes = {
    feature: StudioFeatureNode,
    dimension: StudioDimensionNode,
    particle: StudioParticleNode,
    transformation: StudioTransformationNode,
    condition: StudioConditionNode,
    plugin: StudioPluginNode,
  } as unknown as NodeTypes;

  const hidePanel = (setter: (mode: PanelMode) => void) => setter("hidden");
  const showPanel = (setter: (mode: PanelMode) => void) => setter("open");
  const togglePanel = (mode: PanelMode, setter: (mode: PanelMode) => void) =>
    setter(mode === "hidden" ? "open" : "hidden");
  const hideRightPanel = () => {
    inspectorAuto = false;
    rightMode = "hidden";
  };

  const toggleAssistant = () => {
    if (assistantVisible) {
      rightMode = inspectorVisible ? "inspector" : "hidden";
      return;
    }
    rightMode = inspectorVisible ? "both" : "assistant";
  };

  const toggleInspector = () => {
    if (inspectorVisible) {
      inspectorAuto = false;
      rightMode = assistantVisible ? "assistant" : "hidden";
      return;
    }
    inspectorAuto = true;
    if (!hasSelection && inspectorTab !== "api") {
      inspectorTab = "api";
    }
    if (!inspectorCanShow) return;
    rightMode = assistantVisible ? "both" : "inspector";
  };

  const toggleRightPanel = () => {
    if (assistantVisible || inspectorVisible) {
      inspectorAuto = false;
      rightMode = "hidden";
      return;
    }
    if (inspectorCanShow && inspectorAuto) {
      rightMode = "inspector";
      return;
    }
    rightMode = "assistant";
  };

  const hideAll = () => {
    if (!savedModes) {
      savedModes = {
        left: leftMode,
        right: rightMode,
        top: topMode,
        bottom: bottomMode,
      };
    }
    inspectorAuto = false;
    leftMode = "hidden";
    rightMode = "hidden";
    topMode = "hidden";
    bottomMode = "hidden";
  };

  const restoreAll = () => {
    if (!savedModes) {
      leftMode = "open";
      rightMode = "hidden";
      inspectorAuto = true;
      topMode = "open";
      bottomMode = "open";
      return;
    }
    leftMode = savedModes.left;
    rightMode = savedModes.right;
    topMode = savedModes.top;
    bottomMode = savedModes.bottom;
    savedModes = null;
  };

  const toggleAllPanels = () => {
    const allHidden =
      leftMode === "hidden" &&
      rightMode === "hidden" &&
      topMode === "hidden" &&
      bottomMode === "hidden";
    if (allHidden) restoreAll();
    else hideAll();
  };

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  };

  const clearNetworkIntentQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("network_kind");
    url.searchParams.delete("network_id");
    const nextQuery = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  };

  const resolveNetworkLibraryItem = (
    kind: "feature" | "transformation" | "condition" | "plugin",
    rawId: string,
  ): LibraryItem | null => {
    const target = rawId.trim();
    if (!target) return null;
    const key = normalizeKey(target);
    const pool = networkLibrary[kind] ?? [];
    return (
      pool.find((item) => {
        const registryName = getLibraryRegistryName(item);
        return (
          item.id === target ||
          registryName === target ||
          normalizeKey(registryName) === key ||
          normalizeKey(item.name) === key
        );
      }) ??
      (kind === "plugin"
        ? (networkLibrary.plugin.find(
            (item) => item.viewId === target || normalizeKey(item.viewId ?? "") === key,
          ) ?? null)
        : null)
    );
  };

  const loadNetworkSelectionFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const rawKind = (params.get("network_kind") ?? "").toLowerCase();
    const rawId = params.get("network_id") ?? "";
    if (!rawKind || !rawId) return;

    if (rawKind === "particle") {
      openParticleTab(rawId);
      clearNetworkIntentQuery();
      return;
    }

    if (rawKind === "creator") {
      const candidate =
        networkParticles.find((particle) => particle.authorId === rawId) ??
        networkParticles.find(
          (particle) =>
            normalizeKey(mockUsersById[particle.authorId]?.nickname ?? "") === normalizeKey(rawId),
        );
      if (candidate) openParticleTab(candidate.id);
      clearNetworkIntentQuery();
      return;
    }

    const kind =
      rawKind === "output"
        ? "plugin"
        : ["feature", "transformation", "condition", "plugin"].includes(rawKind)
          ? (rawKind as "feature" | "transformation" | "condition" | "plugin")
          : null;
    if (!kind) {
      clearNetworkIntentQuery();
      return;
    }

    const item = resolveNetworkLibraryItem(kind, rawId);
    if (!item) {
      clearNetworkIntentQuery();
      return;
    }

    if (item.kind !== "plugin" && activeTabReadOnly) {
      createEmptyTab();
    }
    addLibraryNode(item, getCanvasCenter());
    clearNetworkIntentQuery();
  };

  onMount(() => {
    const handleDragOverCapture = (event: DragEvent) => {
      handleDragOver(event);
    };
    const handleDropCapture = (event: DragEvent) => {
      handleDrop(event);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (transformationEditorOpen || conditionEditorOpen) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (key === "[") {
        event.preventDefault();
        togglePanel(leftMode, (mode) => (leftMode = mode));
      }
      if (key === "]") {
        event.preventDefault();
        toggleRightPanel();
      }
      if (key === "t") {
        event.preventDefault();
        togglePanel(topMode, (mode) => (topMode = mode));
      }
      if (key === "b") {
        event.preventDefault();
        togglePanel(bottomMode, (mode) => (bottomMode = mode));
      }
      if (key === "\\") {
        event.preventDefault();
        toggleAllPanels();
      }
    };

    window.addEventListener("keydown", handleKey);
    if (canvasEl) {
      canvasEl.addEventListener("dragover", handleDragOverCapture, { capture: true });
      canvasEl.addEventListener("drop", handleDropCapture, { capture: true });
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleLayout();
    });
    const observeFlowNodes = () => {
      if (!canvasEl) return;
      resizeObserver.disconnect();
      canvasEl
        .querySelectorAll<HTMLElement>(".svelte-flow__node")
        .forEach((node) => resizeObserver.observe(node));
    };
    observeFlowNodes();
    const mutationObserver = new MutationObserver(() => {
      observeFlowNodes();
    });
    if (canvasEl) {
      mutationObserver.observe(canvasEl, { childList: true, subtree: true });
    }

    loadNetworkSelectionFromQuery();
    if (!chainAutoSyncStarted) {
      chainAutoSyncStarted = true;
      void syncChainOwnedRegistry();
    }

    return () => {
      window.removeEventListener("keydown", handleKey);
      if (canvasEl) {
        canvasEl.removeEventListener("dragover", handleDragOverCapture, { capture: true });
        canvasEl.removeEventListener("drop", handleDropCapture, { capture: true });
      }
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  });

  const normalizeToolboxId = (id: string) => id.replace(/^particle-/, "");

  const initialParticleToolbox = (mockUsersById[mockCurrentUserId]?.toolbox ?? []).map(
    normalizeToolboxId,
  );

  let toolboxLibrary = $state<ToolboxLibrary>({
    particles: initialParticleToolbox,
    feature: [],
    transformation: [],
    condition: [],
    plugin: [],
  });

  const networkParticles = $derived.by(() =>
    [...deployedParticles].sort((a, b) => b.createdAt - a.createdAt),
  );

  const networkLibrary = $derived.by(() => ({
    feature: [...deployedLibrary.features],
    transformation: [...deployedLibrary.transformations],
    condition: [...deployedLibrary.conditions],
    plugin: [...mockPlugins, ...deployedLibrary.plugins],
  }));

  const availableParticles = $derived.by(() => {
    const base = networkParticles;
    if (explorerSource === "toolbox") {
      return base.filter((particle) => toolboxLibrary.particles.includes(particle.id));
    }
    return base;
  });

  const filteredParticles = $derived.by(() => availableParticles);
  const selectedNode = $derived.by(() => nodes.find((node) => node.id === selectedNodeId) ?? null);
  const inspectorNode = $derived.by(() => {
    if (selectedNode) return selectedNode;
    if (!activeTab) return null;
    return {
      id: `tab-${activeTab.id}`,
      position: { x: 0, y: 0 },
      data: {
        label: activeTab.label,
        kind: "particle",
        particleId: activeTab.particleId,
        networkId: activeTab.particleId,
        fromNetwork: Boolean(activeTab.particleId),
      },
    } as StudioNode;
  });
  const nodesById = $derived.by(() =>
    Object.fromEntries(nodes.map((node) => [node.id, node] as const)),
  );

  let nameDraft = $state("");
  let dimensionDraft = $state<number | null>(null);
  let tabRenameId = $state<string | null>(null);
  let tabRenameValue = $state("");

  type PendingNameCollision = {
    nodeId: string;
    kind: StudioNodeKind;
    desiredName: string;
    existingId: string;
    existingName: string;
  };

  type PendingDimensionChange = {
    nodeId: string;
    newCount: number;
    removedDimensions: StudioNode[];
  };

  let pendingNameCollision = $state<PendingNameCollision | null>(null);
  let pendingDimensionChange = $state<PendingDimensionChange | null>(null);

  $effect(() => {
    if (!selectedNode) {
      nameDraft = "";
      dimensionDraft = null;
      return;
    }
    nameDraft = selectedNode.data.label;
    dimensionDraft =
      selectedNode.data.kind === "feature" ? (selectedNode.data.dimensions ?? 1) : null;
  });

  $effect(() => {
    if (!hasSelection && inspectorTab !== "api") {
      if (rightMode === "inspector") rightMode = "hidden";
      if (rightMode === "both") rightMode = "assistant";
      return;
    }
    if (!inspectorAuto) return;
    if (rightMode === "hidden") rightMode = "inspector";
    if (rightMode === "assistant") rightMode = "both";
  });

  const handleParticleSelect = (id: ExploreParticle["id"]) => {
    selectedParticleId = id;
  };

  const handleParticleOpen = (id: ExploreParticle["id"]) => {
    openParticleTab(id);
  };

  const startTabRename = (tab: StudioTab) => {
    if (tab.particleId) return;
    tabRenameId = tab.id;
    tabRenameValue = tab.label;
  };

  const commitTabRename = (tab: StudioTab) => {
    if (tabRenameId !== tab.id) return;
    const next = tabRenameValue.trim();
    if (next) {
      tabs = tabs.map((item) => (item.id === tab.id ? { ...item, label: next } : item));
    }
    tabRenameId = null;
  };

  const cancelTabRename = () => {
    tabRenameId = null;
  };

  const updateNodeData = (nodeId: string, patch: Partial<StudioNodeData>) => {
    nodes = nodes.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
    );
    scheduleLayout();
  };

  let layoutFrame: number | null = null;

  const scheduleLayout = () => {
    if (!canvasEl) return;
    if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      layoutFeatureClusters();
    });
  };

  const measureNodeSize = (nodeId: string, fallback: { width: number; height: number }) => {
    if (!canvasEl) return fallback;
    const el = canvasEl.querySelector<HTMLElement>(`.svelte-flow__node[data-id="${nodeId}"]`);
    if (!el) return fallback;
    const rect = el.getBoundingClientRect();
    const zoom = Math.max(0.1, getZoom?.() ?? 1);
    return {
      width: rect.width / zoom,
      height: rect.height / zoom,
    };
  };

  const getCompositeForDimension = (dimensionId: string) => {
    const edge = edges.find((item) => item.source === dimensionId && item.sourceHandle === "out");
    if (!edge) return null;
    const target = edge.target ? nodesById[edge.target] : null;
    if (!target || target.data.kind !== "particle") return null;
    return target;
  };

  const layoutFeatureClusters = () => {
    if (!canvasEl) return;
    const updates = new SvelteMap<string, { x: number; y: number }>();
    const gapX = 24;
    const gapY = 48;
    const defaultSize = { width: 160, height: 60 };
    const defaultDimensionSize = { width: 180, height: 80 };

    nodes
      .filter((node) => node.data.kind === "feature")
      .forEach((feature) => {
        const dimensions = getDimensionNodesForFeature(feature.id).sort(
          (a, b) => (a.data.dimensionIndex ?? 0) - (b.data.dimensionIndex ?? 0),
        );
        if (!dimensions.length) return;

        const featureSize = measureNodeSize(feature.id, defaultSize);
        const dimensionSizes = dimensions.map((dimension) =>
          measureNodeSize(dimension.id, defaultDimensionSize),
        );
        const maxDimensionHeight = Math.max(...dimensionSizes.map((size) => size.height));

        const totalWidth =
          dimensionSizes.reduce((sum, size) => sum + size.width, 0) +
          gapX * Math.max(0, dimensions.length - 1);
        const featureCenter = feature.position.x + featureSize.width / 2;
        let cursorX = featureCenter - totalWidth / 2;

        const dimensionRowY = feature.position.y + featureSize.height + gapY;
        const compositeRowY = dimensionRowY + maxDimensionHeight + gapY;

        dimensions.forEach((dimension, index) => {
          const size = dimensionSizes[index];
          const nextX = cursorX;
          const nextY = dimensionRowY;
          if (
            Math.abs(dimension.position.x - nextX) > 0.5 ||
            Math.abs(dimension.position.y - nextY) > 0.5
          ) {
            updates.set(dimension.id, { x: nextX, y: nextY });
          }

          const composite = getCompositeForDimension(dimension.id);
          if (composite) {
            const compositeSize = measureNodeSize(composite.id, defaultSize);
            const compositeX = nextX + (size.width - compositeSize.width) / 2;
            if (
              Math.abs(composite.position.x - compositeX) > 0.5 ||
              Math.abs(composite.position.y - compositeRowY) > 0.5
            ) {
              updates.set(composite.id, { x: compositeX, y: compositeRowY });
            }
          }

          cursorX += size.width + gapX;
        });
      });

    if (!updates.size) return;
    nodes = nodes.map((node) => {
      const update = updates.get(node.id);
      return update ? { ...node, position: update } : node;
    });
  };

  const updateDimensionTransformations = (
    dimensionId: string,
    updater: (current: TransformationInstance[]) => TransformationInstance[],
  ) => {
    nodes = nodes.map((node) => {
      if (node.id !== dimensionId) return node;
      if (node.data.fromNetwork) return node;
      const current = node.data.transformations ?? [];
      return {
        ...node,
        data: {
          ...node.data,
          transformations: updater([...current]),
        },
      };
    });
    scheduleLayout();
  };

  const createTransformationInstance = (
    name: string,
    args: number[] = [],
    status: TransformationInstance["status"] = "draft",
  ): TransformationInstance => ({
    id: `tx-${crypto.randomUUID()}`,
    name,
    args,
    status,
  });

  const addTransformationToDimension = (
    dimensionId: string,
    name: string,
    args: number[] = [],
    status: TransformationInstance["status"] = "draft",
    insertIndex?: number,
  ) => {
    updateDimensionTransformations(dimensionId, (current) => {
      const next = [...current];
      if (insertIndex === undefined || insertIndex < 0 || insertIndex > next.length) {
        next.push(createTransformationInstance(name, args, status));
      } else {
        next.splice(insertIndex, 0, createTransformationInstance(name, args, status));
      }
      return next;
    });
  };

  const addTransformationToSelectedDimension = (
    label: string,
    status: TransformationInstance["status"] = "draft",
  ) => {
    const selected = nodes.find((node) => node.id === selectedNodeId);
    if (!selected || selected.data.kind !== "dimension") return;
    if (selected.data.fromNetwork) return;
    addTransformationToDimension(selected.id, label, [], status);
  };

  const requestClearCanvas = () => {
    clearConfirmOpen = true;
  };

  const confirmClearCanvas = () => {
    nodes = [];
    edges = [];
    selectedNodeId = null;
    tabGraphs.set(activeTabId, { nodes: [], edges: [] });
    clearConfirmOpen = false;
  };

  const cancelClearCanvas = () => {
    clearConfirmOpen = false;
  };

  const handleAutoLayout = () => {
    scheduleLayout();
  };

  const handleZoomToFit = () => {
    fitView?.({ padding: 0.2, duration: 300 });
  };

  const getPluginTargetNames = (
    pluginId: string,
    nodeLookup: Record<string, StudioNode>,
    graphEdges: Edge[],
  ) => {
    const targets = graphEdges
      .filter((item) => item.target === pluginId && item.source)
      .map((item) => nodeLookup[item.source!])
      .filter((node): node is StudioNode => Boolean(node))
      .filter((node) => node.data.kind === "particle")
      .map((node) => resolveNodeName(node));
    return Array.from(new SvelteSet(targets));
  };

  const refreshPluginOutputs = (
    output: PtOutputFeature[],
    graphNodes: StudioNode[] = nodes,
    graphEdges: Edge[] = edges,
  ) => {
    const nodeLookup: Record<string, StudioNode> = Object.fromEntries(
      graphNodes.map((node) => [node.id, node] as const),
    );
    const hasPlugins = graphNodes.some((node) => node.data.kind === "plugin");
    if (!hasPlugins) return;
    const updatedNodes = graphNodes.map((node) => {
      if (node.data.kind !== "plugin") return node;
      const targetNames = getPluginTargetNames(node.id, nodeLookup, graphEdges);
      if (!targetNames.length) {
        return {
          ...node,
          data: { ...node.data, pluginOutput: [], pluginTargets: undefined },
        };
      }
      const needles = targetNames.map((target) => `/${target}`);
      const filtered = output.filter((stream) =>
        needles.some((needle) => stream.feature_path.includes(needle)),
      );
      return {
        ...node,
        data: { ...node.data, pluginOutput: filtered, pluginTargets: targetNames },
      };
    });
    nodes = updatedNodes;
  };

  const identityTransformRun = (x: number, _args: number[]) => x;
  const alwaysTrueConditionCheck = (_args: number[]) => true;

  const mergeChainSyncSnapshot = (snapshot: ChainStudioSyncResult) => {
    deployedRegistry = {
      ...deployedRegistry,
      features: { ...deployedRegistry.features, ...snapshot.registry.features },
      particles: { ...deployedRegistry.particles, ...snapshot.registry.particles },
      transformations: {
        ...deployedRegistry.transformations,
        ...Object.fromEntries(
          Object.entries(snapshot.registry.transformations).map(([name, def]) => [
            name,
            {
              argc: def.argc,
              // Placeholder runtime until chain execution is wired; keeps Studio graph/runtime stable.
              run: identityTransformRun,
            } satisfies RuntimeTransformationDef,
          ]),
        ),
      },
      conditions: {
        ...deployedRegistry.conditions,
        ...Object.fromEntries(
          Object.entries(snapshot.registry.conditions).map(([name, def]) => [
            name,
            {
              argc: def.argc,
              // Placeholder runtime until chain condition execution is wired.
              check: alwaysTrueConditionCheck,
            } satisfies RuntimeConditionDef,
          ]),
        ),
      },
    };

    deployedLibrary = {
      ...deployedLibrary,
      features: snapshot.library.features.reduce(upsertLibraryItem, deployedLibrary.features),
      transformations: snapshot.library.transformations.reduce(
        upsertLibraryItem,
        deployedLibrary.transformations,
      ),
      conditions: snapshot.library.conditions.reduce(upsertLibraryItem, deployedLibrary.conditions),
      plugins: deployedLibrary.plugins,
    };

    deployedParticles = snapshot.particles.reduce<ExploreParticle[]>((items, next) => {
      if (items.some((item) => item.id === next.id)) return items;
      return [...items, next];
    }, deployedParticles);
  };

  const resolveCurrentMockChainUserId = async () => {
    try {
      const mePayload = (await getMe()) as Record<string, unknown>;
      const user =
        mePayload &&
        typeof mePayload === "object" &&
        mePayload.user &&
        typeof mePayload.user === "object"
          ? (mePayload.user as Record<string, unknown>)
          : mePayload;

      const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
      if (email.endsWith("@mock.decentralised.art")) {
        const id = email.replace(/@mock\.decentralised\.art$/i, "");
        if (mockUsersById[id as keyof typeof mockUsersById])
          return id as keyof typeof mockUsersById;
      }

      const displayName =
        typeof user?.display_name === "string"
          ? user.display_name.trim()
          : typeof user?.displayName === "string"
            ? user.displayName.trim()
            : "";
      if (displayName) {
        const byName = Object.values(mockUsersById).find((entry) => entry.nickname === displayName);
        if (byName) return byName.id;
      }

      const address =
        typeof user?.ethereum_address === "string"
          ? user.ethereum_address.trim().toLowerCase()
          : typeof user?.ethereumAddress === "string"
            ? user.ethereumAddress.trim().toLowerCase()
            : "";
      if (address) {
        const byAddress = Object.values(mockUsersById).find(
          (entry) => entry.address.toLowerCase() === address,
        );
        if (byAddress) return byAddress.id;
      }
    } catch {
      // Services auth may be unavailable; use fallback.
    }
    return mockCurrentUserId;
  };

  const ensureChainAuthForStudio = async (forceRefresh = false) => {
    if (forceRefresh) clearChainToken();
    if (getChainToken()) return;
    const userId = await resolveCurrentMockChainUserId();
    await loginWithMockChainAccount(userId);
  };

  const isInvalidChainTokenError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return /invalid token/i.test(message) || /authentication error/i.test(message);
  };

  async function withChainAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!isInvalidChainTokenError(error)) throw error;
      await ensureChainAuthForStudio(true);
      return await operation();
    }
  }

  const syncSingleChainParticle = async (particleName: string) => {
    const fetched = await fetchChainParticleForStudio(particleName, {
      authorId: mockCurrentUserId,
    });
    const feature = fetched.registry.feature;
    const particle = fetched.registry.particle;
    if (!feature || !particle) return false;

    const inferredTransformations: Record<string, RuntimeTransformationDef> = {};
    feature.dimensions.forEach((dimension) => {
      dimension.transformations.forEach((tx) => {
        const name = String(tx.name);
        inferredTransformations[name] ??= {
          argc: tx.args.length,
          run: identityTransformRun,
        };
      });
    });

    const inferredConditions: Record<string, RuntimeConditionDef> = {};
    if (particle.conditionName) {
      inferredConditions[particle.conditionName] = {
        argc: particle.conditionArgs?.length ?? 0,
        check: alwaysTrueConditionCheck,
      };
    }

    deployedRegistry = {
      ...deployedRegistry,
      features: { ...deployedRegistry.features, [feature.name]: feature },
      particles: { ...deployedRegistry.particles, [particle.name]: particle },
      transformations: {
        ...deployedRegistry.transformations,
        ...inferredTransformations,
      },
      conditions: {
        ...deployedRegistry.conditions,
        ...inferredConditions,
      },
    };

    deployedLibrary = {
      ...deployedLibrary,
      features: upsertLibraryItem(deployedLibrary.features, {
        id: `feature-${feature.name}`,
        name: titleize(feature.name),
        kind: "feature",
        authorId: mockCurrentUserId,
        summary: "Fetched from chain on demand.",
        dimensions: feature.dimensions.length,
      }),
      transformations: Object.entries(inferredTransformations).reduce((items, [name]) => {
        return upsertLibraryItem(items, {
          id: `transform-${name}`,
          name: titleize(name),
          kind: "transformation",
          authorId: mockCurrentUserId,
          summary: "Fetched from chain on demand.",
        });
      }, deployedLibrary.transformations),
      conditions: Object.entries(inferredConditions).reduce((items, [name]) => {
        return upsertLibraryItem(items, {
          id: `condition-${name}`,
          name: titleize(name),
          kind: "condition",
          authorId: mockCurrentUserId,
          summary: "Fetched from chain on demand.",
        });
      }, deployedLibrary.conditions),
      plugins: deployedLibrary.plugins,
    };

    if (fetched.particleMeta) {
      deployedParticles = upsertParticleItem(fetched.particleMeta);
    }

    return true;
  };

  const collectLocalConditionRuntime = (
    graphNodes: StudioNode[],
  ): Record<string, RuntimeConditionDef> => {
    const registry: Record<string, RuntimeConditionDef> = {};
    graphNodes.forEach((node) => {
      if (node.data.kind !== "condition") return;
      const name = resolveNodeName(node);
      const code = getConditionCode(node.id);
      const compiled = compileConditionCode(code);
      registry[name] = {
        argc: Math.max(0, inferArgsCountFromSnippet(code).minArgsCount),
        check: compiled.ok ? compiled.value : alwaysTrueConditionCheck,
      };
    });
    return registry;
  };

  const syncChainOwnedRegistry = async () => {
    chainSyncError = null;
    chainSyncStatus = "Fetching chain registry for mock users...";
    chainSyncBusy = true;
    try {
      const users = Object.values(mockUsersById);
      let totalParticles = 0;
      let totalFeatures = 0;
      let totalTransformations = 0;
      let totalConditions = 0;
      let syncedUsers = 0;

      for (const user of users) {
        const address = typeof user.address === "string" ? user.address.trim() : "";
        if (!address) continue;
        chainSyncStatus = `Fetching chain registry for ${user.nickname}...`;
        const snapshot = await withChainAuthRetry(() =>
          fetchChainOwnedStudioSnapshot(address, {
            authorId: user.id,
          }),
        );
        mergeChainSyncSnapshot(snapshot);
        syncedUsers += 1;
        totalParticles += snapshot.particles.length;
        totalFeatures += Object.keys(snapshot.registry.features).length;
        totalTransformations += Object.keys(snapshot.registry.transformations).length;
        totalConditions += Object.keys(snapshot.registry.conditions).length;
      }

      chainSyncStatus = `Synced ${syncedUsers} users · ${totalParticles} particles · ${totalFeatures} features · ${totalTransformations} transformations · ${totalConditions} conditions.`;
    } catch (error) {
      chainSyncError =
        error instanceof Error ? error.message : "Failed to sync owned chain registry.";
      chainSyncStatus = null;
    } finally {
      chainSyncBusy = false;
    }
  };

  const collectDraftTransformationSources = (graphNodes: StudioNode[]) => {
    const sources = new SvelteMap<string, { code: string }>();
    graphNodes.forEach((node) => {
      if (node.data.kind !== "dimension") return;
      (node.data.transformations ?? []).forEach((tx) => {
        if (tx.status !== "draft") return;
        const name = tx.name.trim();
        if (!name) return;
        const code = getTransformationCode(tx.id);
        if (!sources.has(name)) {
          sources.set(name, { code });
        }
      });
    });
    return sources;
  };

  const publishRuntimeToChain = async (
    runtime: ReturnType<typeof buildStudioRuntime>,
    compiled: Record<string, RuntimeTransformationDef>,
  ) => {
    chainDeployError = null;
    chainDeployStatus = "Authenticating with chain...";
    await ensureChainAuthForStudio();

    const logDeployTraceEntryToConsole = (entry: DeployTraceEntry) => {
      const label = `[Studio deploy] ${entry.method} ${entry.path} -> ${entry.responseStatus ?? "n/a"}`;
      if (typeof console.groupCollapsed === "function") {
        console.groupCollapsed(label);
        console.log("Request body:", entry.requestBody);
        console.log("Response body:", entry.responseBody);
        console.groupEnd();
        return;
      }
      console.log(label, { requestBody: entry.requestBody, responseBody: entry.responseBody });
    };

    async function traceChainPost<T>(
      path: string,
      requestBody: unknown,
      operation: () => Promise<ChainApiPostResult<T>>,
    ): Promise<T> {
      try {
        const result = await withChainAuthRetry(operation);
        const entry: DeployTraceEntry = {
          id: `deploy-trace-${crypto.randomUUID()}`,
          method: "POST",
          path,
          requestBody,
          responseStatus: result.status,
          responseBody: result.body,
          ok: true,
          at: Date.now(),
        };
        deployTraceEntries = [...deployTraceEntries, entry];
        logDeployTraceEntryToConsole(entry);
        return result.body;
      } catch (error) {
        const entry: DeployTraceEntry = {
          id: `deploy-trace-${crypto.randomUUID()}`,
          method: "POST",
          path,
          requestBody,
          responseStatus: error instanceof ChainApiRequestError ? error.status : null,
          responseBody:
            error instanceof ChainApiRequestError
              ? error.responseBody
              : error instanceof Error
                ? { message: error.message }
                : { message: "Unknown error" },
          ok: false,
          at: Date.now(),
        };
        deployTraceEntries = [...deployTraceEntries, entry];
        logDeployTraceEntryToConsole(entry);
        throw error;
      }
    }

    const draftSources = collectDraftTransformationSources(nodes);
    const localConditions = nodes.filter(
      (node) => node.data.kind === "condition" && !node.data.fromNetwork,
    );
    if (localConditions.length) {
      chainDeployStatus = `Publishing ${localConditions.length} condition(s)...`;
      for (const conditionNode of localConditions) {
        const conditionName = resolveNodeName(conditionNode);
        const requestBody = {
          name: conditionName,
          sol_src: getConditionCode(conditionNode.id),
        };
        await traceChainPost("/chain/condition", requestBody, () =>
          postChainConditionDetailed(requestBody),
        );
      }
    }

    if (Object.keys(compiled).length) {
      chainDeployStatus = `Publishing ${Object.keys(compiled).length} transformation(s)...`;
    }
    for (const name of Object.keys(compiled)) {
      const source = draftSources.get(name);
      if (!source) continue;
      const requestBody = { name, sol_src: source.code };
      await traceChainPost("/chain/transformation", requestBody, () =>
        postChainTransformationDetailed(requestBody),
      );
    }

    const localFeatures = nodes.filter(
      (node) => node.data.kind === "feature" && !node.data.fromNetwork,
    );
    if (localFeatures.length) {
      chainDeployStatus = `Publishing ${localFeatures.length} feature(s)...`;
    }
    for (const featureNode of localFeatures) {
      const featureName = resolveNodeName(featureNode);
      const def = runtime.registry.features[featureName];
      if (!def) continue;
      const requestBody = {
        name: featureName,
        dimensions: def.dimensions.map((dimension) => ({
          transformations: dimension.transformations.map((tx) => ({
            name: tx.name,
            args: [...tx.args],
          })),
        })),
      };
      await traceChainPost("/chain/feature", requestBody, () =>
        postChainFeatureDetailed(requestBody),
      );
    }

    const rootDef = runtime.registry.particles[runtime.rootParticle];
    if (!rootDef) {
      throw new Error("Graph does not produce a publishable root particle.");
    }

    chainDeployStatus = `Publishing particle ${rootDef.name}...`;
    const particleRequestBody = {
      name: rootDef.name,
      feature_name: rootDef.featureName,
      composite_names: [...rootDef.composites],
      ...(rootDef.conditionName ? { condition_name: rootDef.conditionName } : {}),
      ...(rootDef.conditionArgs?.length ? { condition_args: [...rootDef.conditionArgs] } : {}),
    };
    await traceChainPost("/chain/particle", particleRequestBody, () =>
      postChainParticleDetailed(particleRequestBody),
    );
    chainDeployStatus = `Published particle ${rootDef.name}.`;
    return rootDef.name;
  };

  const buildRuntimeOverrides = (
    compiledTransformations: Record<string, RuntimeTransformationDef> = {},
  ) => ({
    features: deployedRegistry.features,
    particles: deployedRegistry.particles,
    transformations: { ...deployedRegistry.transformations, ...compiledTransformations },
    conditions: { ...deployedRegistry.conditions, ...collectLocalConditionRuntime(nodes) },
  });

  const collectDraftTransformations = (graphNodes: StudioNode[]) => {
    const draft: TransformationInstance[] = [];
    graphNodes.forEach((node) => {
      if (node.data.kind !== "dimension") return;
      (node.data.transformations ?? []).forEach((transformation) => {
        if (transformation.status === "draft") draft.push(transformation);
      });
    });
    return draft;
  };

  const compileDraftTransformations = (graphNodes: StudioNode[]) => {
    const warnings: string[] = [];
    const registry: Record<string, RuntimeTransformationDef> = {};
    const seen = new SvelteMap<string, { name: string; argc: number; code: string }>();

    const networkNames = new SvelteSet(
      [...Object.keys(deployedRegistry.transformations)].map(normalizeKey),
    );

    collectDraftTransformations(graphNodes).forEach((transformation) => {
      const name = transformation.name.trim();
      if (!name) {
        warnings.push("Draft transformation has an empty name.");
        return;
      }
      const key = normalizeKey(name);
      if (networkNames.has(key)) {
        warnings.push(`Transformation already exists in network: ${name}.`);
        return;
      }

      const argc = transformation.args.length;
      const code = getTransformationCode(transformation.id);

      if (seen.has(key)) {
        const existing = seen.get(key);
        if (existing && existing.argc !== argc) {
          warnings.push(`Transformation ${name} uses inconsistent args count.`);
        }
        if (existing && existing.code !== code) {
          warnings.push(`Transformation ${name} has multiple code variants.`);
        }
        return;
      }

      const compiled = compileTransformationCode(code);
      if (!compiled.ok) {
        warnings.push(`Transformation ${name} failed to compile: ${compiled.error}`);
        return;
      }

      registry[name] = { argc, run: compiled.value };
      seen.set(key, { name, argc, code });
    });

    return { registry, warnings };
  };

  const buildRunningInstances = (
    runtime: ReturnType<typeof buildStudioRuntime>,
    graphNodes: StudioNode[] = nodes,
  ): MockRunningInstance[] => {
    const featureNodesById: Record<string, StudioNode> = Object.fromEntries(
      graphNodes
        .filter((node) => node.data.kind === "feature")
        .map((node) => [node.id, node] as const),
    );
    const dimensionByFeature = new SvelteMap<string, SvelteMap<number, StudioNode>>();
    graphNodes
      .filter((node) => node.data.kind === "dimension")
      .forEach((dimension) => {
        const parentId = dimension.data.parentFeatureId;
        if (!parentId) return;
        const featureNode = featureNodesById[parentId];
        if (!featureNode) return;
        const featureName = resolveNodeName(featureNode);
        const index = dimension.data.dimensionIndex;
        if (typeof index !== "number") return;
        if (!dimensionByFeature.has(featureName)) {
          dimensionByFeature.set(featureName, new SvelteMap());
        }
        dimensionByFeature.get(featureName)!.set(index, dimension);
      });

    const instances: MockRunningInstance[] = [{ startPoint: 0, transformShift: 0 }];
    const stack = new SvelteSet<string>();

    const visit = (particleName: string) => {
      if (stack.has(particleName)) return;
      stack.add(particleName);
      const particle = runtime.registry.particles[particleName];
      if (!particle) {
        stack.delete(particleName);
        return;
      }
      const feature = runtime.registry.features[particle.featureName];
      if (!feature) {
        stack.delete(particleName);
        return;
      }
      for (let dimIndex = 0; dimIndex < feature.dimensions.length; dimIndex += 1) {
        const dimension = dimensionByFeature.get(particle.featureName)?.get(dimIndex);
        const startPoint = toInt(dimension?.data.riStart);
        const transformShift = toInt(dimension?.data.riShift);
        instances.push({ startPoint, transformShift });

        const composite = particle.composites[dimIndex];
        if (composite) visit(composite);
      }
      stack.delete(particleName);
    };

    visit(runtime.rootParticle);
    return instances;
  };

  const executeActiveGraph = () => {
    if (!activeTab) return;
    saveActiveGraph();
    let output: PtOutputFeature[] = [];
    let warnings: string[] = [];

    try {
      const compiled = compileDraftTransformations(nodes);
      const runtime = buildStudioRuntime(
        { nodes, edges },
        { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
        buildRuntimeOverrides(compiled.registry),
      );
      const config: MockRunConfig = {
        samplesCount: Math.max(1, Math.trunc(runSamplesCount)),
        runningInstances: buildRunningInstances(runtime),
      };
      warnings = [...compiled.warnings, ...runtime.warnings];
      output = runStudioParticle(runtime.registry, runtime.rootParticle, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Run failed.";
      warnings = [message];
      output = [];
    }

    runOutputByTab = { ...runOutputByTab, [activeTabId]: output };
    runWarningsByTab = { ...runWarningsByTab, [activeTabId]: warnings };
    runTimestampByTab = { ...runTimestampByTab, [activeTabId]: Date.now() };
    refreshPluginOutputs(output);
  };

  const compileActiveGraph = () => {
    if (!activeTab) return;
    saveActiveGraph();
    const warnings: string[] = [];
    const compiled = compileDraftTransformations(nodes);
    warnings.push(...compiled.warnings);

    const particleName = activeTab.particleId ?? (slugify(activeTab.label) || activeTab.label);
    const particleKey = normalizeKey(particleName);
    const networkParticleKeys = new SvelteSet(
      networkParticles.map((item) => normalizeKey(item.id)),
    );
    if (!activeTab.particleId && networkParticleKeys.has(particleKey)) {
      warnings.push(`Particle already exists in network: ${particleName}.`);
    }

    if (!isValidChainName(particleName)) {
      warnings.push(
        `Invalid particle name for chain deploy: ${particleName}. Use letters, numbers, and underscores only (cannot start with a number).`,
      );
    }

    nodes.forEach((node) => {
      if (node.data.fromNetwork) return;
      if (node.data.kind === "feature" || node.data.kind === "condition") {
        const candidate = resolveNodeName(node);
        if (!isValidChainName(candidate)) {
          warnings.push(
            `Invalid ${node.data.kind} name for chain deploy: ${candidate}. Use letters, numbers, and underscores only (cannot start with a number).`,
          );
        }
      }
      const existing = findRegistryMatch(node.data.kind, node.data.label);
      if (existing && normalizeKey(existing.name) === normalizeKey(node.data.label)) {
        warnings.push(`${titleize(node.data.kind)} already exists: ${node.data.label}.`);
      }
    });

    nodes.forEach((node) => {
      if (node.data.kind !== "dimension") return;
      (node.data.transformations ?? []).forEach((tx) => {
        if (tx.status !== "draft") return;
        if (!isValidChainName(tx.name)) {
          warnings.push(
            `Invalid transformation name for chain deploy: ${tx.name}. Use letters, numbers, and underscores only (cannot start with a number).`,
          );
        }
      });
    });

    try {
      const runtime = buildStudioRuntime(
        { nodes, edges },
        { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
        buildRuntimeOverrides(compiled.registry),
      );
      const rootDef = runtime.registry.particles[runtime.rootParticle];
      if (!rootDef) {
        warnings.push("Graph does not produce a publishable root particle.");
      } else {
        rootDef.composites.forEach((compositeName, index) => {
          if (!compositeName) return;
          if (!deployedRegistry.particles[compositeName]) {
            warnings.push(
              `Dependency particle is not available on chain (sync required): ${compositeName} (dimension ${index + 1}).`,
            );
          }
        });
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Failed to build deploy preview.");
    }

    compiledTransformationsByTab = {
      ...compiledTransformationsByTab,
      [activeTabId]: compiled.registry,
    };
    compileWarningsByTab = { ...compileWarningsByTab, [activeTabId]: warnings };
    compileTimestampByTab = { ...compileTimestampByTab, [activeTabId]: Date.now() };
    return warnings;
  };

  const deployActiveGraph = async () => {
    if (!activeTab) return;
    chainDeployError = null;
    chainDeployStatus = null;
    const warnings = compileActiveGraph();
    if (warnings && warnings.length) return;

    const compiled = compiledTransformationsByTab[activeTabId] ?? {};
    const runtime = buildStudioRuntime(
      { nodes, edges },
      { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
      buildRuntimeOverrides(compiled),
    );

    const localConditionNodes = nodes.filter(
      (node) => node.data.kind === "condition" && !node.data.fromNetwork,
    );

    deployTraceEntries = [];
    chainDeployBusy = true;
    let publishedRootParticleName: string | null = null;
    try {
      publishedRootParticleName = await publishRuntimeToChain(runtime, compiled);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chain deploy failed.";
      chainDeployError = message;
      chainDeployStatus = null;
      compileWarningsByTab = {
        ...compileWarningsByTab,
        [activeTabId]: [message],
      };
      compileTimestampByTab = { ...compileTimestampByTab, [activeTabId]: Date.now() };
      chainDeployBusy = false;
      return;
    }
    chainDeployBusy = false;

    nodes = nodes.map((node) => {
      if (node.data.kind === "condition" && !node.data.fromNetwork) {
        const conditionName = resolveNodeName(node);
        return {
          ...node,
          data: {
            ...node.data,
            networkId: conditionName,
            fromNetwork: true,
          },
        };
      }
      if (node.data.kind !== "dimension") return node;
      const next: TransformationInstance[] = (node.data.transformations ?? []).map((tx) =>
        tx.status === "draft" ? { ...tx, status: "network" as const } : tx,
      );
      return { ...node, data: { ...node.data, transformations: next } };
    });

    if (Object.keys(compiled).length) {
      deployedRegistry = {
        ...deployedRegistry,
        transformations: {
          ...deployedRegistry.transformations,
          ...compiled,
        },
      };

      deployedLibrary = {
        ...deployedLibrary,
        transformations: Object.keys(compiled).reduce((items, name) => {
          const item: LibraryItem = {
            id: `transform-${slugify(name)}`,
            name,
            kind: "transformation",
            authorId: mockCurrentUserId,
            summary: "Deployed from Studio.",
          };
          return upsertLibraryItem(items, item);
        }, deployedLibrary.transformations),
      };
    }

    if (localConditionNodes.length) {
      deployedRegistry = {
        ...deployedRegistry,
        conditions: {
          ...deployedRegistry.conditions,
          ...Object.fromEntries(
            localConditionNodes.map((node) => [
              resolveNodeName(node),
              { argc: 0, check: alwaysTrueConditionCheck } satisfies RuntimeConditionDef,
            ]),
          ),
        },
      };
      deployedLibrary = {
        ...deployedLibrary,
        conditions: localConditionNodes.reduce((items, node) => {
          const name = resolveNodeName(node);
          return upsertLibraryItem(items, {
            id: `condition-${name}`,
            name: node.data.label,
            kind: "condition",
            authorId: mockCurrentUserId,
            summary: "Deployed from Studio.",
          });
        }, deployedLibrary.conditions),
      };
    }

    const existingFeatureKeys = new SvelteSet([
      ...Object.keys(deployedRegistry.features).map(normalizeKey),
    ]);

    const localFeatures = nodes.filter(
      (node) => node.data.kind === "feature" && !node.data.fromNetwork,
    );

    localFeatures.forEach((node) => {
      const featureName = resolveNodeName(node);
      const key = normalizeKey(featureName);
      if (existingFeatureKeys.has(key)) return;
      const def = runtime.registry.features[featureName];
      if (!def) return;
      deployedRegistry = {
        ...deployedRegistry,
        features: { ...deployedRegistry.features, [featureName]: def },
      };
      existingFeatureKeys.add(key);
      deployedLibrary = {
        ...deployedLibrary,
        features: upsertLibraryItem(deployedLibrary.features, {
          id: `feature-${featureName}`,
          name: node.data.label,
          kind: "feature",
          authorId: mockCurrentUserId,
          summary: "Deployed from Studio.",
          dimensions: node.data.dimensions ?? def.dimensions.length,
        }),
      };
    });

    nodes = nodes.map((node) => {
      if (node.data.kind !== "feature") return node;
      if (node.data.fromNetwork) return node;
      const featureName = resolveNodeName(node);
      return {
        ...node,
        data: {
          ...node.data,
          networkId: featureName,
          fromNetwork: true,
        },
      };
    });

    const existingParticleKeys = new SvelteSet([
      ...Object.keys(deployedRegistry.particles).map(normalizeKey),
    ]);

    const rootName = runtime.rootParticle;
    const rootKey = normalizeKey(rootName);
    if (!existingParticleKeys.has(rootKey)) {
      const rootDef = runtime.registry.particles[rootName];
      if (rootDef) {
        deployedRegistry = {
          ...deployedRegistry,
          particles: { ...deployedRegistry.particles, [rootName]: rootDef },
        };
        storeParticleRIs(rootName);
        const createdAt = Date.now();
        deployedParticles = deployedParticles.some((item) => item.id === rootName)
          ? deployedParticles
          : [
              ...deployedParticles,
              {
                id: rootName,
                name: activeTab.label,
                summary: "Deployed from Studio.",
                authorId: mockCurrentUserId,
                viewId: mockParticleViews[0]?.id ?? "midi",
                createdAt,
                createdLabel: "just now",
                ingredients: [],
                complexity: 1,
                transactionName: `${activeTab.label} PT`,
                dependencies: rootDef.composites.filter(Boolean) as string[],
              },
            ];
      }
    }

    if (!activeTab.particleId) {
      tabs = tabs.map((tab) => (tab.id === activeTabId ? { ...tab, particleId: rootName } : tab));
    }

    deployTimestampByTab = { ...deployTimestampByTab, [activeTabId]: Date.now() };
    chainDeployStatus = publishedRootParticleName
      ? `Deployed ${activeTab.label} to chain.`
      : "Deploy completed without publishing a particle.";
  };

  const updateTransformationAt = (
    dimensionId: string,
    index: number,
    patch: Partial<Pick<TransformationInstance, "name" | "args" | "status">>,
  ) => {
    updateDimensionTransformations(dimensionId, (current) => {
      if (index < 0 || index >= current.length) return current;
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const appendTransformation = (dimensionId: string) => {
    addTransformationToDimension(dimensionId, "New Transformation", [], "draft");
  };

  const removeTransformationAt = (dimensionId: string, index: number) => {
    updateDimensionTransformations(dimensionId, (current) => {
      if (index < 0 || index >= current.length) return current;
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  };

  const openTransformationEditor = (
    dimensionId: string,
    index: number,
    transformation: TransformationInstance,
  ) => {
    const name = transformation.name || "New Transformation";
    const args = transformation.args ?? [];
    const key = transformation.id;
    const dimensionNode = nodes.find((node) => node.id === dimensionId);
    transformationEditorOpen = true;
    transformationEditorDimensionId = dimensionId;
    transformationEditorIndex = index;
    transformationEditorId = transformation.id;
    transformationEditorStatus = transformation.status;
    transformationEditorLocked = Boolean(dimensionNode?.data.fromNetwork);
    transformationDraftName = name;
    transformationDraftArgs = args.join(", ");
    transformationDraftCode = transformationCodeById.get(key) ?? "return x + (args[0] ?? 0);";
    transformationDraftError = null;
  };

  const closeTransformationEditor = () => {
    transformationEditorOpen = false;
    transformationEditorDimensionId = null;
    transformationEditorIndex = null;
    transformationEditorId = null;
    transformationEditorStatus = "draft";
    transformationEditorLocked = false;
    transformationDraftError = null;
  };

  const openConditionEditor = (conditionNode: StudioNode) => {
    if (conditionNode.data.kind !== "condition") return;
    conditionEditorOpen = true;
    conditionEditorNodeId = conditionNode.id;
    conditionEditorStatus = conditionNode.data.fromNetwork ? "network" : "draft";
    conditionEditorLocked = Boolean(conditionNode.data.fromNetwork);
    conditionDraftName = conditionNode.data.label || "New Condition";
    conditionDraftCode = getConditionCode(conditionNode.id);
    conditionDraftError = null;
  };

  const closeConditionEditor = () => {
    conditionEditorOpen = false;
    conditionEditorNodeId = null;
    conditionEditorStatus = "draft";
    conditionEditorLocked = false;
    conditionDraftName = "";
    conditionDraftCode = defaultConditionDraftCode;
    conditionDraftError = null;
  };

  const forkConditionEditor = () => {
    if (conditionEditorStatus !== "network") return;
    const baseName = conditionDraftName.trim() || "Condition";
    conditionDraftName = `${baseName} Draft`;
    conditionEditorStatus = "draft";
    conditionEditorLocked = false;
    conditionDraftError = null;
  };

  const saveConditionEditor = () => {
    if (!conditionEditorOpen) return;
    if (conditionEditorReadOnly) {
      closeConditionEditor();
      return;
    }
    const nodeId = conditionEditorNodeId;
    if (!nodeId) return;

    const trimmedName = conditionDraftName.trim();
    if (!trimmedName) {
      conditionDraftError = "Condition name is required.";
      return;
    }

    const compiled = compileConditionCode(conditionDraftCode);
    if (!compiled.ok) {
      conditionDraftError = compiled.error;
      return;
    }

    conditionCodeById.set(nodeId, conditionDraftCode);
    updateNodeData(nodeId, {
      label: trimmedName,
      fromNetwork: false,
      networkId: undefined,
    });
    closeConditionEditor();
  };

  const forkTransformationEditor = () => {
    if (transformationEditorStatus !== "network") return;
    const baseName = transformationDraftName.trim() || "Transformation";
    transformationDraftName = `${baseName} Draft`;
    transformationEditorStatus = "draft";
    transformationDraftError = null;
  };

  const saveTransformationEditor = () => {
    if (!transformationEditorOpen) return;
    if (transformationEditorReadOnly) {
      closeTransformationEditor();
      return;
    }
    const dimensionId = transformationEditorDimensionId;
    const index = transformationEditorIndex;
    if (!dimensionId || index === null) return;

    const trimmedName = transformationDraftName.trim();
    if (!trimmedName) {
      transformationDraftError = "Transformation name is required.";
      return;
    }

    const args = transformationArgsArray;
    updateTransformationAt(dimensionId, index, {
      name: trimmedName,
      args,
      status: transformationEditorStatus,
    });
    if (transformationEditorId && transformationEditorStatus === "draft") {
      transformationCodeById.set(transformationEditorId, transformationDraftCode);
    }
    closeTransformationEditor();
  };

  const saveActiveGraph = () => {
    tabGraphs.set(activeTabId, { nodes, edges });
  };

  const loadTabGraph = (tabId: string) => {
    const graph = tabGraphs.get(tabId);
    nodes = graph?.nodes ?? [];
    edges = graph?.edges ?? [];
    selectedNodeId = null;
    scheduleLayout();
    const output = runOutputByTab[tabId];
    if (output) {
      refreshPluginOutputs(output, nodes, edges);
    }
  };

  const switchTab = (tabId: string) => {
    if (tabId === activeTabId) return;
    saveActiveGraph();
    activeTabId = tabId;
    loadTabGraph(tabId);
  };

  const createEmptyTab = () => {
    saveActiveGraph();
    const nextTab = createStudioTab(`Untitled Particle ${tabs.length + 1}`);
    tabs = [...tabs, nextTab];
    activeTabId = nextTab.id;
    loadTabGraph(nextTab.id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) {
      const fallback = createStudioTab("Untitled Particle");
      tabs = [fallback];
      activeTabId = fallback.id;
      loadTabGraph(fallback.id);
      return;
    }
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    tabs = remaining;
    tabGraphs.delete(tabId);
    if (activeTabId === tabId) {
      const nextActive = remaining[remaining.length - 1];
      activeTabId = nextActive.id;
      loadTabGraph(nextActive.id);
    }
  };

  const buildParticleGraph = (particleName: string) => {
    const particle = deployedRegistry.particles[particleName];
    if (!particle) return { nodes: [], edges: [] };

    const feature = deployedRegistry.features[particle.featureName];
    if (!feature) return { nodes: [], edges: [] };

    const graphNodes: StudioNode[] = [];
    const graphEdges: Edge[] = [];

    const featureItem = networkLibrary.feature.find(
      (item) => getLibraryRegistryName(item) === feature.name,
    );
    const featureLabel = featureItem?.name ?? titleize(feature.name);
    const featureId = `feature-${feature.name}-${crypto.randomUUID()}`;
    const featureX = 360;
    const featureY = 80;
    graphNodes.push({
      id: featureId,
      type: "feature",
      draggable: false,
      position: { x: featureX, y: featureY },
      data: {
        label: featureLabel,
        kind: "feature",
        dimensions: feature.dimensions.length,
        sourceId: feature.name,
        networkId: feature.name,
        fromNetwork: true,
      },
    });

    const dimensionSpacingX = 200;
    const dimensionRowY = featureY + 160;
    const dimensionStartX = featureX - ((feature.dimensions.length - 1) * dimensionSpacingX) / 2;
    const compositeRowY = dimensionRowY + 160;

    feature.dimensions.forEach((dimension, dimIndex) => {
      const dimensionId = `dimension-${feature.name}-${dimIndex}-${crypto.randomUUID()}`;
      const columnX = dimensionStartX + dimIndex * dimensionSpacingX;
      const riConfig = deployedParticleRIs[particleName]?.[dimIndex];
      graphNodes.push({
        id: dimensionId,
        type: "dimension",
        draggable: false,
        position: { x: columnX, y: dimensionRowY },
        data: {
          label: `#${dimIndex + 1}`,
          kind: "dimension",
          parentFeatureId: featureId,
          dimensionIndex: dimIndex,
          transformations: dimension.transformations.map((transformation) =>
            createTransformationInstance(
              titleize(transformation.name),
              transformation.args,
              "network",
            ),
          ),
          fromNetwork: true,
          riStart: riConfig?.start ?? 0,
          riShift: riConfig?.shift ?? 0,
          riLocked: riConfig?.locked ?? false,
        },
      });

      graphEdges.push({
        id: `edge-${featureId}-${dimensionId}`,
        source: featureId,
        sourceHandle: `dim-${dimIndex}`,
        target: dimensionId,
        targetHandle: "in",
      });

      const compositeName = particle.composites[dimIndex];
      if (compositeName) {
        const compositeId = `particle-${compositeName}-${crypto.randomUUID()}`;
        const compositeItem = networkParticles.find((item) => item.id === compositeName);
        graphNodes.push({
          id: compositeId,
          type: "particle",
          draggable: false,
          position: { x: columnX, y: compositeRowY },
          data: {
            label: compositeItem?.name ?? titleize(compositeName),
            kind: "particle",
            particleId: compositeName,
            networkId: compositeName,
            fromNetwork: true,
          },
        });
        graphEdges.push({
          id: `edge-${dimensionId}-${compositeId}`,
          source: dimensionId,
          target: compositeId,
          sourceHandle: "out",
          targetHandle: "in",
        });
      }
    });

    return { nodes: graphNodes, edges: graphEdges };
  };

  const openParticleTab = async (particleId: string) => {
    const existing = tabs.find((tab) => tab.particleId === particleId);
    if (existing) {
      switchTab(existing.id);
      return;
    }
    saveActiveGraph();
    const particleMeta = networkParticles.find((item) => item.id === particleId);
    const label = particleMeta?.name ?? titleize(particleId);
    const nextTab = createStudioTab(label, particleId);
    let graph = buildParticleGraph(particleId);
    tabGraphs.set(nextTab.id, graph);
    tabs = [...tabs, nextTab];
    activeTabId = nextTab.id;
    loadTabGraph(nextTab.id);

    if (graph.nodes.length) return;

    try {
      chainSyncError = null;
      chainSyncStatus = `Fetching ${particleId} from chain...`;
      const merged = await withChainAuthRetry(() => syncSingleChainParticle(particleId));
      if (!merged) {
        chainSyncStatus = null;
        chainSyncError = `Particle ${particleId} was not found in chain registry.`;
        return;
      }
      graph = buildParticleGraph(particleId);
      tabGraphs.set(nextTab.id, graph);
      if (activeTabId === nextTab.id) loadTabGraph(nextTab.id);
      chainSyncStatus = `Loaded ${particleId} from chain.`;
    } catch (error) {
      chainSyncStatus = null;
      chainSyncError = error instanceof Error ? error.message : `Failed to fetch ${particleId}.`;
    }
  };

  type RegistryMatch = {
    id: string;
    name: string;
    dimensions?: number;
  };

  const registryByKind = $derived.by<Record<StudioNodeKind, RegistryMatch[]>>(() => ({
    particle: networkParticles.map((item) => ({ id: item.id, name: item.name })),
    feature: networkLibrary.feature.map((item) => ({
      id: item.id,
      name: item.name,
      dimensions: item.dimensions,
    })),
    transformation: networkLibrary.transformation.map((item) => ({ id: item.id, name: item.name })),
    condition: networkLibrary.condition.map((item) => ({ id: item.id, name: item.name })),
    plugin: networkLibrary.plugin.map((item) => ({ id: item.id, name: item.name })),
    agent: [] as RegistryMatch[],
    dimension: [] as RegistryMatch[],
  }));

  const findRegistryMatch = (kind: StudioNodeKind, name: string): RegistryMatch | null => {
    const pool = registryByKind[kind] ?? [];
    const targetKey = normalizeKey(name);
    return pool.find((item) => normalizeKey(item.name) === targetKey) ?? null;
  };

  const createUniqueName = (kind: StudioNodeKind, baseName: string) => {
    const registryNames = new SvelteSet(
      (registryByKind[kind] ?? []).map((item) => normalizeKey(item.name)),
    );
    const localNames = new SvelteSet(
      nodes.filter((node) => node.data.kind === kind).map((node) => normalizeKey(node.data.label)),
    );
    let suffix = 1;
    let candidate = baseName;
    while (registryNames.has(normalizeKey(candidate)) || localNames.has(normalizeKey(candidate))) {
      candidate = `${baseName}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  };

  const resolveNodeName = (node: StudioNode) => {
    if (node.data.networkId) return node.data.networkId;
    if (node.data.particleId) return node.data.particleId;
    const slugged = slugify(node.data.label);
    return slugged || node.data.label;
  };

  const commitNameChange = (node: StudioNode) => {
    if (node.data.fromNetwork) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    if (trimmed === node.data.label) return;

    const match = findRegistryMatch(node.data.kind, trimmed);
    const matchId = match ? resolveRegistryId(node.data.kind, match.id) : undefined;
    if (match && node.data.networkId !== matchId) {
      pendingNameCollision = {
        nodeId: node.id,
        kind: node.data.kind,
        desiredName: trimmed,
        existingId: match.id,
        existingName: match.name,
      };
      return;
    }

    updateNodeData(node.id, {
      label: trimmed,
      networkId: node.data.networkId === matchId ? node.data.networkId : undefined,
      fromNetwork: false,
    });
  };

  const applyNameCollisionUseExisting = () => {
    if (!pendingNameCollision) return;
    const { nodeId, existingId, existingName, kind } = pendingNameCollision;
    const match = findRegistryMatch(kind, existingName);
    const resolvedId = match
      ? resolveRegistryId(kind, match.id)
      : resolveRegistryId(kind, existingId);
    updateNodeData(nodeId, {
      label: existingName,
      networkId: resolvedId,
      fromNetwork: true,
      dimensions: typeof match?.dimensions === "number" ? match.dimensions : undefined,
    });
    if (kind === "feature" && typeof match?.dimensions === "number") {
      applyDimensionChange(nodeId, match.dimensions);
    }
    pendingNameCollision = null;
  };

  const applyNameCollisionCreateNew = () => {
    if (!pendingNameCollision) return;
    const { nodeId, desiredName, kind } = pendingNameCollision;
    const unique = createUniqueName(kind, desiredName);
    updateNodeData(nodeId, { label: unique, networkId: undefined, fromNetwork: false });
    pendingNameCollision = null;
  };

  const addParticleToToolbox = (particle: ExploreParticle) => {
    const id = normalizeToolboxId(particle.id);
    if (toolboxLibrary.particles.includes(id)) return;
    toolboxLibrary = { ...toolboxLibrary, particles: [...toolboxLibrary.particles, id] };
  };

  const addLibraryToToolbox = (item: LibraryItem) => {
    const kind = item.kind;
    if (toolboxLibrary[kind].includes(item.id)) return;
    toolboxLibrary = { ...toolboxLibrary, [kind]: [...toolboxLibrary[kind], item.id] };
  };

  const getDimensionNodesForFeature = (featureId: string) =>
    nodes.filter(
      (node) => node.data.kind === "dimension" && node.data.parentFeatureId === featureId,
    );

  const getFeatureNode = (featureId: string) => nodes.find((node) => node.id === featureId) ?? null;

  const storeParticleRIs = (particleName: string) => {
    const rootFeatureNode = nodes.find((node) => node.data.kind === "feature");
    if (!rootFeatureNode) return;
    const dims = getDimensionNodesForFeature(rootFeatureNode.id).sort(
      (a, b) => (a.data.dimensionIndex ?? 0) - (b.data.dimensionIndex ?? 0),
    );
    deployedParticleRIs = {
      ...deployedParticleRIs,
      [particleName]: dims.map((dimension) => ({
        start: toInt(dimension.data.riStart) ?? 0,
        shift: toInt(dimension.data.riShift) ?? 0,
        locked: Boolean(dimension.data.riLocked),
      })),
    };
  };

  const createDimensionNode = (
    feature: StudioNode,
    dimensionIndex: number,
    totalDimensions: number,
  ): StudioNode => {
    const spacing = 200;
    const rowY = feature.position.y + 160;
    const startX = feature.position.x - ((Math.max(1, totalDimensions) - 1) * spacing) / 2;
    return {
      id: `dimension-${feature.id}-${dimensionIndex}-${crypto.randomUUID()}`,
      type: "dimension",
      position: {
        x: startX + dimensionIndex * spacing,
        y: rowY,
      },
      data: {
        label: `#${dimensionIndex + 1}`,
        kind: "dimension",
        parentFeatureId: feature.id,
        dimensionIndex,
        transformations: [],
        fromNetwork: feature.data.fromNetwork ?? false,
        riStart: 0,
        riShift: 0,
        riLocked: false,
      },
    };
  };

  const ensureDimensionEdges = (featureId: string, dimensionNodes: StudioNode[]) => {
    const existingEdges = new SvelteSet(
      edges.map((edge) => `${edge.source}-${edge.sourceHandle}-${edge.target}`),
    );
    const newEdges: Edge[] = [];

    dimensionNodes.forEach((dimension) => {
      const key = `${featureId}-dim-${dimension.data.dimensionIndex}-${dimension.id}`;
      if (existingEdges.has(key)) return;
      newEdges.push({
        id: `edge-${featureId}-${dimension.id}`,
        source: featureId,
        sourceHandle: `dim-${dimension.data.dimensionIndex}`,
        target: dimension.id,
        targetHandle: "in",
      });
    });

    if (newEdges.length) edges = [...edges, ...newEdges];
  };

  const dimensionHasTransformations = (dimension: StudioNode) =>
    (dimension.data.transformations ?? []).length > 0;

  const applyDimensionChange = (featureId: string, newCount: number) => {
    const feature = getFeatureNode(featureId);
    if (!feature) return;

    const currentDimensions = getDimensionNodesForFeature(featureId);
    const retained = currentDimensions.filter((node) => (node.data.dimensionIndex ?? 0) < newCount);
    const removed = currentDimensions.filter((node) => (node.data.dimensionIndex ?? 0) >= newCount);

    const removedIds = removed.map((node) => node.id);
    const removeSet = new SvelteSet([...removedIds]);
    if (removeSet.size) {
      nodes = nodes.filter((node) => !removeSet.has(node.id));
      edges = edges.filter((edge) => !removeSet.has(edge.source) && !removeSet.has(edge.target));
    }

    updateNodeData(featureId, { dimensions: newCount });

    const nextDimensions: StudioNode[] = [...retained];
    for (let index = 0; index < newCount; index += 1) {
      if (retained.some((node) => node.data.dimensionIndex === index)) continue;
      nextDimensions.push(createDimensionNode(feature, index, newCount));
    }

    if (nextDimensions.length !== retained.length) {
      nodes = [...nodes, ...nextDimensions.filter((node) => !retained.includes(node))];
    }

    ensureDimensionEdges(featureId, nextDimensions);
    scheduleLayout();
  };

  const requestDimensionChange = (featureId: string, nextCount: number) => {
    const feature = getFeatureNode(featureId);
    if (!feature) return;
    if (feature.data.fromNetwork) return;
    const currentCount = Math.max(1, Math.round(feature.data.dimensions ?? 1));
    const sanitized = Math.max(1, Math.round(nextCount));
    if (sanitized === currentCount) return;

    if (sanitized < currentCount) {
      const removed = getDimensionNodesForFeature(featureId).filter(
        (node) => (node.data.dimensionIndex ?? 0) >= sanitized,
      );
      const hasTransformations = removed.some((node) => dimensionHasTransformations(node));
      if (hasTransformations) {
        pendingDimensionChange = {
          nodeId: featureId,
          newCount: sanitized,
          removedDimensions: removed,
        };
        return;
      }
    }

    applyDimensionChange(featureId, sanitized);
  };

  const confirmDimensionRemoval = () => {
    if (!pendingDimensionChange) return;
    applyDimensionChange(pendingDimensionChange.nodeId, pendingDimensionChange.newCount);
    dimensionDraft = pendingDimensionChange.newCount;
    pendingDimensionChange = null;
  };

  const cancelDimensionRemoval = () => {
    if (selectedNode?.data.kind === "feature") {
      dimensionDraft = selectedNode.data.dimensions ?? 1;
    }
    pendingDimensionChange = null;
  };

  const libraryKindForTab = (tab: typeof libraryTab): LibraryItem["kind"] | null => {
    switch (tab) {
      case "features":
        return "feature";
      case "transformations":
        return "transformation";
      case "conditions":
        return "condition";
      case "plugins":
        return "plugin";
      default:
        return null;
    }
  };

  const libraryItems = $derived.by(() => {
    const kind = libraryKindForTab(libraryTab);
    if (!kind) return [];

    const source = networkLibrary[kind] ?? [];

    if (explorerSource === "toolbox") {
      const saved = toolboxLibrary[kind];
      return source.filter((item) => saved.includes(item.id));
    }

    return source;
  });

  const listTitle = $derived.by(() => {
    switch (libraryTab) {
      case "particles":
        return "Particles";
      case "features":
        return "Features";
      case "transformations":
        return "Transformations";
      case "conditions":
        return "Conditions";
      case "plugins":
        return "Plugins";
      default:
        return "Library";
    }
  });

  const listTooltip = $derived.by(() => {
    switch (libraryTab) {
      case "particles":
        return "A particle is a producer of values. It can be built from many other particles created by different users (humans and AI agents). It connects to other particles through a feature, using the feature’s dimensions as connection points to other particles and selection rules (how to select values from referenced particles).";
      case "features":
        return "A feature defines dimensions (connection points) and the transformations that live on those dimensions. It is a template that tells a particle how it can select values from attached particles or output its own values. A feature alone produces nothing; it only gains output when used by a particle.";
      case "transformations":
        return "Transformations live on dimensions of a feature. Each dimension has its own list of transformations that specify how values are selected from the particle attached at that dimension.";
      case "conditions":
        return "A particle only outputs values if its condition is met. Conditions can be financial (e.g., send funds to an address) or non-financial (artistic, contextual, etc.).";
      case "plugins":
        return "A plugin consumes the runner’s output streams and renders or sonifies them (MIDI, score, audio, image, etc.).";
      default:
        return "";
    }
  });

  const getLibraryRegistryName = (item: LibraryItem) => {
    switch (item.kind) {
      case "feature":
        return item.id.replace(/^feature-/, "");
      case "transformation":
        return item.id.replace(/^transform-/, "");
      case "condition":
        return item.id.replace(/^condition-/, "");
      case "plugin":
        return item.id;
      default:
        return item.id;
    }
  };

  const resolveRegistryId = (kind: StudioNodeKind, id: string) => {
    switch (kind) {
      case "feature":
        return id.replace(/^feature-/, "");
      case "transformation":
        return id.replace(/^transform-/, "");
      case "condition":
        return id.replace(/^condition-/, "");
      case "plugin":
        return id.replace(/^plugin-/, "");
      default:
        return id;
    }
  };

  const upsertLibraryItem = (items: LibraryItem[], next: LibraryItem) => {
    if (items.some((item) => item.id === next.id)) return items;
    return [...items, next];
  };

  const upsertParticleItem = (next: ExploreParticle) => {
    if (deployedParticles.some((item) => item.id === next.id)) return deployedParticles;
    return [...deployedParticles, next];
  };

  const addParticleNode = (
    particle: ExploreParticle,
    position: { x: number; y: number } | null = null,
  ) => {
    if (activeTabReadOnly) return;
    const nodePosition = position ?? {
      x: 120 + Math.round(Math.random() * 200),
      y: 120 + Math.round(Math.random() * 200),
    };
    nodes = [
      ...nodes,
      {
        id: `particle-${particle.id}-${crypto.randomUUID()}`,
        position: nodePosition,
        type: "particle",
        data: {
          label: particle.name,
          kind: "particle",
          particleId: particle.id,
          viewId: particle.viewId,
          networkId: particle.id,
          fromNetwork: true,
        },
      },
    ];
  };

  const addLibraryNode = (item: LibraryItem, position: { x: number; y: number } | null = null) => {
    if (activeTabReadOnly && item.kind !== "plugin") return;
    if (item.kind === "transformation") {
      addTransformationToSelectedDimension(item.name, "network");
      return;
    }
    const registryName = getLibraryRegistryName(item);
    const nodePosition = position ?? {
      x: 160 + Math.round(Math.random() * 200),
      y: 160 + Math.round(Math.random() * 200),
    };
    const node: StudioNode = {
      id: `${item.kind}-${item.id}-${crypto.randomUUID()}`,
      position: nodePosition,
      type:
        item.kind === "feature"
          ? "feature"
          : item.kind === "plugin"
            ? "plugin"
            : item.kind === "condition"
              ? "condition"
              : undefined,
      draggable: item.kind === "plugin" ? true : undefined,
      data: {
        label: item.name,
        kind: item.kind,
        sourceId: item.id,
        viewId: item.viewId,
        networkId: registryName,
        fromNetwork: true,
        dimensions: item.dimensions ?? (item.kind === "feature" ? 1 : undefined),
      },
    };
    nodes = [...nodes, node];
    if (item.kind === "condition") {
      conditionCodeById.set(node.id, defaultConditionDraftCode);
    }
    if (item.kind === "feature") {
      applyDimensionChange(node.id, node.data.dimensions ?? 1);
    }
  };

  const getCanvasCenter = () => {
    if (!canvasEl) return { x: 220, y: 220 };
    const rect = canvasEl.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    return screenToFlowPosition ? screenToFlowPosition(center) : { x: center.x, y: center.y };
  };

  const addQuickNode = (
    kind: QuickNodeKind,
    label: string,
    position: { x: number; y: number } | null = null,
  ) => {
    if (activeTabReadOnly && kind !== "plugin") return;
    if (kind === "transformation") {
      addTransformationToSelectedDimension(label);
      return;
    }
    const nodePosition = position ?? getCanvasCenter();
    const node: StudioNode = {
      id: `${kind}-quick-${crypto.randomUUID()}`,
      position: nodePosition,
      selected: true,
      type: kind === "feature" ? "feature" : kind === "dimension" ? "dimension" : kind,
      draggable: kind === "plugin" ? true : undefined,
      data: {
        label: kind === "dimension" ? "#" : label,
        kind,
        dimensions: kind === "feature" ? 1 : undefined,
        transformations: kind === "dimension" ? [] : undefined,
        fromNetwork: false,
        riStart: kind === "dimension" ? 0 : undefined,
        riShift: kind === "dimension" ? 0 : undefined,
        riLocked: kind === "dimension" ? false : undefined,
      },
    };
    nodes = nodes.map((existing) => ({ ...existing, selected: false }));
    nodes = [...nodes, node];
    if (kind === "condition") {
      conditionCodeById.set(node.id, defaultConditionDraftCode);
    }
    if (kind === "feature") {
      applyDimensionChange(node.id, 1);
    }
  };

  const handleDragStart = (event: DragEvent, particle: ExploreParticle) => {
    event.dataTransfer?.setData("application/x-hypermusic-particle", JSON.stringify(particle));
    event.dataTransfer?.setData("text/plain", particle.name);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
  };

  const handleLibraryDragStart = (event: DragEvent, item: LibraryItem) => {
    event.dataTransfer?.setData("application/x-hypermusic-library", JSON.stringify(item));
    event.dataTransfer?.setData("text/plain", item.name);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  const handleQuickDragStart = (event: DragEvent, kind: QuickNodeKind, label: string) => {
    event.dataTransfer?.setData("application/x-hypermusic-quick", JSON.stringify({ kind, label }));
    event.dataTransfer?.setData("text/plain", label);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const quickPayload = event.dataTransfer?.getData("application/x-hypermusic-quick");
    if (quickPayload) {
      try {
        const payload = JSON.parse(quickPayload) as {
          kind: QuickNodeKind;
          label: string;
        };
        if (activeTabReadOnly && payload.kind !== "plugin") return;
        if (payload.kind === "transformation") return;
        const position = screenToFlowPosition
          ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
          : { x: event.clientX, y: event.clientY };
        addQuickNode(payload.kind, payload.label, position);
        return;
      } catch (error) {
        console.warn("Failed to parse dropped quick payload", error);
      }
    }
    const libraryPayload = event.dataTransfer?.getData("application/x-hypermusic-library");
    if (libraryPayload) {
      try {
        const item = JSON.parse(libraryPayload) as LibraryItem;
        if (activeTabReadOnly && item.kind !== "plugin") return;
        if (item.kind === "transformation") return;
        const position = screenToFlowPosition
          ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
          : { x: event.clientX, y: event.clientY };
        addLibraryNode(item, position);
        return;
      } catch (error) {
        console.warn("Failed to parse dropped library payload", error);
      }
    }
    const payload = event.dataTransfer?.getData("application/x-hypermusic-particle");
    if (!payload) return;
    try {
      const particle = JSON.parse(payload) as ExploreParticle;
      const position = screenToFlowPosition
        ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX, y: event.clientY };
      addParticleNode(particle, position);
    } catch (error) {
      console.warn("Failed to parse dropped particle payload", error);
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      const types = Array.from(event.dataTransfer.types);
      event.dataTransfer.dropEffect = types.includes("application/x-hypermusic-quick")
        ? "copy"
        : "move";
    }
  };

  const handleTabDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      const types = Array.from(event.dataTransfer.types);
      event.dataTransfer.dropEffect = types.includes("application/x-hypermusic-particle")
        ? "copy"
        : "none";
    }
  };

  const handleTabDrop = (event: DragEvent) => {
    event.preventDefault();
    const payload = event.dataTransfer?.getData("application/x-hypermusic-particle");
    if (!payload) return;
    try {
      const particle = JSON.parse(payload) as ExploreParticle;
      openParticleTab(particle.id);
    } catch (error) {
      console.warn("Failed to parse dropped particle payload", error);
    }
  };

  const handleSelectionChange: OnSelectionChange<StudioNode, Edge> = ({ nodes: selectedNodes }) => {
    selectedNodeId = selectedNodes[0]?.id ?? null;
  };

  const handleBeforeDelete = async ({
    nodes: toDelete,
    edges: toDeleteEdges,
  }: {
    nodes: StudioNode[];
    edges: Edge[];
  }) => {
    if (!activeTabReadOnly) return { nodes: toDelete, edges: toDeleteEdges };
    const pluginIds = new SvelteSet(
      toDelete.filter((node) => node.data.kind === "plugin").map((node) => node.id),
    );
    const allowedEdges = toDeleteEdges.filter(
      (edge) => pluginIds.has(edge.source) || pluginIds.has(edge.target),
    );
    if (pluginIds.size === 0 && allowedEdges.length === 0) return false;
    return {
      nodes: toDelete.filter((node) => pluginIds.has(node.id)),
      edges: allowedEdges,
    };
  };

  const parseDimensionHandle = (handle?: string | null) => {
    if (!handle) return null;
    if (!handle.startsWith("dim-")) return null;
    const value = Number(handle.replace("dim-", ""));
    return Number.isFinite(value) ? value : null;
  };

  const isValidConnection: (connection: Connection | Edge) => boolean = (connection) => {
    if (!connection.source || !connection.target) return false;
    const sourceNode = nodesById[connection.source];
    const targetNode = nodesById[connection.target];
    if (!sourceNode || !targetNode) return false;

    if (sourceNode.data.kind === "feature" && targetNode.data.kind === "dimension") {
      const dimensionIndex = parseDimensionHandle(connection.sourceHandle);
      if (dimensionIndex === null) return false;
      if (connection.targetHandle !== "in") return false;
      if (targetNode.data.parentFeatureId && targetNode.data.parentFeatureId !== sourceNode.id) {
        return false;
      }
      return true;
    }

    if (sourceNode.data.kind === "dimension" && targetNode.data.kind === "particle") {
      return connection.sourceHandle === "out" && connection.targetHandle === "in";
    }

    if (sourceNode.data.kind === "condition" && targetNode.data.kind === "feature") {
      return connection.sourceHandle === "out" && connection.targetHandle === "condition";
    }

    if (sourceNode.data.kind === "particle" && targetNode.data.kind === "plugin") {
      return connection.sourceHandle === "out" && connection.targetHandle === "in";
    }

    return false;
  };

  const handleConnect: OnConnect = (connection) => {
    if (!isValidConnection(connection)) return;
    if (!connection.source || !connection.target) return;
    if (activeTabReadOnly) {
      const sourceNode = nodesById[connection.source];
      const targetNode = nodesById[connection.target];
      const isPluginConnection =
        sourceNode?.data.kind === "particle" &&
        targetNode?.data.kind === "plugin" &&
        connection.sourceHandle === "out" &&
        connection.targetHandle === "in";
      if (!isPluginConnection) return;
    }
    if (
      edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle &&
          edge.targetHandle === connection.targetHandle,
      )
    ) {
      return;
    }

    edges = [
      ...edges,
      {
        id: `edge-${connection.source}-${connection.target}-${crypto.randomUUID()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      },
    ];

    const sourceNode = nodesById[connection.source];
    const targetNode = nodesById[connection.target];
    if (sourceNode?.data.kind === "feature" && targetNode?.data.kind === "dimension") {
      const dimensionIndex = parseDimensionHandle(connection.sourceHandle);
      updateNodeData(targetNode.id, {
        parentFeatureId: sourceNode.id,
        dimensionIndex: dimensionIndex ?? targetNode.data.dimensionIndex,
      });
    }

    if (sourceNode?.data.kind === "particle" && targetNode?.data.kind === "plugin") {
      if (activeRunOutput) {
        refreshPluginOutputs(activeRunOutput);
      }
    }
  };

  const handleNodeClick = ({
    node,
    event,
  }: {
    node: StudioNode;
    event: MouseEvent | TouchEvent;
  }) => {
    if (!(event instanceof MouseEvent)) return;
    if (event.detail < 2) return;
    if (node.data.kind === "particle" && node.data.particleId) {
      openParticleTab(node.data.particleId);
    }
  };

  const buildChainDeployPreview = () => {
    if (!activeTab) {
      return {
        ok: false,
        error: "No active tab.",
      };
    }

    try {
      const compiled = compileDraftTransformations(nodes);
      const runtime = buildStudioRuntime(
        { nodes, edges },
        { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
        buildRuntimeOverrides(compiled.registry),
      );

      const warnings: string[] = [...compiled.warnings, ...runtime.warnings];

      const particleName = activeTab.particleId ?? (slugify(activeTab.label) || activeTab.label);
      const particleKey = normalizeKey(particleName);
      const networkParticleKeys = new SvelteSet(
        networkParticles.map((item) => normalizeKey(item.id)),
      );
      if (!activeTab.particleId && networkParticleKeys.has(particleKey)) {
        warnings.push(`Particle already exists in network: ${particleName}.`);
      }

      nodes.forEach((node) => {
        if (node.data.fromNetwork) return;
        const existing = findRegistryMatch(node.data.kind, node.data.label);
        if (existing && normalizeKey(existing.name) === normalizeKey(node.data.label)) {
          warnings.push(`${titleize(node.data.kind)} already exists: ${node.data.label}.`);
        }
      });

      const draftSources = collectDraftTransformationSources(nodes);
      const localConditions = nodes.filter(
        (node) => node.data.kind === "condition" && !node.data.fromNetwork,
      );
      const localFeatures = nodes.filter(
        (node) => node.data.kind === "feature" && !node.data.fromNetwork,
      );

      const conditionRequests = localConditions.map((node) => ({
        method: "POST",
        path: "/chain/condition",
        body: {
          name: resolveNodeName(node),
          sol_src: getConditionCode(node.id),
        },
      }));

      const transformationRequests = Object.keys(compiled.registry)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          method: "POST",
          path: "/chain/transformation",
          body: {
            name,
            sol_src: draftSources.get(name)?.code ?? "",
          },
        }));

      const featureRequests = localFeatures
        .map((featureNode) => {
          const featureName = resolveNodeName(featureNode);
          const def = runtime.registry.features[featureName];
          if (!def) return null;
          return {
            method: "POST",
            path: "/chain/feature",
            body: {
              name: featureName,
              dimensions: def.dimensions.map((dimension) => ({
                transformations: dimension.transformations.map((tx) => ({
                  name: tx.name,
                  args: [...tx.args],
                })),
              })),
            },
          };
        })
        .filter((value): value is { method: string; path: string; body: unknown } =>
          Boolean(value),
        );

      const rootDef = runtime.registry.particles[runtime.rootParticle];
      const particleRequest = rootDef
        ? {
            method: "POST",
            path: "/chain/particle",
            body: {
              name: rootDef.name,
              feature_name: rootDef.featureName,
              composite_names: [...rootDef.composites],
              ...(rootDef.conditionName ? { condition_name: rootDef.conditionName } : {}),
              ...(rootDef.conditionArgs?.length
                ? { condition_args: [...rootDef.conditionArgs] }
                : {}),
            },
          }
        : null;

      return {
        ok: true,
        root_particle: runtime.rootParticle,
        warnings,
        requests: {
          conditions: conditionRequests,
          transformations: transformationRequests,
          features: featureRequests,
          particle: particleRequest,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to build preview.",
      };
    }
  };

  const chainApiPreview = $derived.by(() => buildChainDeployPreview());
  const chainApiPreviewJson = $derived.by(() => JSON.stringify(chainApiPreview, null, 2));

  let apiEditorApplying = false;
  let chainAutoSyncStarted = false;

  type ApiDraftRequest = {
    method?: string;
    path?: string;
    body?: Record<string, unknown>;
  };

  type ApiDraftPreview = {
    ok?: boolean;
    requests?: {
      conditions?: ApiDraftRequest[];
      transformations?: ApiDraftRequest[];
      features?: ApiDraftRequest[];
      particle?: ApiDraftRequest | null;
    };
  };

  const applyApiPreviewJsonToStudio = (rawJson: string) => {
    if (!activeTab) throw new Error("No active tab.");
    let parsed: ApiDraftPreview;
    try {
      parsed = JSON.parse(rawJson) as ApiDraftPreview;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Invalid JSON.");
    }

    const requests = parsed.requests;
    if (!requests || typeof requests !== "object") {
      throw new Error("JSON must include a requests object.");
    }

    const particleReq = requests.particle;
    const particleBody =
      particleReq &&
      typeof particleReq === "object" &&
      particleReq.body &&
      typeof particleReq.body === "object"
        ? (particleReq.body as Record<string, unknown>)
        : null;
    if (!particleBody) {
      throw new Error("requests.particle.body is required.");
    }

    const particleName = String(particleBody.name ?? "").trim();
    const featureName = String(particleBody.feature_name ?? "").trim();
    if (!particleName) throw new Error("requests.particle.body.name is required.");
    if (!featureName) throw new Error("requests.particle.body.feature_name is required.");

    const compositeNamesRaw = Array.isArray(particleBody.composite_names)
      ? (particleBody.composite_names as Array<string | null>)
      : [];
    const compositeNames = compositeNamesRaw.map((value) =>
      typeof value === "string" && value.trim() ? value.trim() : null,
    );

    const conditionName =
      typeof particleBody.condition_name === "string" && particleBody.condition_name.trim()
        ? particleBody.condition_name.trim()
        : null;

    const conditionReqs = Array.isArray(requests.conditions) ? requests.conditions : [];
    const conditionSourceByName = new SvelteMap<string, string>();
    conditionReqs.forEach((req) => {
      if (!req?.body || typeof req.body !== "object") return;
      const body = req.body as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const src = typeof body.sol_src === "string" ? body.sol_src : "";
      if (!name) return;
      conditionSourceByName.set(name, src);
    });

    const transformationReqs = Array.isArray(requests.transformations)
      ? requests.transformations
      : [];
    const transformationSourceByName = new SvelteMap<string, string>();
    transformationReqs.forEach((req) => {
      if (!req?.body || typeof req.body !== "object") return;
      const body = req.body as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const src = typeof body.sol_src === "string" ? body.sol_src : "";
      if (!name) return;
      transformationSourceByName.set(name, src);
    });

    const featureReqs = Array.isArray(requests.features) ? requests.features : [];
    const featureReq = featureReqs.find((req) => {
      if (!req?.body || typeof req.body !== "object") return false;
      const body = req.body as Record<string, unknown>;
      return String(body.name ?? "").trim() === featureName;
    });
    const featureBody =
      featureReq && featureReq.body && typeof featureReq.body === "object"
        ? (featureReq.body as Record<string, unknown>)
        : null;
    if (!featureBody) {
      throw new Error(`Feature request for "${featureName}" is required.`);
    }

    const dimensionsRaw = Array.isArray(featureBody.dimensions)
      ? (featureBody.dimensions as Array<Record<string, unknown>>)
      : [];
    if (!dimensionsRaw.length) {
      throw new Error("Feature must include at least one dimension.");
    }

    const nextNodes: StudioNode[] = [];
    const nextEdges: Edge[] = [];
    const featureX = 360;
    const featureY = 80;

    const featureNode: StudioNode = {
      id: `feature-${crypto.randomUUID()}`,
      type: "feature",
      draggable: false,
      position: { x: featureX, y: featureY },
      data: {
        label: featureName,
        kind: "feature",
        dimensions: dimensionsRaw.length,
        fromNetwork: false,
      },
    };
    nextNodes.push(featureNode);

    if (conditionName) {
      const isDraftCondition = conditionSourceByName.has(conditionName);
      const conditionNode: StudioNode = {
        id: `condition-${crypto.randomUUID()}`,
        type: "condition",
        draggable: false,
        position: { x: featureX, y: featureY - 120 },
        data: {
          label: conditionName,
          kind: "condition",
          fromNetwork: !isDraftCondition,
          ...(isDraftCondition ? {} : { networkId: conditionName }),
        },
      };
      nextNodes.push(conditionNode);
      nextEdges.push({
        id: `edge-${conditionNode.id}-${featureNode.id}`,
        source: conditionNode.id,
        target: featureNode.id,
        sourceHandle: "out",
        targetHandle: "condition",
      });
      if (isDraftCondition) {
        conditionCodeById.set(conditionNode.id, conditionSourceByName.get(conditionName) ?? "");
      }
    }

    const compositeRowY = featureY + 320;
    dimensionsRaw.forEach((dimension, dimIndex) => {
      const dimNode = createDimensionNode(featureNode, dimIndex, dimensionsRaw.length);
      const txDefs = Array.isArray(dimension.transformations)
        ? (dimension.transformations as Array<Record<string, unknown>>)
        : [];
      const txInstances = txDefs
        .map((tx) => {
          const name = typeof tx.name === "string" ? tx.name.trim() : "";
          if (!name) return null;
          const args = Array.isArray(tx.args)
            ? tx.args.map((arg) => Number(arg)).filter((arg) => Number.isFinite(arg))
            : [];
          const isDraft = transformationSourceByName.has(name);
          return createTransformationInstance(name, args, isDraft ? "draft" : "network");
        })
        .filter((value): value is TransformationInstance => Boolean(value));

      dimNode.data = {
        ...dimNode.data,
        transformations: txInstances,
      };
      nextNodes.push(dimNode);
      nextEdges.push({
        id: `edge-${featureNode.id}-${dimNode.id}`,
        source: featureNode.id,
        sourceHandle: `dim-${dimIndex}`,
        target: dimNode.id,
        targetHandle: "in",
      });

      txInstances.forEach((tx) => {
        if (tx.status !== "draft") return;
        const source = transformationSourceByName.get(tx.name);
        if (source) transformationCodeById.set(tx.id, source);
      });

      const compositeName = compositeNames[dimIndex] ?? null;
      if (compositeName) {
        const particleMeta = networkParticles.find((item) => item.id === compositeName);
        const compositeNode: StudioNode = {
          id: `particle-${crypto.randomUUID()}`,
          type: "particle",
          draggable: false,
          position: { x: dimNode.position.x, y: compositeRowY },
          data: {
            label: particleMeta?.name ?? compositeName,
            kind: "particle",
            particleId: compositeName,
            networkId: compositeName,
            fromNetwork: true,
          },
        };
        nextNodes.push(compositeNode);
        nextEdges.push({
          id: `edge-${dimNode.id}-${compositeNode.id}`,
          source: dimNode.id,
          target: compositeNode.id,
          sourceHandle: "out",
          targetHandle: "in",
        });
      }
    });

    apiEditorApplying = true;
    try {
      nodes = nextNodes;
      edges = nextEdges;
      selectedNodeId = null;
      tabs = tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              label: particleName,
              particleId: undefined,
            }
          : tab,
      );
      tabGraphs.set(activeTabId, { nodes: nextNodes, edges: nextEdges });
      scheduleLayout();
    } finally {
      apiEditorApplying = false;
    }
  };

  const handleApiEditorInput = (value: string) => {
    apiEditorText = value;
    apiEditorStatus = null;
    if (!apiEditorLiveApply) {
      apiEditorError = null;
      return;
    }
    try {
      applyApiPreviewJsonToStudio(value);
      apiEditorError = null;
      apiEditorStatus = "Applied to Studio.";
    } catch (error) {
      apiEditorError = error instanceof Error ? error.message : "Invalid API JSON.";
    }
  };

  const applyApiEditorNow = () => {
    apiEditorStatus = null;
    try {
      applyApiPreviewJsonToStudio(apiEditorText);
      apiEditorError = null;
      apiEditorStatus = "Applied to Studio.";
    } catch (error) {
      apiEditorError = error instanceof Error ? error.message : "Invalid API JSON.";
    }
  };

  $effect(() => {
    if (apiEditorApplying) return;
    if (apiEditorFocused) return;
    apiEditorText = chainApiPreviewJson;
    apiEditorError = null;
    apiEditorStatus = null;
  });
</script>

<div
  class="studio"
  style={`--left-size:${leftSize}; --right-size:${rightSize}; --top-size:${topSize}; --bottom-size:${bottomSize};`}
>
  <div class="top-stack">
    <div
      class="tab-bar"
      role="tablist"
      aria-label="Particle tabs"
      tabindex="0"
      ondragover={handleTabDragOver}
      ondrop={handleTabDrop}
    >
      {#each tabs as tab (tab.id)}
        <div class={`tab ${tab.id === activeTabId ? "is-active" : ""}`}>
          {#if tabRenameId === tab.id}
            <input
              class="tab-rename"
              value={tabRenameValue}
              oninput={(event) => {
                const target = event.target as HTMLInputElement | null;
                tabRenameValue = target?.value ?? "";
              }}
              onblur={() => commitTabRename(tab)}
              onkeydown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitTabRename(tab);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelTabRename();
                }
              }}
            />
          {:else}
            <button
              type="button"
              role="tab"
              class="tab-button"
              aria-selected={tab.id === activeTabId}
              onclick={() => switchTab(tab.id)}
              ondblclick={() => startTabRename(tab)}
            >
              <span class="tab-label">{tab.label}</span>
              <span class={`tab-status ${tab.particleId ? "is-network" : "is-draft"}`}>
                {tab.particleId ? "network" : "in-progress"}
              </span>
            </button>
          {/if}
          <button
            type="button"
            class="tab-close"
            aria-label={`Close ${tab.label} tab`}
            onclick={() => closeTab(tab.id)}
          >
            <svg class="tab-close-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6l-12 12"></path>
            </svg>
          </button>
        </div>
      {/each}
      <button
        type="button"
        class="tab tab-add"
        aria-label="Create new particle tab"
        onclick={createEmptyTab}
      >
        +
      </button>
    </div>
    {#if topMode !== "hidden"}
      <DockPanel
        title="Create element"
        position="top"
        inline
        onHide={() => hidePanel((mode) => (topMode = mode))}
      >
        <div class="top-action-group">
          <Button
            variant="ghost"
            ariaLabel="New Feature"
            title="New Feature — A feature defines dimensions (connection points) and the transformations that live on those dimensions."
            className="icon-btn"
            draggable
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addQuickNode("feature", "New Feature");
            }}
            ondragstart={(event) => handleQuickDragStart(event, "feature", "New Feature")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              <path d="M12 8v8M8 12h8"></path>
            </svg>
          </Button>
          <Button
            variant="ghost"
            ariaLabel="New Dimension"
            title="New Dimension — A dimension hosts a chain of transformations for a feature output."
            className="icon-btn"
            draggable
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addQuickNode("dimension", "Dimension");
            }}
            ondragstart={(event) => handleQuickDragStart(event, "dimension", "Dimension")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14"></path>
              <path d="M5 12h14"></path>
              <path d="M5 17h14"></path>
            </svg>
          </Button>
          <Button
            variant="ghost"
            ariaLabel="New Transformation"
            title="New Transformation — Transformations live on dimensions of a feature and specify how values are selected from the attached particle."
            className="icon-btn"
            draggable
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addQuickNode("transformation", "New Transformation");
            }}
            ondragstart={(event) =>
              handleQuickDragStart(event, "transformation", "New Transformation")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 8h10l-3-3"></path>
              <path d="M18 16H8l3 3"></path>
            </svg>
          </Button>
          <Button
            variant="ghost"
            ariaLabel="New Condition"
            title="New Condition — A particle only outputs values if its condition is met."
            className="icon-btn"
            draggable
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addQuickNode("condition", "New Condition");
            }}
            ondragstart={(event) => handleQuickDragStart(event, "condition", "New Condition")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16l-6 7v6l-4-2v-4z"></path>
            </svg>
          </Button>
          <Button
            variant="ghost"
            ariaLabel="New Agent"
            title="New Agent"
            className="icon-btn"
            draggable
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addQuickNode("agent", "New Agent");
            }}
            ondragstart={(event) => handleQuickDragStart(event, "agent", "New Agent")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3"></circle>
              <path d="M5 20a7 7 0 0 1 14 0"></path>
            </svg>
          </Button>
          <Button
            variant="ghost"
            ariaLabel="New Plugin"
            title="New Plugin — A plugin consumes the runner’s output streams and renders or sonifies them."
            className="icon-btn"
            draggable
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addQuickNode("plugin", "New Plugin");
            }}
            ondragstart={(event) => handleQuickDragStart(event, "plugin", "New Plugin")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 6v6M16 6v6"></path>
              <path d="M6 12h12v3a6 6 0 0 1-12 0v-3z"></path>
              <path d="M12 18v3"></path>
            </svg>
          </Button>
        </div>
        <div class="top-action-divider" aria-hidden="true"></div>
        <div class="top-run-group">
          <label class="run-label" for="run-samples">N</label>
          <input
            id="run-samples"
            class="run-input"
            type="number"
            min="1"
            inputmode="numeric"
            value={runSamplesCount}
            oninput={(event) => {
              const target = event.target as HTMLInputElement | null;
              const next = Number(target?.value ?? 1);
              runSamplesCount = Number.isFinite(next) ? Math.max(1, Math.trunc(next)) : 1;
            }}
          />
          <Button
            variant="ghost"
            ariaLabel="Run flow"
            title="Run flow (mock runner)"
            className="icon-btn"
            onclick={executeActiveGraph}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5l12 7-12 7z"></path>
            </svg>
          </Button>
        </div>
        <div class="top-action-divider" aria-hidden="true"></div>
        <div class="top-deploy-group">
          <Button
            variant="ghost"
            ariaLabel="Sync my chain registry"
            title={chainSyncError ??
              chainSyncStatus ??
              "Sync owned chain features, transformations, conditions and particles"}
            className="icon-btn"
            disabled={chainSyncBusy || chainDeployBusy}
            onclick={syncChainOwnedRegistry}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66"></path>
              <path d="M20 4v6h-6"></path>
            </svg>
          </Button>
        </div>
        <div class="top-action-divider" aria-hidden="true"></div>
        <div class="top-deploy-group">
          <Button
            variant="ghost"
            ariaLabel="Deploy draft elements"
            title={chainDeployBusy ? "Deploying to chain..." : "Deploy drafts (compiles first)"}
            className="icon-btn"
            disabled={chainDeployBusy || chainSyncBusy}
            onclick={deployActiveGraph}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v10"></path>
              <path d="M8 8l4-4 4 4"></path>
              <path d="M4 20h16"></path>
            </svg>
          </Button>
        </div>
      </DockPanel>
      {#if chainDeployStatus || chainDeployError}
        <div class="chain-status-strip" role="status" aria-live="polite">
          {#if chainDeployStatus}
            <div class="chain-status-chip is-success">
              <span>Deploy</span>
              <strong>{chainDeployStatus}</strong>
            </div>
          {/if}
          {#if chainDeployError}
            <div class="chain-status-chip is-error">
              <span>Deploy error</span>
              <strong>{chainDeployError}</strong>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  {#if leftMode !== "hidden"}
    <DockPanel
      title="Add element"
      position="left"
      onHide={() => hidePanel((mode) => (leftMode = mode))}
    >
      <div class="left-panel">
        <div class="source-tabs">
          <button
            type="button"
            class={`source-tab ${explorerSource === "network" ? "is-active" : ""}`}
            onclick={() => (explorerSource = "network")}
          >
            Network
          </button>
          <button
            type="button"
            class={`source-tab ${explorerSource === "toolbox" ? "is-active" : ""}`}
            onclick={() => (explorerSource = "toolbox")}
          >
            Toolbox
          </button>
        </div>
        {#if explorerSource === "network" && (chainSyncStatus || chainSyncError)}
          <div
            class="chain-status-strip chain-status-strip--sidebar"
            role="status"
            aria-live="polite"
          >
            {#if chainSyncStatus}
              <div class="chain-status-chip">
                <span>Sync</span>
                <strong>{chainSyncStatus}</strong>
              </div>
            {/if}
            {#if chainSyncError}
              <div class="chain-status-chip is-error">
                <span>Sync error</span>
                <strong>{chainSyncError}</strong>
              </div>
            {/if}
          </div>
        {/if}
        <div class="left-tabs">
          <button
            type="button"
            class="scroll-arrow"
            aria-label="Scroll element tabs left"
            onclick={() => leftTabsEl?.scrollBy({ left: -120, behavior: "smooth" })}
          >
            ‹
          </button>
          <div class="left-tabs-track" bind:this={leftTabsEl}>
            <Button
              variant="subtle"
              selected={libraryTab === "particles"}
              onclick={() => (libraryTab = "particles")}
            >
              Particles
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "features"}
              onclick={() => (libraryTab = "features")}
            >
              Features
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "transformations"}
              onclick={() => (libraryTab = "transformations")}
            >
              Transformations
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "conditions"}
              onclick={() => (libraryTab = "conditions")}
            >
              Conditions
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "plugins"}
              onclick={() => (libraryTab = "plugins")}
            >
              Plugins
            </Button>
          </div>
          <button
            type="button"
            class="scroll-arrow"
            aria-label="Scroll element tabs right"
            onclick={() => leftTabsEl?.scrollBy({ left: 120, behavior: "smooth" })}
          >
            ›
          </button>
        </div>
        <div class="list-header">
          <div class="list-title">{listTitle}</div>
          <button
            class="info-dot"
            type="button"
            data-tooltip={listTooltip}
            style={`--tooltip-x:${tooltipX}px; --tooltip-y:${tooltipY}px;`}
            aria-label={`${listTitle} definition`}
            onmousemove={(event) => {
              tooltipX = event.clientX;
              tooltipY = event.clientY;
            }}
          >
            ?
          </button>
        </div>
        {#if libraryTab === "particles"}
          <CreateParticleExplorer
            particles={filteredParticles}
            views={mockParticleViews}
            usersById={mockUsersById}
            selectedId={selectedParticleId}
            bind:selectedViewId
            onSelect={handleParticleSelect}
            onOpen={handleParticleOpen}
            onAdd={(particle) => addParticleNode(particle, null)}
            onToolbox={addParticleToToolbox}
            onDragStart={handleDragStart}
            draggable
            showHeader={false}
            showViewFilter={false}
          />
        {:else if libraryTab === "features"}
          <StudioLibraryList
            title="Features"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else if libraryTab === "transformations"}
          <StudioLibraryList
            title="Transformations"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else if libraryTab === "conditions"}
          <StudioLibraryList
            title="Conditions"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else}
          <StudioLibraryList
            title="Plugins"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {/if}
      </div>
    </DockPanel>
  {/if}

  <div class="canvas" role="application" aria-label="Flow canvas" bind:this={canvasEl}>
    {#if topMode === "hidden"}
      <button
        class="panel-tab panel-tab--top"
        type="button"
        title="Create element panel (T)"
        aria-label="Create element panel"
        onclick={() => showPanel((m) => (topMode = m))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v16M4 12h16"></path>
        </svg>
      </button>
    {/if}
    <div class="flow-area">
      <SvelteFlow
        bind:nodes
        bind:edges
        {nodeTypes}
        onconnect={handleConnect}
        onselectionchange={handleSelectionChange}
        onbeforedelete={handleBeforeDelete}
        {isValidConnection}
        onnodeclick={handleNodeClick}
        fitView
        nodesDraggable
        nodesConnectable
        deleteKey={activeTabReadOnly ? null : "Backspace"}
        zoomOnScroll
        zoomOnDoubleClick={false}
        zoomOnPinch
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background bgColor="black" />
        <FlowInstanceBridge
          onReady={({ screenToFlowPosition: toFlow, getZoom: zoomFn, fitView: fitViewFn }) => {
            screenToFlowPosition = toFlow;
            getZoom = zoomFn;
            fitView = fitViewFn;
          }}
        />
      </SvelteFlow>
    </div>
  </div>

  {#if rightMode === "assistant"}
    <DockPanel title="Assistant" position="right" onHide={hideRightPanel}>
      <div class="right-panel-content">
        <div class="right-panel-controls">
          <button
            type="button"
            class={`right-panel-icon ${assistantVisible ? "is-active" : ""}`}
            aria-label="Toggle assistant panel"
            onclick={toggleAssistant}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v10H8l-4 4z"></path>
              <path d="M8 10h8M8 13h6"></path>
            </svg>
          </button>
          <button
            type="button"
            class={`right-panel-icon ${inspectorVisible ? "is-active" : ""}`}
            aria-label="Toggle inspector panel"
            onclick={toggleInspector}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7"></circle>
              <path d="M12 11v5"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </button>
        </div>
        <div class="assistant-placeholder">Agent assistant chat goes here.</div>
      </div>
    </DockPanel>
  {/if}

  {#if rightMode === "inspector"}
    <DockPanel title="Inspector" position="right" onHide={hideRightPanel}>
      <div class="right-panel-content">
        <div class="right-panel-controls">
          <button
            type="button"
            class={`right-panel-icon ${assistantVisible ? "is-active" : ""}`}
            aria-label="Toggle assistant panel"
            onclick={toggleAssistant}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v10H8l-4 4z"></path>
              <path d="M8 10h8M8 13h6"></path>
            </svg>
          </button>
          <button
            type="button"
            class={`right-panel-icon ${inspectorVisible ? "is-active" : ""}`}
            aria-label="Toggle inspector panel"
            onclick={toggleInspector}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7"></circle>
              <path d="M12 11v5"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </button>
        </div>
        <div class="inspector">
          <div class="inspector-header">
            <div class="inspector-tabs" role="tablist" aria-label="Inspector views">
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === "node"}
                class={`inspector-tab ${inspectorTab === "node" ? "is-active" : ""}`}
                onclick={() => {
                  inspectorTab = "node";
                }}
              >
                Node
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === "api"}
                class={`inspector-tab ${inspectorTab === "api" ? "is-active" : ""}`}
                onclick={() => {
                  inspectorTab = "api";
                }}
              >
                API
              </button>
            </div>
          </div>
          {#if inspectorTab === "node"}
            {#if inspectorNode}
              {#if selectedNode}
                {@const isReadOnly = selectedNode.data.fromNetwork}
                <label class="inspector-label" for="node-name">Name</label>
                <input
                  id="node-name"
                  class="inspector-input"
                  value={nameDraft}
                  disabled={isReadOnly}
                  oninput={(event) => {
                    const target = event.target as HTMLInputElement | null;
                    nameDraft = target?.value ?? "";
                  }}
                  onblur={() => commitNameChange(selectedNode)}
                  onkeydown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitNameChange(selectedNode);
                    }
                  }}
                />
                {#if pendingNameCollision && pendingNameCollision.nodeId === selectedNode.id}
                  <div class="inspector-alert">
                    <div class="inspector-alert-text">
                      “{pendingNameCollision.desiredName}” already exists in the network.
                    </div>
                    <div class="inspector-alert-actions">
                      <button type="button" onclick={applyNameCollisionUseExisting}>
                        Use existing
                      </button>
                      <button type="button" onclick={applyNameCollisionCreateNew}>
                        Create new
                      </button>
                    </div>
                  </div>
                {/if}
                {#if selectedNode.data.kind === "feature"}
                  <label class="inspector-label" for="node-dimensions">Dimensions</label>
                  <input
                    id="node-dimensions"
                    class="inspector-input"
                    type="number"
                    min="1"
                    value={dimensionDraft ?? 1}
                    disabled={isReadOnly}
                    oninput={(event) => {
                      const target = event.target as HTMLInputElement | null;
                      dimensionDraft = target ? Number(target.value) : 1;
                    }}
                    onchange={() => {
                      if (dimensionDraft !== null) {
                        requestDimensionChange(selectedNode.id, dimensionDraft);
                      }
                    }}
                  />
                  {#if pendingDimensionChange && pendingDimensionChange.nodeId === selectedNode.id}
                    <div class="inspector-alert">
                      <div class="inspector-alert-text">
                        Removing dimensions will delete {pendingDimensionChange.removedDimensions
                          .length}
                        dimension(s) with transformations. Continue?
                      </div>
                      <div class="inspector-alert-actions">
                        <button type="button" onclick={confirmDimensionRemoval}> Remove </button>
                        <button type="button" onclick={cancelDimensionRemoval}> Cancel </button>
                      </div>
                    </div>
                  {/if}
                {/if}
                {#if selectedNode.data.kind === "dimension"}
                  {@const locked = selectedNode.data.riLocked ?? false}
                  <div class="inspector-section">
                    <div class="inspector-section-title">Running instance</div>
                    <div class="inspector-inline">
                      <label class="inspector-inline-label" for="ri-start">Start</label>
                      <input
                        id="ri-start"
                        class="inspector-input inspector-input--compact inspector-input--inline"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        step="1"
                        value={selectedNode.data.riStart ?? 0}
                        disabled={isReadOnly && locked}
                        onwheel={(event) => {
                          event.preventDefault();
                          (event.currentTarget as HTMLInputElement).blur();
                        }}
                        onkeydown={(event) => {
                          if (["-", "+", "e", "E", "."].includes(event.key)) {
                            event.preventDefault();
                          }
                        }}
                        oninput={(event) => {
                          const target = event.target as HTMLInputElement | null;
                          updateNodeData(selectedNode.id, {
                            riStart: toInt(target?.value ?? "0"),
                          });
                        }}
                      />
                      <label class="inspector-inline-label" for="ri-shift">Shift</label>
                      <input
                        id="ri-shift"
                        class="inspector-input inspector-input--compact inspector-input--inline"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        step="1"
                        value={selectedNode.data.riShift ?? 0}
                        disabled={isReadOnly && locked}
                        onwheel={(event) => {
                          event.preventDefault();
                          (event.currentTarget as HTMLInputElement).blur();
                        }}
                        onkeydown={(event) => {
                          if (["-", "+", "e", "E", "."].includes(event.key)) {
                            event.preventDefault();
                          }
                        }}
                        oninput={(event) => {
                          const target = event.target as HTMLInputElement | null;
                          updateNodeData(selectedNode.id, {
                            riShift: toInt(target?.value ?? "0"),
                          });
                        }}
                      />
                      <button
                        type="button"
                        class={`inspector-toggle ${locked ? "is-locked" : ""}`}
                        disabled={isReadOnly}
                        onclick={() => updateNodeData(selectedNode.id, { riLocked: !locked })}
                      >
                        {locked ? "fixed" : "open"}
                      </button>
                    </div>
                    {#if isReadOnly}
                      <div class="inspector-hint">
                        {locked
                          ? "RI fixed — locked in network particle."
                          : "RI open — editable for runs."}
                      </div>
                    {/if}
                  </div>
                  <div class="inspector-section">
                    <div class="inspector-section-title">Transformations</div>
                    <div class="inspector-transform-list">
                      {#each selectedNode.data.transformations ?? [] as transformation, index (transformation.id)}
                        {@const isNetwork = transformation.status === "network"}
                        <div class="inspector-transform-row">
                          <div class="inspector-transform-fields">
                            <input
                              class="inspector-input inspector-input--compact"
                              value={transformation.name}
                              disabled={isNetwork || isReadOnly}
                              oninput={(event) => {
                                const target = event.target as HTMLInputElement | null;
                                const name = target?.value ?? "";
                                updateTransformationAt(selectedNode.id, index, { name });
                              }}
                            />
                            <input
                              class="inspector-input inspector-input--compact inspector-input--args"
                              value={transformation.args.join(", ")}
                              disabled={isReadOnly}
                              oninput={(event) => {
                                const target = event.target as HTMLInputElement | null;
                                const args = parseArgsInput(target?.value ?? "");
                                updateTransformationAt(selectedNode.id, index, { args });
                              }}
                            />
                          </div>
                          <div class="inspector-transform-meta">
                            <span class="inspector-tag">
                              {isNetwork ? "Network" : "Draft"}
                            </span>
                            <div class="inspector-transform-actions">
                              <button
                                type="button"
                                class="inspector-edit"
                                onclick={() =>
                                  openTransformationEditor(selectedNode.id, index, transformation)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                class="inspector-remove"
                                disabled={isReadOnly}
                                onclick={() => removeTransformationAt(selectedNode.id, index)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      {/each}
                      <button
                        type="button"
                        class="inspector-action"
                        disabled={isReadOnly}
                        onclick={() => appendTransformation(selectedNode.id)}
                      >
                        Add transformation
                      </button>
                    </div>
                  </div>
                {/if}
                {#if selectedNode.data.kind === "condition"}
                  <div class="inspector-section">
                    <div class="inspector-section-title">Condition code</div>
                    <div class="inspector-hint">
                      Edit the Solidity snippet that will be published for this condition.
                    </div>
                    <button
                      type="button"
                      class="inspector-action"
                      onclick={() => openConditionEditor(selectedNode)}
                    >
                      Edit condition code
                    </button>
                  </div>
                {/if}
                {#if selectedNode.data.kind === "particle" && selectedNode.data.particleId}
                  <button
                    type="button"
                    class="inspector-action"
                    onclick={() => openParticleTab(selectedNode.data.particleId!)}
                  >
                    Open particle tab
                  </button>
                {/if}
              {:else}
                <div class="inspector-row">
                  <span>Context</span>
                  <span>Current tab</span>
                </div>
              {/if}
              <div class="inspector-row">
                <span>Status</span>
                <span>{getNodeStatusLabel(inspectorNode)}</span>
              </div>
              <div class="inspector-row">
                <span>Type</span>
                <span>{inspectorNode.data.kind}</span>
              </div>
              <div class="inspector-row">
                <span>Name</span>
                <span>{inspectorNode.data.label}</span>
              </div>
              {#if inspectorNode.data.particleId}
                <div class="inspector-row">
                  <span>Particle</span>
                  <span>{inspectorNode.data.particleId}</span>
                </div>
              {/if}
              {#if inspectorNode.data.sourceId}
                <div class="inspector-row">
                  <span>Source</span>
                  <span>{inspectorNode.data.sourceId}</span>
                </div>
              {/if}
              {#if inspectorNode.data.viewId}
                <div class="inspector-row">
                  <span>View</span>
                  <span>{inspectorNode.data.viewId}</span>
                </div>
              {/if}
              {#if activeRunOutput}
                <div class="inspector-section">
                  <div class="inspector-section-title">Last run</div>
                  <div class="inspector-row">
                    <span>Streams</span>
                    <span>{activeRunOutput.length}</span>
                  </div>
                  {#if activeRunTimestamp}
                    <div class="inspector-row">
                      <span>Ran</span>
                      <span>{new Date(activeRunTimestamp).toLocaleTimeString()}</span>
                    </div>
                  {/if}
                  {#if activeRunWarnings.length}
                    <div class="inspector-alert">
                      <div class="inspector-alert-text">{activeRunWarnings.join("; ")}</div>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if activeCompileTimestamp}
                <div class="inspector-section">
                  <div class="inspector-section-title">Last compile</div>
                  <div class="inspector-row">
                    <span>Ran</span>
                    <span>{new Date(activeCompileTimestamp).toLocaleTimeString()}</span>
                  </div>
                  {#if activeCompileWarnings.length}
                    <div class="inspector-alert">
                      <div class="inspector-alert-text">
                        {activeCompileWarnings.join("; ")}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if activeDeployTimestamp}
                <div class="inspector-section">
                  <div class="inspector-section-title">Last deploy</div>
                  <div class="inspector-row">
                    <span>Ran</span>
                    <span>{new Date(activeDeployTimestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              {/if}
            {:else}
              <div class="inspector-empty">Select a node to view details.</div>
            {/if}
          {:else}
            <div class="inspector-section">
              <div class="inspector-section-title">Chain deploy request preview</div>
              <div class="inspector-hint">
                Edit this JSON to update the Studio flow. Valid changes are applied immediately.
              </div>
              <div class="inspector-api-controls">
                <label class="inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={apiEditorLiveApply}
                    onchange={(event) => {
                      const target = event.target as HTMLInputElement | null;
                      apiEditorLiveApply = Boolean(target?.checked);
                      if (apiEditorLiveApply) {
                        handleApiEditorInput(apiEditorText);
                      }
                    }}
                  />
                  <span>Live apply</span>
                </label>
                <button
                  type="button"
                  class="inspector-edit"
                  onclick={applyApiEditorNow}
                  disabled={apiEditorLiveApply}
                >
                  Apply JSON
                </button>
              </div>
              <textarea
                class="inspector-json-editor"
                value={apiEditorText}
                spellcheck="false"
                onfocus={() => {
                  apiEditorFocused = true;
                }}
                onblur={() => {
                  apiEditorFocused = false;
                }}
                oninput={(event) => {
                  const target = event.target as HTMLTextAreaElement | null;
                  handleApiEditorInput(target?.value ?? "");
                }}
              ></textarea>
              {#if apiEditorError}
                <div class="inspector-alert">
                  <div class="inspector-alert-text">{apiEditorError}</div>
                </div>
              {:else if apiEditorStatus}
                <div class="inspector-hint">{apiEditorStatus}</div>
              {/if}
            </div>
            <div class="inspector-section">
              <div class="inspector-section-title">Deploy trace</div>
              <div class="inspector-hint">
                Endpoint-by-endpoint responses from the latest deploy attempt.
              </div>
              {#if deployTraceEntries.length === 0}
                <div class="inspector-empty">No deploy trace yet.</div>
              {:else}
                <div class="deploy-trace-list">
                  {#each deployTraceEntries as entry (entry.id)}
                    <div class="deploy-trace-item">
                      <div class="deploy-trace-head">
                        <span class={`deploy-trace-badge ${entry.ok ? "is-ok" : "is-error"}`}>
                          {entry.ok ? "OK" : "ERR"}
                        </span>
                        <code>{entry.method} {entry.path}</code>
                        <span class="deploy-trace-status">
                          {entry.responseStatus ?? "n/a"}
                        </span>
                      </div>
                      <div class="deploy-trace-block">
                        <div class="deploy-trace-label">Request body</div>
                        <pre class="deploy-trace-json">{JSON.stringify(
                            entry.requestBody,
                            null,
                            2,
                          )}</pre>
                      </div>
                      <div class="deploy-trace-block">
                        <div class="deploy-trace-label">Response body</div>
                        <pre class="deploy-trace-json">{JSON.stringify(
                            entry.responseBody,
                            null,
                            2,
                          )}</pre>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </DockPanel>
  {/if}

  {#if rightMode === "both"}
    <DockPanel title="Inspector + Assistant" position="right" onHide={hideRightPanel}>
      <div class="right-panel-content">
        <div class="right-panel-controls">
          <button
            type="button"
            class={`right-panel-icon ${assistantVisible ? "is-active" : ""}`}
            aria-label="Toggle assistant panel"
            onclick={toggleAssistant}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v10H8l-4 4z"></path>
              <path d="M8 10h8M8 13h6"></path>
            </svg>
          </button>
          <button
            type="button"
            class={`right-panel-icon ${inspectorVisible ? "is-active" : ""}`}
            aria-label="Toggle inspector panel"
            onclick={toggleInspector}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7"></circle>
              <path d="M12 11v5"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </button>
        </div>
        <div class="right-split">
          <div class="right-section">
            <div class="right-section-body">
              <div class="inspector">
                <div class="inspector-header">
                  <div class="inspector-tabs" role="tablist" aria-label="Inspector views">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inspectorTab === "node"}
                      class={`inspector-tab ${inspectorTab === "node" ? "is-active" : ""}`}
                      onclick={() => {
                        inspectorTab = "node";
                      }}
                    >
                      Node
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inspectorTab === "api"}
                      class={`inspector-tab ${inspectorTab === "api" ? "is-active" : ""}`}
                      onclick={() => {
                        inspectorTab = "api";
                      }}
                    >
                      API
                    </button>
                  </div>
                </div>
                {#if inspectorTab === "node"}
                  {#if inspectorNode}
                    {#if selectedNode}
                      {@const isReadOnly = selectedNode.data.fromNetwork}
                      <label class="inspector-label" for="node-name-split">Name</label>
                      <input
                        id="node-name-split"
                        class="inspector-input"
                        value={nameDraft}
                        disabled={isReadOnly}
                        oninput={(event) => {
                          const target = event.target as HTMLInputElement | null;
                          nameDraft = target?.value ?? "";
                        }}
                        onblur={() => commitNameChange(selectedNode)}
                        onkeydown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitNameChange(selectedNode);
                          }
                        }}
                      />
                      {#if pendingNameCollision && pendingNameCollision.nodeId === selectedNode.id}
                        <div class="inspector-alert">
                          <div class="inspector-alert-text">
                            “{pendingNameCollision.desiredName}” already exists in the network.
                          </div>
                          <div class="inspector-alert-actions">
                            <button type="button" onclick={applyNameCollisionUseExisting}>
                              Use existing
                            </button>
                            <button type="button" onclick={applyNameCollisionCreateNew}>
                              Create new
                            </button>
                          </div>
                        </div>
                      {/if}
                      {#if selectedNode.data.kind === "feature"}
                        <label class="inspector-label" for="node-dimensions-split">Dimensions</label
                        >
                        <input
                          id="node-dimensions-split"
                          class="inspector-input"
                          type="number"
                          min="1"
                          value={dimensionDraft ?? 1}
                          disabled={isReadOnly}
                          oninput={(event) => {
                            const target = event.target as HTMLInputElement | null;
                            dimensionDraft = target ? Number(target.value) : 1;
                          }}
                          onchange={() => {
                            if (dimensionDraft !== null) {
                              requestDimensionChange(selectedNode.id, dimensionDraft);
                            }
                          }}
                        />
                        {#if pendingDimensionChange && pendingDimensionChange.nodeId === selectedNode.id}
                          <div class="inspector-alert">
                            <div class="inspector-alert-text">
                              Removing dimensions will delete {pendingDimensionChange
                                .removedDimensions.length}
                              dimension(s) with transformations. Continue?
                            </div>
                            <div class="inspector-alert-actions">
                              <button type="button" onclick={confirmDimensionRemoval}>
                                Remove
                              </button>
                              <button type="button" onclick={cancelDimensionRemoval}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        {/if}
                      {/if}
                      {#if selectedNode.data.kind === "dimension"}
                        {@const locked = selectedNode.data.riLocked ?? false}
                        <div class="inspector-section">
                          <div class="inspector-section-title">Running instance</div>
                          <div class="inspector-inline">
                            <label class="inspector-inline-label" for="ri-start-split">Start</label>
                            <input
                              id="ri-start-split"
                              class="inspector-input inspector-input--compact inspector-input--inline"
                              type="number"
                              inputmode="numeric"
                              min="0"
                              step="1"
                              value={selectedNode.data.riStart ?? 0}
                              disabled={isReadOnly && locked}
                              onwheel={(event) => {
                                event.preventDefault();
                                (event.currentTarget as HTMLInputElement).blur();
                              }}
                              onkeydown={(event) => {
                                if (["-", "+", "e", "E", "."].includes(event.key)) {
                                  event.preventDefault();
                                }
                              }}
                              oninput={(event) => {
                                const target = event.target as HTMLInputElement | null;
                                updateNodeData(selectedNode.id, {
                                  riStart: toInt(target?.value ?? "0"),
                                });
                              }}
                            />
                            <label class="inspector-inline-label" for="ri-shift-split">Shift</label>
                            <input
                              id="ri-shift-split"
                              class="inspector-input inspector-input--compact inspector-input--inline"
                              type="number"
                              inputmode="numeric"
                              min="0"
                              step="1"
                              value={selectedNode.data.riShift ?? 0}
                              disabled={isReadOnly && locked}
                              onwheel={(event) => {
                                event.preventDefault();
                                (event.currentTarget as HTMLInputElement).blur();
                              }}
                              onkeydown={(event) => {
                                if (["-", "+", "e", "E", "."].includes(event.key)) {
                                  event.preventDefault();
                                }
                              }}
                              oninput={(event) => {
                                const target = event.target as HTMLInputElement | null;
                                updateNodeData(selectedNode.id, {
                                  riShift: toInt(target?.value ?? "0"),
                                });
                              }}
                            />
                            <button
                              type="button"
                              class={`inspector-toggle ${locked ? "is-locked" : ""}`}
                              disabled={isReadOnly}
                              onclick={() => updateNodeData(selectedNode.id, { riLocked: !locked })}
                            >
                              {locked ? "fixed" : "open"}
                            </button>
                          </div>
                          {#if isReadOnly}
                            <div class="inspector-hint">
                              {locked
                                ? "RI fixed — locked in network particle."
                                : "RI open — editable for runs."}
                            </div>
                          {/if}
                        </div>
                        <div class="inspector-section">
                          <div class="inspector-section-title">Transformations</div>
                          <div class="inspector-transform-list">
                            {#each selectedNode.data.transformations ?? [] as transformation, index (transformation.id)}
                              {@const isNetwork = transformation.status === "network"}
                              <div class="inspector-transform-row">
                                <div class="inspector-transform-fields">
                                  <input
                                    class="inspector-input inspector-input--compact"
                                    value={transformation.name}
                                    disabled={isNetwork || isReadOnly}
                                    oninput={(event) => {
                                      const target = event.target as HTMLInputElement | null;
                                      const name = target?.value ?? "";
                                      updateTransformationAt(selectedNode.id, index, { name });
                                    }}
                                  />
                                  <input
                                    class="inspector-input inspector-input--compact inspector-input--args"
                                    value={transformation.args.join(", ")}
                                    disabled={isReadOnly}
                                    oninput={(event) => {
                                      const target = event.target as HTMLInputElement | null;
                                      const args = parseArgsInput(target?.value ?? "");
                                      updateTransformationAt(selectedNode.id, index, { args });
                                    }}
                                  />
                                </div>
                                <div class="inspector-transform-meta">
                                  <span class="inspector-tag">
                                    {isNetwork ? "Network" : "Draft"}
                                  </span>
                                  <div class="inspector-transform-actions">
                                    <button
                                      type="button"
                                      class="inspector-edit"
                                      onclick={() =>
                                        openTransformationEditor(
                                          selectedNode.id,
                                          index,
                                          transformation,
                                        )}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      class="inspector-remove"
                                      disabled={isReadOnly}
                                      onclick={() => removeTransformationAt(selectedNode.id, index)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            {/each}
                            <button
                              type="button"
                              class="inspector-action"
                              disabled={isReadOnly}
                              onclick={() => appendTransformation(selectedNode.id)}
                            >
                              Add transformation
                            </button>
                          </div>
                        </div>
                      {/if}
                      {#if selectedNode.data.kind === "condition"}
                        <div class="inspector-section">
                          <div class="inspector-section-title">Condition code</div>
                          <div class="inspector-hint">
                            Edit the Solidity snippet that will be published for this condition.
                          </div>
                          <button
                            type="button"
                            class="inspector-action"
                            onclick={() => openConditionEditor(selectedNode)}
                          >
                            Edit condition code
                          </button>
                        </div>
                      {/if}
                      {#if selectedNode.data.kind === "particle" && selectedNode.data.particleId}
                        <button
                          type="button"
                          class="inspector-action"
                          onclick={() => openParticleTab(selectedNode.data.particleId!)}
                        >
                          Open particle tab
                        </button>
                      {/if}
                    {:else}
                      <div class="inspector-row">
                        <span>Context</span>
                        <span>Current tab</span>
                      </div>
                    {/if}
                    <div class="inspector-row">
                      <span>Status</span>
                      <span>{getNodeStatusLabel(inspectorNode)}</span>
                    </div>
                    <div class="inspector-row">
                      <span>Type</span>
                      <span>{inspectorNode.data.kind}</span>
                    </div>
                    <div class="inspector-row">
                      <span>Name</span>
                      <span>{inspectorNode.data.label}</span>
                    </div>
                    {#if inspectorNode.data.particleId}
                      <div class="inspector-row">
                        <span>Particle</span>
                        <span>{inspectorNode.data.particleId}</span>
                      </div>
                    {/if}
                    {#if inspectorNode.data.sourceId}
                      <div class="inspector-row">
                        <span>Source</span>
                        <span>{inspectorNode.data.sourceId}</span>
                      </div>
                    {/if}
                    {#if inspectorNode.data.viewId}
                      <div class="inspector-row">
                        <span>View</span>
                        <span>{inspectorNode.data.viewId}</span>
                      </div>
                    {/if}
                    {#if activeRunOutput}
                      <div class="inspector-section">
                        <div class="inspector-section-title">Last run</div>
                        <div class="inspector-row">
                          <span>Streams</span>
                          <span>{activeRunOutput.length}</span>
                        </div>
                        {#if activeRunTimestamp}
                          <div class="inspector-row">
                            <span>Ran</span>
                            <span>{new Date(activeRunTimestamp).toLocaleTimeString()}</span>
                          </div>
                        {/if}
                        {#if activeRunWarnings.length}
                          <div class="inspector-alert">
                            <div class="inspector-alert-text">
                              {activeRunWarnings.join("; ")}
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                    {#if activeCompileTimestamp}
                      <div class="inspector-section">
                        <div class="inspector-section-title">Last compile</div>
                        <div class="inspector-row">
                          <span>Ran</span>
                          <span>{new Date(activeCompileTimestamp).toLocaleTimeString()}</span>
                        </div>
                        {#if activeCompileWarnings.length}
                          <div class="inspector-alert">
                            <div class="inspector-alert-text">
                              {activeCompileWarnings.join("; ")}
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                    {#if activeDeployTimestamp}
                      <div class="inspector-section">
                        <div class="inspector-section-title">Last deploy</div>
                        <div class="inspector-row">
                          <span>Ran</span>
                          <span>{new Date(activeDeployTimestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    {/if}
                  {:else}
                    <div class="inspector-empty">Select a node to view details.</div>
                  {/if}
                {:else}
                  <div class="inspector-section">
                    <div class="inspector-section-title">Chain deploy request preview</div>
                    <div class="inspector-hint">
                      Edit this JSON to update the Studio flow. Valid changes are applied
                      immediately.
                    </div>
                    <div class="inspector-api-controls">
                      <label class="inspector-checkbox">
                        <input
                          type="checkbox"
                          checked={apiEditorLiveApply}
                          onchange={(event) => {
                            const target = event.target as HTMLInputElement | null;
                            apiEditorLiveApply = Boolean(target?.checked);
                            if (apiEditorLiveApply) {
                              handleApiEditorInput(apiEditorText);
                            }
                          }}
                        />
                        <span>Live apply</span>
                      </label>
                      <button
                        type="button"
                        class="inspector-edit"
                        onclick={applyApiEditorNow}
                        disabled={apiEditorLiveApply}
                      >
                        Apply JSON
                      </button>
                    </div>
                    <textarea
                      class="inspector-json-editor"
                      value={apiEditorText}
                      spellcheck="false"
                      onfocus={() => {
                        apiEditorFocused = true;
                      }}
                      onblur={() => {
                        apiEditorFocused = false;
                      }}
                      oninput={(event) => {
                        const target = event.target as HTMLTextAreaElement | null;
                        handleApiEditorInput(target?.value ?? "");
                      }}
                    ></textarea>
                    {#if apiEditorError}
                      <div class="inspector-alert">
                        <div class="inspector-alert-text">{apiEditorError}</div>
                      </div>
                    {:else if apiEditorStatus}
                      <div class="inspector-hint">{apiEditorStatus}</div>
                    {/if}
                  </div>
                  <div class="inspector-section">
                    <div class="inspector-section-title">Deploy trace</div>
                    <div class="inspector-hint">
                      Endpoint-by-endpoint responses from the latest deploy attempt.
                    </div>
                    {#if deployTraceEntries.length === 0}
                      <div class="inspector-empty">No deploy trace yet.</div>
                    {:else}
                      <div class="deploy-trace-list">
                        {#each deployTraceEntries as entry (entry.id)}
                          <div class="deploy-trace-item">
                            <div class="deploy-trace-head">
                              <span class={`deploy-trace-badge ${entry.ok ? "is-ok" : "is-error"}`}>
                                {entry.ok ? "OK" : "ERR"}
                              </span>
                              <code>{entry.method} {entry.path}</code>
                              <span class="deploy-trace-status">
                                {entry.responseStatus ?? "n/a"}
                              </span>
                            </div>
                            <div class="deploy-trace-block">
                              <div class="deploy-trace-label">Request body</div>
                              <pre class="deploy-trace-json">{JSON.stringify(
                                  entry.requestBody,
                                  null,
                                  2,
                                )}</pre>
                            </div>
                            <div class="deploy-trace-block">
                              <div class="deploy-trace-label">Response body</div>
                              <pre class="deploy-trace-json">{JSON.stringify(
                                  entry.responseBody,
                                  null,
                                  2,
                                )}</pre>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
          <div class="right-section">
            <div class="right-section-body">
              <div class="assistant-placeholder">Agent assistant chat goes here.</div>
            </div>
          </div>
        </div>
      </div>
    </DockPanel>
  {/if}

  {#if bottomMode !== "hidden"}
    <DockPanel
      title="Utilities"
      position="bottom"
      inline
      onHide={() => hidePanel((mode) => (bottomMode = mode))}
    >
      <Button
        variant="subtle"
        ariaLabel="Clear canvas"
        title="Clear canvas"
        className="icon-btn"
        onclick={requestClearCanvas}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16"></path>
          <path d="M9 7V5h6v2"></path>
          <path d="M7 7l1 12h8l1-12"></path>
        </svg>
      </Button>
      <Button
        variant="subtle"
        ariaLabel="Auto layout"
        title="Auto layout"
        className="icon-btn"
        onclick={handleAutoLayout}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6"></rect>
          <rect x="14" y="4" width="6" height="6"></rect>
          <rect x="4" y="14" width="6" height="6"></rect>
          <rect x="14" y="14" width="6" height="6"></rect>
        </svg>
      </Button>
      <Button
        variant="subtle"
        ariaLabel="Zoom to fit"
        title="Zoom to fit"
        className="icon-btn"
        onclick={handleZoomToFit}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
          <path d="M9 9h6v6H9z"></path>
        </svg>
      </Button>
      <Button
        variant="subtle"
        ariaLabel="Hide all panels"
        title="Hide all panels (\\)"
        className="icon-btn"
        onclick={toggleAllPanels}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"></path>
          <path d="M4 4l16 16"></path>
        </svg>
      </Button>
    </DockPanel>
  {/if}

  {#if bottomMode === "hidden"}
    <button
      class="panel-tab panel-tab--bottom"
      type="button"
      title="Utilities panel (B)"
      aria-label="Utilities panel"
      onclick={() => showPanel((m) => (bottomMode = m))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h16"></path>
        <path d="M7 8h4M13 16h4"></path>
      </svg>
    </button>
  {/if}

  {#if leftMode === "hidden"}
    <button
      class="panel-tab panel-tab--left"
      type="button"
      title="Add element panel ([)"
      aria-label="Add element panel"
      onclick={() => showPanel((m) => (leftMode = m))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="6" width="14" height="12" rx="2"></rect>
        <path d="M9 10h6M9 14h6"></path>
      </svg>
    </button>
  {/if}

  {#if rightMode === "hidden"}
    <div class="panel-tab-stack panel-tab-stack--right">
      <button
        class="panel-tab"
        type="button"
        title="Assistant panel (])"
        aria-label="Assistant panel"
        onclick={toggleAssistant}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v10H8l-4 4z"></path>
          <path d="M8 10h8M8 13h6"></path>
        </svg>
      </button>
      <button
        class="panel-tab"
        type="button"
        title="Inspector panel"
        aria-label="Inspector panel"
        onclick={toggleInspector}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7"></circle>
          <path d="M12 11v5"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </button>
    </div>
  {/if}

  {#if transformationEditorOpen}
    <div class="confirm-overlay" role="dialog" aria-modal="true">
      <div class="editor-modal">
        <div class="editor-header">
          <div class="editor-title">Edit transformation</div>
          <div class="editor-header-actions">
            <span class="editor-status">
              {transformationEditorStatus === "network" ? "Network" : "Draft"}
            </span>
            {#if transformationEditorStatus === "network" && !transformationEditorLocked}
              <button type="button" class="editor-fork" onclick={forkTransformationEditor}>
                Fork as draft
              </button>
            {/if}
            <button type="button" class="editor-close" onclick={closeTransformationEditor}>
              Close
            </button>
          </div>
        </div>
        <div class="editor-fields">
          <label class="editor-label" for="tx-name">Name</label>
          <input
            id="tx-name"
            class="editor-input"
            value={transformationDraftName}
            disabled={transformationEditorReadOnly}
            oninput={(event) => {
              const target = event.target as HTMLInputElement | null;
              transformationDraftName = target?.value ?? "";
              transformationDraftError = null;
            }}
          />
          <label class="editor-label" for="tx-args">Args (comma-separated)</label>
          <input
            id="tx-args"
            class="editor-input"
            value={transformationDraftArgs}
            disabled={transformationEditorReadOnly}
            oninput={(event) => {
              const target = event.target as HTMLInputElement | null;
              transformationDraftArgs = target?.value ?? "";
            }}
          />
          {#if transformationArgsWarning}
            <div class="editor-hint">{transformationArgsWarning}</div>
          {/if}
          {#if transformationDraftError}
            <div class="editor-error">{transformationDraftError}</div>
          {/if}
        </div>
        <div class="editor-shell">
          <SolidityEditorShell
            template={transformationTemplate}
            bind:value={transformationDraftCode}
            readOnly={transformationEditorReadOnly}
          />
        </div>
        <div class="editor-actions">
          <button type="button" onclick={closeTransformationEditor}>Cancel</button>
          <button
            type="button"
            class="primary"
            disabled={transformationEditorReadOnly}
            onclick={saveTransformationEditor}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if conditionEditorOpen}
    <div class="confirm-overlay" role="dialog" aria-modal="true">
      <div class="editor-modal">
        <div class="editor-header">
          <div class="editor-title">Edit condition</div>
          <div class="editor-header-actions">
            <span class="editor-status"
              >{conditionEditorStatus === "network" ? "Network" : "Draft"}</span
            >
            {#if conditionEditorStatus === "network" && !conditionEditorLocked}
              <button type="button" class="editor-fork" onclick={forkConditionEditor}>
                Fork as draft
              </button>
            {/if}
            <button type="button" class="editor-close" onclick={closeConditionEditor}>Close</button>
          </div>
        </div>
        <div class="editor-fields">
          <label class="editor-label" for="condition-name">Name</label>
          <input
            id="condition-name"
            class="editor-input"
            value={conditionDraftName}
            disabled={conditionEditorReadOnly}
            oninput={(event) => {
              const target = event.target as HTMLInputElement | null;
              conditionDraftName = target?.value ?? "";
              conditionDraftError = null;
            }}
          />
          {#if conditionArgsInfo}
            <div class="editor-hint">{conditionArgsInfo}</div>
          {/if}
          {#if conditionDraftError}
            <div class="editor-error">{conditionDraftError}</div>
          {/if}
        </div>
        <div class="editor-shell">
          <SolidityEditorShell
            template={conditionTemplate}
            bind:value={conditionDraftCode}
            readOnly={conditionEditorReadOnly}
          />
        </div>
        <div class="editor-actions">
          <button type="button" onclick={closeConditionEditor}>Cancel</button>
          <button
            type="button"
            class="primary"
            disabled={conditionEditorReadOnly}
            onclick={saveConditionEditor}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if clearConfirmOpen}
    <div class="confirm-overlay" role="dialog" aria-modal="true">
      <div class="confirm-modal">
        <div class="confirm-title">Clear canvas?</div>
        <div class="confirm-text">
          This will remove all nodes and connections from the current particle tab.
        </div>
        <div class="confirm-actions">
          <button type="button" onclick={cancelClearCanvas}>Cancel</button>
          <button type="button" class="danger" onclick={confirmClearCanvas}>Clear</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .studio {
    @apply relative h-[calc(100vh-4rem)] w-full grid gap-0;
    grid-template-columns: var(--left-size) minmax(0, 1fr) var(--right-size);
    grid-template-rows: var(--top-size) minmax(0, 1fr) var(--bottom-size);
    grid-template-areas:
      "top top top"
      "left canvas right"
      "bottom bottom bottom";
  }

  .top-stack {
    grid-area: top;
    @apply flex flex-col border-b border-white/10 bg-black/80;
  }

  .canvas {
    grid-area: canvas;
    @apply relative min-h-0 bg-black flex flex-col;
  }

  .tab-bar {
    @apply flex items-center gap-2 px-3 py-2;
  }

  .top-action-group {
    @apply flex flex-wrap items-center gap-2;
  }

  .top-run-group {
    @apply flex items-center gap-2;
  }

  .top-deploy-group {
    @apply flex items-center gap-2;
  }

  .run-label {
    @apply text-[0.55rem] uppercase tracking-[0.2em] text-white/50;
  }

  .run-input {
    @apply w-14 rounded-md border border-white/10 bg-black/60 px-2 py-1
      text-[0.7rem] text-white/80 outline-none focus:border-emerald-400/60;
  }

  .top-action-divider {
    @apply h-5 w-px bg-white/10 mx-1 self-stretch;
  }

  .tab {
    @apply rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[0.6rem]
      uppercase tracking-[0.2em] text-white/60 hover:border-white/30 hover:text-white;
    @apply inline-flex items-center gap-2;
  }

  .tab.is-active {
    @apply border-emerald-400/40 bg-emerald-500/10 text-emerald-200;
  }

  .tab-button {
    @apply inline-flex items-center gap-2 text-left;
  }

  .tab-label {
    @apply text-left;
  }

  .tab-status {
    @apply rounded-full border border-white/10 px-2 py-[0.1rem] text-[0.5rem]
      uppercase tracking-[0.2em] text-white/50;
  }

  .tab-status.is-draft {
    @apply border-white/10 text-white/40;
  }

  .tab-status.is-network {
    @apply border-emerald-400/40 text-emerald-200;
  }

  .tab-rename {
    @apply w-40 rounded-md border border-emerald-400/50 bg-black/80 px-2 py-1
      text-[0.6rem] uppercase tracking-[0.2em] text-emerald-200 outline-none;
  }

  .tab-add {
    @apply ml-auto w-8 justify-center px-0 text-white/70;
  }

  .tab-close {
    @apply inline-flex h-4 w-4 items-center justify-center rounded-full
      border border-white/10 text-white/60
      hover:border-white/30 hover:text-white;
  }

  .tab-close-icon {
    @apply h-3 w-3;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
  }

  .flow-area {
    @apply min-h-0 flex-1;
  }

  .studio :global(.svelte-flow) {
    @apply h-full w-full;
  }

  .studio > :global(.dock--left) {
    grid-area: left;
  }

  .studio > :global(.dock--right) {
    grid-area: right;
  }

  .studio > :global(.dock--bottom) {
    grid-area: bottom;
  }

  .left-panel {
    @apply flex flex-col gap-2 min-h-0;
  }

  .source-tabs {
    @apply flex border-b border-white/10;
  }

  .source-tab {
    @apply px-3 py-2 text-[0.6rem] uppercase tracking-[0.24em]
      text-white/60 border border-white/10 border-b-0
      bg-black/30;
    margin-bottom: -1px;
  }

  .source-tab + .source-tab {
    margin-left: -1px;
  }

  .source-tab.is-active {
    @apply text-white border-white/30 bg-black/80;
    border-bottom-color: transparent;
  }

  .left-tabs {
    @apply flex items-center gap-1;
  }

  .left-tabs-track {
    @apply flex items-center gap-1;
    overflow-x: auto;
    scroll-behavior: smooth;
    scrollbar-width: none;
  }

  .left-tabs-track::-webkit-scrollbar {
    display: none;
  }

  .left-tabs-track :global(.btn) {
    @apply px-2 py-1 text-[0.55rem] uppercase tracking-[0.18em] inline-flex items-center justify-center gap-1;
    flex: 0 0 auto;
  }

  .scroll-arrow {
    @apply h-6 w-6 flex items-center justify-center
      rounded-md border border-white/10 bg-white/5
      text-white/60 hover:text-white hover:border-white/30;
    flex: 0 0 auto;
  }

  .info-dot {
    @apply relative inline-flex items-center justify-center
      h-4 w-4 rounded-full border border-white/20
      text-[0.55rem] font-semibold text-white/60
      hover:text-white hover:border-white/40;
  }

  .info-dot::after {
    content: attr(data-tooltip);
    @apply fixed z-[60] opacity-0 pointer-events-none
      rounded-md border border-white/10 bg-black/90
      px-2 py-1 text-[0.6rem] normal-case tracking-normal text-white/80;
    width: max-content;
    max-width: 240px;
    left: var(--tooltip-x);
    top: var(--tooltip-y);
    transform: translateY(-100%);
    transition:
      opacity 150ms ease,
      transform 150ms ease;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.45);
  }

  .info-dot:hover::after,
  .info-dot:focus-visible::after {
    opacity: 1;
    transform: translateY(-100%);
  }

  .list-header {
    @apply flex items-center gap-2 text-white/70;
  }

  .list-title {
    @apply text-[0.7rem] uppercase tracking-[0.28em] text-white/70;
  }

  .studio :global(.svelte-flow__node) {
    @apply rounded-md border border-white/15 bg-black/80 text-white/80;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.45);
    background-color: rgba(6, 8, 12, 0.85) !important;
    color: rgba(255, 255, 255, 0.85) !important;
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  .studio :global(.svelte-flow__node.selected) {
    @apply border-emerald-400/60 text-emerald-200;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 16px 28px rgba(0, 0, 0, 0.5);
    border-color: rgba(52, 211, 153, 0.6) !important;
    color: rgba(167, 243, 208, 0.95) !important;
  }

  .studio :global(.svelte-flow__node .svelte-flow__node-content) {
    @apply text-[0.7rem] font-semibold tracking-[0.08em];
  }

  .studio :global(.dock--top .btn),
  .studio :global(.dock--bottom .btn) {
    @apply px-2 py-1 text-xs;
  }

  .studio :global(.icon-btn) {
    @apply rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white;
  }

  .studio :global(.icon-btn svg) {
    @apply h-4 w-4;
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .studio :global(.dock--top .dock-title),
  .studio :global(.dock--bottom .dock-title) {
    @apply text-[0.55rem];
  }

  .inspector {
    @apply rounded-md border border-white/10 bg-black/60 p-3 text-white/70;
  }

  .inspector-header {
    @apply flex items-center justify-between;
  }

  .inspector-tabs {
    @apply inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/70 p-1;
  }

  .inspector-tab {
    @apply rounded-md px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/45 hover:text-white/80;
  }

  .inspector-tab.is-active {
    @apply border border-white/15 bg-white/10 text-white/90;
  }

  .inspector-title {
    @apply text-[0.55rem] uppercase tracking-[0.24em] text-white/60;
  }

  .inspector-label {
    @apply mt-2 text-[0.6rem] uppercase tracking-[0.24em] text-white/50;
  }

  .inspector-input {
    @apply mt-1 w-full rounded-md border border-white/10 bg-black/60 px-2 py-1
      text-sm text-white/80 outline-none focus:border-emerald-400/60;
  }

  .inspector-input--compact {
    @apply mt-0 text-[0.7rem];
  }

  .inspector-input--inline {
    @apply mt-0 w-16;
  }

  .inspector-inline {
    @apply flex flex-wrap items-center gap-2;
  }

  .inspector-inline-label {
    @apply text-[0.55rem] uppercase tracking-[0.2em] text-white/40;
  }

  .inspector-toggle {
    @apply rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.18em] text-white/60 hover:border-white/30 hover:text-white;
  }

  .inspector-toggle.is-locked {
    @apply border-emerald-400/40 text-emerald-200;
  }

  .inspector-section {
    @apply mt-3 flex flex-col gap-2 rounded-md border border-white/10 bg-black/70 p-2;
  }

  .inspector-section-title {
    @apply text-[0.55rem] uppercase tracking-[0.22em] text-white/50;
  }

  .inspector-hint {
    @apply text-[0.6rem] text-white/45;
  }

  .inspector-transform-list {
    @apply flex flex-col gap-2;
  }

  .inspector-transform-row {
    @apply flex flex-col gap-2;
  }

  .inspector-transform-fields {
    @apply flex items-center gap-2;
  }

  .inspector-transform-fields .inspector-input {
    @apply flex-1 min-w-[6rem];
  }

  .inspector-input--args {
    @apply w-24 flex-none text-[0.65rem];
  }

  .inspector-transform-meta {
    @apply flex items-center justify-between gap-2;
  }

  .inspector-tag {
    @apply rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.55rem]
      uppercase tracking-[0.18em] text-white/60;
    flex: 0 0 auto;
  }

  .inspector-transform-actions {
    @apply flex items-center gap-1;
  }

  .inspector-edit {
    @apply rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.18em] text-white/60 hover:border-white/30 hover:text-white;
    flex: 0 0 auto;
  }

  .inspector-remove {
    @apply rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.18em] text-white/60 hover:border-white/30 hover:text-white;
    flex: 0 0 auto;
  }

  .inspector-row {
    @apply mt-2 flex items-center justify-between text-[0.7rem] text-white/80;
  }

  .inspector-row span:last-child {
    @apply text-white/90;
  }

  .inspector-action {
    @apply mt-2 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[0.6rem]
      uppercase tracking-[0.18em] text-white/70 hover:border-white/30 hover:text-white;
  }

  .inspector-alert {
    @apply mt-2 rounded-md border border-white/10 bg-black/80 p-2 text-[0.65rem] text-white/70;
  }

  .inspector-alert-text {
    @apply text-white/70;
  }

  .inspector-alert-actions {
    @apply mt-2 flex items-center gap-2;
  }

  .inspector-alert-actions button {
    @apply rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em]
      text-white/70 hover:border-white/30 hover:text-white;
  }

  .inspector-empty {
    @apply mt-2 text-[0.65rem] text-white/50;
  }

  .inspector-json {
    @apply mt-2 max-h-[26rem] overflow-auto rounded-md border border-white/10 bg-black/80 p-2 text-[0.65rem] leading-5 text-emerald-100/90;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .inspector-json-editor {
    @apply mt-2 min-h-[18rem] w-full resize-y rounded-md border border-white/10 bg-black/80 p-2
      text-[0.65rem] leading-5 text-emerald-100/90 outline-none focus:border-emerald-400/50;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
      monospace;
    white-space: pre;
  }

  .inspector-api-controls {
    @apply mt-2 flex items-center justify-between gap-2;
  }

  .inspector-checkbox {
    @apply inline-flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.16em] text-white/60;
  }

  .inspector-checkbox input {
    accent-color: rgb(16 185 129);
  }

  .deploy-trace-list {
    @apply mt-2 flex max-h-[28rem] flex-col gap-2 overflow-auto pr-1;
  }

  .deploy-trace-item {
    @apply rounded-md border border-white/10 bg-black/80 p-2;
  }

  .deploy-trace-head {
    @apply flex flex-wrap items-center gap-2 text-[0.65rem] text-white/80;
  }

  .deploy-trace-head code {
    @apply rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.6rem] text-emerald-100/90;
    word-break: break-all;
  }

  .deploy-trace-badge {
    @apply inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.5rem] uppercase tracking-[0.18em];
  }

  .deploy-trace-badge.is-ok {
    @apply border-emerald-400/40 bg-emerald-400/10 text-emerald-200;
  }

  .deploy-trace-badge.is-error {
    @apply border-rose-400/40 bg-rose-400/10 text-rose-200;
  }

  .deploy-trace-status {
    @apply ml-auto rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.55rem] text-white/70;
  }

  .deploy-trace-block {
    @apply mt-2;
  }

  .deploy-trace-label {
    @apply mb-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/45;
  }

  .deploy-trace-json {
    @apply max-h-40 overflow-auto rounded-md border border-white/10 bg-black/90 p-2 text-[0.6rem] leading-5 text-white/80;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .assistant-placeholder {
    @apply mt-4 text-[0.8rem] text-white/60;
  }

  .right-split {
    @apply flex h-full flex-col gap-3;
  }

  .right-section {
    @apply flex min-h-0 flex-1 flex-col rounded-md border border-white/10 bg-black/70 p-2;
  }

  .right-section-body {
    @apply mt-2 min-h-0 flex-1 overflow-auto;
  }

  .right-panel-content {
    @apply h-full flex flex-col;
  }

  .right-panel-controls {
    @apply flex items-center justify-end gap-2 border-b border-white/10 pb-3;
  }

  .right-panel-icon {
    @apply inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10
      text-white/60 hover:border-white/40 hover:text-white;
  }

  .right-panel-icon.is-active {
    @apply border-emerald-400/60 text-emerald-200;
  }

  .right-panel-icon svg {
    @apply h-4 w-4;
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .panel-tab {
    @apply grid place-items-center rounded-md border border-white/15 bg-black/80
      h-7 w-7 text-white/60 hover:text-white hover:border-white/30;
  }

  .panel-tab svg {
    @apply h-4 w-4;
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .panel-tab--top {
    @apply absolute z-20 top-2;
    left: 50%;
    transform: translateX(-50%);
  }

  .panel-tab--bottom {
    @apply absolute z-20 bottom-2 left-1/2 -translate-x-1/2;
  }

  .panel-tab--left {
    @apply absolute z-20 top-1/2 left-2 -translate-y-1/2;
  }

  .panel-tab-stack {
    @apply absolute z-20 flex flex-col gap-2;
  }

  .panel-tab-stack--right {
    @apply top-1/2 right-2 -translate-y-1/2;
  }

  .confirm-overlay {
    @apply absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm;
  }

  .confirm-modal {
    @apply w-[min(320px,90vw)] rounded-md border border-white/10 bg-black/90 p-4 text-white/80;
  }

  .confirm-title {
    @apply text-[0.7rem] uppercase tracking-[0.24em] text-white/70;
  }

  .confirm-text {
    @apply mt-2 text-[0.8rem] text-white/70;
  }

  .confirm-actions {
    @apply mt-4 flex items-center justify-end gap-2;
  }

  .confirm-actions button {
    @apply rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[0.6rem]
      uppercase tracking-[0.18em] text-white/70 hover:border-white/30 hover:text-white;
  }

  .confirm-actions .danger {
    @apply border-rose-500/40 text-rose-200 hover:border-rose-400/70;
  }

  .editor-modal {
    @apply w-[min(840px,94vw)] max-h-[90vh] rounded-md border border-white/10 bg-black/90
      p-4 text-white/80 flex flex-col gap-3;
    min-height: 70vh;
  }

  .editor-header {
    @apply flex items-center justify-between;
  }

  .editor-header-actions {
    @apply flex items-center gap-2;
  }

  .editor-title {
    @apply text-[0.7rem] uppercase tracking-[0.24em] text-white/70;
  }

  .editor-status {
    @apply rounded-full border border-white/10 px-2 py-0.5 text-[0.5rem]
      uppercase tracking-[0.2em] text-white/50;
  }

  .editor-fork {
    @apply rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.18em] text-white/60 hover:border-white/30 hover:text-white;
  }

  .editor-close {
    @apply rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.18em] text-white/60 hover:border-white/30 hover:text-white;
  }

  .editor-fields {
    @apply grid gap-2;
  }

  .editor-label {
    @apply text-[0.6rem] uppercase tracking-[0.2em] text-white/50;
  }

  .editor-input {
    @apply w-full rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[0.75rem]
      text-white/80 outline-none focus:border-emerald-400/60;
  }

  .editor-hint {
    @apply text-[0.65rem] text-amber-200/80;
  }

  .editor-error {
    @apply text-[0.65rem] text-rose-200/80;
  }

  .editor-shell {
    @apply min-h-0 flex-1 rounded-md border border-white/10 bg-black/70 overflow-hidden flex flex-col;
    min-height: 320px;
  }

  .editor-shell :global(.shell) {
    @apply flex-1 min-h-0;
  }

  .editor-actions {
    @apply flex items-center justify-end gap-2;
  }

  .editor-actions button {
    @apply rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[0.6rem]
      uppercase tracking-[0.18em] text-white/70 hover:border-white/30 hover:text-white;
  }

  .editor-actions .primary {
    @apply border-emerald-400/40 text-emerald-200 hover:border-emerald-300/70;
  }

  .chain-status-strip {
    @apply mt-2 flex flex-wrap items-start gap-2 px-2 pb-2;
  }

  .chain-status-strip--sidebar {
    @apply mt-2 px-0 pb-0;
  }

  .chain-status-chip {
    @apply inline-flex max-w-full items-start gap-2 rounded-md border border-white/10 bg-black/70 px-2 py-1
      text-[0.62rem] text-white/80;
  }

  .chain-status-chip span {
    @apply shrink-0 uppercase tracking-[0.18em] text-white/50;
  }

  .chain-status-chip strong {
    @apply font-medium text-white/80 break-words;
  }

  .chain-status-chip.is-error {
    @apply border-rose-400/30 bg-rose-950/20 text-rose-100;
  }

  .chain-status-chip.is-error span {
    @apply text-rose-200/70;
  }

  .chain-status-chip.is-success {
    @apply border-emerald-400/30 bg-emerald-950/20 text-emerald-100;
  }

  .chain-status-chip.is-success span {
    @apply text-emerald-200/70;
  }
</style>
