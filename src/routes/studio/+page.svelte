<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { resolve } from "$app/paths";

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
  import FlowInstanceBridge from "$lib/components/studio/FlowInstanceBridge.svelte";
  import StudioDimensionNode from "$lib/components/studio/StudioDimensionNode.svelte";
  import StudioConnectorNode from "$lib/components/studio/StudioConnectorNode.svelte";
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
    listChainSyncSourcesForApp,
    type ChainStudioSyncResult,
  } from "$lib/studio/chainStudioAdapter";
  import {
    getCurrentUserToolboxLibrary,
    getMe,
    loginWithMockChainAccount,
    saveCurrentUserToolboxLibrary,
  } from "$lib/auth/api";
  import { clearChainToken, getChainToken } from "$lib/auth/session";
  import {
    ChainApiRequestError,
    type ChainApiPostResult,
    postChainConnectorDetailed,
    postChainConditionDetailed,
    postChainTransformationDetailed,
  } from "$lib/chain/registryApi";
  import { mockPlugins, type LibraryItem } from "$lib/data/studioLibrary";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
  import {
    createLocalFormat,
    loadLocalFormats,
    type ParticleFormat,
  } from "$lib/formats/localFormats";

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
    | "connector"
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

  type ConnectorRowPreview = {
    dimension: number;
    transformations: string[];
  };

  type StandaloneTransformationDraft = {
    id: string;
    name: string;
    args: number[];
    code: string;
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
    connectorRows?: ConnectorRowPreview[];
    selectedDimensionIndex?: number;
    conditionLabel?: string | null;
    boundKind?: "static" | "forwarded" | null;
    boundSlotLabel?: string | null;
    boundOwnerName?: string | null;
    conditionTargetSelected?: boolean;
    networkId?: string;
    fromNetwork?: boolean;
    placeholder?: boolean;
    placeholderDetail?: string;
    placeholderState?: "loading" | "warning";
    foldedRootConnectorId?: string;
    connectorTreeCollapsible?: boolean;
    connectorTreeCollapsed?: boolean;
    definitionRole?: "root" | "member" | null;
    tabRoot?: boolean;
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
    hidden?: boolean;
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
    connectors: Record<string, StudioConnectorDef>;
    features: Record<string, MockFeatureDef>;
    particles: Record<string, MockParticleDef>;
    transformations: Record<string, RuntimeTransformationDef>;
    conditions: Record<string, RuntimeConditionDef>;
  };

  let nodes = $state.raw<StudioNode[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let selectedNodeId = $state<string | null>(null);
  type ConnectorDropTarget =
    | { type: "dimension"; connectorId: string; dimensionIndex: number }
    | { type: "condition"; connectorId: string }
    | null;
  let connectorDropTarget = $state<ConnectorDropTarget>(null);
  let explorerSource = $state<"network" | "toolbox" | "formats">("network");
  let libraryTab = $state<"connectors" | "transformations" | "conditions" | "plugins">(
    "connectors",
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
  let toolboxLoadBusy = $state(true);
  let chainDeployBusy = $state(false);
  let chainDeployStatus = $state<string | null>(null);
  let chainDeployError = $state<string | null>(null);
  let localFormats = $state<ParticleFormat[]>([]);
  let formatNameDraft = $state("");
  let formatParticleSearchDraft = $state("");
  let selectedFormatParticleIds = $state<string[]>([]);
  let formatCreateError = $state<string | null>(null);
  let formatCreateStatus = $state<string | null>(null);
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
  let apiEditorLastGenerated = $state("");
  let apiJsonView = $state<"protocol" | "resolved">("protocol");
  let compiledTransformationsByTab = $state<
    Record<string, Record<string, RuntimeTransformationDef>>
  >({});
  let runSamplesCount = $state(12);
  let transformationEditorOpen = $state(false);
  let transformationEditorDimensionId = $state<string | null>(null);
  let transformationEditorId = $state<string | null>(null);
  let transformationEditorStatus = $state<TransformationInstance["status"]>("draft");
  let transformationEditorLocked = $state(false);
  let transformationEditorDeployBusy = $state(false);
  let transformationDraftName = $state("");
  let transformationDraftArgs = $state("");
  let transformationDraftCode = $state("return x + args[0];");
  let transformationDraftError = $state<string | null>(null);
  const transformationCodeById = new SvelteMap<string, string>();
  let conditionEditorOpen = $state(false);
  let conditionEditorNodeId = $state<string | null>(null);
  let conditionEditorStatus = $state<"draft" | "network">("draft");
  let conditionEditorLocked = $state(false);
  let conditionEditorDeployBusy = $state(false);
  let conditionDraftName = $state("");
  let conditionDraftCode = $state("return true;");
  let conditionDraftError = $state<string | null>(null);
  let libraryCreateActionError = $state<string | null>(null);
  let standaloneDraftTransformations = $state<StandaloneTransformationDraft[]>([]);
  const conditionCodeById = new SvelteMap<string, string>();
  const selectedFormatParticleIdSet = $derived.by(() => new Set(selectedFormatParticleIds));

  const transformationEditorReadOnly = $derived.by(
    () => transformationEditorStatus === "network" || transformationEditorLocked,
  );
  const conditionEditorReadOnly = $derived.by(
    () => conditionEditorStatus === "network" || conditionEditorLocked,
  );

  let deployedRegistry = $state<DeployedRegistry>({
    connectors: {},
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
  const connectorTreeModelsByTab = new SvelteMap<string, { nodes: StudioNode[]; edges: Edge[] }>();

  type ToolboxLibrary = {
    particles: string[];
    feature: string[];
    transformation: string[];
    condition: string[];
    plugin: string[];
  };

  type QuickNodeKind =
    | "feature"
    | "connector"
    | "transformation"
    | "condition"
    | "plugin"
    | "agent";

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

  const uniqueStrings = (values: string[]) =>
    Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

  const formatTransformationPreviewLabel = (name: string, args: number[] = []) => {
    const trimmed = name.trim() || "Transformation";
    if (!args.length) return trimmed;
    return `${trimmed} (${args.join(", ")})`;
  };

  const formatTransformationPreview = (transformation: TransformationInstance) =>
    formatTransformationPreviewLabel(transformation.name, transformation.args);

  const isConnectorKind = (kind: StudioNodeKind) => kind === "feature" || kind === "connector";

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

  const defaultDraftCode = "return x + args[0];";
  const defaultConditionDraftCode = "return true;";

  const getTransformationCode = (id: string) => {
    const direct = transformationCodeById.get(id);
    if (direct) return direct;
    const standalone = standaloneDraftTransformations.find((item) => item.id === id);
    return standalone?.code ?? defaultDraftCode;
  };
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

  const initialTab = createStudioTab("Untitled Connector");
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
    feature: StudioConnectorNode,
    connector: StudioConnectorNode,
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
    kind: "connector" | "transformation" | "condition" | "plugin",
    rawId: string,
  ): LibraryItem | null => {
    const target = rawId.trim();
    if (!target) return null;
    const key = normalizeKey(target);
    const sourceKind = kind === "connector" ? "feature" : kind;
    const pool = networkLibrary[sourceKind] ?? [];
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
      (sourceKind === "plugin"
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
        : ["feature", "connector", "transformation", "condition", "plugin"].includes(rawKind)
          ? ((rawKind === "feature" ? "connector" : rawKind) as
              | "connector"
              | "transformation"
              | "condition"
              | "plugin")
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
    localFormats = loadLocalFormats();
    void loadToolboxLibraryFromProfile();
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

  const persistToolboxLibrary = async (nextToolboxLibrary: ToolboxLibrary) => {
    try {
      await saveCurrentUserToolboxLibrary({
        particles: [...nextToolboxLibrary.particles],
        feature: [...nextToolboxLibrary.feature],
        transformation: [...nextToolboxLibrary.transformation],
        condition: [...nextToolboxLibrary.condition],
        plugin: [...nextToolboxLibrary.plugin],
      });
    } catch (error) {
      console.warn("[Studio] Failed to persist toolbox library.", error);
    }
  };

  const loadToolboxLibraryFromProfile = async () => {
    toolboxLoadBusy = true;
    try {
      const saved = await getCurrentUserToolboxLibrary();
      toolboxLibrary = {
        particles: saved.particles.map(normalizeToolboxId),
        feature: [...saved.feature],
        transformation: [...saved.transformation],
        condition: [...saved.condition],
        plugin: [...saved.plugin],
      };
    } catch (error) {
      console.warn("[Studio] Failed to load toolbox library from profile.", error);
    } finally {
      toolboxLoadBusy = false;
    }
  };

  const networkParticles = $derived.by(() =>
    [...deployedParticles].sort((a, b) => b.createdAt - a.createdAt),
  );

  const networkLibrary = $derived.by(() => ({
    feature: [...deployedLibrary.features],
    transformation: [
      ...deployedLibrary.transformations,
      ...standaloneDraftTransformations.map((item) => ({
        id: `draft-transform-${item.id}`,
        name: item.name,
        kind: "transformation" as const,
        authorId: mockCurrentUserId,
        summary: "Draft (local, not yet published).",
      })),
    ],
    condition: [...deployedLibrary.conditions],
    plugin: [...mockPlugins, ...deployedLibrary.plugins],
  }));

  const formatParticleChoices = $derived.by(() =>
    [...networkParticles].sort((a, b) => a.name.localeCompare(b.name)),
  );
  const formatParticleById = $derived.by(
    () => new Map(formatParticleChoices.map((particle) => [particle.id, particle] as const)),
  );
  const selectedFormatParticles = $derived.by(() =>
    selectedFormatParticleIds
      .map((id) => formatParticleById.get(id) ?? null)
      .filter((particle): particle is ExploreParticle => Boolean(particle)),
  );
  const formatParticleSearchResults = $derived.by(() => {
    const query = formatParticleSearchDraft.trim().toLowerCase();
    if (!query) return [] as ExploreParticle[];
    return formatParticleChoices
      .filter((particle) => !selectedFormatParticleIdSet.has(particle.id))
      .filter((particle) => {
        return `${particle.name} ${particle.id} ${particle.summary}`.toLowerCase().includes(query);
      })
      .slice(0, 8);
  });
  const selectedNode = $derived.by(() => nodes.find((node) => node.id === selectedNodeId) ?? null);
  const inspectorNode = $derived.by(() => {
    if (selectedNode) return selectedNode;
    if (!activeTab) return null;
    return {
      id: `tab-${activeTab.id}`,
      position: { x: 0, y: 0 },
      data: {
        label: activeTab.label,
        kind: "connector",
        particleId: activeTab.particleId,
        networkId: activeTab.particleId,
        fromNetwork: Boolean(activeTab.particleId),
      },
    } as StudioNode;
  });
  const nodesById = $derived.by(() =>
    Object.fromEntries(nodes.map((node) => [node.id, node] as const)),
  );
  const connectorConditionEdgeFingerprint = $derived.by(() =>
    edges
      .filter((edge) => {
        const sourceNode = edge.source ? nodesById[edge.source] : null;
        const targetNode = edge.target ? nodesById[edge.target] : null;
        if (sourceNode?.data.kind !== "condition") return false;
        return Boolean(targetNode && isConnectorKind(targetNode.data.kind));
      })
      .map((edge) => `${edge.source}:${edge.target}:${edge.sourceHandle ?? "out"}`)
      .sort()
      .join("|"),
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
    dimensionDraft = isConnectorKind(selectedNode.data.kind)
      ? (selectedNode.data.dimensions ?? 1)
      : null;
  });

  $effect(() => {
    connectorConditionEdgeFingerprint;
    queueMicrotask(() => {
      syncAllConnectorRowPreviews({ schedule: false });
    });
  });

  $effect(() => {
    const target = connectorDropTarget;
    if (!target) return;
    const connector = getFeatureNode(target.connectorId);
    if (!connector || !isConnectorKind(connector.data.kind)) {
      setConnectorDropTarget(null);
      return;
    }
    if (
      target.type === "dimension" &&
      !getDimensionNodeForConnectorIndex(target.connectorId, target.dimensionIndex)
    ) {
      setConnectorDropTarget(null);
    }
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

  $effect(() => {
    libraryTab;
    libraryCreateActionError = null;
  });

  $effect(() => {
    activeTabId;
    activeTab?.label;
    activeTab?.particleId;
    nodes.length;
    if (!activeTab || activeTab.particleId || isConnectorTreeTab(activeTabId)) return;
    ensureActiveDraftTabRootConnector();
  });

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
      if (tab.id === activeTabId && !tab.particleId) {
        ensureActiveDraftTabRootConnector();
      }
    }
    tabRenameId = null;
  };

  const cancelTabRename = () => {
    tabRenameId = null;
  };

  const updateNodeData = (nodeId: string, patch: Partial<StudioNodeData>) => {
    const currentNode = nodes.find((node) => node.id === nodeId) ?? null;
    nodes = nodes.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
    );
    if (currentNode?.data.kind === "condition") {
      const connectorIds = edges
        .filter((edge) => {
          if (edge.source !== nodeId) return false;
          if ((edge.sourceHandle ?? "out") !== "out") return false;
          const targetNode = edge.target ? nodesById[edge.target] : null;
          return Boolean(targetNode && isConnectorKind(targetNode.data.kind));
        })
        .map((edge) => edge.target)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      connectorIds.forEach((connectorId) =>
        syncConnectorRowPreview(connectorId, { schedule: false }),
      );
    }
    scheduleLayout();
  };

  let layoutFrame: number | null = null;
  let spacingFrame: number | null = null;

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

  const fallbackNodeSize = (node: StudioNode): { width: number; height: number } => {
    switch (node.data.kind) {
      case "connector":
      case "feature":
        return { width: 280, height: 190 };
      case "dimension":
        return { width: 220, height: 120 };
      case "particle":
        return { width: 170, height: 70 };
      case "condition":
      case "transformation":
        return { width: 220, height: 96 };
      case "plugin":
      case "agent":
        return { width: 220, height: 120 };
      default:
        return { width: 180, height: 80 };
    }
  };

  const boxesOverlap = (
    lhs: { x: number; y: number; width: number; height: number },
    rhs: { x: number; y: number; width: number; height: number },
    padding = 20,
  ) =>
    lhs.x < rhs.x + rhs.width + padding &&
    lhs.x + lhs.width + padding > rhs.x &&
    lhs.y < rhs.y + rhs.height + padding &&
    lhs.y + lhs.height + padding > rhs.y;

  const ensureNodeSpacing = (sourceNodes: StudioNode[]) => {
    if (!canvasEl || !sourceNodes.length) return sourceNodes;

    const nextNodes = sourceNodes.map((node) => ({
      ...node,
      position: { ...node.position },
    }));
    const byId = new SvelteMap(nextNodes.map((node) => [node.id, node] as const));
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
    let changed = false;

    const ordered = nextNodes
      .filter((node) => !node.hidden)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    ordered.forEach((node) => {
      const current = byId.get(node.id);
      if (!current) return;
      const size = measureNodeSize(current.id, fallbackNodeSize(current));
      let x = current.position.x;
      let y = current.position.y;
      let guard = 0;
      while (guard < 256) {
        const overlapping = placed.find((other) =>
          boxesOverlap({ x, y, width: size.width, height: size.height }, other),
        );
        if (!overlapping) break;
        y = overlapping.y + overlapping.height + 20;
        guard += 1;
      }
      if (Math.abs(current.position.x - x) > 0.5 || Math.abs(current.position.y - y) > 0.5) {
        current.position = { x, y };
        changed = true;
      }
      placed.push({ x, y, width: size.width, height: size.height });
    });

    return changed ? nextNodes : sourceNodes;
  };

  const scheduleNodeSpacing = () => {
    if (!canvasEl) return;
    if (spacingFrame !== null) cancelAnimationFrame(spacingFrame);
    spacingFrame = requestAnimationFrame(() => {
      spacingFrame = null;
      const spacedNodes = ensureNodeSpacing(nodes);
      if (spacedNodes !== nodes) {
        nodes = spacedNodes;
      }
    });
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
      .filter((node) => isConnectorKind(node.data.kind))
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

    const nextNodes = updates.size
      ? nodes.map((node) => {
          const update = updates.get(node.id);
          return update ? { ...node, position: update } : node;
        })
      : nodes;
    const spacedNodes = ensureNodeSpacing(nextNodes);
    if (spacedNodes !== nodes) {
      nodes = spacedNodes;
    }
  };

  const nodePositionSignature = $derived.by(() =>
    nodes
      .filter((node) => !node.hidden)
      .map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}`)
      .join("|"),
  );

  $effect(() => {
    nodePositionSignature;
    scheduleNodeSpacing();
  });

  const updateDimensionTransformations = (
    dimensionId: string,
    updater: (current: TransformationInstance[]) => TransformationInstance[],
  ) => {
    const parentFeatureId = (() => {
      const dimensionNode = nodes.find((node) => node.id === dimensionId);
      if (!dimensionNode || dimensionNode.data.kind !== "dimension") return null;
      return dimensionNode.data.parentFeatureId ?? null;
    })();
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
    if (parentFeatureId) {
      syncConnectorRowPreview(parentFeatureId, { schedule: false });
    }
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
  ): string | null => {
    const created = createTransformationInstance(name, args, status);
    let inserted = false;
    updateDimensionTransformations(dimensionId, (current) => {
      const next = [...current];
      if (insertIndex === undefined || insertIndex < 0 || insertIndex > next.length) {
        next.push(created);
      } else {
        next.splice(insertIndex, 0, created);
      }
      inserted = true;
      return next;
    });
    return inserted ? created.id : null;
  };

  const updateTransformationArgsOnDimension = (
    dimensionId: string,
    transformationId: string,
    rawArgs: string,
  ) => {
    const args = parseArgsInput(rawArgs);
    updateDimensionTransformations(dimensionId, (current) =>
      current.map((tx) => (tx.id === transformationId ? { ...tx, args } : tx)),
    );
  };

  const addTransformationToSelectedDimension = (
    label: string,
    status: TransformationInstance["status"] = "draft",
  ) => {
    if (connectorDropTarget?.type === "dimension") {
      const targetDimension = getDimensionNodeForConnectorIndex(
        connectorDropTarget.connectorId,
        connectorDropTarget.dimensionIndex,
      );
      if (targetDimension && !targetDimension.data.fromNetwork) {
        addTransformationToDimension(targetDimension.id, label, [], status);
        return;
      }
      setConnectorDropTarget(null);
    }

    const selected = nodes.find((node) => node.id === selectedNodeId);
    if (!selected) return;

    if (selected.data.kind === "dimension") {
      if (selected.data.fromNetwork) return;
      addTransformationToDimension(selected.id, label, [], status);
      setConnectorDropTarget({
        type: "dimension",
        connectorId: selected.data.parentFeatureId ?? selected.id,
        dimensionIndex: selected.data.dimensionIndex ?? 0,
      });
      return;
    }

    if (isConnectorKind(selected.data.kind)) {
      const targetDimension = getDimensionNodesForFeature(selected.id)
        .sort((a, b) => (a.data.dimensionIndex ?? 0) - (b.data.dimensionIndex ?? 0))
        .at(0);
      if (!targetDimension || targetDimension.data.fromNetwork) return;
      addTransformationToDimension(targetDimension.id, label, [], status);
      setConnectorDropTarget({
        type: "dimension",
        connectorId: selected.id,
        dimensionIndex: targetDimension.data.dimensionIndex ?? 0,
      });
    }
  };

  const getSelectedConnectorNode = (): StudioNode | null => {
    const selected = nodes.find((node) => node.id === selectedNodeId);
    if (!selected) return null;
    if (isConnectorKind(selected.data.kind)) return selected;
    if (selected.data.kind === "dimension" && selected.data.parentFeatureId) {
      const parent = getFeatureNode(selected.data.parentFeatureId);
      if (parent && isConnectorKind(parent.data.kind)) return parent;
    }
    return null;
  };

  const getConnectorDefinitionForName = (connectorName: string): StudioConnectorDef | null => {
    const trimmed = connectorName.trim();
    if (!trimmed) return null;
    if (deployedRegistry.connectors[trimmed]) return deployedRegistry.connectors[trimmed];
    try {
      const compiled = compileDraftTransformations(nodes);
      const runtime = buildStudioRuntime(
        { nodes, edges },
        { rootLabel: activeTab?.label ?? "connector", rootParticleId: activeTab?.particleId },
        buildRuntimeOverrides(compiled.registry),
      );
      return runtime.registry.connectors[trimmed] ?? null;
    } catch {
      return null;
    }
  };

  const collectDirectDefinitionConnectorReferences = (connectorName: string) => {
    const compositeNames = new SvelteSet<string>();
    const bindingTargetNames = new SvelteSet<string>();
    const connector = getConnectorDefinitionForName(connectorName);
    if (!connector) {
      return { compositeNames, bindingTargetNames };
    }

    connector.dimensions.forEach((dimension) => {
      const compositeName = (dimension.composite ?? "").trim();
      if (compositeName) compositeNames.add(compositeName);
      Object.values(dimension.bindings ?? {}).forEach((targetRaw) => {
        const targetName = `${targetRaw ?? ""}`.trim();
        if (targetName) bindingTargetNames.add(targetName);
      });
    });

    return { compositeNames, bindingTargetNames };
  };

  $effect(() => {
    const selectedConnector = getSelectedConnectorNode();
    const rootConnectorId = selectedConnector?.id ?? null;
    const rootConnectorName = selectedConnector ? resolveNodeName(selectedConnector) : "";
    const directlyReferenced = rootConnectorName
      ? collectDirectDefinitionConnectorReferences(rootConnectorName)
      : {
          compositeNames: new SvelteSet<string>(),
          bindingTargetNames: new SvelteSet<string>(),
        };

    let changed = false;
    const nextNodes = nodes.map((node) => {
      if (!isConnectorKind(node.data.kind)) return node;
      const nodeName = resolveNodeName(node);
      const hasDirectCompositeEdgeFromRoot =
        rootConnectorId !== null &&
        edges.some(
          (edge) =>
            edge.source === rootConnectorId &&
            edge.target === node.id &&
            `${edge.label ?? ""}`.toLowerCase().startsWith("composite"),
        );
      const hasDirectBindingEdgeFromRoot =
        rootConnectorId !== null &&
        edges.some(
          (edge) =>
            edge.source === rootConnectorId &&
            edge.target === node.id &&
            `${edge.label ?? ""}`.toLowerCase().startsWith("binding"),
        );
      const hasBindingOwnedByRoot = edges.some((edge) => {
        if (edge.target !== node.id) return false;
        if (!`${edge.label ?? ""}`.toLowerCase().startsWith("binding")) return false;
        const bindingOwnerName =
          typeof edge.data === "object" && edge.data
            ? `${(edge.data as { bindingOwnerName?: unknown }).bindingOwnerName ?? ""}`.trim()
            : "";
        return bindingOwnerName === rootConnectorName;
      });
      const isCompositeMember =
        directlyReferenced.compositeNames.has(nodeName) && hasDirectCompositeEdgeFromRoot;
      const isBindingMember =
        directlyReferenced.bindingTargetNames.has(nodeName) &&
        (node.data.boundOwnerName === rootConnectorName ||
          hasBindingOwnedByRoot ||
          (!node.data.fromNetwork && hasDirectBindingEdgeFromRoot));

      const nextRole: "root" | "member" | null = rootConnectorId
        ? node.id === rootConnectorId
          ? "root"
          : isCompositeMember || isBindingMember
            ? "member"
            : null
        : null;
      const currentRole = node.data.definitionRole ?? null;
      if (currentRole === nextRole) return node;
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          definitionRole: nextRole,
        },
      };
    });
    if (changed) {
      nodes = nextNodes;
    }
  });

  const getPreferredDraftDimensionId = (): string | null => {
    const selected = nodes.find((node) => node.id === selectedNodeId);
    if (selected?.data.kind === "dimension" && !selected.data.fromNetwork) {
      return selected.id;
    }
    const selectedConnector = getSelectedConnectorNode();
    if (selectedConnector && !selectedConnector.data.fromNetwork) {
      const selectedConnectorDimension = getSortedConnectorDimensions(selectedConnector.id).find(
        (dimensionNode) => !dimensionNode.data.fromNetwork,
      );
      if (selectedConnectorDimension) return selectedConnectorDimension.id;
    }
    const firstLocalConnector = nodes.find(
      (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
    );
    if (!firstLocalConnector) return null;
    const firstLocalDimension = getSortedConnectorDimensions(firstLocalConnector.id).find(
      (dimensionNode) => !dimensionNode.data.fromNetwork,
    );
    return firstLocalDimension?.id ?? null;
  };

  const openNewTransformationEditor = () => {
    if (activeTabReadOnly) return;
    libraryCreateActionError = null;
    const targetDimensionId = getPreferredDraftDimensionId();
    transformationEditorOpen = true;
    transformationEditorDimensionId = targetDimensionId;
    transformationEditorId = null;
    transformationEditorStatus = "draft";
    transformationEditorLocked = false;
    transformationDraftName = createUniqueName("transformation", "new_transformation");
    transformationDraftArgs = "0";
    transformationDraftCode = defaultDraftCode;
    transformationDraftError = null;
  };

  const openNewConditionEditor = () => {
    if (activeTabReadOnly) return;
    libraryCreateActionError = null;
    const targetConnector = connectorDropTarget?.connectorId
      ? (getFeatureNode(connectorDropTarget.connectorId) ?? null)
      : null;
    const attachedConnector =
      targetConnector && isConnectorKind(targetConnector.data.kind)
        ? targetConnector
        : getSelectedConnectorNode();
    const nodeId = `condition-quick-${crypto.randomUUID()}`;
    const center = getCanvasCenter();
    const node: StudioNode = {
      id: nodeId,
      selected: true,
      type: "condition",
      draggable: false,
      position: attachedConnector
        ? {
            x: attachedConnector.position.x,
            y: attachedConnector.position.y - 140,
          }
        : center,
      data: {
        label: createUniqueName("condition", "new_condition"),
        kind: "condition",
        fromNetwork: false,
      },
    };
    nodes = nodes.map((existing) => ({ ...existing, selected: false }));
    nodes = [...nodes, node];
    if (
      attachedConnector &&
      !edges.some(
        (edge) =>
          edge.source === node.id &&
          edge.target === attachedConnector.id &&
          (edge.sourceHandle ?? "out") === "out" &&
          ((edge.targetHandle ?? "in") === "in" || edge.targetHandle === "condition"),
      )
    ) {
      edges = [
        ...edges,
        {
          id: `edge-${node.id}-${attachedConnector.id}`,
          source: node.id,
          sourceHandle: "out",
          target: attachedConnector.id,
          targetHandle: "in",
        },
      ];
    }
    selectedNodeId = node.id;
    conditionCodeById.set(node.id, defaultConditionDraftCode);
    openConditionEditor(node);
    scheduleLayout();
  };

  const requestClearCanvas = () => {
    if (activeTabReadOnly) return;
    clearConfirmOpen = true;
  };

  const confirmClearCanvas = () => {
    if (activeTabReadOnly) {
      clearConfirmOpen = false;
      return;
    }
    nodes = [];
    edges = [];
    selectedNodeId = null;
    tabGraphs.set(activeTabId, { nodes: [], edges: [] });
    ensureActiveDraftTabRootConnector();
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
      connectors: { ...deployedRegistry.connectors, ...snapshot.registry.connectors },
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
    const connector = fetched.registry.connector;
    const feature = fetched.registry.feature;
    const particle = fetched.registry.particle;
    if (!connector) return false;

    const inferredTransformations: Record<string, RuntimeTransformationDef> = {};
    connector.dimensions.forEach((dimension) => {
      dimension.transformations.forEach((tx) => {
        const name = String(tx.name);
        inferredTransformations[name] ??= {
          argc: tx.args.length,
          run: identityTransformRun,
        };
      });
    });

    const inferredConditions: Record<string, RuntimeConditionDef> = {};
    if (connector.conditionName) {
      inferredConditions[connector.conditionName] = {
        argc: connector.conditionArgs?.length ?? 0,
        check: alwaysTrueConditionCheck,
      };
    }

    deployedRegistry = {
      ...deployedRegistry,
      connectors: { ...deployedRegistry.connectors, [connector.name]: connector },
      ...(feature
        ? {
            features: { ...deployedRegistry.features, [feature.name]: feature },
          }
        : {}),
      ...(particle
        ? {
            particles: { ...deployedRegistry.particles, [particle.name]: particle },
          }
        : {}),
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
        id: `feature-${connector.name}`,
        name: titleize(connector.name),
        kind: "feature",
        authorId: fetched.particleMeta?.authorId ?? mockCurrentUserId,
        summary: "Fetched from chain on demand.",
        dimensions: connector.dimensions.length,
      }),
      transformations: Object.entries(inferredTransformations).reduce((items, [name]) => {
        return upsertLibraryItem(items, {
          id: `transform-${name}`,
          name: titleize(name),
          kind: "transformation",
          authorId: fetched.particleMeta?.authorId ?? mockCurrentUserId,
          summary: "Fetched from chain on demand.",
        });
      }, deployedLibrary.transformations),
      conditions: Object.entries(inferredConditions).reduce((items, [name]) => {
        return upsertLibraryItem(items, {
          id: `condition-${name}`,
          name: titleize(name),
          kind: "condition",
          authorId: fetched.particleMeta?.authorId ?? mockCurrentUserId,
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
      const parsedSnippet = parseSoliditySnippet(code);
      registry[name] = {
        argc: parsedSnippet.ok
          ? Math.max(0, inferArgsCountFromSnippet(parsedSnippet.value).minArgsCount)
          : 0,
        check: compiled.ok ? compiled.value : alwaysTrueConditionCheck,
      };
    });
    return registry;
  };

  const syncChainOwnedRegistry = async () => {
    chainSyncError = null;
    chainSyncStatus = "Fetching chain registry for all services users...";
    chainSyncBusy = true;
    try {
      const sources = await listChainSyncSourcesForApp({ force: true });
      const particleIds = new SvelteSet<string>();
      const connectorNames = new SvelteSet<string>();
      const transformationIds = new SvelteSet<string>();
      const conditionIds = new SvelteSet<string>();
      let syncedSources = 0;

      for (const source of sources) {
        const address = source.address;
        if (!address) continue;
        chainSyncStatus = `Fetching chain registry for ${source.label}...`;
        const snapshot = await withChainAuthRetry(() =>
          fetchChainOwnedStudioSnapshot(address, {
            authorId: source.authorId,
          }),
        );
        mergeChainSyncSnapshot(snapshot);
        if (
          isConnectorTreeTab(activeTabId) &&
          nodes.some((node) => Boolean(node.data.placeholder))
        ) {
          refreshConnectorTreeTab(activeTabId);
        }
        syncedSources += 1;
        snapshot.particles.forEach((particle) => particleIds.add(particle.id));
        Object.keys(snapshot.registry.connectors).forEach((name) => connectorNames.add(name));
        snapshot.library.transformations.forEach((item) => transformationIds.add(item.id));
        snapshot.library.conditions.forEach((item) => conditionIds.add(item.id));
      }

      refreshConnectorTreeTabs();

      chainSyncStatus = `Synced ${syncedSources} sources · ${particleIds.size} particles · ${connectorNames.size} connectors · ${transformationIds.size} transformations · ${conditionIds.size} conditions.`;
    } catch (error) {
      chainSyncError =
        error instanceof Error ? error.message : "Failed to sync owned chain registry.";
      chainSyncStatus = null;
    } finally {
      chainSyncBusy = false;
    }
  };

  const isNonNull = <T,>(value: T | null): value is T => value !== null;

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
    standaloneDraftTransformations.forEach((tx) => {
      const name = tx.name.trim();
      if (!name) return;
      if (!sources.has(name)) {
        sources.set(name, { code: tx.code });
      }
    });
    return sources;
  };

  const publishRuntimeToChain = async (
    runtime: ReturnType<typeof buildStudioRuntime> | null,
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

    const localConnectors = nodes.filter(
      (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
    );
    if (
      !runtime &&
      !localConnectors.length &&
      !localConditions.length &&
      !Object.keys(compiled).length
    ) {
      throw new Error("Nothing to deploy.");
    }
    if (localConnectors.length) {
      chainDeployStatus = `Publishing ${localConnectors.length} connector(s)...`;
    }
    if (!runtime) {
      return null;
    }
    for (const connectorNode of localConnectors) {
      const connectorName = resolveNodeName(connectorNode);
      const def = runtime.registry.connectors[connectorName];
      if (!def) continue;
      const requestBody = {
        name: connectorName,
        dimensions: def.dimensions.map((dimension) => ({
          transformations: dimension.transformations.map((tx) => ({
            name: tx.name,
            args: [...tx.args],
          })),
          ...(dimension.composite ? { composite: dimension.composite } : {}),
          ...(Object.keys(dimension.bindings ?? {}).length
            ? { bindings: { ...dimension.bindings } }
            : {}),
        })),
        ...(def.conditionName ? { condition_name: def.conditionName } : {}),
        ...(def.conditionArgs?.length ? { condition_args: [...def.conditionArgs] } : {}),
      };
      await traceChainPost("/chain/connector", requestBody, () =>
        postChainConnectorDetailed(requestBody),
      );
    }

    if (!localConnectors.length) {
      return null;
    }
    const rootDef = runtime.registry.connectors[runtime.rootConnector];
    if (!rootDef) return null;
    chainDeployStatus = `Published connector ${rootDef.name}.`;
    return rootDef.name;
  };

  const buildRuntimeOverrides = (
    compiledTransformations: Record<string, RuntimeTransformationDef> = {},
  ) => ({
    connectors: deployedRegistry.connectors,
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
    standaloneDraftTransformations.forEach((tx) => {
      draft.push({
        id: tx.id,
        name: tx.name,
        args: [...tx.args],
        status: "draft",
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
        .filter((node) => isConnectorKind(node.data.kind))
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

    const hasLocalConnectors = nodes.some(
      (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
    );

    if (hasLocalConnectors) {
      const connectorName = activeTab.particleId ?? (slugify(activeTab.label) || activeTab.label);
      const connectorKey = normalizeKey(connectorName);
      const networkConnectorKeys = new SvelteSet(
        Object.keys(deployedRegistry.connectors).map(normalizeKey),
      );
      if (!activeTab.particleId && networkConnectorKeys.has(connectorKey)) {
        warnings.push(`Connector already exists in network: ${connectorName}.`);
      }

      if (!isValidChainName(connectorName)) {
        warnings.push(
          `Invalid connector name for chain deploy: ${connectorName}. Use letters, numbers, and underscores only (cannot start with a number).`,
        );
      }
    }

    nodes.forEach((node) => {
      if (node.data.fromNetwork) return;
      if (isConnectorKind(node.data.kind) || node.data.kind === "condition") {
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

    standaloneDraftTransformations.forEach((tx) => {
      if (!isValidChainName(tx.name)) {
        warnings.push(
          `Invalid transformation name for chain deploy: ${tx.name}. Use letters, numbers, and underscores only (cannot start with a number).`,
        );
      }
    });

    const hasStandaloneElements =
      standaloneDraftTransformations.length > 0 ||
      nodes.some((node) => node.data.kind === "condition" && !node.data.fromNetwork);
    if (!hasLocalConnectors && !hasStandaloneElements) {
      warnings.push("No local connectors or standalone conditions/transformations to deploy.");
      compiledTransformationsByTab = {
        ...compiledTransformationsByTab,
        [activeTabId]: compiled.registry,
      };
      compileWarningsByTab = { ...compileWarningsByTab, [activeTabId]: warnings };
      compileTimestampByTab = { ...compileTimestampByTab, [activeTabId]: Date.now() };
      return warnings;
    }

    if (hasLocalConnectors) {
      try {
        const runtime = buildStudioRuntime(
          { nodes, edges },
          { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
          buildRuntimeOverrides(compiled.registry),
        );
        const rootDef = runtime.registry.connectors[runtime.rootConnector];
        if (!rootDef) {
          warnings.push("Graph does not produce a publishable root connector.");
        } else {
          rootDef.dimensions.forEach((dimension, index) => {
            const compositeName = dimension.composite ?? null;
            if (!compositeName) return;
            if (!deployedRegistry.connectors[compositeName]) {
              warnings.push(
                `Dependency connector is not available on chain (sync required): ${compositeName} (dimension ${index + 1}).`,
              );
            }
          });
        }
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Failed to build deploy preview.");
      }
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
    if (warnings && warnings.length) {
      chainDeployError = warnings.join(" ");
      return;
    }

    const compiled = compiledTransformationsByTab[activeTabId] ?? {};
    const hasLocalConnectors = nodes.some(
      (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
    );
    let runtime: ReturnType<typeof buildStudioRuntime> | null = null;
    if (hasLocalConnectors) {
      try {
        runtime = buildStudioRuntime(
          { nodes, edges },
          { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
          buildRuntimeOverrides(compiled),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to build deploy runtime.";
        chainDeployError = message;
        compileWarningsByTab = {
          ...compileWarningsByTab,
          [activeTabId]: [message],
        };
        compileTimestampByTab = { ...compileTimestampByTab, [activeTabId]: Date.now() };
        return;
      }
    }

    const localConditionNodes = nodes.filter(
      (node) => node.data.kind === "condition" && !node.data.fromNetwork,
    );

    deployTraceEntries = [];
    chainDeployBusy = true;
    let publishedRootConnectorName: string | null = null;
    try {
      publishedRootConnectorName = await publishRuntimeToChain(runtime, compiled);
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
    if (Object.keys(compiled).length) {
      const deployedDraftKeys = new SvelteSet(
        Object.keys(compiled).map((name) => normalizeKey(name)),
      );
      standaloneDraftTransformations = standaloneDraftTransformations.filter(
        (item) => !deployedDraftKeys.has(normalizeKey(item.name)),
      );
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

    if (runtime) {
      const existingConnectorKeys = new SvelteSet([
        ...Object.keys(deployedRegistry.connectors).map(normalizeKey),
      ]);

      const localConnectors = nodes.filter(
        (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
      );

      localConnectors.forEach((node) => {
        const connectorName = resolveNodeName(node);
        const key = normalizeKey(connectorName);
        if (existingConnectorKeys.has(key)) return;
        const def = runtime.registry.connectors[connectorName];
        if (!def) return;
        const legacyFeatureDef = runtime.registry.features[connectorName];
        const legacyParticleDef = runtime.registry.particles[connectorName];
        deployedRegistry = {
          ...deployedRegistry,
          connectors: { ...deployedRegistry.connectors, [connectorName]: def },
          features: legacyFeatureDef
            ? { ...deployedRegistry.features, [connectorName]: legacyFeatureDef }
            : deployedRegistry.features,
          particles: {
            ...deployedRegistry.particles,
            ...(legacyParticleDef ? { [connectorName]: legacyParticleDef } : {}),
          },
        };
        existingConnectorKeys.add(key);
        deployedLibrary = {
          ...deployedLibrary,
          features: upsertLibraryItem(deployedLibrary.features, {
            id: `feature-${connectorName}`,
            name: node.data.label,
            kind: "feature",
            authorId: mockCurrentUserId,
            summary: "Deployed from Studio.",
            dimensions:
              node.data.dimensions ?? legacyFeatureDef?.dimensions.length ?? def.dimensions.length,
          }),
        };
      });

      nodes = nodes.map((node) => {
        if (!isConnectorKind(node.data.kind)) return node;
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

      const rootName = runtime.rootConnector;
      const rootKey = normalizeKey(rootName);
      if (!existingParticleKeys.has(rootKey)) {
        const rootConnectorDef = runtime.registry.connectors[rootName];
        if (rootConnectorDef) {
          const rootLegacyParticle = runtime.registry.particles[rootName];
          deployedRegistry = {
            ...deployedRegistry,
            particles: rootLegacyParticle
              ? { ...deployedRegistry.particles, [rootName]: rootLegacyParticle }
              : deployedRegistry.particles,
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
                  dependencies: rootConnectorDef.dimensions
                    .map((dimension) => dimension.composite ?? null)
                    .filter((value): value is string => Boolean(value)),
                },
              ];
        }
      }

      if (!activeTab.particleId) {
        tabs = tabs.map((tab) => (tab.id === activeTabId ? { ...tab, particleId: rootName } : tab));
      }
    }

    deployTimestampByTab = { ...deployTimestampByTab, [activeTabId]: Date.now() };
    if (publishedRootConnectorName) {
      chainDeployStatus = `Deployed ${activeTab.label} to chain.`;
    } else if (runtime) {
      chainDeployStatus = "Deploy completed without publishing a connector.";
    } else {
      const deployedParts: string[] = [];
      if (Object.keys(compiled).length) {
        deployedParts.push(`${Object.keys(compiled).length} transformation(s)`);
      }
      if (localConditionNodes.length) {
        deployedParts.push(`${localConditionNodes.length} condition(s)`);
      }
      chainDeployStatus = deployedParts.length
        ? `Deployed ${deployedParts.join(" and ")} to chain.`
        : "Deploy completed.";
    }
  };

  const closeTransformationEditor = () => {
    transformationEditorOpen = false;
    transformationEditorDimensionId = null;
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
    conditionEditorDeployBusy = false;
    conditionDraftName = "";
    conditionDraftCode = defaultConditionDraftCode;
    conditionDraftError = null;
  };

  const saveConditionEditor = async () => {
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

    if (!isValidChainName(trimmedName)) {
      conditionDraftError =
        "Invalid condition name for chain deploy. Use letters, numbers, and underscores only (cannot start with a number).";
      return;
    }

    const existing = findRegistryMatch("condition", trimmedName);
    if (existing && !existing.id.startsWith("condition-quick-")) {
      conditionDraftError = `Condition ${trimmedName} already exists in network.`;
      return;
    }

    const duplicateLocal = nodes.some((node) => {
      if (node.data.kind !== "condition") return false;
      if (node.id === nodeId) return false;
      if (node.data.fromNetwork) return false;
      return normalizeKey(node.data.label) === normalizeKey(trimmedName);
    });
    if (duplicateLocal) {
      conditionDraftError = `Condition ${trimmedName} already exists locally in this graph.`;
      return;
    }

    conditionEditorDeployBusy = true;
    conditionDraftError = null;
    chainDeployError = null;
    chainDeployStatus = `Deploying condition ${trimmedName}...`;

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

    const requestBody = { name: trimmedName, sol_src: conditionDraftCode };
    try {
      await ensureChainAuthForStudio();
      const result = await withChainAuthRetry(() => postChainConditionDetailed(requestBody));

      const successEntry: DeployTraceEntry = {
        id: `deploy-trace-${crypto.randomUUID()}`,
        method: "POST",
        path: "/chain/condition",
        requestBody,
        responseStatus: result.status,
        responseBody: result.body,
        ok: true,
        at: Date.now(),
      };
      deployTraceEntries = [...deployTraceEntries, successEntry];
      logDeployTraceEntryToConsole(successEntry);

      const snippetParsed = parseSoliditySnippet(conditionDraftCode);
      const inferredArgsCount = snippetParsed.ok
        ? Math.max(0, inferArgsCountFromSnippet(snippetParsed.value).minArgsCount)
        : 0;
      conditionCodeById.set(nodeId, conditionDraftCode);
      updateNodeData(nodeId, {
        label: trimmedName,
        fromNetwork: true,
        networkId: trimmedName,
      });

      deployedRegistry = {
        ...deployedRegistry,
        conditions: {
          ...deployedRegistry.conditions,
          [trimmedName]: { argc: inferredArgsCount, check: alwaysTrueConditionCheck },
        },
      };
      deployedLibrary = {
        ...deployedLibrary,
        conditions: upsertLibraryItem(deployedLibrary.conditions, {
          id: `condition-${slugify(trimmedName)}`,
          name: trimmedName,
          kind: "condition",
          authorId: mockCurrentUserId,
          summary: "Deployed from Studio.",
        }),
      };

      chainDeployStatus = `Deployed condition ${trimmedName}.`;
      closeConditionEditor();
    } catch (error) {
      const errorEntry: DeployTraceEntry = {
        id: `deploy-trace-${crypto.randomUUID()}`,
        method: "POST",
        path: "/chain/condition",
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
      deployTraceEntries = [...deployTraceEntries, errorEntry];
      logDeployTraceEntryToConsole(errorEntry);

      const responseBody = error instanceof ChainApiRequestError ? error.responseBody : undefined;
      const responseMessage =
        responseBody &&
        typeof responseBody === "object" &&
        "message" in responseBody &&
        typeof (responseBody as { message?: unknown }).message === "string"
          ? ((responseBody as { message: string }).message ?? "").trim()
          : "";
      const message =
        responseMessage || (error instanceof Error ? error.message : "Failed to deploy condition.");
      conditionDraftError = message;
      chainDeployError = message;
      chainDeployStatus = null;
    } finally {
      conditionEditorDeployBusy = false;
    }
  };

  const saveTransformationEditor = async () => {
    if (!transformationEditorOpen) return;
    if (transformationEditorReadOnly) {
      closeTransformationEditor();
      return;
    }

    const trimmedName = transformationDraftName.trim();
    if (!trimmedName) {
      transformationDraftError = "Transformation name is required.";
      return;
    }

    const args = transformationArgsArray;
    const snippetParsed = parseSoliditySnippet(transformationDraftCode);
    if (!snippetParsed.ok) {
      transformationDraftError = snippetParsed.error;
      return;
    }
    const inferred = inferArgsCountFromSnippet(snippetParsed.value);
    if (args.length < inferred.minArgsCount) {
      transformationDraftError = `This code references args[${inferred.maxIndex}], so provide at least ${inferred.minArgsCount} argument(s).`;
      return;
    }
    const compiled = compileTransformationCode(transformationDraftCode);
    if (!compiled.ok) {
      transformationDraftError = compiled.error;
      return;
    }

    if (!isValidChainName(trimmedName)) {
      transformationDraftError =
        "Invalid transformation name for chain deploy. Use letters, numbers, and underscores only (cannot start with a number).";
      return;
    }

    const existing = findRegistryMatch("transformation", trimmedName);
    if (existing && !existing.id.startsWith("draft-transform-")) {
      transformationDraftError = `Transformation ${trimmedName} already exists in network.`;
      return;
    }

    transformationEditorDeployBusy = true;
    transformationDraftError = null;
    chainDeployError = null;
    chainDeployStatus = `Deploying transformation ${trimmedName}...`;

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

    const requestBody = { name: trimmedName, sol_src: transformationDraftCode };
    try {
      await ensureChainAuthForStudio();
      const result = await withChainAuthRetry(() => postChainTransformationDetailed(requestBody));

      const successEntry: DeployTraceEntry = {
        id: `deploy-trace-${crypto.randomUUID()}`,
        method: "POST",
        path: "/chain/transformation",
        requestBody,
        responseStatus: result.status,
        responseBody: result.body,
        ok: true,
        at: Date.now(),
      };
      deployTraceEntries = [...deployTraceEntries, successEntry];
      logDeployTraceEntryToConsole(successEntry);

      deployedRegistry = {
        ...deployedRegistry,
        transformations: {
          ...deployedRegistry.transformations,
          [trimmedName]: { argc: args.length, run: compiled.value },
        },
      };
      deployedLibrary = {
        ...deployedLibrary,
        transformations: upsertLibraryItem(deployedLibrary.transformations, {
          id: `transform-${slugify(trimmedName)}`,
          name: trimmedName,
          kind: "transformation",
          authorId: mockCurrentUserId,
          summary: "Deployed from Studio.",
        }),
      };

      const dimensionId = transformationEditorDimensionId;
      if (dimensionId) {
        const dimensionNode = nodesById[dimensionId];
        if (dimensionNode?.data.kind === "dimension" && !dimensionNode.data.fromNetwork) {
          const createdId = addTransformationToDimension(dimensionId, trimmedName, args, "network");
          if (createdId) transformationCodeById.set(createdId, transformationDraftCode);
        }
      }

      standaloneDraftTransformations = standaloneDraftTransformations.filter(
        (item) => normalizeKey(item.name) !== normalizeKey(trimmedName),
      );
      chainDeployStatus = `Deployed transformation ${trimmedName}.`;
      closeTransformationEditor();
    } catch (error) {
      const errorEntry: DeployTraceEntry = {
        id: `deploy-trace-${crypto.randomUUID()}`,
        method: "POST",
        path: "/chain/transformation",
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
      deployTraceEntries = [...deployTraceEntries, errorEntry];
      logDeployTraceEntryToConsole(errorEntry);

      const responseBody = error instanceof ChainApiRequestError ? error.responseBody : undefined;
      const responseMessage =
        responseBody &&
        typeof responseBody === "object" &&
        "message" in responseBody &&
        typeof (responseBody as { message?: unknown }).message === "string"
          ? ((responseBody as { message: string }).message ?? "").trim()
          : "";
      const message =
        responseMessage ||
        (error instanceof Error ? error.message : "Failed to deploy transformation.");
      transformationDraftError = message;
      chainDeployError = message;
      chainDeployStatus = null;
    } finally {
      transformationEditorDeployBusy = false;
    }
  };

  const isConnectorTreeTab = (tabId: string) => connectorTreeModelsByTab.has(tabId);

  const projectConnectorTreeGraph = (tabId: string) => {
    const model = connectorTreeModelsByTab.get(tabId);
    if (!model) return null;
    const projectedNodes: StudioNode[] = model.nodes.map((node) => {
      const next: StudioNode = {
        ...node,
        position: { ...node.position },
        data: { ...node.data },
        hidden: false,
      };
      if (isConnectorKind(next.data.kind)) {
        next.data.connectorTreeCollapsible = false;
        next.data.connectorTreeCollapsed = false;
      }
      return next;
    });
    const projectedEdges: Edge[] = model.edges.map((edge) => ({
      ...edge,
      ...(edge.style ? { style: { ...edge.style } } : {}),
    }));
    return { nodes: projectedNodes, edges: projectedEdges };
  };

  const saveActiveGraph = () => {
    if (isConnectorTreeTab(activeTabId)) {
      const pluginNodeIds = new SvelteSet(
        nodes.filter((node) => node.data.kind === "plugin").map((node) => node.id),
      );
      const pluginNodes = nodes
        .filter((node) => pluginNodeIds.has(node.id))
        .map((node) => ({
          ...node,
          position: { ...node.position },
          data: { ...node.data },
        }));
      const pluginEdges = edges
        .filter((edge) => pluginNodeIds.has(edge.source) || pluginNodeIds.has(edge.target))
        .map((edge) => ({
          ...edge,
          ...(edge.style ? { style: { ...edge.style } } : {}),
        }));
      tabGraphs.set(activeTabId, { nodes: pluginNodes, edges: pluginEdges });
      return;
    }
    tabGraphs.set(activeTabId, { nodes, edges });
  };

  const loadTabGraph = (tabId: string) => {
    const projectedTree = projectConnectorTreeGraph(tabId);
    if (projectedTree) {
      const overlay = tabGraphs.get(tabId);
      const overlayNodes = overlay?.nodes ?? [];
      const overlayEdges = overlay?.edges ?? [];
      const mergedNodes = [...projectedTree.nodes];
      const mergedNodeIdSet = new SvelteSet(mergedNodes.map((node) => node.id));
      overlayNodes.forEach((node) => {
        if (mergedNodeIdSet.has(node.id)) return;
        mergedNodes.push({
          ...node,
          position: { ...node.position },
          data: { ...node.data },
        });
        mergedNodeIdSet.add(node.id);
      });
      const mergedEdges = [...projectedTree.edges];
      overlayEdges.forEach((edge) => {
        if (!mergedNodeIdSet.has(edge.source) || !mergedNodeIdSet.has(edge.target)) return;
        if (
          mergedEdges.some(
            (existing) =>
              existing.source === edge.source &&
              existing.target === edge.target &&
              (existing.sourceHandle ?? "") === (edge.sourceHandle ?? "") &&
              (existing.targetHandle ?? "") === (edge.targetHandle ?? ""),
          )
        ) {
          return;
        }
        mergedEdges.push({
          ...edge,
          ...(edge.style ? { style: { ...edge.style } } : {}),
        });
      });
      nodes = mergedNodes;
      edges = mergedEdges;
    } else {
      const graph = tabGraphs.get(tabId);
      nodes = graph?.nodes ?? [];
      edges = graph?.edges ?? [];
      if (tabId === activeTabId) {
        ensureActiveDraftTabRootConnector();
      }
    }
    syncAllConnectorRowPreviews({ schedule: false });
    selectedNodeId = null;
    setConnectorDropTarget(null);
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
    const nextTab = createStudioTab(`Untitled Connector ${tabs.length + 1}`);
    tabs = [...tabs, nextTab];
    activeTabId = nextTab.id;
    loadTabGraph(nextTab.id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) {
      tabGraphs.delete(tabId);
      connectorTreeModelsByTab.delete(tabId);
      const fallback = createStudioTab("Untitled Connector");
      tabs = [fallback];
      activeTabId = fallback.id;
      loadTabGraph(fallback.id);
      return;
    }
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    tabs = remaining;
    tabGraphs.delete(tabId);
    connectorTreeModelsByTab.delete(tabId);
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
      type: "connector",
      draggable: false,
      position: { x: featureX, y: featureY },
      data: {
        label: featureLabel,
        kind: "connector",
        dimensions: feature.dimensions.length,
        connectorRows: feature.dimensions.map((dimension, dimIndex) => ({
          dimension: dimIndex + 1,
          transformations: dimension.transformations.map((transformation) =>
            formatTransformationPreviewLabel(transformation.name, transformation.args),
          ),
        })),
        conditionLabel: particle.conditionName ? titleize(particle.conditionName) : null,
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
        hidden: true,
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
          id: `edge-${featureId}-dim-${dimIndex}-${compositeId}`,
          source: featureId,
          sourceHandle: `dim-${dimIndex}`,
          target: compositeId,
          targetHandle: "in",
        });
      }
    });

    return { nodes: graphNodes, edges: graphEdges };
  };

  const getConnectorLibraryLabel = (connectorName: string) =>
    networkLibrary.feature.find((item) => getLibraryRegistryName(item) === connectorName)?.name ??
    titleize(connectorName);

  type IncomingBindingDescriptor = {
    targetName: string;
    kind: "static" | "forwarded";
    fromSlot: number;
    ownerConnectorName: string;
    forwarded: Map<number, IncomingBindingDescriptor>;
  };

  const getSortedCanonicalBindingEntries = (bindings: Record<string, string> = {}) => {
    const entries = Object.entries(bindings)
      .map(([slotRaw, targetRaw]) => {
        const slot = String(slotRaw).trim();
        if (!/^\d+$/.test(slot)) return null;
        const slotId = Number.parseInt(slot, 10);
        if (!Number.isInteger(slotId) || slotId < 0) return null;
        if (String(slotId) !== slot) return null;
        const targetName = String(targetRaw ?? "").trim();
        if (!targetName) return null;
        return { slotId, targetName };
      })
      .filter((value): value is { slotId: number; targetName: string } => Boolean(value));
    entries.sort((lhs, rhs) => lhs.slotId - rhs.slotId);
    return entries;
  };

  const cloneIncomingBindingDescriptor = (
    binding: IncomingBindingDescriptor | null | undefined,
    fallbackSlot = 0,
  ): IncomingBindingDescriptor | null => {
    if (!binding) return null;
    const targetName = String(binding.targetName ?? "").trim();
    if (!targetName) return null;
    const fromSlot = Number.isInteger(binding.fromSlot) ? binding.fromSlot : fallbackSlot;
    const ownerConnectorName = String(binding.ownerConnectorName ?? "").trim();
    return {
      targetName,
      kind: binding.kind === "static" ? "static" : "forwarded",
      fromSlot,
      ownerConnectorName,
      forwarded: cloneIncomingBindingMap(binding.forwarded),
    };
  };

  const cloneIncomingBindingAsForwarded = (
    binding: IncomingBindingDescriptor | null | undefined,
    fallbackSlot = 0,
  ): IncomingBindingDescriptor | null => {
    const cloned = cloneIncomingBindingDescriptor(binding, fallbackSlot);
    if (!cloned) return null;
    cloned.kind = "forwarded";
    return cloned;
  };

  const cloneIncomingBindingMap = (
    bindings: Map<number, IncomingBindingDescriptor> | null | undefined,
  ) => {
    const cloned = new SvelteMap<number, IncomingBindingDescriptor>();
    if (!(bindings instanceof Map)) return cloned;
    for (const [slotId, binding] of bindings.entries()) {
      if (!Number.isInteger(slotId) || slotId < 0) continue;
      const clonedBinding = cloneIncomingBindingDescriptor(binding, slotId);
      if (!clonedBinding) continue;
      cloned.set(slotId, clonedBinding);
    }
    return cloned;
  };

  const getSortedIncomingBindingEntries = (bindings: Map<number, IncomingBindingDescriptor>) =>
    Array.from(bindings.entries())
      .filter(([slotId, binding]) => Number.isInteger(slotId) && slotId >= 0 && Boolean(binding))
      .sort((lhs, rhs) => lhs[0] - rhs[0]);

  const computeConnectorOpenSlots = (
    connectorName: string,
    cache = new SvelteMap<string, number>(),
    visiting = new SvelteSet<string>(),
  ): number => {
    if (cache.has(connectorName)) return cache.get(connectorName) ?? 0;
    if (visiting.has(connectorName)) {
      throw new Error(`Connector cycle detected at '${connectorName}'.`);
    }
    const connector = deployedRegistry.connectors[connectorName];
    if (!connector) return 0;

    visiting.add(connectorName);
    try {
      let openSlots = 0;
      connector.dimensions.forEach((dimension, dimIndex) => {
        if (!dimension.composite) {
          openSlots += 1;
          return;
        }

        const childOpenSlots = computeConnectorOpenSlots(dimension.composite, cache, visiting);
        openSlots += childOpenSlots;

        const staticTargetsByChildSlot = new SvelteMap<number, string>();
        getSortedCanonicalBindingEntries(dimension.bindings ?? {}).forEach(
          ({ slotId, targetName }) => {
            if (slotId >= childOpenSlots) {
              throw new Error(
                `Connector '${connectorName}' has out-of-range binding slot ${slotId} at dimension ${dimIndex} (child '${dimension.composite}' exports ${childOpenSlots} slots).`,
              );
            }
            if (staticTargetsByChildSlot.has(slotId)) {
              throw new Error(
                `Connector '${connectorName}' has duplicate canonical binding slot ${slotId} at dimension ${dimIndex}.`,
              );
            }
            staticTargetsByChildSlot.set(slotId, targetName);
          },
        );

        for (const targetName of staticTargetsByChildSlot.values()) {
          openSlots += computeConnectorOpenSlots(targetName, cache, visiting);
        }

        openSlots -= staticTargetsByChildSlot.size;
      });

      cache.set(connectorName, openSlots);
      return openSlots;
    } finally {
      visiting.delete(connectorName);
    }
  };

  const buildConnectorTreeGraph = (
    rootConnectorName: string,
    origin: { x: number; y: number },
  ): { nodes: StudioNode[]; edges: Edge[] } => {
    const root = deployedRegistry.connectors[rootConnectorName];
    if (!root) return { nodes: [], edges: [] };

    const graphNodes: StudioNode[] = [];
    const graphEdges: Edge[] = [];
    const edgeKeySet = new SvelteSet<string>();
    const openSlotCache = new SvelteMap<string, number>();
    const treeInfo = new SvelteMap<string, { depth: number; children: string[] }>();
    const conditionParentById = new SvelteMap<string, string>();
    const horizontalSpacing = 380;
    const verticalSpacing = 340;
    let leafCursor = 0;

    const pushEdge = (
      sourceId: string,
      sourceHandle: string,
      targetId: string,
      targetHandle: string,
      options?: {
        label?: string;
        kind?: "composite" | "binding" | "open";
        bindingOwnerName?: string | null;
        bindingSlot?: number | null;
      },
    ) => {
      const key = `${sourceId}|${sourceHandle}|${targetId}|${targetHandle}|${options?.kind ?? "plain"}|${options?.label ?? ""}|${options?.bindingOwnerName ?? ""}|${options?.bindingSlot ?? ""}`;
      if (edgeKeySet.has(key)) return;
      edgeKeySet.add(key);
      const isBinding = options?.kind === "binding";
      const isOpen = options?.kind === "open";
      graphEdges.push({
        id: `edge-${crypto.randomUUID()}`,
        source: sourceId,
        sourceHandle,
        target: targetId,
        targetHandle,
        ...(options?.label ? { label: options.label } : {}),
        ...(options?.kind === "composite" || options?.kind === "binding"
          ? {
              data: {
                relation: options.kind,
                ...(isBinding && options?.bindingOwnerName
                  ? { bindingOwnerName: options.bindingOwnerName }
                  : {}),
                ...(isBinding && typeof options?.bindingSlot === "number"
                  ? { bindingSlot: options.bindingSlot }
                  : {}),
              },
            }
          : {}),
        ...(isBinding
          ? {
              style: {
                stroke: "#c97500",
                strokeDasharray: "8 5",
              },
            }
          : isOpen
            ? {
                style: {
                  stroke: "#7b8794",
                  strokeDasharray: "4 6",
                },
              }
            : {}),
      });
    };

    const createOpenSlotPlaceholder = (
      name: string,
      detail: string,
      depth: number,
      kind: "missing" | "cycle" = "missing",
    ) => {
      const id = `placeholder-${kind}-${crypto.randomUUID()}`;
      graphNodes.push({
        id,
        type: "particle",
        draggable: true,
        position: { x: origin.x, y: origin.y + depth * verticalSpacing },
        data: {
          label: kind === "cycle" ? "Connector cycle" : "Loading connector...",
          kind: "particle",
          fromNetwork: true,
          placeholder: true,
          placeholderDetail: kind === "cycle" ? detail : `waiting for chain sync: ${detail}`,
          placeholderState: kind === "cycle" ? "warning" : "loading",
        },
      });
      treeInfo.set(id, { depth, children: [] });
      return id;
    };

    const expandConnector = (
      input: {
        connectorName: string;
        incomingBindings: Map<number, IncomingBindingDescriptor>;
        depth: number;
        boundDescriptor?: {
          kind: "static" | "forwarded";
          slotLabel: string;
          ownerConnectorName?: string | null;
        } | null;
      },
      visiting = new SvelteSet<string>(),
    ): string => {
      const connectorName = input.connectorName.trim();
      if (!connectorName) {
        return createOpenSlotPlaceholder("Open slot", "Unnamed connector reference", input.depth);
      }

      if (visiting.has(connectorName)) {
        return createOpenSlotPlaceholder(
          "Cycle",
          `Connector cycle at ${connectorName}`,
          input.depth,
          "cycle",
        );
      }

      const def = deployedRegistry.connectors[connectorName];
      if (!def) {
        return createOpenSlotPlaceholder(
          "Missing connector",
          connectorName,
          input.depth,
          "missing",
        );
      }

      const connectorId = `connector-${connectorName}-${crypto.randomUUID()}`;
      const connectorNode: StudioNode = {
        id: connectorId,
        type: "connector",
        draggable: true,
        position: { x: origin.x, y: origin.y + input.depth * verticalSpacing },
        data: {
          label: getConnectorLibraryLabel(connectorName),
          kind: "connector",
          dimensions: def.dimensions.length,
          connectorRows: def.dimensions.map((dimension, dimIndex) => ({
            dimension: dimIndex + 1,
            transformations: dimension.transformations.map((transformation) =>
              formatTransformationPreviewLabel(transformation.name, transformation.args),
            ),
          })),
          conditionLabel: def.conditionName ? titleize(def.conditionName) : null,
          boundKind: input.boundDescriptor?.kind ?? null,
          boundSlotLabel: input.boundDescriptor?.slotLabel ?? null,
          boundOwnerName: input.boundDescriptor?.ownerConnectorName ?? null,
          sourceId: `feature-${connectorName}`,
          networkId: connectorName,
          fromNetwork: true,
          tabRoot: input.depth === 0,
        },
      };
      graphNodes.push(connectorNode);
      treeInfo.set(connectorId, { depth: input.depth, children: [] });

      if (def.conditionName) {
        const conditionNodeId = `condition-${connectorName}-${crypto.randomUUID()}`;
        graphNodes.push({
          id: conditionNodeId,
          type: "condition",
          draggable: true,
          position: { x: origin.x, y: origin.y + input.depth * verticalSpacing - 120 },
          data: {
            label: titleize(def.conditionName),
            kind: "condition",
            networkId: def.conditionName,
            fromNetwork: true,
          },
        });
        conditionParentById.set(conditionNodeId, connectorId);
        pushEdge(conditionNodeId, "out", connectorId, "in");
      }

      const nextVisiting = new SvelteSet(visiting);
      nextVisiting.add(connectorName);
      let openSlotId = 0;

      for (let dimId = 0; dimId < def.dimensions.length; dimId += 1) {
        const dimension = def.dimensions[dimId];

        if (!dimension.composite) {
          const replacement = input.incomingBindings.get(openSlotId) ?? null;
          if (replacement) {
            const slotLabel =
              replacement.kind === "forwarded"
                ? `slot ${openSlotId} (from slot ${replacement.fromSlot})`
                : `slot ${openSlotId}`;
            const childId = expandConnector(
              {
                connectorName: replacement.targetName,
                incomingBindings: cloneIncomingBindingMap(replacement.forwarded),
                depth: input.depth + 1,
                boundDescriptor: {
                  kind: replacement.kind,
                  slotLabel,
                  ownerConnectorName: replacement.ownerConnectorName,
                },
              },
              nextVisiting,
            );
            treeInfo.get(connectorId)?.children.push(childId);
            pushEdge(connectorId, `dim-${dimId}`, childId, "in", {
              kind: "binding",
              label: `binding · slot ${openSlotId}`,
              bindingOwnerName: replacement.ownerConnectorName,
              bindingSlot: openSlotId,
            });
          }

          openSlotId += 1;
          continue;
        }

        const childOpenSlots = computeConnectorOpenSlots(
          dimension.composite,
          openSlotCache,
          new SvelteSet(nextVisiting),
        );
        const staticTargetsByChildSlot = new SvelteMap<number, string>();
        getSortedCanonicalBindingEntries(dimension.bindings ?? {}).forEach(
          ({ slotId, targetName }) => {
            if (slotId >= childOpenSlots || staticTargetsByChildSlot.has(slotId)) return;
            staticTargetsByChildSlot.set(slotId, targetName);
          },
        );

        const slotProjectedStarts = new Array(childOpenSlots).fill(0);
        const slotProjectedWidths = new Array(childOpenSlots).fill(0);
        const slotStaticTargets = new Array<string>(childOpenSlots).fill("");
        const slotSelectedBindings = new Array<IncomingBindingDescriptor | null>(
          childOpenSlots,
        ).fill(null);
        const slotForwardedInternalBindings = Array.from(
          { length: childOpenSlots },
          () => new SvelteMap<number, IncomingBindingDescriptor>(),
        );
        let childOpenSlotsInParent = 0;

        for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
          slotProjectedStarts[childSlotId] = childOpenSlotsInParent;
          const staticTarget = staticTargetsByChildSlot.get(childSlotId);
          if (staticTarget) {
            const staticTargetOpenSlots = computeConnectorOpenSlots(
              staticTarget,
              openSlotCache,
              new SvelteSet(nextVisiting),
            );
            slotStaticTargets[childSlotId] = staticTarget;
            slotSelectedBindings[childSlotId] = {
              targetName: staticTarget,
              kind: "static",
              fromSlot: childSlotId,
              ownerConnectorName: connectorName,
              forwarded: new SvelteMap<number, IncomingBindingDescriptor>(),
            };
            slotProjectedWidths[childSlotId] = staticTargetOpenSlots;
            childOpenSlotsInParent += staticTargetOpenSlots;
            continue;
          }
          slotProjectedWidths[childSlotId] = 1;
          childOpenSlotsInParent += 1;
        }

        for (const [parentSlotId, parentBinding] of getSortedIncomingBindingEntries(
          input.incomingBindings,
        )) {
          if (parentSlotId < openSlotId) continue;
          const localSlotId = parentSlotId - openSlotId;
          if (localSlotId >= childOpenSlotsInParent) continue;

          for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
            const rangeStart = slotProjectedStarts[childSlotId];
            const rangeWidth = slotProjectedWidths[childSlotId];
            if (rangeWidth <= 0) continue;
            const rangeEndExclusive = rangeStart + rangeWidth;
            if (localSlotId < rangeStart || localSlotId >= rangeEndExclusive) continue;

            const staticTarget = slotStaticTargets[childSlotId];
            if (!staticTarget) {
              const forwardedBinding = cloneIncomingBindingAsForwarded(parentBinding, parentSlotId);
              if (forwardedBinding) slotSelectedBindings[childSlotId] = forwardedBinding;
              break;
            }

            const offset = localSlotId - rangeStart;
            const forwardedInternal = cloneIncomingBindingAsForwarded(parentBinding, parentSlotId);
            if (forwardedInternal) {
              slotForwardedInternalBindings[childSlotId].set(offset, forwardedInternal);
            }
            break;
          }
        }

        const childBindings = new SvelteMap<number, IncomingBindingDescriptor>();
        for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
          const selectedBinding = slotSelectedBindings[childSlotId];
          if (!selectedBinding) continue;
          const finalized = cloneIncomingBindingDescriptor(selectedBinding, childSlotId);
          if (!finalized) continue;
          if (slotStaticTargets[childSlotId]) {
            finalized.forwarded = cloneIncomingBindingMap(
              slotForwardedInternalBindings[childSlotId],
            );
          }
          childBindings.set(childSlotId, finalized);
        }

        const compositeChildId = expandConnector(
          {
            connectorName: dimension.composite,
            incomingBindings: childBindings,
            depth: input.depth + 1,
            boundDescriptor: null,
          },
          nextVisiting,
        );
        treeInfo.get(connectorId)?.children.push(compositeChildId);
        pushEdge(connectorId, `dim-${dimId}`, compositeChildId, "in", {
          kind: "composite",
          label: `composite · D${dimId + 1}`,
        });

        openSlotId += childOpenSlotsInParent;
      }

      return connectorId;
    };

    const rootId = expandConnector({
      connectorName: rootConnectorName,
      incomingBindings: new SvelteMap<number, IncomingBindingDescriptor>(),
      depth: 0,
      boundDescriptor: null,
    });

    const xByNodeId = new SvelteMap<string, number>();
    const computeTreeX = (nodeId: string): number => {
      const existing = xByNodeId.get(nodeId);
      if (typeof existing === "number") return existing;
      const info = treeInfo.get(nodeId);
      if (!info || info.children.length === 0) {
        const x = origin.x + leafCursor * horizontalSpacing;
        leafCursor += 1;
        xByNodeId.set(nodeId, x);
        return x;
      }
      const childrenX = info.children.map((childId) => computeTreeX(childId));
      const x = childrenX.reduce((sum, item) => sum + item, 0) / childrenX.length;
      xByNodeId.set(nodeId, x);
      return x;
    };

    const rootX = computeTreeX(rootId);
    const xShift = origin.x - rootX;

    const minLevelGap = 390;
    const levelSortedNodeIds = Array.from(treeInfo.entries())
      .map(([nodeId, info]) => ({ nodeId, depth: info.depth }))
      .sort(
        (a, b) =>
          a.depth - b.depth || (xByNodeId.get(a.nodeId) ?? 0) - (xByNodeId.get(b.nodeId) ?? 0),
      );
    let currentDepth: number | null = null;
    let previousX = 0;
    levelSortedNodeIds.forEach(({ nodeId, depth }) => {
      if (currentDepth !== depth) {
        currentDepth = depth;
        previousX = -Infinity;
      }
      const currentX = xByNodeId.get(nodeId) ?? 0;
      const nextX = Number.isFinite(previousX)
        ? Math.max(currentX, previousX + minLevelGap)
        : currentX;
      xByNodeId.set(nodeId, nextX);
      previousX = nextX;
    });

    const connectorPositionById = new SvelteMap<string, { x: number; y: number }>();
    graphNodes.forEach((node) => {
      const info = treeInfo.get(node.id);
      if (info) {
        const x = (xByNodeId.get(node.id) ?? origin.x) + xShift;
        const y = origin.y + info.depth * verticalSpacing;
        node.position = { x, y };
        if (isConnectorKind(node.data.kind)) {
          connectorPositionById.set(node.id, { x, y });
        }
      }
    });

    graphNodes.forEach((node) => {
      if (node.data.kind !== "dimension") return;
      const parentId = node.data.parentFeatureId ?? "";
      const parentPos = connectorPositionById.get(parentId);
      if (!parentPos) return;
      const parent = graphNodes.find((candidate) => candidate.id === parentId);
      const dimensions = Math.max(1, Math.round(parent?.data.dimensions ?? 1));
      const dimIndex = Math.max(0, Math.round(node.data.dimensionIndex ?? 0));
      const spacing = 200;
      const startX = parentPos.x - ((dimensions - 1) * spacing) / 2;
      node.position = {
        x: startX + dimIndex * spacing,
        y: parentPos.y + 160,
      };
    });

    conditionParentById.forEach((parentId, conditionId) => {
      const parentPos = connectorPositionById.get(parentId);
      const conditionNode = graphNodes.find((candidate) => candidate.id === conditionId);
      if (!parentPos || !conditionNode) return;
      conditionNode.position = {
        x: parentPos.x,
        y: parentPos.y - 120,
      };
    });

    return { nodes: graphNodes, edges: graphEdges };
  };

  const refreshConnectorTreeTab = (tabId: string) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);
    const rootConnectorName = tab?.particleId?.trim() ?? "";
    if (!rootConnectorName || !connectorTreeModelsByTab.has(tabId)) return;
    const graph = buildConnectorTreeGraph(rootConnectorName, { x: 360, y: 120 });
    connectorTreeModelsByTab.set(tabId, graph);
    tabGraphs.set(tabId, tabGraphs.get(tabId) ?? { nodes: [], edges: [] });
    if (activeTabId === tabId) loadTabGraph(tabId);
  };

  const refreshConnectorTreeTabs = () => {
    tabs.forEach((tab) => {
      if (!tab.particleId) return;
      if (!connectorTreeModelsByTab.has(tab.id)) return;
      refreshConnectorTreeTab(tab.id);
    });
  };

  const ensureConnectorTreeTabGraph = async (tabId: string, connectorName: string) => {
    let graph = buildConnectorTreeGraph(connectorName, { x: 360, y: 120 });
    connectorTreeModelsByTab.set(tabId, graph);
    tabGraphs.set(tabId, tabGraphs.get(tabId) ?? { nodes: [], edges: [] });
    if (activeTabId === tabId) loadTabGraph(tabId);
    if (graph.nodes.length) return true;

    try {
      chainSyncError = null;
      chainSyncStatus = `Fetching ${connectorName} from chain...`;
      const merged = await withChainAuthRetry(() => syncSingleChainParticle(connectorName));
      if (!merged) {
        chainSyncStatus = null;
        chainSyncError = `Connector ${connectorName} was not found in chain registry.`;
        return false;
      }
      graph = buildConnectorTreeGraph(connectorName, { x: 360, y: 120 });
      connectorTreeModelsByTab.set(tabId, graph);
      tabGraphs.set(tabId, tabGraphs.get(tabId) ?? { nodes: [], edges: [] });
      if (activeTabId === tabId) loadTabGraph(tabId);
      chainSyncStatus = graph.nodes.length
        ? `Loaded ${connectorName} from chain.`
        : `Fetched ${connectorName}, but no tree could be rendered yet.`;
      return graph.nodes.length > 0;
    } catch (error) {
      chainSyncStatus = null;
      chainSyncError = error instanceof Error ? error.message : `Failed to fetch ${connectorName}.`;
      return false;
    }
  };

  const openConnectorTab = async (connectorId: string) => {
    const resolvedId = connectorId.replace(/^feature-/, "").trim();
    if (!resolvedId) return;
    const existing = tabs.find((tab) => tab.particleId === resolvedId);
    if (existing) {
      switchTab(existing.id);
      await ensureConnectorTreeTabGraph(existing.id, resolvedId);
      return;
    }
    saveActiveGraph();
    const label = getConnectorLibraryLabel(resolvedId);
    const nextTab = createStudioTab(label, resolvedId);
    tabs = [...tabs, nextTab];
    activeTabId = nextTab.id;
    loadTabGraph(nextTab.id);
    await ensureConnectorTreeTabGraph(nextTab.id, resolvedId);
  };

  const openParticleTab = async (particleId: string) => {
    await openConnectorTab(particleId);
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
    connector: networkLibrary.feature.map((item) => ({
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
    if (kind === "transformation") {
      standaloneDraftTransformations.forEach((item) => {
        localNames.add(normalizeKey(item.name));
      });
    }
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

    if (isConnectorKind(node.data.kind) && node.data.tabRoot) {
      tabs = tabs.map((tab) => (tab.id === activeTabId ? { ...tab, label: trimmed } : tab));
      ensureActiveDraftTabRootConnector();
      return;
    }

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
    if (isConnectorKind(kind) && typeof match?.dimensions === "number") {
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
    const next = { ...toolboxLibrary, particles: [...toolboxLibrary.particles, id] };
    toolboxLibrary = next;
    void persistToolboxLibrary(next);
  };

  const addLibraryToToolbox = (item: LibraryItem) => {
    const kind = item.kind;
    if (toolboxLibrary[kind].includes(item.id)) return;
    const next = { ...toolboxLibrary, [kind]: [...toolboxLibrary[kind], item.id] };
    toolboxLibrary = next;
    void persistToolboxLibrary(next);
  };

  const toggleFormatParticleSelection = (particleId: string) => {
    formatCreateError = null;
    formatCreateStatus = null;
    if (selectedFormatParticleIdSet.has(particleId)) {
      selectedFormatParticleIds = selectedFormatParticleIds.filter((id) => id !== particleId);
      return;
    }
    selectedFormatParticleIds = [...selectedFormatParticleIds, particleId];
  };

  const addFormatParticleSelection = (particleId: string) => {
    if (selectedFormatParticleIdSet.has(particleId)) return;
    formatCreateError = null;
    formatCreateStatus = null;
    selectedFormatParticleIds = [...selectedFormatParticleIds, particleId];
  };

  const tryAddFormatParticleByToken = (rawToken: string) => {
    const token = rawToken.trim().toLowerCase();
    if (!token) return false;
    const match =
      formatParticleChoices.find((particle) => particle.id.toLowerCase() === token) ??
      formatParticleChoices.find((particle) => particle.name.toLowerCase() === token);
    if (!match) return false;
    addFormatParticleSelection(match.id);
    return true;
  };

  const commitFormatParticleSearchInput = () => {
    const raw = formatParticleSearchDraft;
    const tokens = raw
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (!tokens.length) return;

    let addedAny = false;
    for (const token of tokens) {
      if (tryAddFormatParticleByToken(token)) {
        addedAny = true;
      }
    }

    if (addedAny) {
      formatParticleSearchDraft = "";
      formatCreateError = null;
      formatCreateStatus = null;
      return;
    }

    const first = tokens[0];
    formatCreateError = `No synced particle matched "${first}".`;
  };

  const resetFormatDraft = () => {
    formatNameDraft = "";
    formatParticleSearchDraft = "";
    selectedFormatParticleIds = [];
    formatCreateError = null;
    formatCreateStatus = null;
  };

  const handleCreateFormat = () => {
    formatCreateError = null;
    formatCreateStatus = null;
    try {
      const result = createLocalFormat({
        name: formatNameDraft,
        authorId: mockCurrentUserId,
        terminalParticleIds: selectedFormatParticleIds,
        existing: localFormats,
      });
      localFormats = result.formats;
      formatCreateStatus = `Created format ${result.created.name}.`;
      formatNameDraft = "";
      selectedFormatParticleIds = [];
    } catch (error) {
      formatCreateError = error instanceof Error ? error.message : "Failed to create format.";
    }
  };

  const getDimensionNodesForFeature = (featureId: string) =>
    nodes.filter(
      (node) => node.data.kind === "dimension" && node.data.parentFeatureId === featureId,
    );

  const getSortedConnectorDimensions = (connectorId: string) =>
    getDimensionNodesForFeature(connectorId).sort(
      (a, b) => (a.data.dimensionIndex ?? 0) - (b.data.dimensionIndex ?? 0),
    );

  const getDimensionNodeForConnectorIndex = (connectorId: string, dimensionIndex: number) =>
    getSortedConnectorDimensions(connectorId).find(
      (node) => (node.data.dimensionIndex ?? -1) === dimensionIndex,
    ) ?? null;

  const getConditionEdgeForConnector = (connectorId: string) =>
    edges.find((edge) => {
      if (edge.target !== connectorId) return false;
      const sourceNode = edge.source ? nodesById[edge.source] : null;
      if (sourceNode?.data.kind !== "condition") return false;
      const targetHandle = edge.targetHandle ?? "in";
      return targetHandle === "in" || targetHandle === "condition";
    }) ?? null;

  const getAttachedConditionNodeForConnector = (connectorId: string) => {
    const conditionEdge = getConditionEdgeForConnector(connectorId);
    if (!conditionEdge?.source) return null;
    const node = nodes.find((candidate) => candidate.id === conditionEdge.source) ?? null;
    if (!node || node.data.kind !== "condition") return null;
    return node;
  };

  const getFeatureNode = (featureId: string) => nodes.find((node) => node.id === featureId) ?? null;

  const createPlaceholderConnectorRows = (count: number): ConnectorRowPreview[] =>
    Array.from({ length: Math.max(1, count) }, (_, index) => ({
      dimension: index + 1,
      transformations: [],
    }));

  const buildConnectorRows = (connectorId: string, fallbackCount = 1): ConnectorRowPreview[] => {
    const dimensions = getSortedConnectorDimensions(connectorId);
    if (!dimensions.length) {
      return createPlaceholderConnectorRows(fallbackCount);
    }
    return dimensions.map((dimensionNode, index) => ({
      dimension: (dimensionNode.data.dimensionIndex ?? index) + 1,
      transformations: (dimensionNode.data.transformations ?? []).map(formatTransformationPreview),
    }));
  };

  const connectorRowsEqual = (a: ConnectorRowPreview[] = [], b: ConnectorRowPreview[] = []) => {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (a[index]?.dimension !== b[index]?.dimension) return false;
      const aTx = a[index]?.transformations ?? [];
      const bTx = b[index]?.transformations ?? [];
      if (aTx.length !== bTx.length) return false;
      for (let txIndex = 0; txIndex < aTx.length; txIndex += 1) {
        if (aTx[txIndex] !== bTx[txIndex]) return false;
      }
    }
    return true;
  };

  const syncConnectorRowPreview = (
    connectorId: string,
    options: { schedule?: boolean } = {},
  ): void => {
    const connector = getFeatureNode(connectorId);
    if (!connector || !isConnectorKind(connector.data.kind)) return;
    const dimensionNodes = getSortedConnectorDimensions(connectorId);
    const attachedConditionNode = getAttachedConditionNodeForConnector(connectorId);
    const nextConditionLabel = attachedConditionNode?.data.label ?? null;

    // Network/tree connectors can be rendered without local dimension nodes.
    // In that case, keep the fetched connectorRows preview instead of replacing
    // it with local placeholders.
    if (connector.data.fromNetwork && dimensionNodes.length === 0) {
      const currentConditionLabel = connector.data.conditionLabel ?? null;
      if (currentConditionLabel === nextConditionLabel) return;
      nodes = nodes.map((node) =>
        node.id === connectorId
          ? {
              ...node,
              data: {
                ...node.data,
                conditionLabel: nextConditionLabel,
              },
            }
          : node,
      );
      if (options.schedule ?? true) {
        scheduleLayout();
      }
      return;
    }

    const fallbackCount = Math.max(1, Math.round(connector.data.dimensions ?? 1));
    const nextRows = buildConnectorRows(connectorId, fallbackCount);
    const nextDimensions = Math.max(fallbackCount, nextRows.length, 1);
    let changed = false;
    const nextNodes = nodes.map((node) => {
      if (node.id !== connectorId) return node;
      const currentRows = node.data.connectorRows ?? [];
      const currentDimensions = Math.max(1, Math.round(node.data.dimensions ?? 1));
      const currentConditionLabel = node.data.conditionLabel ?? null;
      if (
        connectorRowsEqual(currentRows, nextRows) &&
        currentDimensions === nextDimensions &&
        currentConditionLabel === nextConditionLabel
      ) {
        return node;
      }
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          dimensions: nextDimensions,
          connectorRows: nextRows,
          conditionLabel: nextConditionLabel,
        },
      };
    });
    if (!changed) return;
    nodes = nextNodes;
    if (changed && (options.schedule ?? true)) {
      scheduleLayout();
    }
  };

  const syncAllConnectorRowPreviews = (options: { schedule?: boolean } = {}): void => {
    const connectorIds = nodes
      .filter((node) => isConnectorKind(node.data.kind))
      .map((node) => node.id);
    connectorIds.forEach((connectorId) => {
      syncConnectorRowPreview(connectorId, { schedule: false });
    });
    if (options.schedule ?? true) {
      scheduleLayout();
    }
  };

  const setConnectorDropTarget = (target: ConnectorDropTarget) => {
    connectorDropTarget = target;
    nodes = nodes.map((node) => {
      if (!isConnectorKind(node.data.kind)) return node;
      const selectedDimensionIndex =
        target?.type === "dimension" && target.connectorId === node.id
          ? target.dimensionIndex
          : undefined;
      const conditionTargetSelected =
        target?.type === "condition" && target.connectorId === node.id;
      if (
        node.data.selectedDimensionIndex === selectedDimensionIndex &&
        Boolean(node.data.conditionTargetSelected) === Boolean(conditionTargetSelected)
      ) {
        return node;
      }
      return {
        ...node,
        data: {
          ...node.data,
          selectedDimensionIndex,
          conditionTargetSelected,
        },
      };
    });
  };

  const storeParticleRIs = (particleName: string) => {
    const rootFeatureNode = nodes.find((node) => isConnectorKind(node.data.kind));
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
      hidden: true,
      draggable: false,
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

  const createDraftTabRootConnectorNode = (tab: StudioTab): StudioNode => ({
    id: `feature-root-${crypto.randomUUID()}`,
    type: "connector",
    draggable: true,
    position: { x: 360, y: 120 },
    data: {
      label: tab.label,
      kind: "connector",
      dimensions: 1,
      connectorRows: createPlaceholderConnectorRows(1),
      sourceId: `feature-${slugify(tab.label) || "untitled-connector"}`,
      fromNetwork: false,
      tabRoot: true,
    },
  });

  const ensureActiveDraftTabRootConnector = () => {
    const tab = tabs.find((candidate) => candidate.id === activeTabId) ?? null;
    if (!tab || tab.particleId || isConnectorTreeTab(activeTabId)) return;

    let nextNodes = [...nodes];
    let nextEdges = [...edges];
    let changed = false;

    const connectorNodes = nextNodes.filter((node) => isConnectorKind(node.data.kind));
    let rootNode =
      connectorNodes.find((node) => Boolean(node.data.tabRoot)) ??
      connectorNodes.find((node) => normalizeKey(node.data.label) === normalizeKey(tab.label)) ??
      null;

    if (!rootNode) {
      rootNode = createDraftTabRootConnectorNode(tab);
      nextNodes = [...nextNodes, rootNode];
      changed = true;
    }

    const rootId = rootNode.id;
    nextNodes = nextNodes.map((node) => {
      if (!isConnectorKind(node.data.kind)) return node;
      const shouldBeRoot = node.id === rootId;
      const nextLabel = shouldBeRoot ? tab.label : node.data.label;
      const nextFromNetwork = shouldBeRoot ? false : node.data.fromNetwork;
      const nextTabRoot = shouldBeRoot;
      const nextNetworkId = shouldBeRoot ? undefined : node.data.networkId;
      const nextParticleId = shouldBeRoot ? undefined : node.data.particleId;
      const nextDimensions = Math.max(1, Math.round(node.data.dimensions ?? 1));
      if (
        node.data.label === nextLabel &&
        Boolean(node.data.fromNetwork) === Boolean(nextFromNetwork) &&
        Boolean(node.data.tabRoot) === nextTabRoot &&
        node.data.networkId === nextNetworkId &&
        node.data.particleId === nextParticleId &&
        (node.data.dimensions ?? 1) === nextDimensions
      ) {
        return node;
      }
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          label: nextLabel,
          fromNetwork: nextFromNetwork,
          tabRoot: nextTabRoot,
          networkId: nextNetworkId,
          particleId: nextParticleId,
          dimensions: nextDimensions,
        },
      };
    });

    const refreshedRoot = nextNodes.find((node) => node.id === rootId) ?? null;
    if (!refreshedRoot || !isConnectorKind(refreshedRoot.data.kind)) {
      nodes = nextNodes;
      edges = nextEdges;
      return;
    }

    const rootDimensionCount = Math.max(1, Math.round(refreshedRoot.data.dimensions ?? 1));
    const existingDimensions = nextNodes.filter(
      (node) => node.data.kind === "dimension" && node.data.parentFeatureId === rootId,
    );

    const missingDimensions: StudioNode[] = [];
    for (let index = 0; index < rootDimensionCount; index += 1) {
      if (existingDimensions.some((dimensionNode) => dimensionNode.data.dimensionIndex === index)) {
        continue;
      }
      missingDimensions.push(createDimensionNode(refreshedRoot, index, rootDimensionCount));
    }

    if (missingDimensions.length) {
      nextNodes = [...nextNodes, ...missingDimensions];
      changed = true;
    }

    const allRootDimensions = nextNodes.filter(
      (node) =>
        node.data.kind === "dimension" &&
        node.data.parentFeatureId === rootId &&
        (node.data.dimensionIndex ?? -1) >= 0 &&
        (node.data.dimensionIndex ?? -1) < rootDimensionCount,
    );
    const edgeKeys = new SvelteSet(
      nextEdges.map((edge) => `${edge.source}|${edge.sourceHandle ?? ""}|${edge.target}`),
    );
    const newEdges: Edge[] = [];
    allRootDimensions.forEach((dimensionNode) => {
      const dimIndex = dimensionNode.data.dimensionIndex ?? 0;
      const key = `${rootId}|dim-${dimIndex}|${dimensionNode.id}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      newEdges.push({
        id: `edge-${rootId}-${dimensionNode.id}-${crypto.randomUUID()}`,
        source: rootId,
        sourceHandle: `dim-${dimIndex}`,
        target: dimensionNode.id,
        targetHandle: "in",
      });
    });
    if (newEdges.length) {
      nextEdges = [...nextEdges, ...newEdges];
      changed = true;
    }

    if (!changed) return;
    nodes = nextNodes;
    edges = nextEdges;
    syncConnectorRowPreview(rootId, { schedule: false });
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
    syncConnectorRowPreview(featureId, { schedule: false });
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
    if (selectedNode && isConnectorKind(selectedNode.data.kind)) {
      dimensionDraft = selectedNode.data.dimensions ?? 1;
    }
    pendingDimensionChange = null;
  };

  const libraryKindForTab = (tab: typeof libraryTab): LibraryItem["kind"] | null => {
    switch (tab) {
      case "connectors":
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
      case "connectors":
        return "Connectors";
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
      case "connectors":
        return "A connector defines dimensions and the transformation chains on those dimensions; each dimension can connect to another connector (or a terminal particle) as a composite input.";
      case "transformations":
        return "Transformations live on dimensions of a connector. Each dimension has its own list of transformations that specify how values are selected from the particle attached at that dimension.";
      case "conditions":
        return "A connector only outputs values if its condition is met. Conditions can be financial (e.g., send funds to an address) or non-financial (artistic, contextual, etc.).";
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
      case "connector":
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

  const attachConditionToConnector = (
    connectorId: string,
    input: {
      label: string;
      status: "draft" | "network";
      networkId?: string;
      sourceId?: string;
    },
  ) => {
    const connector = getFeatureNode(connectorId);
    if (!connector || !isConnectorKind(connector.data.kind) || connector.data.fromNetwork) {
      return false;
    }

    const existingEdge = getConditionEdgeForConnector(connectorId);
    if (existingEdge) {
      edges = edges.filter((edge) => edge.id !== existingEdge.id);
    }

    const existingConditionNode =
      input.status === "network" && input.networkId
        ? (nodes.find(
            (node) =>
              node.data.kind === "condition" &&
              node.data.fromNetwork &&
              (node.data.networkId === input.networkId ||
                normalizeKey(resolveNodeName(node)) === normalizeKey(input.networkId ?? "")),
          ) ?? null)
        : null;

    const conditionNode =
      existingConditionNode ??
      ({
        id: `condition-link-${crypto.randomUUID()}`,
        type: "condition",
        draggable: false,
        position: {
          x: connector.position.x,
          y: connector.position.y - 140,
        },
        data: {
          label: input.label,
          kind: "condition",
          fromNetwork: input.status === "network",
          ...(input.networkId ? { networkId: input.networkId } : {}),
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        },
      } satisfies StudioNode);

    if (!existingConditionNode) {
      nodes = [...nodes, conditionNode];
      conditionCodeById.set(conditionNode.id, defaultConditionDraftCode);
    }

    const edgeExists = edges.some(
      (edge) =>
        edge.source === conditionNode.id &&
        edge.target === connectorId &&
        (edge.sourceHandle ?? "out") === "out" &&
        ((edge.targetHandle ?? "in") === "in" || edge.targetHandle === "condition"),
    );
    if (!edgeExists) {
      edges = [
        ...edges,
        {
          id: `edge-${conditionNode.id}-${connectorId}-${crypto.randomUUID()}`,
          source: conditionNode.id,
          sourceHandle: "out",
          target: connectorId,
          targetHandle: "in",
        },
      ];
    }

    setConnectorDropTarget({ type: "condition", connectorId });
    syncConnectorRowPreview(connectorId, { schedule: false });
    scheduleLayout();
    return true;
  };

  const addLibraryNode = (item: LibraryItem, position: { x: number; y: number } | null = null) => {
    if (activeTabReadOnly && item.kind !== "plugin") return;
    if (item.kind === "transformation") {
      addTransformationToSelectedDimension(item.name, "network");
      return;
    }
    if (item.kind === "condition" && connectorDropTarget?.type === "condition") {
      const attached = attachConditionToConnector(connectorDropTarget.connectorId, {
        label: item.name,
        status: "network",
        networkId: getLibraryRegistryName(item),
        sourceId: item.id,
      });
      if (attached) return;
    }
    const registryName = getLibraryRegistryName(item);
    const nodePosition = position ?? {
      x: 160 + Math.round(Math.random() * 200),
      y: 160 + Math.round(Math.random() * 200),
    };
    if (item.kind === "feature") {
      const graph = buildConnectorTreeGraph(registryName, nodePosition);
      if (graph.nodes.length) {
        nodes = [...nodes, ...graph.nodes];
        edges = [...edges, ...graph.edges];
        scheduleLayout();
        return;
      }
    }
    const node: StudioNode = {
      id: `${item.kind}-${item.id}-${crypto.randomUUID()}`,
      position: nodePosition,
      type:
        item.kind === "feature"
          ? "connector"
          : item.kind === "plugin"
            ? "plugin"
            : item.kind === "condition"
              ? "condition"
              : undefined,
      draggable: item.kind === "plugin" ? true : undefined,
      data: {
        label: item.name,
        kind: item.kind === "feature" ? "connector" : item.kind,
        sourceId: item.id,
        viewId: item.viewId,
        networkId: registryName,
        fromNetwork: true,
        dimensions: item.dimensions ?? (item.kind === "feature" ? 1 : undefined),
        connectorRows:
          item.kind === "feature"
            ? createPlaceholderConnectorRows(item.dimensions ?? 1)
            : undefined,
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
    if (kind === "condition" && connectorDropTarget?.type === "condition") {
      const attached = attachConditionToConnector(connectorDropTarget.connectorId, {
        label,
        status: "draft",
      });
      if (attached) return;
    }
    const nodePosition = position ?? getCanvasCenter();
    const node: StudioNode = {
      id: `${kind}-quick-${crypto.randomUUID()}`,
      position: nodePosition,
      selected: true,
      type: kind === "feature" || kind === "connector" ? "connector" : kind,
      draggable: kind === "plugin" ? true : undefined,
      data: {
        label,
        kind: kind === "feature" ? "connector" : kind,
        dimensions: kind === "feature" || kind === "connector" ? 1 : undefined,
        connectorRows:
          kind === "feature" || kind === "connector"
            ? createPlaceholderConnectorRows(1)
            : undefined,
        fromNetwork: false,
      },
    };
    nodes = nodes.map((existing) => ({ ...existing, selected: false }));
    nodes = [...nodes, node];
    if (kind === "condition") {
      conditionCodeById.set(node.id, defaultConditionDraftCode);
    }
    if (kind === "feature" || kind === "connector") {
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

  const resolveConnectorDropTargetFromEvent = (
    event: MouseEvent | DragEvent | TouchEvent,
  ): ConnectorDropTarget => {
    if (!(event.target instanceof Element)) return null;
    const targetEl = event.target.closest<HTMLElement>("[data-connector-drop-target]");
    if (!targetEl) return null;
    const connectorId = targetEl.dataset.connectorId?.trim();
    const targetType = targetEl.dataset.connectorDropTarget;
    if (!connectorId || !targetType) return null;
    if (targetType === "condition") {
      return { type: "condition", connectorId };
    }
    if (targetType === "dimension") {
      const indexRaw = targetEl.dataset.dimensionIndex;
      const index = Number(indexRaw);
      if (!Number.isInteger(index) || index < 0) return null;
      return { type: "dimension", connectorId, dimensionIndex: index };
    }
    return null;
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const dropTarget = resolveConnectorDropTargetFromEvent(event);
    const quickPayload = event.dataTransfer?.getData("application/x-hypermusic-quick");
    if (quickPayload) {
      try {
        const payload = JSON.parse(quickPayload) as {
          kind: QuickNodeKind;
          label: string;
        };
        if (activeTabReadOnly && payload.kind !== "plugin") return;
        if (payload.kind === "transformation") {
          if (dropTarget?.type === "dimension") {
            const targetDimension = getDimensionNodeForConnectorIndex(
              dropTarget.connectorId,
              dropTarget.dimensionIndex,
            );
            if (targetDimension && !targetDimension.data.fromNetwork) {
              addTransformationToDimension(targetDimension.id, payload.label, [], "draft");
              setConnectorDropTarget(dropTarget);
            }
          }
          return;
        }
        if (payload.kind === "condition" && dropTarget?.type === "condition") {
          attachConditionToConnector(dropTarget.connectorId, {
            label: payload.label,
            status: "draft",
          });
          return;
        }
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
        if (item.kind === "transformation") {
          if (dropTarget?.type === "dimension") {
            const targetDimension = getDimensionNodeForConnectorIndex(
              dropTarget.connectorId,
              dropTarget.dimensionIndex,
            );
            if (targetDimension && !targetDimension.data.fromNetwork) {
              addTransformationToDimension(targetDimension.id, item.name, [], "network");
              setConnectorDropTarget(dropTarget);
            }
          }
          return;
        }
        if (item.kind === "condition" && dropTarget?.type === "condition") {
          attachConditionToConnector(dropTarget.connectorId, {
            label: item.name,
            status: "network",
            networkId: getLibraryRegistryName(item),
            sourceId: item.id,
          });
          return;
        }
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
      const canDropTab =
        types.includes("application/x-hypermusic-particle") ||
        types.includes("application/x-hypermusic-library");
      event.dataTransfer.dropEffect = canDropTab ? "copy" : "none";
    }
  };

  const handleTabDrop = (event: DragEvent) => {
    event.preventDefault();
    const libraryPayload = event.dataTransfer?.getData("application/x-hypermusic-library");
    if (libraryPayload) {
      try {
        const item = JSON.parse(libraryPayload) as LibraryItem;
        if (item.kind === "feature" || item.id.startsWith("feature-")) {
          void openConnectorTab(getLibraryRegistryName(item));
          return;
        }
      } catch (error) {
        console.warn("Failed to parse dropped library payload", error);
      }
    }

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
    if (!activeTabReadOnly) {
      const rootConnectorId =
        nodes.find((node) => isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot))?.id ??
        null;
      if (!rootConnectorId) return { nodes: toDelete, edges: toDeleteEdges };

      const blockedNodeIds = new SvelteSet<string>([rootConnectorId]);
      const allowedNodes = toDelete.filter((node) => !blockedNodeIds.has(node.id));
      const allowedEdges = toDeleteEdges.filter(
        (edge) => !blockedNodeIds.has(edge.source) && !blockedNodeIds.has(edge.target),
      );
      if (!allowedNodes.length && !allowedEdges.length) return false;
      return { nodes: allowedNodes, edges: allowedEdges };
    }
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

    if (isConnectorKind(sourceNode.data.kind) && targetNode.data.kind === "dimension") {
      if (sourceNode.data.fromNetwork) return false;
      const dimensionIndex = parseDimensionHandle(connection.sourceHandle);
      if (dimensionIndex === null) return false;
      if (connection.targetHandle !== "in") return false;
      if (targetNode.data.parentFeatureId && targetNode.data.parentFeatureId !== sourceNode.id) {
        return false;
      }
      return true;
    }

    if (sourceNode.data.kind === "dimension" && targetNode.data.kind === "particle") {
      if (sourceNode.data.fromNetwork) return false;
      return connection.sourceHandle === "out" && connection.targetHandle === "in";
    }

    if (isConnectorKind(sourceNode.data.kind) && targetNode.data.kind === "particle") {
      const dimensionIndex = parseDimensionHandle(connection.sourceHandle);
      if (dimensionIndex === null) return false;
      return connection.targetHandle === "in";
    }

    if (isConnectorKind(sourceNode.data.kind) && isConnectorKind(targetNode.data.kind)) {
      if (sourceNode.id === targetNode.id) return false;
      const dimensionIndex = parseDimensionHandle(connection.sourceHandle);
      if (dimensionIndex === null) return false;
      return connection.targetHandle === "in";
    }

    if (sourceNode.data.kind === "condition" && isConnectorKind(targetNode.data.kind)) {
      if (connection.sourceHandle !== "out") return false;
      const targetHandle = connection.targetHandle ?? "in";
      return targetHandle === "in" || targetHandle === "condition";
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

    const sourceNode = nodesById[connection.source];
    const targetNode = nodesById[connection.target];
    const parseEdgeRelation = (edge: Edge): "composite" | "binding" | "unknown" => {
      if (edge.data && typeof edge.data === "object") {
        const relation = (edge.data as { relation?: unknown; kind?: unknown }).relation;
        if (relation === "composite" || relation === "binding") return relation;
        const kind = (edge.data as { relation?: unknown; kind?: unknown }).kind;
        if (kind === "composite" || kind === "binding") return kind;
      }
      const label = typeof edge.label === "string" ? edge.label.trim().toLowerCase() : "";
      if (label.startsWith("composite")) return "composite";
      if (label.startsWith("binding")) return "binding";
      return "unknown";
    };

    const parseEdgeBindingSlot = (edge: Edge): number | null => {
      if (edge.data && typeof edge.data === "object") {
        const slot = (
          edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }
        ).bindingSlot;
        if (Number.isInteger(slot) && Number(slot) >= 0) return Number(slot);
        const alt = (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
          .binding_slot;
        if (Number.isInteger(alt) && Number(alt) >= 0) return Number(alt);
        const legacy = (
          edge.data as {
            bindingSlot?: unknown;
            binding_slot?: unknown;
            slot?: unknown;
          }
        ).slot;
        if (Number.isInteger(legacy) && Number(legacy) >= 0) return Number(legacy);
      }
      const label = typeof edge.label === "string" ? edge.label : "";
      const match = label.match(/slot\s+(\d+)/i);
      if (!match) return null;
      const parsed = Number(match[1]);
      return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
    };

    const nextEdge: Edge = {
      id: `edge-${connection.source}-${connection.target}-${crypto.randomUUID()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    };

    if (
      sourceNode &&
      isConnectorKind(sourceNode.data.kind) &&
      targetNode &&
      isConnectorKind(targetNode.data.kind)
    ) {
      const dimensionIndex = parseDimensionHandle(connection.sourceHandle);
      if (dimensionIndex !== null) {
        const sameDimensionEdges = edges.filter((edge) => {
          if (
            edge.source !== connection.source ||
            edge.sourceHandle !== connection.sourceHandle ||
            edge.targetHandle !== "in"
          ) {
            return false;
          }
          const edgeTargetNode = nodesById[edge.target];
          return Boolean(edgeTargetNode && isConnectorKind(edgeTargetNode.data.kind));
        });
        const hasComposite = sameDimensionEdges.some(
          (edge) => parseEdgeRelation(edge) === "composite",
        );
        if (!hasComposite) {
          nextEdge.label = `composite · D${dimensionIndex + 1}`;
          nextEdge.data = { relation: "composite" };
        } else {
          const childConnectorName = resolveNodeName(targetNode);
          let childOpenSlots = 0;
          try {
            childOpenSlots = computeConnectorOpenSlots(childConnectorName);
          } catch {
            childOpenSlots = 0;
          }
          const usedSlots = new SvelteSet<number>();
          sameDimensionEdges
            .filter((edge) => parseEdgeRelation(edge) === "binding")
            .forEach((edge) => {
              const slot = parseEdgeBindingSlot(edge);
              if (slot !== null) usedSlots.add(slot);
            });
          let slot = 0;
          while (usedSlots.has(slot) && slot < childOpenSlots) slot += 1;
          if (slot >= childOpenSlots) {
            while (usedSlots.has(slot)) slot += 1;
          }
          nextEdge.label = `binding · slot ${slot}`;
          nextEdge.data = {
            relation: "binding",
            bindingSlot: slot,
            bindingOwnerName: resolveNodeName(sourceNode),
          };
          nextEdge.style = {
            stroke: "#c97500",
            strokeDasharray: "8 5",
          };
        }
      }
    }

    edges = [...edges, nextEdge];

    if (
      sourceNode &&
      isConnectorKind(sourceNode.data.kind) &&
      targetNode?.data.kind === "dimension"
    ) {
      const dimensionIndex = parseDimensionHandle(connection.sourceHandle);
      updateNodeData(targetNode.id, {
        parentFeatureId: sourceNode.id,
        dimensionIndex: dimensionIndex ?? targetNode.data.dimensionIndex,
      });
    }

    if (
      sourceNode &&
      isConnectorKind(sourceNode.data.kind) &&
      targetNode &&
      isConnectorKind(targetNode.data.kind)
    ) {
      syncConnectorRowPreview(sourceNode.id, { schedule: false });
      scheduleLayout();
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
    if (event instanceof MouseEvent) {
      const openTreeTrigger =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-open-connector-tree]")
          : null;
      if (openTreeTrigger && isConnectorKind(node.data.kind)) {
        const connectorName =
          (openTreeTrigger.dataset.connectorName ?? "").trim() ||
          (node.data.networkId ?? "").trim() ||
          (node.data.sourceId ?? "").trim();
        if (connectorName) {
          openConnectorTab(connectorName);
          return;
        }
      }

      const target = resolveConnectorDropTargetFromEvent(event);
      if (target) {
        setConnectorDropTarget(target);
        selectedNodeId = node.id;
        return;
      }

      if (event.detail >= 2 && node.data.kind === "particle" && node.data.particleId) {
        openParticleTab(node.data.particleId);
      }
    }
  };

  const buildChainConnectorRequestBodyPreview = () => {
    if (!activeTab) return {};

    try {
      const compiled = compileDraftTransformations(nodes);
      const connectorNodesInGraph = nodes.filter((node) => isConnectorKind(node.data.kind));
      const hasConnectorGraph = connectorNodesInGraph.length > 0;
      const selectedConnectorNode = getSelectedConnectorNode();
      const selectedConnectorName = selectedConnectorNode
        ? resolveNodeName(selectedConnectorNode)
        : "";
      const runtime = hasConnectorGraph
        ? buildStudioRuntime(
            { nodes, edges },
            { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
            buildRuntimeOverrides(compiled.registry),
          )
        : null;

      const connectorName =
        selectedConnectorName ||
        runtime?.rootConnector ||
        activeTab.particleId ||
        (connectorNodesInGraph[0] ? resolveNodeName(connectorNodesInGraph[0]) : "");
      if (!connectorName) return {};

      const fromGraphNetworkNode =
        Boolean(selectedConnectorNode?.data.fromNetwork) ||
        connectorNodesInGraph.some(
          (node) => resolveNodeName(node) === connectorName && Boolean(node.data.fromNetwork),
        );
      const def =
        (fromGraphNetworkNode ? deployedRegistry.connectors[connectorName] : undefined) ??
        runtime?.registry.connectors[connectorName] ??
        deployedRegistry.connectors[connectorName] ??
        null;
      if (!def) return {};

      return {
        name: connectorName,
        dimensions: def.dimensions.map((dimension) => {
          const base = {
            transformations: dimension.transformations.map((tx) => ({
              name: tx.name,
              args: [...tx.args],
            })),
          };
          return {
            ...base,
            ...(dimension.composite ? { composite: dimension.composite } : {}),
            ...(Object.keys(dimension.bindings ?? {}).length
              ? { bindings: { ...dimension.bindings } }
              : {}),
          };
        }),
        condition_name: def.conditionName ?? "",
        condition_args: def.conditionArgs?.length ? [...def.conditionArgs] : [],
      };
    } catch {
      return {};
    }
  };

  const chainApiProtocolJson = $derived.by(() =>
    JSON.stringify(buildChainConnectorRequestBodyPreview(), null, 2),
  );

  const buildResolvedConnectorTreePreview = () => {
    const visibleNodes = nodes.filter((node) => !node.hidden);
    const connectorNodes = visibleNodes.filter((node) => isConnectorKind(node.data.kind));
    if (!connectorNodes.length) {
      return {
        root_connector: null,
        connectors: [],
        links: [],
        terminals: [],
      };
    }

    const rootNode =
      connectorNodes.find(
        (node) =>
          activeTab?.particleId &&
          normalizeKey(resolveNodeName(node)) === normalizeKey(activeTab.particleId),
      ) ??
      connectorNodes.find((node) => node.data.definitionRole === "root") ??
      connectorNodes[0];
    const rootConnectorName = resolveNodeName(rootNode);
    const links: Array<Record<string, unknown>> = [];
    const linkKeySet = new SvelteSet<string>();

    const pushLink = (link: Record<string, unknown>) => {
      const key = JSON.stringify(link);
      if (linkKeySet.has(key)) return;
      linkKeySet.add(key);
      links.push(link);
    };

    edges.forEach((edge) => {
      if (!edge.source || !edge.target) return;
      const sourceNode = nodesById[edge.source] ?? null;
      const targetNode = nodesById[edge.target] ?? null;
      if (!sourceNode || !targetNode) return;

      if (isConnectorKind(sourceNode.data.kind) && isConnectorKind(targetNode.data.kind)) {
        const sourceConnectorName = resolveNodeName(sourceNode);
        const targetConnectorName = resolveNodeName(targetNode);
        const label = typeof edge.label === "string" ? edge.label.trim() : "";
        const relationFromData =
          edge.data && typeof edge.data === "object"
            ? `${(edge.data as { relation?: unknown; kind?: unknown }).relation ?? (edge.data as { relation?: unknown; kind?: unknown }).kind ?? ""}`
                .trim()
                .toLowerCase()
            : "";
        const relation =
          relationFromData === "binding" || relationFromData === "composite"
            ? relationFromData
            : label.toLowerCase().startsWith("binding")
              ? "binding"
              : label.toLowerCase().startsWith("composite")
                ? "composite"
                : "connector_link";
        const dimension =
          parseDimensionHandle(edge.sourceHandle ?? null) !== null
            ? (parseDimensionHandle(edge.sourceHandle ?? null) ?? 0) + 1
            : null;
        const bindingSlotFromData =
          edge.data && typeof edge.data === "object"
            ? ((edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
                .bindingSlot ??
              (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
                .binding_slot ??
              (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).slot)
            : null;
        const bindingSlotNumber =
          Number.isInteger(bindingSlotFromData) && Number(bindingSlotFromData) >= 0
            ? Number(bindingSlotFromData)
            : null;
        const bindingSlotMatch = label.match(/slot\s+(\d+)/i);
        pushLink({
          owner_connector: sourceConnectorName,
          from_connector: sourceConnectorName,
          to_connector: targetConnectorName,
          relation,
          ...(dimension !== null ? { dimension } : {}),
          ...(bindingSlotNumber !== null
            ? { binding_slot: bindingSlotNumber }
            : bindingSlotMatch
              ? { binding_slot: Number(bindingSlotMatch[1]) }
              : {}),
          ...(label ? { label } : {}),
        });
        return;
      }

      if (
        sourceNode.data.kind === "dimension" &&
        (isConnectorKind(targetNode.data.kind) || targetNode.data.kind === "particle")
      ) {
        const ownerConnector = sourceNode.data.parentFeatureId
          ? (nodesById[sourceNode.data.parentFeatureId] ?? null)
          : null;
        if (!ownerConnector || !isConnectorKind(ownerConnector.data.kind)) return;
        const ownerConnectorName = resolveNodeName(ownerConnector);
        const targetName = isConnectorKind(targetNode.data.kind)
          ? resolveNodeName(targetNode)
          : (targetNode.data.particleId ?? resolveNodeName(targetNode));
        const dimension =
          typeof sourceNode.data.dimensionIndex === "number"
            ? sourceNode.data.dimensionIndex + 1
            : null;
        pushLink({
          owner_connector: ownerConnectorName,
          from_connector: ownerConnectorName,
          to: targetName,
          to_type: isConnectorKind(targetNode.data.kind) ? "connector" : "terminal_particle",
          relation: isConnectorKind(targetNode.data.kind) ? "composite_or_binding" : "terminal",
          ...(dimension !== null ? { dimension } : {}),
        });
      }
    });

    return {
      root_connector: rootConnectorName,
      root_connector_label: rootNode.data.label,
      connectors: connectorNodes.map((node) => ({
        node_id: node.id,
        name: resolveNodeName(node),
        label: node.data.label,
        dimensions: Math.max(1, Math.round(node.data.dimensions ?? 1)),
        connector_rows: node.data.connectorRows ?? [],
        condition: node.data.conditionLabel ?? "",
        from_network: Boolean(node.data.fromNetwork),
        definition_role: node.data.definitionRole ?? null,
      })),
      links,
      terminals: visibleNodes
        .filter((node) => node.data.kind === "particle")
        .map((node) => ({
          node_id: node.id,
          id: node.data.particleId ?? resolveNodeName(node),
          label: node.data.label,
        })),
    };
  };

  const chainApiResolvedJson = $derived.by(() =>
    JSON.stringify(buildResolvedConnectorTreePreview(), null, 2),
  );

  let apiEditorApplying = false;
  let chainAutoSyncStarted = false;

  type ApiDraftRequest = {
    method?: string;
    path?: string;
    body?: Record<string, unknown>;
  };

  type ApiConnectorRequestBody = {
    name?: string;
    dimensions?: Array<Record<string, unknown>>;
    condition_name?: string;
    condition_args?: number[];
  };

  type ApiDraftPreview = {
    ok?: boolean;
    warnings?: string[];
    root_connector?: string | null;
    deploy_requests?: ApiDraftRequest[];
    requests?: {
      conditions?: ApiDraftRequest[];
      transformations?: ApiDraftRequest[];
      connectors?: ApiDraftRequest[];
    };
  };

  type ApiResolvedConnectorPreview = {
    name?: string;
    label?: string;
    dimensions?: number;
    connector_rows?: Array<{
      dimension?: number;
      transformations?: string[];
    }>;
    condition?: string;
    from_network?: boolean;
  };

  type ApiResolvedLinkPreview = {
    owner_connector?: string;
    relation?: string;
    to_connector?: string;
    dimension?: number;
    binding_slot?: number;
  };

  type ApiResolvedTreePreview = {
    root_connector?: string | null;
    root_connector_label?: string | null;
    connectors?: ApiResolvedConnectorPreview[];
    links?: ApiResolvedLinkPreview[];
  };

  const isConnectorRequestBody = (value: unknown): value is ApiConnectorRequestBody => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.name === "string" &&
      Array.isArray(candidate.dimensions) &&
      candidate.dimensions.every((dimension) => Boolean(dimension && typeof dimension === "object"))
    );
  };

  const isResolvedTreePreview = (value: unknown): value is ApiResolvedTreePreview => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return Array.isArray(candidate.connectors);
  };

  const parseTransformationPreview = (
    rawValue: string,
  ): { name: string; args: number[] } | null => {
    const raw = rawValue.trim();
    if (!raw) return null;
    const match = raw.match(/^\s*([^()]+?)(?:\(([^)]*)\))?\s*$/);
    const name = (match?.[1] ?? raw).trim();
    if (!name) return null;
    const argsRaw = (match?.[2] ?? "").trim();
    const args = argsRaw
      ? argsRaw
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value))
      : [];
    return { name, args };
  };

  const toConnectorBodyFromDef = (connector: StudioConnectorDef): Record<string, unknown> => ({
    name: connector.name,
    dimensions: connector.dimensions.map((dimension) => ({
      transformations: dimension.transformations.map((tx) => ({
        name: tx.name,
        args: [...tx.args],
      })),
      ...(dimension.composite ? { composite: dimension.composite } : {}),
      ...(Object.keys(dimension.bindings ?? {}).length
        ? { bindings: { ...dimension.bindings } }
        : {}),
    })),
    condition_name: connector.conditionName ?? "",
    condition_args: connector.conditionName ? [...(connector.conditionArgs ?? [])] : [],
  });

  const convertResolvedTreePreviewToDraft = (
    resolved: ApiResolvedTreePreview,
  ): {
    preview: ApiDraftPreview;
    readOnlyByName: Map<string, boolean>;
  } => {
    const currentResolved = buildResolvedConnectorTreePreview() as ApiResolvedTreePreview;

    const connectorByName = new Map<string, ApiResolvedConnectorPreview>();
    const readOnlyByName = new Map<string, boolean>();

    (resolved.connectors ?? []).forEach((connector) => {
      const name = `${connector.name ?? ""}`.trim();
      if (!name) return;
      connectorByName.set(name, connector);
      if (Boolean(connector.from_network)) {
        readOnlyByName.set(name, true);
      }
    });

    (currentResolved.connectors ?? []).forEach((connector) => {
      const name = `${connector.name ?? ""}`.trim();
      if (!name || !connector.from_network) return;
      readOnlyByName.set(name, true);
      connectorByName.set(name, connector);
    });

    const readOnlyOwners = new SvelteSet<string>(
      Array.from(readOnlyByName.entries())
        .filter(([, flag]) => flag)
        .map(([name]) => name),
    );

    const inputLinks = (resolved.links ?? []).filter((link) =>
      Boolean(link && typeof link === "object"),
    );
    const currentReadOnlyLinks = (currentResolved.links ?? []).filter((link) => {
      const owner = `${link.owner_connector ?? ""}`.trim();
      return owner.length > 0 && readOnlyOwners.has(owner);
    });
    const mutableInputLinks = inputLinks.filter((link) => {
      const owner = `${link.owner_connector ?? ""}`.trim();
      return owner.length === 0 || !readOnlyOwners.has(owner);
    });
    const mergedLinks = [...mutableInputLinks, ...currentReadOnlyLinks];

    const connectorBodyByName = new Map<string, Record<string, unknown>>();
    connectorByName.forEach((connector, name) => {
      const isReadOnly = readOnlyByName.get(name) ?? false;
      if (isReadOnly && deployedRegistry.connectors[name]) {
        connectorBodyByName.set(name, toConnectorBodyFromDef(deployedRegistry.connectors[name]));
        return;
      }

      const rows = Array.isArray(connector.connector_rows) ? connector.connector_rows : [];
      const inferredDimensionsFromRows = rows.reduce((max, row) => {
        const dim = Number(row?.dimension ?? 0);
        return Number.isFinite(dim) ? Math.max(max, Math.trunc(dim)) : max;
      }, 0);
      const configuredDimensions = Math.max(
        1,
        Math.trunc(Number(connector.dimensions ?? inferredDimensionsFromRows ?? 1)),
      );
      const dimensions = Array.from({ length: configuredDimensions }, () => ({
        transformations: [] as Array<{ name: string; args: number[] }>,
        composite: "",
        bindings: {} as Record<string, string>,
      }));

      rows.forEach((row) => {
        const dim = Number(row?.dimension ?? 0);
        const dimIndex = Number.isFinite(dim) ? Math.trunc(dim) - 1 : -1;
        if (dimIndex < 0 || dimIndex >= dimensions.length) return;
        const txLabels = Array.isArray(row?.transformations) ? row.transformations : [];
        const parsed = txLabels
          .map((label) => parseTransformationPreview(`${label ?? ""}`))
          .filter((value): value is { name: string; args: number[] } => Boolean(value));
        dimensions[dimIndex].transformations = parsed;
      });

      connectorBodyByName.set(name, {
        name,
        dimensions: dimensions.map((dimension) => ({
          transformations: dimension.transformations.map((tx) => ({
            name: tx.name,
            args: [...tx.args],
          })),
          ...(dimension.composite ? { composite: dimension.composite } : {}),
          ...(Object.keys(dimension.bindings).length
            ? { bindings: { ...dimension.bindings } }
            : {}),
        })),
        condition_name: `${connector.condition ?? ""}`.trim(),
        condition_args: [],
      });
    });

    mergedLinks.forEach((link) => {
      const owner = `${link.owner_connector ?? ""}`.trim();
      if (!owner || readOnlyByName.get(owner)) return;
      const body = connectorBodyByName.get(owner);
      if (!body) return;

      const dimensions = Array.isArray(body.dimensions)
        ? (body.dimensions as Array<Record<string, unknown>>)
        : [];
      const dimensionNumber = Number(link.dimension ?? 0);
      const dimensionIndex = Number.isFinite(dimensionNumber)
        ? Math.trunc(dimensionNumber) - 1
        : -1;
      if (dimensionIndex < 0 || dimensionIndex >= dimensions.length) return;
      const relation = `${link.relation ?? ""}`.trim().toLowerCase();
      const target = `${link.to_connector ?? ""}`.trim();
      if (!target) return;

      if (relation === "composite") {
        dimensions[dimensionIndex].composite = target;
        return;
      }

      if (relation === "binding") {
        const slot = Number(link.binding_slot);
        if (!Number.isInteger(slot) || slot < 0) return;
        const bindings =
          dimensions[dimensionIndex].bindings &&
          typeof dimensions[dimensionIndex].bindings === "object" &&
          !Array.isArray(dimensions[dimensionIndex].bindings)
            ? (dimensions[dimensionIndex].bindings as Record<string, string>)
            : {};
        bindings[String(slot)] = target;
        dimensions[dimensionIndex].bindings = bindings;
      }
    });

    const connectorBodies = Array.from(connectorBodyByName.values());
    const rootConnector = `${resolved.root_connector ?? ""}`.trim();
    const fallbackRoot =
      rootConnector ||
      (connectorBodies.length
        ? `${(connectorBodies[0] as Record<string, unknown>).name ?? ""}`.trim()
        : "");

    return {
      preview: {
        root_connector: fallbackRoot || null,
        deploy_requests: connectorBodies.map((body) => ({
          method: "POST",
          path: "/chain/connector",
          body,
        })),
      },
      readOnlyByName,
    };
  };

  const normalizeApiRequestPath = (path?: string) => {
    const raw = typeof path === "string" ? path.trim() : "";
    if (!raw) return "";
    try {
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        return new URL(raw).pathname.replace(/\/+$/, "");
      }
    } catch {
      // fall through to raw path
    }
    return raw.replace(/\/+$/, "");
  };

  const isApiPath = (path: string, expected: string) => {
    const normalized = normalizeApiRequestPath(path);
    return normalized === expected || normalized.endsWith(expected);
  };

  const normalizeDeployRequests = (
    preview: ApiDraftPreview | ApiDraftRequest[],
  ): ApiDraftRequest[] => {
    if (Array.isArray(preview)) {
      return preview.filter((request): request is ApiDraftRequest =>
        Boolean(request && typeof request === "object"),
      );
    }

    if (Array.isArray(preview.deploy_requests)) {
      return preview.deploy_requests.filter((request): request is ApiDraftRequest =>
        Boolean(request && typeof request === "object"),
      );
    }

    const requests = preview.requests;
    if (!requests || typeof requests !== "object") return [];
    const conditions = Array.isArray(requests.conditions) ? requests.conditions : [];
    const transformations = Array.isArray(requests.transformations) ? requests.transformations : [];
    const connectors = Array.isArray(requests.connectors) ? requests.connectors : [];
    return [...conditions, ...transformations, ...connectors].filter(
      (request): request is ApiDraftRequest => Boolean(request && typeof request === "object"),
    );
  };

  const applyApiPreviewJsonToStudio = (rawJson: string) => {
    if (!activeTab) throw new Error("No active tab.");
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(rawJson) as unknown;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Invalid JSON.");
    }

    let connectorReadOnlyByName = new Map<string, boolean>();
    let connectorLabelByName = new Map<string, string>();
    let requestedRootLabelFromResolved = "";
    if (isResolvedTreePreview(parsedRaw)) {
      requestedRootLabelFromResolved =
        typeof parsedRaw.root_connector_label === "string"
          ? parsedRaw.root_connector_label.trim()
          : "";
      connectorLabelByName = new SvelteMap(
        (parsedRaw.connectors ?? [])
          .map((connector) => {
            const name = `${connector.name ?? ""}`.trim();
            const label = `${connector.label ?? ""}`.trim();
            return name && label ? ([name, label] as const) : null;
          })
          .filter((entry): entry is readonly [string, string] => Boolean(entry)),
      );
      const converted = convertResolvedTreePreviewToDraft(parsedRaw);
      parsedRaw = converted.preview;
      connectorReadOnlyByName = converted.readOnlyByName;
    }

    const parsed: ApiDraftPreview = isConnectorRequestBody(parsedRaw)
      ? ({
          root_connector: parsedRaw.name?.trim() ?? "",
          deploy_requests: [
            {
              method: "POST",
              path: "/chain/connector",
              body: parsedRaw as Record<string, unknown>,
            },
          ],
        } satisfies ApiDraftPreview)
      : Array.isArray(parsedRaw)
        ? ({ deploy_requests: parsedRaw as ApiDraftRequest[] } satisfies ApiDraftPreview)
        : ((parsedRaw as ApiDraftPreview) ?? {});

    const deployRequests = normalizeDeployRequests(parsed);
    if (!deployRequests.length) {
      throw new Error(
        "JSON must be a connector body or include deploy_requests (or legacy requests.conditions/transformations/connectors).",
      );
    }

    const connectorReqs = deployRequests.filter((request) =>
      isApiPath(request.path ?? "", "/chain/connector"),
    );
    const connectorBodies = connectorReqs
      .map((request) =>
        request?.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>)
          : null,
      )
      .filter((body): body is Record<string, unknown> => Boolean(body));
    if (!connectorBodies.length) {
      throw new Error("deploy_requests must include at least one POST /chain/connector body.");
    }

    const connectorBodyByName = new SvelteMap<string, Record<string, unknown>>();
    connectorBodies.forEach((body) => {
      const name = String(body.name ?? "").trim();
      if (!name) return;
      connectorBodyByName.set(name, body);
    });

    const requestedRootConnector =
      typeof parsed.root_connector === "string" ? parsed.root_connector.trim() : "";
    const connectorNames = connectorBodies
      .map((body) => String(body.name ?? "").trim())
      .filter((name) => name.length > 0);
    if (!connectorNames.length) {
      throw new Error("Each connector request body must include a connector name.");
    }

    const referencedConnectorNames = new SvelteSet<string>();
    connectorBodies.forEach((body) => {
      const dimensions = Array.isArray(body.dimensions)
        ? (body.dimensions as Array<Record<string, unknown>>)
        : [];
      dimensions.forEach((dimension) => {
        const compositeName =
          typeof dimension.composite === "string" ? dimension.composite.trim() : "";
        if (compositeName) referencedConnectorNames.add(compositeName);
        const bindings =
          dimension.bindings && typeof dimension.bindings === "object"
            ? (dimension.bindings as Record<string, unknown>)
            : {};
        Object.values(bindings).forEach((targetRaw) => {
          const targetName = typeof targetRaw === "string" ? targetRaw.trim() : "";
          if (targetName) referencedConnectorNames.add(targetName);
        });
      });
    });

    const inferredRootConnector =
      connectorNames.find((name) => !referencedConnectorNames.has(name)) ?? connectorNames[0];

    let rootConnectorName = requestedRootConnector || inferredRootConnector;
    let requestedRootLabelFallback = "";
    if (requestedRootConnector && !connectorBodyByName.has(requestedRootConnector)) {
      // If user typed a human title into `root_connector`, treat it as a label override
      // and keep the inferred/valid root id.
      rootConnectorName = inferredRootConnector;
      requestedRootLabelFallback = requestedRootConnector;
    }
    if (!rootConnectorName) {
      throw new Error("root_connector is required (or inferable from connector dependencies).");
    }
    const rootConnectorBody = connectorBodyByName.get(rootConnectorName);
    if (!rootConnectorBody) {
      throw new Error(`Connector request for "${rootConnectorName}" is required.`);
    }

    const conditionReqs = deployRequests.filter((request) =>
      isApiPath(request.path ?? "", "/chain/condition"),
    );
    const conditionSourceByName = new SvelteMap<string, string>();
    conditionReqs.forEach((req) => {
      if (!req?.body || typeof req.body !== "object") return;
      const body = req.body as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const src = typeof body.sol_src === "string" ? body.sol_src : "";
      if (!name) return;
      conditionSourceByName.set(name, src);
    });

    const transformationReqs = deployRequests.filter((request) =>
      isApiPath(request.path ?? "", "/chain/transformation"),
    );
    const transformationSourceByName = new SvelteMap<string, string>();
    transformationReqs.forEach((req) => {
      if (!req?.body || typeof req.body !== "object") return;
      const body = req.body as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const src = typeof body.sol_src === "string" ? body.sol_src : "";
      if (!name) return;
      transformationSourceByName.set(name, src);
    });

    const nextNodes: StudioNode[] = [];
    const nextEdges: Edge[] = [];
    const connectorNodeByName = new SvelteMap<string, StudioNode>();
    const particleNodeByName = new SvelteMap<string, StudioNode>();
    const conditionNodeByName = new SvelteMap<string, StudioNode>();
    const edgeKeySet = new SvelteSet<string>();

    const adjacency = new SvelteMap<string, string[]>();
    connectorNames.forEach((name) => adjacency.set(name, []));
    connectorBodies.forEach((body) => {
      const sourceName = String(body.name ?? "").trim();
      if (!sourceName) return;
      const dimensions = Array.isArray(body.dimensions)
        ? (body.dimensions as Array<Record<string, unknown>>)
        : [];
      const children: string[] = [];
      dimensions.forEach((dimension) => {
        const compositeName =
          typeof dimension.composite === "string" ? dimension.composite.trim() : "";
        if (compositeName && connectorBodyByName.has(compositeName)) {
          children.push(compositeName);
        }
        const bindings =
          dimension.bindings && typeof dimension.bindings === "object"
            ? (dimension.bindings as Record<string, unknown>)
            : {};
        Object.values(bindings).forEach((targetRaw) => {
          const targetName = typeof targetRaw === "string" ? targetRaw.trim() : "";
          if (targetName && connectorBodyByName.has(targetName)) {
            children.push(targetName);
          }
        });
      });
      adjacency.set(sourceName, Array.from(new SvelteSet(children)));
    });

    const connectorLevel = new SvelteMap<string, number>();
    const queue: string[] = [];
    const queued = new SvelteSet<string>();
    const orderedConnectorNames: string[] = [];
    const pushConnector = (name: string) => {
      if (!name || queued.has(name)) return;
      queued.add(name);
      queue.push(name);
    };
    pushConnector(rootConnectorName);
    while (queue.length) {
      const current = queue.shift()!;
      orderedConnectorNames.push(current);
      const level = connectorLevel.has(current) ? (connectorLevel.get(current) ?? 0) : 0;
      connectorLevel.set(current, level);
      (adjacency.get(current) ?? []).forEach((childName) => {
        const nextLevel = level + 1;
        if (!connectorLevel.has(childName) || (connectorLevel.get(childName) ?? 0) > nextLevel) {
          connectorLevel.set(childName, nextLevel);
        }
        pushConnector(childName);
      });
    }
    connectorNames.forEach((name) => {
      if (!orderedConnectorNames.includes(name)) orderedConnectorNames.push(name);
      if (!connectorLevel.has(name)) connectorLevel.set(name, 0);
    });

    const levelCounters = new SvelteMap<number, number>();
    orderedConnectorNames.forEach((connectorName) => {
      const connectorBody = connectorBodyByName.get(connectorName);
      if (!connectorBody) return;
      const connectorIsReadOnly = connectorReadOnlyByName.get(connectorName) ?? false;
      const dimensionsRaw = Array.isArray(connectorBody.dimensions)
        ? (connectorBody.dimensions as Array<Record<string, unknown>>)
        : [];
      if (!dimensionsRaw.length) return;
      const level = connectorLevel.get(connectorName) ?? 0;
      const rowIndex = levelCounters.get(level) ?? 0;
      levelCounters.set(level, rowIndex + 1);

      const connectorRowsFromApi: ConnectorRowPreview[] = dimensionsRaw.map(
        (dimension, dimIndex) => {
          const txDefs = Array.isArray(dimension.transformations)
            ? (dimension.transformations as Array<Record<string, unknown>>)
            : [];
          const transformations = txDefs
            .map((tx) => {
              const name = typeof tx.name === "string" ? tx.name.trim() : "";
              if (!name) return null;
              const args = Array.isArray(tx.args)
                ? tx.args.map((arg) => Number(arg)).filter((arg) => Number.isFinite(arg))
                : [];
              return formatTransformationPreviewLabel(name, args);
            })
            .filter((value): value is string => Boolean(value));
          return {
            dimension: dimIndex + 1,
            transformations,
          };
        },
      );

      const connectorNode: StudioNode = {
        id: `feature-${crypto.randomUUID()}`,
        type: "connector",
        draggable: false,
        position: { x: 260 + level * 360, y: 80 + rowIndex * 320 },
        data: {
          label:
            (connectorName === rootConnectorName
              ? requestedRootLabelFromResolved || requestedRootLabelFallback
              : "") ||
            connectorLabelByName.get(connectorName) ||
            connectorName,
          kind: "connector",
          dimensions: dimensionsRaw.length,
          connectorRows: connectorRowsFromApi,
          fromNetwork: connectorIsReadOnly,
          tabRoot: connectorName === rootConnectorName,
        },
      };
      connectorNodeByName.set(connectorName, connectorNode);
      nextNodes.push(connectorNode);
    });

    const addEdgeIfMissing = (edge: Omit<Edge, "id">) => {
      const relationPart =
        edge.data && typeof edge.data === "object"
          ? `${(edge.data as { relation?: unknown; kind?: unknown }).relation ?? (edge.data as { relation?: unknown; kind?: unknown }).kind ?? ""}`
          : "";
      const bindingSlotPart =
        edge.data && typeof edge.data === "object"
          ? `${(edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).bindingSlot ?? (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).binding_slot ?? (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).slot ?? ""}`
          : "";
      const key = `${edge.source}|${edge.sourceHandle ?? ""}|${edge.target}|${edge.targetHandle ?? ""}|${relationPart}|${bindingSlotPart}|${edge.label ?? ""}`;
      if (edgeKeySet.has(key)) return;
      edgeKeySet.add(key);
      nextEdges.push({
        id: `edge-${crypto.randomUUID()}`,
        ...edge,
      });
    };

    connectorBodies.forEach((connectorBody) => {
      const connectorName = String(connectorBody.name ?? "").trim();
      const connectorNode = connectorNodeByName.get(connectorName) ?? null;
      if (!connectorNode) return;
      const connectorIsReadOnly = connectorReadOnlyByName.get(connectorName) ?? false;

      const conditionName =
        typeof connectorBody.condition_name === "string" ? connectorBody.condition_name.trim() : "";
      if (conditionName) {
        let conditionNode = conditionNodeByName.get(conditionName) ?? null;
        if (!conditionNode) {
          const isDraftCondition = conditionSourceByName.has(conditionName);
          conditionNode = {
            id: `condition-${crypto.randomUUID()}`,
            type: "condition",
            draggable: false,
            position: {
              x: connectorNode.position.x,
              y: connectorNode.position.y - 120,
            },
            data: {
              label: conditionName,
              kind: "condition",
              fromNetwork: !isDraftCondition,
              ...(isDraftCondition ? {} : { networkId: conditionName }),
            },
          };
          conditionNodeByName.set(conditionName, conditionNode);
          nextNodes.push(conditionNode);
          if (isDraftCondition) {
            conditionCodeById.set(conditionNode.id, conditionSourceByName.get(conditionName) ?? "");
          }
        }
        addEdgeIfMissing({
          source: conditionNode.id,
          sourceHandle: "out",
          target: connectorNode.id,
          targetHandle: "in",
        });
      }

      const dimensionsRaw = Array.isArray(connectorBody.dimensions)
        ? (connectorBody.dimensions as Array<Record<string, unknown>>)
        : [];
      dimensionsRaw.forEach((dimension, dimIndex) => {
        const dimNode = createDimensionNode(connectorNode, dimIndex, dimensionsRaw.length);
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
            const isDraft = transformationSourceByName.has(name) || !connectorIsReadOnly;
            return createTransformationInstance(name, args, isDraft ? "draft" : "network");
          })
          .filter((value): value is TransformationInstance => Boolean(value));

        dimNode.data = {
          ...dimNode.data,
          transformations: txInstances,
        };
        nextNodes.push(dimNode);
        addEdgeIfMissing({
          source: connectorNode.id,
          sourceHandle: `dim-${dimIndex}`,
          target: dimNode.id,
          targetHandle: "in",
        });

        txInstances.forEach((tx) => {
          if (tx.status !== "draft") return;
          const source = transformationSourceByName.get(tx.name);
          if (source) transformationCodeById.set(tx.id, source);
        });

        const bindingEntries =
          dimension.bindings && typeof dimension.bindings === "object"
            ? Object.entries(dimension.bindings as Record<string, unknown>)
                .filter(([slot]) => /^\d+$/.test(slot.trim()))
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([slot, targetRaw]) => ({
                  slotId: Number(slot),
                  targetName: typeof targetRaw === "string" ? targetRaw.trim() : "",
                }))
                .filter(
                  (value) =>
                    Number.isInteger(value.slotId) && value.slotId >= 0 && value.targetName,
                )
            : [];
        const compositeName =
          typeof dimension.composite === "string" ? dimension.composite.trim() : "";
        const targets: Array<{
          relation: "composite" | "binding";
          targetName: string;
          slotId?: number;
        }> = [
          ...(compositeName ? [{ relation: "composite" as const, targetName: compositeName }] : []),
          ...bindingEntries.map((binding) => ({
            relation: "binding" as const,
            targetName: binding.targetName,
            slotId: binding.slotId,
          })),
        ];

        targets.forEach((item, targetIndex) => {
          const targetName = item.targetName;
          const targetConnectorNode = connectorNodeByName.get(targetName) ?? null;
          if (targetConnectorNode) {
            addEdgeIfMissing({
              source: connectorNode.id,
              sourceHandle: `dim-${dimIndex}`,
              target: targetConnectorNode.id,
              targetHandle: "in",
              ...(item.relation === "composite"
                ? {
                    label: `composite · D${dimIndex + 1}`,
                    data: { relation: "composite" },
                  }
                : {
                    label: `binding · slot ${item.slotId ?? 0}`,
                    data: {
                      relation: "binding",
                      bindingSlot: item.slotId ?? 0,
                      bindingOwnerName: connectorName,
                    },
                    style: {
                      stroke: "#c97500",
                      strokeDasharray: "8 5",
                    },
                  }),
            });
            return;
          }

          let particleNode = particleNodeByName.get(targetName) ?? null;
          if (!particleNode) {
            const particleMeta = networkParticles.find((item) => item.id === targetName);
            particleNode = {
              id: `particle-${crypto.randomUUID()}`,
              type: "particle",
              draggable: false,
              position: {
                x: dimNode.position.x + targetIndex * 120,
                y: dimNode.position.y + 180,
              },
              data: {
                label: particleMeta?.name ?? targetName,
                kind: "particle",
                particleId: targetName,
                networkId: targetName,
                fromNetwork: true,
              },
            };
            particleNodeByName.set(targetName, particleNode);
            nextNodes.push(particleNode);
          }

          addEdgeIfMissing({
            source: connectorNode.id,
            sourceHandle: `dim-${dimIndex}`,
            target: particleNode.id,
            targetHandle: "in",
            ...(item.relation === "composite"
              ? {
                  label: `composite · D${dimIndex + 1}`,
                  data: { relation: "composite" },
                }
              : {
                  label: `binding · slot ${item.slotId ?? 0}`,
                  data: {
                    relation: "binding",
                    bindingSlot: item.slotId ?? 0,
                    bindingOwnerName: connectorName,
                  },
                  style: {
                    stroke: "#c97500",
                    strokeDasharray: "8 5",
                  },
                }),
          });
        });
      });
    });

    apiEditorApplying = true;
    try {
      const rootConnectorLabel =
        requestedRootLabelFromResolved ||
        requestedRootLabelFallback ||
        connectorLabelByName.get(rootConnectorName) ||
        rootConnectorName;
      nodes = nextNodes;
      edges = nextEdges;
      selectedNodeId = null;
      tabs = tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              label: rootConnectorLabel,
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
    const nextGenerated = chainApiResolvedJson;
    const userHasUnsavedJsonDraft =
      apiEditorFocused &&
      apiEditorText.trim().length > 0 &&
      apiEditorText.trim() !== apiEditorLastGenerated.trim();
    apiEditorLastGenerated = nextGenerated;
    if (userHasUnsavedJsonDraft) return;
    apiEditorText = nextGenerated;
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
      aria-label="Connector tabs"
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
        aria-label="Create new connector tab"
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
            ariaLabel="New Connector"
            title="New Connector — A connector defines dimensions (connection points) and the transformations that live on those dimensions."
            className="icon-btn"
            draggable
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addQuickNode("connector", "New Connector");
            }}
            ondragstart={(event) => handleQuickDragStart(event, "connector", "New Connector")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              <path d="M12 8v8M8 12h8"></path>
            </svg>
          </Button>
          <Button
            variant="ghost"
            ariaLabel="New Transformation"
            title="New Transformation — Transformations live on connector dimensions and specify how values are selected from the attached particle."
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
            title="New Condition — A connector only outputs values if its condition is met."
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
              "Sync owned chain connectors, transformations, conditions and particles"}
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
          <button
            type="button"
            class={`source-tab ${explorerSource === "formats" ? "is-active" : ""}`}
            onclick={() => (explorerSource = "formats")}
          >
            Formats
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
        {#if explorerSource !== "formats"}
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
                selected={libraryTab === "connectors"}
                onclick={() => (libraryTab = "connectors")}
              >
                Connectors
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
        {/if}
        {#if explorerSource === "formats"}
          <section class="format-panel" aria-label="Create format">
            <div class="format-panel-head">
              <p class="format-panel-title">Create format</p>
              <span class="format-panel-count">{selectedFormatParticleIds.length} selected</span>
            </div>
            <p class="format-panel-copy">
              Select terminal particles and save a named format. It will appear as a format event in
              the network feed.
            </p>
            <input
              class="format-panel-input"
              type="text"
              placeholder="Format name"
              bind:value={formatNameDraft}
              oninput={() => {
                formatCreateError = null;
                formatCreateStatus = null;
              }}
            />
            <input
              class="format-panel-input format-panel-input--compact"
              type="text"
              placeholder="Add terminal particles by name (comma or Enter)"
              bind:value={formatParticleSearchDraft}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitFormatParticleSearchInput();
                }
              }}
              onblur={() => {
                if (formatParticleSearchDraft.trim()) commitFormatParticleSearchInput();
              }}
              oninput={() => {
                formatCreateError = null;
                formatCreateStatus = null;
              }}
            />
            {#if selectedFormatParticles.length > 0}
              <div class="format-selected-list" aria-label="Selected terminal particles">
                <span class="format-selected-label">Selected:</span>
                <span class="format-selected-values">
                  {#each selectedFormatParticles as particle, index (particle.id)}
                    <button
                      type="button"
                      class="format-selected-item"
                      onclick={() => toggleFormatParticleSelection(particle.id)}
                      title="Remove particle"
                    >
                      {particle.name}
                    </button>
                    {#if index < selectedFormatParticles.length - 1}
                      <span class="format-selected-separator" aria-hidden="true">, </span>
                    {/if}
                  {/each}
                </span>
              </div>
            {/if}
            {#if formatParticleChoices.length === 0}
              <p class="format-panel-empty">
                No chain particles synced yet. Use the Network tab sync first.
              </p>
            {:else if formatParticleSearchDraft.trim().length > 0}
              {#if formatParticleSearchResults.length > 0}
                <div class="format-search-results" role="list" aria-label="Particle matches">
                  {#each formatParticleSearchResults as particle (particle.id)}
                    <button
                      type="button"
                      class="format-search-result"
                      onclick={() => {
                        addFormatParticleSelection(particle.id);
                        formatParticleSearchDraft = "";
                      }}
                    >
                      <span class="format-search-result-name">{particle.name}</span>
                      <span class="format-search-result-id">{particle.id}</span>
                    </button>
                  {/each}
                </div>
              {:else}
                <p class="format-panel-empty">No particle matches that name.</p>
              {/if}
            {/if}
            <div class="format-panel-actions">
              <Button variant="ghost" type="button" onclick={resetFormatDraft}>Reset</Button>
              <Button
                variant="primary"
                type="button"
                onclick={handleCreateFormat}
                disabled={!formatNameDraft.trim() || selectedFormatParticleIds.length === 0}
              >
                Create format
              </Button>
            </div>
            {#if formatCreateStatus}
              <p class="format-panel-status">{formatCreateStatus}</p>
            {/if}
            {#if formatCreateError}
              <p class="format-panel-error">{formatCreateError}</p>
            {/if}
            {#if localFormats.length > 0}
              <div class="format-panel-list">
                <p class="format-panel-subtitle">Saved formats</p>
                <div class="format-panel-list-items">
                  {#each localFormats.slice(0, 8) as format (format.id)}
                    <a class="format-panel-link" href={resolve("/f/[slug]", { slug: format.slug })}>
                      <span>{format.name}</span>
                      <small>{format.terminalParticleIds.length} terminals</small>
                    </a>
                  {/each}
                </div>
              </div>
            {/if}
          </section>
        {:else if libraryTab === "connectors"}
          <StudioLibraryList
            title="Connectors"
            items={libraryItems}
            loading={(explorerSource === "network" && chainSyncBusy) ||
              (explorerSource === "toolbox" && toolboxLoadBusy)}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else if libraryTab === "transformations"}
          <div class="library-create-actions">
            <Button
              variant="ghost"
              type="button"
              disabled={activeTabReadOnly}
              onclick={openNewTransformationEditor}
            >
              New transformation
            </Button>
            {#if libraryCreateActionError}
              <p class="library-create-error">{libraryCreateActionError}</p>
            {/if}
          </div>
          <StudioLibraryList
            title="Transformations"
            items={libraryItems}
            loading={(explorerSource === "network" && chainSyncBusy) ||
              (explorerSource === "toolbox" && toolboxLoadBusy)}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else if libraryTab === "conditions"}
          <div class="library-create-actions">
            <Button
              variant="ghost"
              type="button"
              disabled={activeTabReadOnly}
              onclick={openNewConditionEditor}
            >
              New condition
            </Button>
            {#if libraryCreateActionError}
              <p class="library-create-error">{libraryCreateActionError}</p>
            {/if}
          </div>
          <StudioLibraryList
            title="Conditions"
            items={libraryItems}
            loading={(explorerSource === "network" && chainSyncBusy) ||
              (explorerSource === "toolbox" && toolboxLoadBusy)}
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
            loading={(explorerSource === "network" && chainSyncBusy) ||
              (explorerSource === "toolbox" && toolboxLoadBusy)}
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
                {@const isNameReadOnly = isReadOnly || selectedNode.data.kind === "condition"}
                <label class="inspector-label" for="node-name">Name</label>
                <input
                  id="node-name"
                  class="inspector-input"
                  value={nameDraft}
                  disabled={isNameReadOnly}
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
                {#if isConnectorKind(selectedNode.data.kind)}
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
                  <div class="inspector-section">
                    <div class="inspector-section-title">Connector dimensions</div>
                    {#if getSortedConnectorDimensions(selectedNode.id).length === 0}
                      <div class="inspector-hint">No dimensions configured yet.</div>
                    {:else}
                      {#each getSortedConnectorDimensions(selectedNode.id) as dimensionNode, dimIndex (dimensionNode.id)}
                        {@const locked = dimensionNode.data.riLocked ?? false}
                        <div class="inspector-row">
                          <span>#{dimIndex + 1}</span>
                          <span>{(dimensionNode.data.transformations ?? []).length} tx</span>
                        </div>
                        <div class="inspector-inline">
                          <label
                            class="inspector-inline-label"
                            for={`ri-start-${dimensionNode.id}`}
                          >
                            Start
                          </label>
                          <input
                            id={`ri-start-${dimensionNode.id}`}
                            class="inspector-input inspector-input--compact inspector-input--inline"
                            type="number"
                            inputmode="numeric"
                            min="0"
                            step="1"
                            value={dimensionNode.data.riStart ?? 0}
                            disabled={isReadOnly && locked}
                            oninput={(event) => {
                              const target = event.target as HTMLInputElement | null;
                              updateNodeData(dimensionNode.id, {
                                riStart: toInt(target?.value ?? "0"),
                              });
                            }}
                          />
                          <label
                            class="inspector-inline-label"
                            for={`ri-shift-${dimensionNode.id}`}
                          >
                            Shift
                          </label>
                          <input
                            id={`ri-shift-${dimensionNode.id}`}
                            class="inspector-input inspector-input--compact inspector-input--inline"
                            type="number"
                            inputmode="numeric"
                            min="0"
                            step="1"
                            value={dimensionNode.data.riShift ?? 0}
                            disabled={isReadOnly && locked}
                            oninput={(event) => {
                              const target = event.target as HTMLInputElement | null;
                              updateNodeData(dimensionNode.id, {
                                riShift: toInt(target?.value ?? "0"),
                              });
                            }}
                          />
                          <button
                            type="button"
                            class={`inspector-toggle ${locked ? "is-locked" : ""}`}
                            disabled={isReadOnly}
                            onclick={() => updateNodeData(dimensionNode.id, { riLocked: !locked })}
                          >
                            {locked ? "fixed" : "open"}
                          </button>
                        </div>
                        {#if (dimensionNode.data.transformations ?? []).length > 0}
                          <div class="inspector-transform-list inspector-transform-list--compact">
                            {#each dimensionNode.data.transformations ?? [] as transformation (transformation.id)}
                              {@const isNetwork = transformation.status === "network"}
                              {@const canEditArgs = !isReadOnly}
                              <div class="inspector-transform-row">
                                <div class="inspector-transform-readonly">
                                  <span class="inspector-transform-name">{transformation.name}</span
                                  >
                                  {#if canEditArgs}
                                    <input
                                      class="inspector-input inspector-input--compact inspector-transform-args-input"
                                      value={transformation.args.join(", ")}
                                      placeholder="args: 0, 1"
                                      oninput={(event) => {
                                        const target = event.target as HTMLInputElement | null;
                                        updateTransformationArgsOnDimension(
                                          dimensionNode.id,
                                          transformation.id,
                                          target?.value ?? "",
                                        );
                                      }}
                                    />
                                  {:else}
                                    <span class="inspector-transform-args">
                                      args: {transformation.args.length
                                        ? transformation.args.join(", ")
                                        : "none"}
                                    </span>
                                  {/if}
                                </div>
                                <div class="inspector-transform-meta">
                                  <span class="inspector-tag">
                                    {isNetwork ? "Network" : "Draft"}
                                  </span>
                                </div>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/each}
                    {/if}
                  </div>
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
                      {#if (selectedNode.data.transformations ?? []).length === 0}
                        <div class="inspector-hint">No transformations on this dimension.</div>
                      {:else}
                        {#each selectedNode.data.transformations ?? [] as transformation (transformation.id)}
                          {@const isNetwork = transformation.status === "network"}
                          {@const canEditArgs = !isReadOnly}
                          <div class="inspector-transform-row">
                            <div class="inspector-transform-readonly">
                              <span class="inspector-transform-name">{transformation.name}</span>
                              {#if canEditArgs}
                                <input
                                  class="inspector-input inspector-input--compact inspector-transform-args-input"
                                  value={transformation.args.join(", ")}
                                  placeholder="args: 0, 1"
                                  oninput={(event) => {
                                    const target = event.target as HTMLInputElement | null;
                                    updateTransformationArgsOnDimension(
                                      selectedNode.id,
                                      transformation.id,
                                      target?.value ?? "",
                                    );
                                  }}
                                />
                              {:else}
                                <span class="inspector-transform-args">
                                  args: {transformation.args.length
                                    ? transformation.args.join(", ")
                                    : "none"}
                                </span>
                              {/if}
                            </div>
                            <div class="inspector-transform-meta">
                              <span class="inspector-tag">
                                {isNetwork ? "Network" : "Draft"}
                              </span>
                            </div>
                          </div>
                        {/each}
                      {/if}
                    </div>
                  </div>
                {/if}
                {#if selectedNode.data.kind === "condition"}
                  {@const conditionCodePreview = selectedNode.data.fromNetwork
                    ? "// Network condition source is immutable and not editable in Studio."
                    : getConditionCode(selectedNode.id)}
                  <div class="inspector-section">
                    <div class="inspector-section-title">Condition</div>
                    <div class="inspector-hint">
                      Conditions are immutable once published. Create a new condition from the left
                      panel and reconnect it if you need changes.
                    </div>
                    <pre class="inspector-code-preview">{conditionCodePreview}</pre>
                  </div>
                {/if}
                {#if selectedNode.data.kind === "particle" && selectedNode.data.particleId}
                  <button
                    type="button"
                    class="inspector-action"
                    onclick={() => openConnectorTab(selectedNode.data.particleId!)}
                  >
                    Open connector tab
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
              <div class="inspector-section-title">Connector JSON views</div>
              <div class="inspector-json-view-tabs" role="tablist" aria-label="JSON view mode">
                <button
                  type="button"
                  class={`inspector-tab ${apiJsonView === "protocol" ? "is-active" : ""}`}
                  role="tab"
                  aria-selected={apiJsonView === "protocol"}
                  onclick={() => (apiJsonView = "protocol")}
                >
                  Protocol JSON
                </button>
                <button
                  type="button"
                  class={`inspector-tab ${apiJsonView === "resolved" ? "is-active" : ""}`}
                  role="tab"
                  aria-selected={apiJsonView === "resolved"}
                  onclick={() => (apiJsonView = "resolved")}
                >
                  Resolved tree JSON
                </button>
              </div>
              {#if apiJsonView === "protocol"}
                <div class="inspector-hint">
                  Canonical protocol JSON for the selected connector (read-only).
                </div>
                <pre class="inspector-code-preview">{chainApiProtocolJson}</pre>
              {:else}
                <div class="inspector-hint">
                  Edit computed full-tree JSON to update the flow. Read-only (on-chain) connectors
                  are preserved automatically.
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
                      {@const isNameReadOnly = isReadOnly || selectedNode.data.kind === "condition"}
                      <label class="inspector-label" for="node-name-split">Name</label>
                      <input
                        id="node-name-split"
                        class="inspector-input"
                        value={nameDraft}
                        disabled={isNameReadOnly}
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
                      {#if isConnectorKind(selectedNode.data.kind)}
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
                        <div class="inspector-section">
                          <div class="inspector-section-title">Connector dimensions</div>
                          {#if getSortedConnectorDimensions(selectedNode.id).length === 0}
                            <div class="inspector-hint">No dimensions configured yet.</div>
                          {:else}
                            {#each getSortedConnectorDimensions(selectedNode.id) as dimensionNode, dimIndex (dimensionNode.id)}
                              {@const locked = dimensionNode.data.riLocked ?? false}
                              <div class="inspector-row">
                                <span>#{dimIndex + 1}</span>
                                <span>{(dimensionNode.data.transformations ?? []).length} tx</span>
                              </div>
                              <div class="inspector-inline">
                                <label
                                  class="inspector-inline-label"
                                  for={`ri-start-split-${dimensionNode.id}`}
                                >
                                  Start
                                </label>
                                <input
                                  id={`ri-start-split-${dimensionNode.id}`}
                                  class="inspector-input inspector-input--compact inspector-input--inline"
                                  type="number"
                                  inputmode="numeric"
                                  min="0"
                                  step="1"
                                  value={dimensionNode.data.riStart ?? 0}
                                  disabled={isReadOnly && locked}
                                  oninput={(event) => {
                                    const target = event.target as HTMLInputElement | null;
                                    updateNodeData(dimensionNode.id, {
                                      riStart: toInt(target?.value ?? "0"),
                                    });
                                  }}
                                />
                                <label
                                  class="inspector-inline-label"
                                  for={`ri-shift-split-${dimensionNode.id}`}
                                >
                                  Shift
                                </label>
                                <input
                                  id={`ri-shift-split-${dimensionNode.id}`}
                                  class="inspector-input inspector-input--compact inspector-input--inline"
                                  type="number"
                                  inputmode="numeric"
                                  min="0"
                                  step="1"
                                  value={dimensionNode.data.riShift ?? 0}
                                  disabled={isReadOnly && locked}
                                  oninput={(event) => {
                                    const target = event.target as HTMLInputElement | null;
                                    updateNodeData(dimensionNode.id, {
                                      riShift: toInt(target?.value ?? "0"),
                                    });
                                  }}
                                />
                                <button
                                  type="button"
                                  class={`inspector-toggle ${locked ? "is-locked" : ""}`}
                                  disabled={isReadOnly}
                                  onclick={() =>
                                    updateNodeData(dimensionNode.id, { riLocked: !locked })}
                                >
                                  {locked ? "fixed" : "open"}
                                </button>
                              </div>
                              {#if (dimensionNode.data.transformations ?? []).length > 0}
                                <div
                                  class="inspector-transform-list inspector-transform-list--compact"
                                >
                                  {#each dimensionNode.data.transformations ?? [] as transformation (transformation.id)}
                                    {@const isNetwork = transformation.status === "network"}
                                    {@const canEditArgs = !isReadOnly}
                                    <div class="inspector-transform-row">
                                      <div class="inspector-transform-readonly">
                                        <span class="inspector-transform-name"
                                          >{transformation.name}</span
                                        >
                                        {#if canEditArgs}
                                          <input
                                            class="inspector-input inspector-input--compact inspector-transform-args-input"
                                            value={transformation.args.join(", ")}
                                            placeholder="args: 0, 1"
                                            oninput={(event) => {
                                              const target =
                                                event.target as HTMLInputElement | null;
                                              updateTransformationArgsOnDimension(
                                                dimensionNode.id,
                                                transformation.id,
                                                target?.value ?? "",
                                              );
                                            }}
                                          />
                                        {:else}
                                          <span class="inspector-transform-args">
                                            args: {transformation.args.length
                                              ? transformation.args.join(", ")
                                              : "none"}
                                          </span>
                                        {/if}
                                      </div>
                                      <div class="inspector-transform-meta">
                                        <span class="inspector-tag">
                                          {isNetwork ? "Network" : "Draft"}
                                        </span>
                                      </div>
                                    </div>
                                  {/each}
                                </div>
                              {/if}
                            {/each}
                          {/if}
                        </div>
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
                            {#if (selectedNode.data.transformations ?? []).length === 0}
                              <div class="inspector-hint">
                                No transformations on this dimension.
                              </div>
                            {:else}
                              {#each selectedNode.data.transformations ?? [] as transformation (transformation.id)}
                                {@const isNetwork = transformation.status === "network"}
                                {@const canEditArgs = !isReadOnly}
                                <div class="inspector-transform-row">
                                  <div class="inspector-transform-readonly">
                                    <span class="inspector-transform-name"
                                      >{transformation.name}</span
                                    >
                                    {#if canEditArgs}
                                      <input
                                        class="inspector-input inspector-input--compact inspector-transform-args-input"
                                        value={transformation.args.join(", ")}
                                        placeholder="args: 0, 1"
                                        oninput={(event) => {
                                          const target = event.target as HTMLInputElement | null;
                                          updateTransformationArgsOnDimension(
                                            selectedNode.id,
                                            transformation.id,
                                            target?.value ?? "",
                                          );
                                        }}
                                      />
                                    {:else}
                                      <span class="inspector-transform-args">
                                        args: {transformation.args.length
                                          ? transformation.args.join(", ")
                                          : "none"}
                                      </span>
                                    {/if}
                                  </div>
                                  <div class="inspector-transform-meta">
                                    <span class="inspector-tag">
                                      {isNetwork ? "Network" : "Draft"}
                                    </span>
                                  </div>
                                </div>
                              {/each}
                            {/if}
                          </div>
                        </div>
                      {/if}
                      {#if selectedNode.data.kind === "condition"}
                        {@const conditionCodePreview = selectedNode.data.fromNetwork
                          ? "// Network condition source is immutable and not editable in Studio."
                          : getConditionCode(selectedNode.id)}
                        <div class="inspector-section">
                          <div class="inspector-section-title">Condition</div>
                          <div class="inspector-hint">
                            Conditions are immutable once published. Create a new condition from the
                            left panel and reconnect it if you need changes.
                          </div>
                          <pre class="inspector-code-preview">{conditionCodePreview}</pre>
                        </div>
                      {/if}
                      {#if selectedNode.data.kind === "particle" && selectedNode.data.particleId}
                        <button
                          type="button"
                          class="inspector-action"
                          onclick={() => openConnectorTab(selectedNode.data.particleId!)}
                        >
                          Open connector tab
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
                    <div class="inspector-section-title">Connector JSON views</div>
                    <div
                      class="inspector-json-view-tabs"
                      role="tablist"
                      aria-label="JSON view mode"
                    >
                      <button
                        type="button"
                        class={`inspector-tab ${apiJsonView === "protocol" ? "is-active" : ""}`}
                        role="tab"
                        aria-selected={apiJsonView === "protocol"}
                        onclick={() => (apiJsonView = "protocol")}
                      >
                        Protocol JSON
                      </button>
                      <button
                        type="button"
                        class={`inspector-tab ${apiJsonView === "resolved" ? "is-active" : ""}`}
                        role="tab"
                        aria-selected={apiJsonView === "resolved"}
                        onclick={() => (apiJsonView = "resolved")}
                      >
                        Resolved tree JSON
                      </button>
                    </div>
                    {#if apiJsonView === "protocol"}
                      <div class="inspector-hint">
                        Canonical protocol JSON for the selected connector (read-only).
                      </div>
                      <pre class="inspector-code-preview">{chainApiProtocolJson}</pre>
                    {:else}
                      <div class="inspector-hint">
                        Edit computed full-tree JSON to update the flow. Read-only (on-chain)
                        connectors are preserved automatically.
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
          <div class="editor-title">Create transformation</div>
          <div class="editor-header-actions">
            <span class="editor-status">
              {transformationEditorStatus === "network" ? "Network" : "Draft"}
            </span>
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
            disabled={transformationEditorReadOnly || transformationEditorDeployBusy}
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
            disabled={transformationEditorReadOnly || transformationEditorDeployBusy}
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
            readOnly={transformationEditorReadOnly || transformationEditorDeployBusy}
          />
        </div>
        <div class="editor-actions">
          <button type="button" onclick={closeTransformationEditor}>Cancel</button>
          <button
            type="button"
            class="primary"
            disabled={transformationEditorReadOnly || transformationEditorDeployBusy}
            onclick={saveTransformationEditor}
          >
            {transformationEditorDeployBusy ? "Deploying..." : "Deploy to chain"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if conditionEditorOpen}
    <div class="confirm-overlay" role="dialog" aria-modal="true">
      <div class="editor-modal">
        <div class="editor-header">
          <div class="editor-title">Create condition</div>
          <div class="editor-header-actions">
            <span class="editor-status"
              >{conditionEditorStatus === "network" ? "Network" : "Draft"}</span
            >
            <button type="button" class="editor-close" onclick={closeConditionEditor}>Close</button>
          </div>
        </div>
        <div class="editor-fields">
          <label class="editor-label" for="condition-name">Name</label>
          <input
            id="condition-name"
            class="editor-input"
            value={conditionDraftName}
            disabled={conditionEditorReadOnly || conditionEditorDeployBusy}
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
            readOnly={conditionEditorReadOnly || conditionEditorDeployBusy}
          />
        </div>
        <div class="editor-actions">
          <button type="button" onclick={closeConditionEditor}>Cancel</button>
          <button
            type="button"
            class="primary"
            disabled={conditionEditorReadOnly || conditionEditorDeployBusy}
            onclick={saveConditionEditor}
          >
            {conditionEditorDeployBusy ? "Deploying..." : "Deploy to chain"}
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
          This will remove all nodes and connections from the current connector tab.
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

  .format-panel {
    @apply grid gap-2 rounded-md border border-white/10 bg-black/40 p-2 min-h-0;
  }

  .format-panel-head {
    @apply flex items-center justify-between gap-2;
  }

  .format-panel-title {
    @apply text-[0.6rem] uppercase tracking-[0.22em] text-white/70;
  }

  .format-panel-count {
    @apply text-[0.55rem] uppercase tracking-[0.16em] text-white/40;
  }

  .format-panel-copy {
    @apply text-[0.65rem] text-white/50 leading-snug;
  }

  .format-panel-input {
    @apply w-full rounded-md border border-white/10 bg-black/60 px-2 py-1.5 text-[0.75rem]
      text-white/85 outline-none focus:border-emerald-400/60;
  }

  .format-panel-input--compact {
    @apply text-[0.7rem] py-1.5;
  }

  .format-panel-empty {
    @apply rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[0.65rem] text-white/55;
  }

  .format-selected-list {
    @apply flex flex-wrap items-baseline gap-x-1 text-[0.65rem] text-white/65;
  }

  .format-selected-label {
    @apply uppercase tracking-[0.14em] text-[0.55rem] text-white/40;
  }

  .format-selected-values {
    @apply flex flex-wrap items-baseline;
  }

  .format-selected-item {
    @apply text-[0.68rem] text-white/80 hover:text-white underline decoration-white/20 underline-offset-2;
  }

  .format-selected-separator {
    @apply text-white/35;
  }

  .format-search-results {
    @apply grid gap-1 max-h-40 overflow-y-auto pr-1;
  }

  .format-search-result {
    @apply flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5
      px-2 py-1.5 text-left transition;
  }

  .format-search-result:hover {
    @apply border-white/25 bg-white/10;
  }

  .format-search-result-name {
    @apply text-[0.7rem] text-white/80 truncate;
  }

  .format-search-result-id {
    @apply text-[0.55rem] uppercase tracking-[0.14em] text-white/40 shrink-0;
  }

  .format-panel-actions {
    @apply flex items-center justify-end gap-2;
  }

  .format-panel-status {
    @apply text-[0.65rem] text-emerald-200;
  }

  .format-panel-error {
    @apply text-[0.65rem] text-red-300;
  }

  .format-panel-list {
    @apply mt-1 grid gap-1.5 border-t border-white/10 pt-2;
  }

  .format-panel-subtitle {
    @apply text-[0.55rem] uppercase tracking-[0.18em] text-white/45;
  }

  .format-panel-list-items {
    @apply grid gap-1;
  }

  .format-panel-link {
    @apply flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5
      px-2 py-1.5 text-[0.65rem] text-white/75 no-underline transition;
  }

  .format-panel-link:hover {
    @apply border-white/25 text-white;
  }

  .format-panel-link small {
    @apply text-[0.55rem] uppercase tracking-[0.14em] text-white/45;
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

  .studio :global(.svelte-flow__edge-text) {
    fill: rgba(255, 255, 255, 0.9) !important;
  }

  .studio :global(.svelte-flow__edge-textbg) {
    fill: transparent !important;
    stroke: transparent !important;
  }

  .studio :global(.svelte-flow__edge-label) {
    color: rgba(255, 255, 255, 0.92) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
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

  .inspector-json-view-tabs {
    @apply inline-flex w-full items-center gap-1 rounded-md border border-white/10 bg-black/70 p-1;
  }

  .inspector-json-view-tabs .inspector-tab {
    @apply flex-1;
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

  .inspector-transform-list--compact {
    @apply mt-1;
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

  .inspector-transform-readonly {
    @apply flex flex-1 min-w-0 flex-col gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-1;
  }

  .inspector-transform-name {
    @apply text-[0.66rem] font-medium text-white/90;
  }

  .inspector-transform-args {
    @apply text-[0.56rem] uppercase tracking-[0.16em] text-white/45;
  }

  .inspector-transform-args-input {
    @apply mt-0 w-24 text-[0.62rem] normal-case tracking-normal;
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

  .inspector-code-preview {
    @apply max-h-44 overflow-auto rounded-md border border-white/10 bg-black/80 p-2 text-[0.6rem] leading-5 text-emerald-100/90;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .library-create-actions {
    @apply mb-2 flex flex-col gap-2;
  }

  .library-create-error {
    @apply text-[0.62rem] text-rose-300/85;
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
