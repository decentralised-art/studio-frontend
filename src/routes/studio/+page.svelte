<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  import {
    Background,
    SelectionMode,
    SvelteFlow,
    type Connection,
    type Edge,
    type NodeTypes,
    type OnConnect,
    type OnSelectionChange,
    type Viewport,
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
    buildExecutePlanConnectorRegistry,
    buildExecuteRequestBody,
    buildExecuteRiPlan,
    buildExecuteRiPlanFromPositioning,
    formatExecuteRiSummary,
    type ExecuteNodeOverrides,
  } from "$lib/studio/executeRequestPlanner";
  import { extractExecuteErrorDetail } from "$lib/studio/executeErrorDetail";
  import {
    dispatchAssistantToolCall,
    type AssistantRuntimeBridge,
  } from "$lib/studio/assistant/dispatcher";
  import {
    DEFAULT_ASSISTANT_MODEL_SETTINGS,
    type AssistantModelSettings,
  } from "$lib/studio/assistant/modelClient";
  import {
    SOLIDITY_ASSISTANT_WELCOME_MESSAGE,
    buildAssistantConversationTitle,
    createAssistantConversation as createAssistantConversationState,
    createAssistantMessage,
    createPopupAssistantMessage,
    getAssistantWelcomeMessage as resolveAssistantWelcomeMessage,
    replaceAssistantWelcomeMessages,
    type AssistantConversation,
    type AssistantMessageDraft,
    type AssistantPendingConfirmation,
    type PopupAssistantMessage,
  } from "$lib/studio/assistant/conversationState";
  import { requestSolidityEditorAssistant } from "$lib/studio/assistant/solidityEditorAssistant";
  import {
    buildAssistantRepairPrompt,
    planAssistantTurn,
    splitAssistantToolCallsByConfirmation,
    summarizeAssistantToolCalls,
  } from "$lib/studio/assistant/orchestrator";
  import {
    summarizeToolCall,
    type AssistantEnvelope,
    type AssistantExecutionResult,
    type AssistantMessage,
    type AssistantToolCall,
  } from "$lib/studio/assistant/types";
  import { projectRiPositionsToConnectorNodes } from "$lib/studio/riProjectionMapping";
  import { materializeReferencedRiIntoRootStatic } from "$lib/studio/riMaterialization";
  import { resolveConnectorRiMutability, resolveNextRiLocked } from "$lib/studio/riMutability";
  import {
    buildApiConnectorRequestBodyPreview,
    buildApiGraphFromPreviewJson,
    buildApiResolvedConnectorTreePreview,
  } from "$lib/studio/apiGraphConversion";
  import {
    cloneStaticRiMap,
    parseConnectorEdgeBindingSlot,
    parseConnectorEdgeRelation,
    resolveConnectorSelfStaticRi,
    toCanonicalPositionKey,
    toInt,
  } from "$lib/studio/connectorGraph";
  import {
    computeConnectorContextPathPrefixes,
    computeSelectedConnectorContextHighlightRoles,
    isConnectorContextEdge,
    type ConnectorContextHighlightRole,
  } from "$lib/studio/connectorContextHighlight";
  import {
    buildConnectorTreeGraph as buildConnectorTreeGraphFromRegistry,
    computeConnectorOpenSlotsInRegistry,
    hasConnectorTreePlaceholderNodes,
    isCompleteConnectorTreeModel,
    shouldReplaceConnectorTreeModel,
  } from "$lib/studio/connectorTreeGraph";
  import { mergeConnectorTreeProjectionWithOverlay } from "$lib/studio/connectorTreeOverlay";
  import {
    formatTransformationPreview,
    formatTransformationPreviewLabel,
    isConnectorKind,
    isValidChainName,
    normalizeKey,
    parseArgsInput,
    slugify,
    titleize,
    toConditionContractName,
    toContractName,
  } from "$lib/studio/studioNaming";
  import {
    STUDIO_TABS_SESSION_STORAGE_KEY,
    buildStudioTabsSessionPayload,
    readStudioTabsSession,
    restoreStudioTabsSessionPayload,
  } from "$lib/studio/studioTabsSession";
  import {
    DEFAULT_CONDITION_DRAFT_CODE,
    DEFAULT_TRANSFORMATION_DRAFT_CODE,
    alwaysTrueConditionCheck,
    compileConditionDraftCode as compileConditionCode,
    compileTransformationDraftCode as compileTransformationCode,
  } from "$lib/studio/solidityDraftRuntime";
  import {
    buildStudioChainSyncSources,
    buildStudioChainSyncSummary as formatStudioChainSyncSummary,
    isInvalidChainTokenError,
    mergeFetchedChainParticleIntoStudioState,
    mergeToolboxRuntimePayloadsIntoStudioState,
    type DeployedStudioState,
  } from "$lib/studio/studioChainSync";
  import {
    loadStudioNetworkLibraryFromEventFeed,
    type StudioEventFeedLibraryDiscovery,
  } from "$lib/studio/studioEventFeedLibrary";
  import {
    createEmptyDeployedLibrary,
    createEmptyDeployedRegistry,
    type DeployedLibrary,
    type DeployedRegistry,
    type RuntimeConditionDef,
    type RuntimeTransformationDef,
    upsertLibraryItem,
  } from "$lib/studio/studioRegistryState";
  import {
    createStudioChainPostTracer,
    extractChainDeployErrorMessage,
    publishConditionWithTrace,
    publishConnectorWithTrace,
    publishTransformationWithTrace,
    type DeployTraceEntry,
  } from "$lib/studio/studioDeployTrace";
  import { buildStudioDeployPlan, type StudioDeployPlan } from "$lib/studio/studioDeployPlan";
  import {
    clampPanelWidth,
    getStudioPanelBounds,
    getStudioPanelScale,
    panelSize,
    resolveResponsivePanelWidth,
    type StudioPanelMode,
  } from "$lib/studio/studioPanels";
  import {
    isLibraryItemSavedInToolbox,
    listToolboxLibraryItemsForKind,
    toolboxEntryForLibraryItem,
    type NetworkLibraryKind,
  } from "$lib/studio/studioToolbox";
  import {
    addToolboxLibraryItem,
    createEmptyToolboxLibrary,
    normalizeConnectorToolboxId,
    normalizeToolboxListByKind,
    toggleToolboxLibraryItem,
    type ToolboxLibrary,
  } from "$lib/toolbox/toolboxLibrary";
  import { orderConnectorDefsForDeploy } from "$lib/studio/connectorDeployOrder";
  import { buildStudioRuntime } from "$lib/studio/studioRuntime";
  import { fetchChainParticleForStudio } from "$lib/studio/chainStudioAdapter";
  import {
    getCachedCurrentUserToolboxLibrary,
    getCurrentUserProfileState,
    getCurrentUserToolboxLibrary,
    getMe,
    listServicesUsers,
    chainTokenIdentityForWalletAddress,
    loginWithBrowserWalletChainAccount,
    resolveCurrentUserChainSourceAddresses,
    saveCurrentUserToolboxLibrary,
  } from "$lib/auth/api";
  import { clearChainToken, getChainToken, getChainTokenUserId, getToken } from "$lib/auth/session";
  import {
    ChainApiRequestError,
    type ChainExecutePayload,
    getChainCondition,
    getChainTransformation,
    normalizeFormatHash,
    postChainExecuteDetailed,
  } from "$lib/chain/registryApi";
  import { createEphemeralDeployName, isReservedCoreCollectionName } from "$lib/chain/deployNaming";
  import { type LibraryItem } from "$lib/data/studioLibrary";
  import { displayUsersById, type User } from "$lib/data/users";
  import {
    buildStudioUsersById,
    mapServicesUserToStudioAuthor,
  } from "$lib/studio/studioAuthorUsers";
  import type {
    StudioConnectorDef,
    StudioRunningInstanceRef,
  } from "$lib/studio/domain/connectorModel";
  import {
    buildStudioPluginRuntimeData,
    type StudioPluginRuntimeData,
  } from "$lib/studio/plugins/runtime";
  import { listStudioPlugins, type StudioPluginDescriptor } from "$lib/studio/plugins/registry";
  import {
    bindStudioCanvasDragDrop,
    readStudioPluginDropData,
    writeStudioPluginDragData,
  } from "$lib/studio/studioPluginDragDrop";

  type PanelMode = StudioPanelMode;
  type RightPanelMode = "assistant" | "inspector" | "runner" | "hidden";
  type InspectorTab = "node" | "api";

  const STUDIO_FLOW_MIN_ZOOM = 0.05;
  const DEFAULT_STUDIO_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

  const normalizeStudioViewport = (viewport: Partial<Viewport> | null | undefined): Viewport => {
    const x = Number(viewport?.x);
    const y = Number(viewport?.y);
    const zoom = Number(viewport?.zoom);
    return {
      x: Number.isFinite(x) ? x : DEFAULT_STUDIO_VIEWPORT.x,
      y: Number.isFinite(y) ? y : DEFAULT_STUDIO_VIEWPORT.y,
      zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_STUDIO_VIEWPORT.zoom,
    };
  };

  let leftMode = $state<PanelMode>("open");
  let rightMode = $state<RightPanelMode>("hidden");
  let inspectorTab = $state<InspectorTab>("node");
  let inspectorAuto = $state(true);
  let topMode = $state<PanelMode>("open");
  let bottomMode = $state<PanelMode>("open");
  let viewportWidthPx = $state(1280);
  let leftPanelWidthPx = $state(280);
  let rightPanelWidthPx = $state(300);
  let leftPanelUserSized = $state(false);
  let rightPanelUserSized = $state(false);
  let servicesAuthorUsersById = $state<Record<string, User>>({});
  let savedModes = $state<{
    left: PanelMode;
    right: RightPanelMode;
    top: PanelMode;
    bottom: PanelMode;
  } | null>(null);

  const studioUsersById = $derived.by(() =>
    buildStudioUsersById({
      baseUsersById: displayUsersById,
      servicesAuthorUsersById,
    }),
  );

  const ASSISTANT_SETTINGS_STORAGE_KEY = "dcn_studio_assistant_settings_v1";
  type AssistantSettingsSnapshot = {
    endpoint: string;
    model: string;
    apiKey: string;
    temperature: number;
    enabled: boolean;
  };
  type AssistantTelemetryEventName =
    | "prompt_submitted"
    | "tool_calls_proposed"
    | "tool_calls_executed"
    | "repair_attempted"
    | "repair_succeeded"
    | "repair_failed"
    | "confirmation_accepted"
    | "confirmation_rejected"
    | "run_succeeded"
    | "run_failed"
    | "deploy_succeeded"
    | "deploy_failed";
  type AssistantContextSnapshot = {
    active_tab: {
      id: string;
      label: string;
      read_only: boolean;
      root_connector: string | null;
    } | null;
    selected_connector: string | null;
    connectors: Array<{
      id: string;
      name: string;
      from_network: boolean;
      dimensions: number;
      ri: {
        start_point: number;
        transformation_shift: number;
        mode: "dynamic" | "static";
      };
      definition_role: "root" | "member" | null;
    }>;
    links: Array<{
      from: string;
      to: string;
      relation: "composite" | "binding" | "unknown";
      dimension: number | null;
      binding_slot: number | null;
    }>;
    run: {
      particles_count: number;
      busy: boolean;
    };
    deploy: {
      busy: boolean;
      read_only: boolean;
    };
    capabilities: {
      can_edit_flow: boolean;
      can_add_connectors: boolean;
      can_run: boolean;
      can_deploy: boolean;
      high_risk_tools_require_confirmation: string[];
    };
    network_connector_catalog: string[];
  };

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
    contextHighlightRole?: ConnectorContextHighlightRole | null;
    tabRoot?: boolean;
    hideOutlets?: boolean;
    pluginOutput?: PtOutputFeature[];
    pluginData?: StudioPluginRuntimeData;
    pluginTargets?: string[];
    selectedConnectorContextNames?: string[];
    selectedConnectorContextPathPrefixes?: string[];
    riStart?: number;
    riShift?: number;
    riLocked?: boolean;
    riPosition?: number;
    riTargetPosition?: number;
    staticRi?: Record<string, StudioRunningInstanceRef>;
    materializedReferencedRiPositions?: number[];
    materializedReferencedRiSnapshot?: Record<string, StudioRunningInstanceRef>;
    showRiControls?: boolean;
    riLockToggleDisabled?: boolean;
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

  let nodes = $state.raw<StudioNode[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let selectedNodeId = $state<string | null>(null);
  let selectedEdgeId = $state<string | null>(null);
  let selectedNodeIds = $state.raw<string[]>([]);
  let selectedEdgeIds = $state.raw<string[]>([]);
  type ConnectorDropTarget =
    | { type: "dimension"; connectorId: string; dimensionIndex: number }
    | { type: "condition"; connectorId: string }
    | null;
  let connectorDropTarget = $state<ConnectorDropTarget>(null);
  type ExplorerSource = "network" | "toolbox" | "plugins";
  let explorerSource = $state<ExplorerSource>("network");
  let libraryTab = $state<"connectors" | "transformations" | "conditions">("connectors");
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let leftTabsEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLDivElement | null>(null);
  let screenToFlowPosition:
    | ((client: { x: number; y: number }) => { x: number; y: number })
    | null = null;
  let getZoom: (() => number) | null = null;
  let setCenter:
    | ((x: number, y: number, options?: { zoom?: number; duration?: number }) => Promise<boolean>)
    | null = null;
  let fitView:
    | ((options?: {
        padding?: number;
        duration?: number;
        minZoom?: number;
        maxZoom?: number;
        nodes?: { id: string }[];
      }) => Promise<boolean>)
    | null = null;
  let clearFlowSelection: (() => void) | null = null;
  let clearConfirmOpen = $state(false);
  let runOutputByTab = $state<Record<string, PtOutputFeature[]>>({});
  let runWarningsByTab = $state<Record<string, string[]>>({});
  let runTimestampByTab = $state<Record<string, number>>({});
  let chainRunBusy = $state(false);
  let chainRunMessageByTab = $state<Record<string, string>>({});
  let chainRunTimestampByTab = $state<Record<string, number>>({});
  let compileWarningsByTab = $state<Record<string, string[]>>({});
  let compileTimestampByTab = $state<Record<string, number>>({});
  let deployTimestampByTab = $state<Record<string, number>>({});
  let chainSyncBusy = $state(false);
  let chainSyncStatus = $state<string | null>(null);
  let chainSyncError = $state<string | null>(null);
  let studioNetworkLibraryLoaded = false;
  let studioNetworkLibraryLoadPromise: Promise<void> | null = null;
  let lastStudioSyncedSourcesCount = $state(0);
  let toolboxLoadBusy = $state(true);
  let toolboxLoadError = $state<string | null>(null);
  let chainDeployBusy = $state(false);
  let chainDeployStatus = $state<string | null>(null);
  let chainDeployError = $state<string | null>(null);
  let deployTraceEntries = $state<DeployTraceEntry[]>([]);
  const appendDeployTraceEntry = (entry: DeployTraceEntry) => {
    deployTraceEntries = [...deployTraceEntries, entry];
  };
  const traceStudioChainPost = createStudioChainPostTracer({
    withAuthRetry: withChainAuthRetry,
    appendEntry: appendDeployTraceEntry,
  });
  let apiEditorText = $state("");
  let apiEditorError = $state<string | null>(null);
  let apiEditorStatus = $state<string | null>(null);
  let apiEditorFocused = $state(false);
  let apiEditorLiveApply = $state(true);
  let apiEditorLastGenerated = $state("");
  let apiJsonView = $state<"deploy" | "protocol" | "resolved">("deploy");
  let deployPreviewCopyStatus = $state<string | null>(null);
  let deployPreviewCopyTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let compiledTransformationsByTab = $state<
    Record<string, Record<string, RuntimeTransformationDef>>
  >({});
  let runSamplesCount = $state(12);
  let assistantEnabled = $state(true);
  let assistantApiKey = $state("");
  let assistantApiKeyDraft = $state("");
  let assistantEndpoint = $state(DEFAULT_ASSISTANT_MODEL_SETTINGS.endpoint);
  let assistantModel = $state(DEFAULT_ASSISTANT_MODEL_SETTINGS.model);
  let assistantTemperature = $state(DEFAULT_ASSISTANT_MODEL_SETTINGS.temperature);
  let assistantPanelTab = $state<"conversations" | "settings">("conversations");
  let assistantConversationView = $state<"list" | "chat">("list");
  let assistantConversations = $state<AssistantConversation[]>([]);
  let assistantActiveConversationId = $state<string | null>(null);
  let assistantPromptDraft = $state("");
  let assistantBusy = $state(false);
  let assistantMessages = $state<AssistantMessage[]>([]);
  let assistantTransientMessages = $state<AssistantMessage[]>([]);
  let assistantPendingConfirmation = $state<AssistantPendingConfirmation | null>(null);
  let assistantSettingsStatus = $state<string | null>(null);
  let assistantSettingsError = $state<string | null>(null);
  let assistantLastError = $state<string | null>(null);
  const assistantTelemetryLog = new SvelteMap<string, unknown>();
  let transformationEditorOpen = $state(false);
  let transformationEditorDimensionId = $state<string | null>(null);
  let transformationEditorStatus = $state<TransformationInstance["status"]>("draft");
  let transformationEditorLocked = $state(false);
  let transformationEditorDeployBusy = $state(false);
  let transformationDraftName = $state("");
  let transformationDraftCode = $state("return x + args[0];");
  let transformationDraftError = $state<string | null>(null);
  let transformationAiAssistantOpen = $state(false);
  let transformationAiAssistantBusy = $state(false);
  let transformationAiAssistantPrompt = $state("");
  let transformationAiAssistantError = $state<string | null>(null);
  let transformationAiAssistantMessages = $state<PopupAssistantMessage[]>([]);
  const transformationCodeById = new SvelteMap<string, string>();
  let conditionEditorOpen = $state(false);
  let conditionEditorNodeId = $state<string | null>(null);
  let conditionEditorTargetConnectorId = $state<string | null>(null);
  let conditionEditorStatus = $state<"draft" | "network">("draft");
  let conditionEditorLocked = $state(false);
  let conditionEditorDeployBusy = $state(false);
  let conditionDraftName = $state("");
  let conditionDraftCode = $state("return true;");
  let conditionDraftError = $state<string | null>(null);
  let conditionAiAssistantOpen = $state(false);
  let conditionAiAssistantBusy = $state(false);
  let conditionAiAssistantPrompt = $state("");
  let conditionAiAssistantError = $state<string | null>(null);
  let conditionAiAssistantMessages = $state<PopupAssistantMessage[]>([]);
  let libraryCreateActionError = $state<string | null>(null);
  let pluginAttachStatus = $state<string | null>(null);
  let pluginAttachError = $state<string | null>(null);
  let standaloneDraftTransformations = $state<StandaloneTransformationDraft[]>([]);
  const conditionCodeById = new SvelteMap<string, string>();

  const transformationEditorReadOnly = $derived.by(
    () => transformationEditorStatus === "network" || transformationEditorLocked,
  );
  const conditionEditorReadOnly = $derived.by(
    () => conditionEditorStatus === "network" || conditionEditorLocked,
  );

  let deployedRegistry = $state<DeployedRegistry>(createEmptyDeployedRegistry());
  let deployedParticleRIs = $state<
    Record<string, { start: number; shift: number; locked: boolean }[]>
  >({});

  let deployedLibrary = $state<DeployedLibrary>(createEmptyDeployedLibrary());

  let deployedParticles = $state<ExploreParticle[]>([]);

  const createEmptyNetworkFeedLibraryIds = (): Record<NetworkLibraryKind, string[]> => ({
    feature: [],
    transformation: [],
    condition: [],
  });

  let networkFeedLibraryIds = $state<Record<NetworkLibraryKind, string[]>>(
    createEmptyNetworkFeedLibraryIds(),
  );

  type StudioTab = {
    id: string;
    label: string;
    particleId?: string;
  };

  type ConnectorTreeModel = {
    rootConnectorName: string;
    nodes: StudioNode[];
    edges: Edge[];
  };

  const tabGraphs = new SvelteMap<string, { nodes: StudioNode[]; edges: Edge[] }>();
  const connectorTreeModelsByTab = new SvelteMap<string, ConnectorTreeModel>();
  const tabViewports = new SvelteMap<string, Viewport>();

  type QuickNodeKind =
    | "feature"
    | "connector"
    | "transformation"
    | "condition"
    | "plugin"
    | "agent";

  const touchDeps = (..._deps: unknown[]) => _deps.length;

  const getConnectorStaticRi = (
    node: StudioNode | null | undefined,
  ): Record<string, StudioRunningInstanceRef> => {
    if (!node || !isConnectorKind(node.data.kind)) return {};
    return cloneStaticRiMap(node.data.staticRi);
  };

  const transformationTemplate = $derived.by(() => {
    const contractName = toContractName(transformationDraftName);
    const nameRes = parseContractName(contractName);
    if (!nameRes.ok) return `// error: ${nameRes.error}`;

    const codeRes = parseSoliditySnippet(transformationDraftCode);
    if (!codeRes.ok) return `// error: ${codeRes.error}`;

    const inferred = inferArgsCountFromSnippet(codeRes.value);
    const argsCount = inferred.minArgsCount;

    return renderTransformationSolidity({
      name: nameRes.value,
      argsCount,
      code: codeRes.value,
      baseImportPath: "../TransformationBase.sol",
    });
  });

  const defaultDraftCode = DEFAULT_TRANSFORMATION_DRAFT_CODE;
  const defaultConditionDraftCode = DEFAULT_CONDITION_DRAFT_CODE;

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

  const createStudioTab = (label: string, particleId?: string): StudioTab => {
    const id = `tab-${crypto.randomUUID()}`;
    tabGraphs.set(id, { nodes: [], edges: [] });
    tabViewports.set(id, normalizeStudioViewport(DEFAULT_STUDIO_VIEWPORT));
    return { id, label, particleId };
  };

  const initialTab = createStudioTab("Untitled Connector");
  let tabs = $state<StudioTab[]>([initialTab]);
  let activeTabId = $state<string>(initialTab.id);
  let flowViewport = $state<Viewport>(normalizeStudioViewport(tabViewports.get(initialTab.id)));
  const activeTab = $derived.by(() => tabs.find((tab) => tab.id === activeTabId) ?? null);
  const activeTabReadOnly = $derived.by(
    () => Boolean(activeTab?.particleId) || Boolean(connectorTreeModelsByTab.get(activeTabId)),
  );
  const assistantKeyConfigured = $derived.by(() => assistantApiKey.trim().length > 0);
  const assistantActiveConversation = $derived.by(
    () =>
      assistantConversations.find(
        (conversation) => conversation.id === assistantActiveConversationId,
      ) ?? null,
  );
  const assistantCanSend = $derived.by(
    () =>
      assistantPanelTab === "conversations" &&
      assistantConversationView === "chat" &&
      Boolean(assistantActiveConversationId) &&
      assistantEnabled &&
      assistantKeyConfigured &&
      !assistantBusy &&
      assistantPromptDraft.trim().length > 0,
  );
  const assistantThreadMessages = $derived.by(() =>
    [...assistantMessages, ...assistantTransientMessages].slice().sort((a, b) => a.at - b.at),
  );
  const assistantModelSettings = $derived.by(
    (): AssistantModelSettings => ({
      apiKey: assistantApiKey,
      endpoint: assistantEndpoint,
      model: assistantModel,
      temperature: assistantTemperature,
    }),
  );
  const activeRunOutput = $derived.by(() => runOutputByTab[activeTabId]);
  const activeRunWarnings = $derived.by(() => runWarningsByTab[activeTabId] ?? []);
  const activeRunTimestamp = $derived.by(() => runTimestampByTab[activeTabId] ?? null);
  const activeChainRunMessage = $derived.by(() => chainRunMessageByTab[activeTabId] ?? "");
  const activeChainRunTimestamp = $derived.by(() => chainRunTimestampByTab[activeTabId] ?? null);
  const activeCompileWarnings = $derived.by(() => compileWarningsByTab[activeTabId] ?? []);
  const activeCompileTimestamp = $derived.by(() => compileTimestampByTab[activeTabId] ?? null);
  const activeDeployTimestamp = $derived.by(() => deployTimestampByTab[activeTabId] ?? null);
  let tabsSessionRestoreReady = $state(false);

  const persistStudioTabsSession = () => {
    if (!browser) return;
    try {
      saveActiveGraph();
      const payload = buildStudioTabsSessionPayload<StudioTab, StudioNode, Edge>({
        tabs,
        activeTabId,
        tabGraphs: tabGraphs.entries(),
        connectorTreeModels: connectorTreeModelsByTab.entries(),
        tabViewports: tabViewports.entries(),
      });
      window.sessionStorage.setItem(STUDIO_TABS_SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("[Studio] Failed to persist tabs session.", error);
    }
  };

  const restoreStudioTabsSession = (): boolean => {
    if (!browser) return false;
    const restored = restoreStudioTabsSessionPayload<StudioNode, Edge>(
      readStudioTabsSession(window.sessionStorage),
    );
    if (!restored) return false;

    tabGraphs.clear();
    connectorTreeModelsByTab.clear();
    tabViewports.clear();

    Object.entries(restored.tabGraphs).forEach(([tabId, graph]) => {
      tabGraphs.set(tabId, graph);
    });

    Object.entries(restored.connectorTreeModels).forEach(([tabId, model]) => {
      connectorTreeModelsByTab.set(tabId, model);
    });

    Object.entries(restored.tabViewports).forEach(([tabId, viewport]) => {
      tabViewports.set(tabId, normalizeStudioViewport(viewport));
    });

    tabs = restored.tabs;
    activeTabId = restored.activeTabId;
    loadTabGraph(activeTabId);
    return true;
  };

  let persistStudioTabsSessionTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePersistStudioTabsSession = () => {
    if (!browser || !tabsSessionRestoreReady) return;
    if (persistStudioTabsSessionTimer) {
      clearTimeout(persistStudioTabsSessionTimer);
    }
    persistStudioTabsSessionTimer = setTimeout(() => {
      persistStudioTabsSession();
      persistStudioTabsSessionTimer = null;
    }, 180);
  };

  $effect(() => {
    touchDeps(
      tabsSessionRestoreReady,
      activeTabId,
      tabs.map((tab) => `${tab.id}:${tab.label}:${tab.particleId ?? ""}`).join("|"),
      nodes.length,
      edges.length,
      flowViewport.x,
      flowViewport.y,
      flowViewport.zoom,
      connectorTreeModelsByTab.size,
      tabGraphs.size,
      tabViewports.size,
    );
    schedulePersistStudioTabsSession();
  });

  const getNodeStatusLabel = (node: StudioNode) =>
    node.data.fromNetwork ? "Network (view-only)" : "Unpublished";

  const getLeftPanelBounds = () => getStudioPanelBounds("left", viewportWidthPx);
  const getRightPanelBounds = () => getStudioPanelBounds("right", viewportWidthPx);
  const clampLeftPanelWidth = (value: number) => clampPanelWidth(value, getLeftPanelBounds());
  const clampRightPanelWidth = (value: number) => clampPanelWidth(value, getRightPanelBounds());

  const applyResponsivePanelWidths = () => {
    leftPanelWidthPx = resolveResponsivePanelWidth({
      side: "left",
      viewportWidthPx,
      currentWidthPx: leftPanelWidthPx,
      userSized: leftPanelUserSized,
    });
    rightPanelWidthPx = resolveResponsivePanelWidth({
      side: "right",
      viewportWidthPx,
      currentWidthPx: rightPanelWidthPx,
      userSized: rightPanelUserSized,
    });
  };

  const leftPanelScale = $derived.by(() =>
    getStudioPanelScale("left", viewportWidthPx, leftPanelWidthPx),
  );

  const rightPanelScale = $derived.by(() =>
    getStudioPanelScale("right", viewportWidthPx, rightPanelWidthPx),
  );

  const leftSize = $derived.by(() =>
    leftMode === "hidden" ? "0px" : `${clampLeftPanelWidth(leftPanelWidthPx)}px`,
  );
  const hasSelection = $derived.by(() => selectedNodeId !== null || activeTab !== null);
  const inspectorCanShow = $derived.by(() => inspectorTab === "api" || hasSelection);
  const assistantVisible = $derived.by(() => rightMode === "assistant");
  const inspectorVisible = $derived.by(() => inspectorCanShow && rightMode === "inspector");
  const runnerVisible = $derived.by(() => rightMode === "runner");
  const rightSize = $derived.by(() =>
    assistantVisible || inspectorVisible || runnerVisible
      ? `${clampRightPanelWidth(rightPanelWidthPx)}px`
      : "0px",
  );
  const topSize = $derived.by(() => "auto");
  const bottomSize = $derived.by(() => panelSize(bottomMode, "max-content"));

  const handleLeftPanelResize = (nextSize: number) => {
    leftPanelUserSized = true;
    leftPanelWidthPx = clampLeftPanelWidth(nextSize);
  };

  const handleRightPanelResize = (nextSize: number) => {
    rightPanelUserSized = true;
    rightPanelWidthPx = clampRightPanelWidth(nextSize);
  };

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
      rightMode = "hidden";
      return;
    }
    rightMode = "assistant";
  };

  const toggleInspector = () => {
    if (inspectorVisible) {
      inspectorAuto = false;
      rightMode = "hidden";
      return;
    }
    inspectorAuto = true;
    if (!hasSelection && inspectorTab !== "api") {
      inspectorTab = "api";
    }
    if (!inspectorCanShow) return;
    rightMode = "inspector";
  };

  const toggleRunner = () => {
    if (runnerVisible) {
      rightMode = "hidden";
      return;
    }
    inspectorAuto = false;
    rightMode = "runner";
  };

  const toggleRightPanel = () => {
    if (assistantVisible || inspectorVisible || runnerVisible) {
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
    kind: "connector" | "transformation" | "condition",
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
      }) ?? null
    );
  };

  const loadNetworkSelectionFromQuery = async () => {
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
      const candidate = networkParticles.find((particle) => particle.authorId === rawId);
      if (candidate) openParticleTab(candidate.id);
      clearNetworkIntentQuery();
      return;
    }

    const kind = ["feature", "connector", "transformation", "condition"].includes(rawKind)
      ? ((rawKind === "feature" ? "connector" : rawKind) as
          | "connector"
          | "transformation"
          | "condition")
      : null;
    if (!kind) {
      clearNetworkIntentQuery();
      return;
    }

    if (kind === "connector") {
      await openConnectorTab(rawId);
      clearNetworkIntentQuery();
      return;
    }

    await ensureStudioNetworkLibraryLoaded();
    const item = resolveNetworkLibraryItem(kind, rawId);
    if (!item) {
      clearNetworkIntentQuery();
      return;
    }

    if (activeTabReadOnly) {
      createEmptyTab();
    }
    await addLibraryNode(item, getCanvasCenter());
    clearNetworkIntentQuery();
  };

  const emitAssistantTelemetry = (
    eventName: AssistantTelemetryEventName,
    payload: Record<string, unknown> = {},
  ) => {
    const entry = {
      event: eventName,
      at: Date.now(),
      payload,
    };
    const key = `${entry.at}-${crypto.randomUUID()}`;
    assistantTelemetryLog.set(key, entry);
    if (import.meta.env.DEV) {
      console.info("[Studio Assistant]", eventName, payload);
    }
  };

  const getAssistantWelcomeMessage = () => resolveAssistantWelcomeMessage(assistantApiKey);

  const createAssistantConversation = (): AssistantConversation =>
    createAssistantConversationState({ apiKey: assistantApiKey });

  const refreshAssistantWelcomeMessages = () => {
    const nextWelcome = getAssistantWelcomeMessage();
    assistantMessages = replaceAssistantWelcomeMessages(assistantMessages, nextWelcome);

    assistantConversations = assistantConversations.map((conversation) => ({
      ...conversation,
      messages: replaceAssistantWelcomeMessages(conversation.messages, nextWelcome),
    }));
  };

  const syncAssistantConversationRuntimeState = () => {
    if (!assistantActiveConversationId) return;
    assistantConversations = assistantConversations.map((conversation) => {
      if (conversation.id !== assistantActiveConversationId) return conversation;
      return {
        ...conversation,
        title: buildAssistantConversationTitle(assistantMessages),
        updatedAt: Date.now(),
        messages: [...assistantMessages],
        pendingConfirmation: assistantPendingConfirmation
          ? { ...assistantPendingConfirmation }
          : null,
        lastError: assistantLastError,
      };
    });
  };

  const loadAssistantConversation = (conversationId: string) => {
    const conversation =
      assistantConversations.find((candidate) => candidate.id === conversationId) ?? null;
    if (!conversation) return;
    assistantPanelTab = "conversations";
    assistantActiveConversationId = conversation.id;
    assistantMessages = [...conversation.messages];
    assistantPendingConfirmation = conversation.pendingConfirmation
      ? { ...conversation.pendingConfirmation }
      : null;
    assistantLastError = conversation.lastError;
    clearAssistantTransientMessages();
    assistantPromptDraft = "";
    assistantConversationView = "chat";
  };

  const openAssistantConversationList = () => {
    syncAssistantConversationRuntimeState();
    assistantPanelTab = "conversations";
    assistantConversationView = "list";
  };

  const startNewAssistantConversation = () => {
    syncAssistantConversationRuntimeState();
    const created = createAssistantConversation();
    assistantConversations = [created, ...assistantConversations];
    loadAssistantConversation(created.id);
  };

  const deleteAssistantConversation = (conversationId: string) => {
    const remaining = assistantConversations.filter(
      (conversation) => conversation.id !== conversationId,
    );
    assistantConversations = remaining;

    if (assistantActiveConversationId !== conversationId) return;

    if (remaining.length === 0) {
      const fallback = createAssistantConversation();
      assistantConversations = [fallback];
      loadAssistantConversation(fallback.id);
      assistantConversationView = "list";
      return;
    }

    loadAssistantConversation(remaining[0].id);
    assistantConversationView = "list";
  };

  const clearActiveAssistantConversation = () => {
    if (!assistantActiveConversationId) return;
    const now = Date.now();
    assistantMessages = [
      {
        id: `assistant-msg-${crypto.randomUUID()}`,
        at: now,
        role: "system",
        text: getAssistantWelcomeMessage(),
      },
    ];
    assistantPendingConfirmation = null;
    assistantLastError = null;
    assistantPromptDraft = "";
    clearAssistantTransientMessages();
    syncAssistantConversationRuntimeState();
  };

  const appendAssistantMessage = (message: AssistantMessageDraft) => {
    const next = createAssistantMessage(message);
    assistantMessages = [...assistantMessages, next];
    syncAssistantConversationRuntimeState();
  };

  const appendAssistantTransientMessage = (message: AssistantMessageDraft) => {
    const next = createAssistantMessage(message, { idPrefix: "assistant-msg-transient" });
    assistantTransientMessages = [...assistantTransientMessages, next];
  };

  const clearAssistantTransientMessages = () => {
    if (!assistantTransientMessages.length) return;
    assistantTransientMessages = [];
  };

  const appendTransformationAiAssistantMessage = (
    role: PopupAssistantMessage["role"],
    text: string,
  ) => {
    transformationAiAssistantMessages = [
      ...transformationAiAssistantMessages,
      createPopupAssistantMessage(role, text),
    ];
  };

  const appendConditionAiAssistantMessage = (role: PopupAssistantMessage["role"], text: string) => {
    conditionAiAssistantMessages = [
      ...conditionAiAssistantMessages,
      createPopupAssistantMessage(role, text),
    ];
  };

  const toggleTransformationAiAssistant = () => {
    transformationAiAssistantOpen = !transformationAiAssistantOpen;
    if (transformationAiAssistantOpen && transformationAiAssistantMessages.length === 0) {
      appendTransformationAiAssistantMessage("system", SOLIDITY_ASSISTANT_WELCOME_MESSAGE);
    }
  };

  const toggleConditionAiAssistant = () => {
    conditionAiAssistantOpen = !conditionAiAssistantOpen;
    if (conditionAiAssistantOpen && conditionAiAssistantMessages.length === 0) {
      appendConditionAiAssistantMessage("system", SOLIDITY_ASSISTANT_WELCOME_MESSAGE);
    }
  };

  const getSolidityAssistantSettingsOrThrow = (): AssistantModelSettings => {
    if (!assistantEnabled) {
      throw new Error("AI assistant is disabled in settings.");
    }
    if (!assistantKeyConfigured) {
      throw new Error("AI assistant API key is missing. Add it in Assistant settings.");
    }
    return assistantModelSettings;
  };

  const requestTransformationCodeEdit = async () => {
    const prompt = transformationAiAssistantPrompt.trim();
    if (!prompt || transformationAiAssistantBusy) return;

    try {
      const settings = getSolidityAssistantSettingsOrThrow();
      transformationAiAssistantError = null;
      appendTransformationAiAssistantMessage("user", prompt);
      transformationAiAssistantBusy = true;
      transformationAiAssistantPrompt = "";

      const result = await requestSolidityEditorAssistant({
        settings,
        target: "transformation",
        draftName: transformationDraftName,
        draftCode: transformationDraftCode,
        userPrompt: prompt,
      });

      if (result.assistantResponse) {
        appendTransformationAiAssistantMessage("assistant", result.assistantResponse);
      }
      if (result.thoughtLog.length) {
        result.thoughtLog.forEach((line, index) => {
          appendTransformationAiAssistantMessage(
            "assistant",
            `log ${index + 1}/${result.thoughtLog.length}: ${line}`,
          );
        });
      }

      const parsedSnippet = parseSoliditySnippet(result.code);
      if (!parsedSnippet.ok) {
        throw new Error(`AI proposed invalid snippet: ${parsedSnippet.error}`);
      }

      transformationDraftCode = parsedSnippet.value;
      if (result.suggestedName?.trim()) {
        transformationDraftName = result.suggestedName.trim();
      }
      transformationDraftError = null;
      appendTransformationAiAssistantMessage(
        "assistant",
        "Draft updated in the editor. Review and publish when ready.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to apply AI transformation edit.";
      transformationAiAssistantError = message;
      appendTransformationAiAssistantMessage("error", `AI assistant failed: ${message}`);
    } finally {
      transformationAiAssistantBusy = false;
    }
  };

  const requestConditionCodeEdit = async () => {
    const prompt = conditionAiAssistantPrompt.trim();
    if (!prompt || conditionAiAssistantBusy) return;

    try {
      const settings = getSolidityAssistantSettingsOrThrow();
      conditionAiAssistantError = null;
      appendConditionAiAssistantMessage("user", prompt);
      conditionAiAssistantBusy = true;
      conditionAiAssistantPrompt = "";

      const result = await requestSolidityEditorAssistant({
        settings,
        target: "condition",
        draftName: conditionDraftName,
        draftCode: conditionDraftCode,
        userPrompt: prompt,
      });

      if (result.assistantResponse) {
        appendConditionAiAssistantMessage("assistant", result.assistantResponse);
      }
      if (result.thoughtLog.length) {
        result.thoughtLog.forEach((line, index) => {
          appendConditionAiAssistantMessage(
            "assistant",
            `log ${index + 1}/${result.thoughtLog.length}: ${line}`,
          );
        });
      }

      const parsedSnippet = parseSoliditySnippet(result.code);
      if (!parsedSnippet.ok) {
        throw new Error(`AI proposed invalid snippet: ${parsedSnippet.error}`);
      }

      conditionDraftCode = parsedSnippet.value;
      if (result.suggestedName?.trim()) {
        conditionDraftName = result.suggestedName.trim();
      }
      conditionDraftError = null;
      appendConditionAiAssistantMessage(
        "assistant",
        "Draft updated in the editor. Review and publish when ready.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply AI condition edit.";
      conditionAiAssistantError = message;
      appendConditionAiAssistantMessage("error", `AI assistant failed: ${message}`);
    } finally {
      conditionAiAssistantBusy = false;
    }
  };

  const appendAssistantPlanningNarrative = (envelope: AssistantEnvelope) => {
    if (envelope.assistant_response?.trim()) {
      appendAssistantMessage({
        role: "assistant",
        text: envelope.assistant_response.trim(),
      });
    }
    if (import.meta.env.DEV && envelope.thought_log?.length) {
      console.info("[Studio Assistant] Thought log", envelope.thought_log);
    }
  };

  const loadAssistantSettingsFromStorage = () => {
    if (!browser) return;
    const raw = window.localStorage.getItem(ASSISTANT_SETTINGS_STORAGE_KEY);
    if (!raw) {
      assistantApiKeyDraft = "";
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AssistantSettingsSnapshot>;
      if (typeof parsed.endpoint === "string" && parsed.endpoint.trim()) {
        assistantEndpoint = parsed.endpoint.trim();
      }
      if (typeof parsed.model === "string" && parsed.model.trim()) {
        assistantModel = parsed.model.trim();
      }
      if (typeof parsed.apiKey === "string") {
        assistantApiKey = parsed.apiKey;
        assistantApiKeyDraft = parsed.apiKey;
      }
      if (typeof parsed.temperature === "number" && Number.isFinite(parsed.temperature)) {
        assistantTemperature = Math.min(2, Math.max(0, parsed.temperature));
      }
      if (typeof parsed.enabled === "boolean") {
        assistantEnabled = parsed.enabled;
      }
    } catch (error) {
      console.warn("[Studio Assistant] Failed to parse local settings.", error);
    }
  };

  const persistAssistantSettingsToStorage = () => {
    if (!browser) return;
    const payload: AssistantSettingsSnapshot = {
      endpoint: assistantEndpoint.trim() || DEFAULT_ASSISTANT_MODEL_SETTINGS.endpoint,
      model: assistantModel.trim() || DEFAULT_ASSISTANT_MODEL_SETTINGS.model,
      apiKey: assistantApiKey.trim(),
      temperature: Number.isFinite(assistantTemperature)
        ? Math.min(2, Math.max(0, assistantTemperature))
        : DEFAULT_ASSISTANT_MODEL_SETTINGS.temperature,
      enabled: assistantEnabled,
    };
    window.localStorage.setItem(ASSISTANT_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  };

  const saveAssistantApiKey = () => {
    const trimmed = assistantApiKeyDraft.trim();
    assistantApiKey = trimmed;
    assistantApiKeyDraft = trimmed;
    refreshAssistantWelcomeMessages();
    persistAssistantSettingsToStorage();
    assistantSettingsError = null;
    assistantSettingsStatus = trimmed ? "Assistant key saved locally." : "Assistant key removed.";
  };

  const clearAssistantApiKey = () => {
    assistantApiKey = "";
    assistantApiKeyDraft = "";
    refreshAssistantWelcomeMessages();
    persistAssistantSettingsToStorage();
    assistantSettingsError = null;
    assistantSettingsStatus = "Assistant key cleared.";
  };

  const saveAssistantModelSettings = () => {
    assistantEndpoint = assistantEndpoint.trim() || DEFAULT_ASSISTANT_MODEL_SETTINGS.endpoint;
    assistantModel = assistantModel.trim() || DEFAULT_ASSISTANT_MODEL_SETTINGS.model;
    assistantTemperature = Number.isFinite(assistantTemperature)
      ? Math.min(2, Math.max(0, assistantTemperature))
      : DEFAULT_ASSISTANT_MODEL_SETTINGS.temperature;
    persistAssistantSettingsToStorage();
    assistantSettingsError = null;
    assistantSettingsStatus = "Assistant model settings saved.";
  };

  const resolveConnectorNodeForAssistant = (identifier: string): StudioNode | null => {
    const normalized = normalizeKey(identifier);
    if (!normalized) return null;
    const byId = nodes.find((node) => node.id === identifier && isConnectorKind(node.data.kind));
    if (byId) return byId;

    const matchesIdentifier = (node: StudioNode): boolean => {
      if (!isConnectorKind(node.data.kind)) return false;
      const nodeName = resolveNodeName(node);
      const networkId = node.data.networkId ?? "";
      const sourceId = node.data.sourceId ?? "";
      return (
        normalizeKey(nodeName) === normalized ||
        normalizeKey(networkId) === normalized ||
        normalizeKey(sourceId) === normalized
      );
    };

    // Prefer currently selected connector when the identifier is ambiguous.
    const selected = selectedNodeId ? nodesById[selectedNodeId] : null;
    if (selected && matchesIdentifier(selected)) return selected;

    // Prefer the most recently added matching connector, not the oldest one.
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const candidate = nodes[i];
      if (matchesIdentifier(candidate)) return candidate;
    }

    return null;
  };

  const addConnectorNodeToFlowForAssistant = async (
    connector: string,
  ): Promise<{ node: StudioNode; source: "network" | "draft" }> => {
    if (activeTabReadOnly) {
      throw new Error("Cannot add connectors in view-only tab.");
    }
    const normalized = normalizeKey(connector);
    const beforeIds = new SvelteSet(nodes.map((node) => node.id));
    const networkItem =
      networkLibrary.feature.find(
        (item) =>
          normalizeKey(getLibraryRegistryName(item)) === normalized ||
          normalizeKey(item.name) === normalized,
      ) ?? null;

    if (networkItem) {
      await addLibraryNode(networkItem, getCanvasCenter());
    } else {
      addQuickNode("connector", connector, getCanvasCenter());
    }

    const addedConnector =
      nodes.find(
        (node) =>
          !beforeIds.has(node.id) &&
          isConnectorKind(node.data.kind) &&
          normalizeKey(resolveNodeName(node)) === normalized,
      ) ??
      nodes.find((node) => !beforeIds.has(node.id) && isConnectorKind(node.data.kind)) ??
      resolveConnectorNodeForAssistant(connector);

    if (!addedConnector) {
      throw new Error(`Failed to add connector '${connector}' to flow.`);
    }
    return {
      node: addedConnector,
      source: networkItem ? "network" : "draft",
    };
  };

  const ensureConnectorNodeInFlowForAssistant = async (
    connector: string,
    options: { createIfMissing?: boolean } = {},
  ): Promise<{ node: StudioNode; created: boolean; source?: "network" | "draft" }> => {
    const existing = resolveConnectorNodeForAssistant(connector);
    if (existing) return { node: existing, created: false };
    if (!options.createIfMissing) {
      throw new Error(`Connector '${connector}' not found in current flow.`);
    }
    const added = await addConnectorNodeToFlowForAssistant(connector);
    return {
      node: added.node,
      created: true,
      source: added.source,
    };
  };

  const buildAssistantContextSnapshot = (): AssistantContextSnapshot => {
    const selectedConnector = getSelectedConnectorNode();
    const rootConnectorName = resolveActiveExecuteConnectorName(nodes) || null;
    const connectorNodes = nodes.filter((node) => isConnectorKind(node.data.kind));
    const connectorDetails = connectorNodes.map((node) => ({
      id: node.id,
      name: resolveNodeName(node),
      from_network: Boolean(node.data.fromNetwork),
      dimensions: node.data.dimensions ?? 1,
      ri: {
        start_point: toInt(node.data.riStart) ?? 0,
        transformation_shift: toInt(node.data.riShift) ?? 0,
        mode: node.data.riLocked ? ("static" as const) : ("dynamic" as const),
      },
      definition_role: node.data.definitionRole ?? null,
    }));

    const linkDetails = edges
      .map((edge) => {
        const sourceNode = edge.source ? nodesById[edge.source] : null;
        const targetNode = edge.target ? nodesById[edge.target] : null;
        if (!sourceNode || !targetNode) return null;
        if (!isConnectorKind(sourceNode.data.kind) || !isConnectorKind(targetNode.data.kind)) {
          return null;
        }
        const dimensionIndex = parseDimensionHandle(edge.sourceHandle);
        return {
          from: resolveNodeName(sourceNode),
          to: resolveNodeName(targetNode),
          relation: parseConnectorEdgeRelation(edge),
          dimension: dimensionIndex === null ? null : dimensionIndex + 1,
          binding_slot: parseConnectorEdgeBindingSlot(edge),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return {
      active_tab: activeTab
        ? {
            id: activeTab.id,
            label: activeTab.label,
            read_only: activeTabReadOnly,
            root_connector: rootConnectorName,
          }
        : null,
      selected_connector: selectedConnector ? resolveNodeName(selectedConnector) : null,
      connectors: connectorDetails,
      links: linkDetails,
      run: {
        particles_count: runSamplesCount,
        busy: chainRunBusy,
      },
      deploy: {
        busy: chainDeployBusy,
        read_only: activeTabReadOnly,
      },
      capabilities: {
        can_edit_flow: !activeTabReadOnly,
        can_add_connectors: !activeTabReadOnly,
        can_run: !chainRunBusy && !chainDeployBusy,
        can_deploy: !activeTabReadOnly && !chainRunBusy && !chainDeployBusy && !chainSyncBusy,
        high_risk_tools_require_confirmation: [
          "deploy_connector",
          "disconnect_connectors",
          "remove_transformation_from_dimension",
        ],
      },
      network_connector_catalog: networkLibrary.feature
        .map((item) => getLibraryRegistryName(item) || item.name)
        .filter((name, index, all) => name && all.indexOf(name) === index)
        .slice(0, 200),
    };
  };

  const assistantRuntimeBridge: AssistantRuntimeBridge = {
    inspectFlow: () => ({
      message: "Flow inspected.",
      data: buildAssistantContextSnapshot(),
    }),
    selectConnector: async ({ connector }) => {
      const resolved = await ensureConnectorNodeInFlowForAssistant(connector, {
        createIfMissing: !activeTabReadOnly,
      });
      selectedNodeId = resolved.node.id;
      return {
        message: resolved.created
          ? `Added and selected connector '${resolveNodeName(resolved.node)}'.`
          : `Selected connector '${resolveNodeName(resolved.node)}'.`,
        data: {
          node_id: resolved.node.id,
          connector: resolveNodeName(resolved.node),
        },
      };
    },
    renameConnector: ({ connector, new_name }) => {
      if (activeTabReadOnly) throw new Error("Cannot rename connectors in view-only tab.");
      const target = connector
        ? resolveConnectorNodeForAssistant(connector)
        : getSelectedConnectorNode();
      if (!target) {
        throw new Error(
          connector
            ? `Connector '${connector}' not found in current flow.`
            : "No connector selected to rename.",
        );
      }
      if (target.data.fromNetwork) {
        throw new Error("Cannot rename read-only connector.");
      }

      const nextName = new_name.trim();
      if (!nextName) throw new Error("New connector name cannot be empty.");

      const previousLabel = target.data.label;
      if (previousLabel === nextName) {
        selectedNodeId = target.id;
        return {
          message: `Connector '${previousLabel}' already has that name.`,
          data: {
            node_id: target.id,
            connector: previousLabel,
          },
        };
      }

      selectedNodeId = target.id;
      nameDraft = nextName;
      const previousPendingCollision = pendingNameCollision;
      commitNameChange(target);

      const activePendingNameCollision = pendingNameCollision;
      const collisionForTarget =
        activePendingNameCollision &&
        activePendingNameCollision !== previousPendingCollision &&
        activePendingNameCollision.nodeId === target.id &&
        normalizeKey(activePendingNameCollision.desiredName) === normalizeKey(nextName);
      if (collisionForTarget) {
        const existingName = activePendingNameCollision.existingName;
        pendingNameCollision = null;
        throw new Error(
          `Name '${nextName}' is already deployed as '${existingName}'. Choose a different name.`,
        );
      }

      const renamedNode = nodes.find((node) => node.id === target.id) ?? target;
      const renamedLabel = renamedNode.data.label;
      if (renamedLabel !== nextName) {
        throw new Error(`Failed to rename connector '${previousLabel}'.`);
      }

      return {
        message: `Renamed connector '${previousLabel}' to '${renamedLabel}'.`,
        data: {
          node_id: renamedNode.id,
          connector: renamedLabel,
        },
      };
    },
    addConnectorToFlow: async ({ connector }) => {
      const { node, source } = await addConnectorNodeToFlowForAssistant(connector);
      selectedNodeId = node.id;
      return {
        message:
          source === "network"
            ? `Added network connector '${connector}' to flow.`
            : `Added draft connector '${connector}' to flow.`,
      };
    },
    connectConnectors: async ({ from_connector, to_connector, dimension, relation }) => {
      if (activeTabReadOnly) throw new Error("Cannot edit links in view-only tab.");
      let source = (
        await ensureConnectorNodeInFlowForAssistant(from_connector, {
          createIfMissing: true,
        })
      ).node;
      let target = (
        await ensureConnectorNodeInFlowForAssistant(to_connector, {
          createIfMissing: true,
        })
      ).node;
      let autoCorrectedDirection = false;
      const sourceDimensionCountBeforeSwap = source.data.dimensions ?? 1;
      const targetDimensionCountBeforeSwap = target.data.dimensions ?? 1;
      const sourceLooksLikeOwner = Boolean(source.data.tabRoot);
      const targetLooksLikeOwner = Boolean(target.data.tabRoot);

      if (
        (targetLooksLikeOwner && !sourceLooksLikeOwner) ||
        (dimension > sourceDimensionCountBeforeSwap && dimension <= targetDimensionCountBeforeSwap)
      ) {
        [source, target] = [target, source];
        autoCorrectedDirection = true;
      }

      // Root connectors intentionally hide their top inlet in draft tabs; never target them.
      if (target.data.tabRoot && !source.data.tabRoot) {
        [source, target] = [target, source];
        autoCorrectedDirection = true;
      }

      const sourceDimensionCount = source.data.dimensions ?? 1;
      if (dimension < 1 || dimension > sourceDimensionCount) {
        throw new Error(
          `Connector '${resolveNodeName(source)}' has ${sourceDimensionCount} dimensions; cannot use D${dimension}.`,
        );
      }

      const sourceHandle = `dim-${dimension - 1}`;
      const sameDimensionEdges = edges.filter(
        (edge) => edge.source === source.id && edge.sourceHandle === sourceHandle,
      );
      const hasComposite = sameDimensionEdges.some(
        (edge) => parseConnectorEdgeRelation(edge) === "composite",
      );

      if (relation === "composite" && hasComposite) {
        throw new Error(
          `D${dimension} already has a composite link. Remove it first before adding a new composite.`,
        );
      }

      if (relation === "binding" && !hasComposite) {
        throw new Error(
          `D${dimension} has no composite link yet. Create a composite first, then add binding.`,
        );
      }

      const beforeEdgeCount = edges.length;
      handleConnect({
        source: source.id,
        target: target.id,
        sourceHandle,
        targetHandle: "in",
      });
      if (edges.length === beforeEdgeCount) {
        throw new Error("No connector link was created.");
      }
      return {
        message: `Connected '${resolveNodeName(source)}' -> '${resolveNodeName(target)}' on D${dimension}${autoCorrectedDirection ? " (direction auto-corrected)." : "."}`,
      };
    },
    disconnectConnectors: ({ from_connector, to_connector, dimension, relation }) => {
      if (activeTabReadOnly) throw new Error("Cannot remove links in view-only tab.");
      const normalizedFrom = from_connector ? normalizeKey(from_connector) : null;
      const normalizedTo = to_connector ? normalizeKey(to_connector) : null;
      if (!normalizedFrom && !normalizedTo && !dimension && !relation) {
        throw new Error(
          "disconnect_connectors requires at least one filter: from_connector, to_connector, dimension, or relation.",
        );
      }

      const edgesToRemove = edges.filter((edge) => {
        const sourceNode = edge.source ? nodesById[edge.source] : null;
        const targetNode = edge.target ? nodesById[edge.target] : null;
        if (!sourceNode || !targetNode) return false;
        if (!isConnectorKind(sourceNode.data.kind) || !isConnectorKind(targetNode.data.kind)) {
          return false;
        }
        if (normalizedFrom && normalizeKey(resolveNodeName(sourceNode)) !== normalizedFrom) {
          return false;
        }
        if (normalizedTo && normalizeKey(resolveNodeName(targetNode)) !== normalizedTo) {
          return false;
        }
        if (dimension) {
          const edgeDimension = parseDimensionHandle(edge.sourceHandle);
          if (edgeDimension === null || edgeDimension + 1 !== dimension) return false;
        }
        if (relation && parseConnectorEdgeRelation(edge) !== relation) return false;
        return true;
      });

      if (!edgesToRemove.length) {
        throw new Error("No connector links matched the disconnect request.");
      }

      const removeIds = new SvelteSet(edgesToRemove.map((edge) => edge.id));
      edges = edges.filter((edge) => !removeIds.has(edge.id));
      const affectedSources = new SvelteSet(edgesToRemove.map((edge) => edge.source));
      affectedSources.forEach((sourceId) => {
        if (sourceId) syncConnectorRowPreview(sourceId, { schedule: false });
      });
      scheduleLayout();
      return {
        message: `Removed ${edgesToRemove.length} connector link(s).`,
      };
    },
    setConnectorRiMode: async ({ connector, mode }) => {
      const resolved = await ensureConnectorNodeInFlowForAssistant(connector, {
        createIfMissing: !activeTabReadOnly,
      });
      applyConnectorRiPatch(resolved.node.id, { riLocked: mode === "static" });
      return {
        message: `Set RI mode for '${resolveNodeName(resolved.node)}' to ${mode}.`,
      };
    },
    setConnectorRiValues: async ({ connector, start_point, transformation_shift }) => {
      const resolved = await ensureConnectorNodeInFlowForAssistant(connector, {
        createIfMissing: !activeTabReadOnly,
      });
      applyConnectorRiPatch(resolved.node.id, {
        riStart: start_point,
        riShift: transformation_shift,
      });
      return {
        message: `Updated RI values for '${resolveNodeName(resolved.node)}' to start=${start_point}, shift=${transformation_shift}.`,
      };
    },
    addTransformationToDimension: ({ connector, dimension, transformation, args }) => {
      if (activeTabReadOnly) throw new Error("Cannot edit transformations in view-only tab.");
      const connectorNode = resolveConnectorNodeForAssistant(connector);
      if (!connectorNode) throw new Error(`Connector '${connector}' not found in current flow.`);
      const dimensionNode = getDimensionNodeForConnectorIndex(connectorNode.id, dimension - 1);
      if (!dimensionNode) {
        throw new Error(
          `Dimension D${dimension} not found on connector '${resolveNodeName(connectorNode)}'.`,
        );
      }
      if (dimensionNode.data.fromNetwork) {
        throw new Error("Cannot edit transformations on read-only connector dimension.");
      }
      const transformationId = addTransformationToDimension(
        dimensionNode.id,
        transformation,
        args ?? [],
        "network",
      );
      if (!transformationId) throw new Error("Failed to add transformation.");
      return {
        message: `Added transformation '${transformation}' to '${resolveNodeName(connectorNode)}' D${dimension}.`,
      };
    },
    removeTransformationFromDimension: ({ connector, dimension, transformation, index }) => {
      if (activeTabReadOnly) throw new Error("Cannot edit transformations in view-only tab.");
      const connectorNode = resolveConnectorNodeForAssistant(connector);
      if (!connectorNode) throw new Error(`Connector '${connector}' not found in current flow.`);
      const dimensionNode = getDimensionNodeForConnectorIndex(connectorNode.id, dimension - 1);
      if (!dimensionNode) {
        throw new Error(
          `Dimension D${dimension} not found on connector '${resolveNodeName(connectorNode)}'.`,
        );
      }
      if (dimensionNode.data.fromNetwork) {
        throw new Error("Cannot edit transformations on read-only connector dimension.");
      }
      const transformations = dimensionNode.data.transformations ?? [];
      let target =
        typeof index === "number" && index > 0 && index <= transformations.length
          ? transformations[index - 1]
          : null;
      if (!target && transformation) {
        const normalizedTransformation = normalizeKey(transformation);
        target =
          transformations.find((item) => normalizeKey(item.name) === normalizedTransformation) ??
          null;
      }
      if (!target) {
        throw new Error("Transformation to remove was not found in requested dimension.");
      }
      removeTransformationFromDimension(dimensionNode.id, target.id);
      return {
        message: `Removed transformation '${target.name}' from '${resolveNodeName(connectorNode)}' D${dimension}.`,
      };
    },
    runConnector: async ({ connector, particles_count }) => {
      if (particles_count && Number.isFinite(particles_count)) {
        runSamplesCount = Math.max(1, Math.trunc(particles_count));
      }
      if (connector) {
        const node = resolveConnectorNodeForAssistant(connector);
        if (!node) throw new Error(`Connector '${connector}' not found in current flow.`);
        selectedNodeId = node.id;
      }
      await executeActiveGraph();
      if (chainDeployError) {
        throw new Error(chainDeployError);
      }
      const output = chainRunMessageByTab[activeTabId] ?? "[]";
      return {
        message: "Run completed.",
        data: output,
      };
    },
    deployConnector: async (_args) => {
      if (activeTabReadOnly) throw new Error("Cannot deploy from view-only tab.");
      await deployActiveGraph();
      if (chainDeployError) {
        throw new Error(chainDeployError);
      }
      return {
        message: chainDeployStatus || "Deploy completed.",
      };
    },
  };

  const executeAssistantToolCalls = async (
    toolCalls: AssistantToolCall[],
    source: "auto" | "confirmed",
  ): Promise<AssistantExecutionResult[]> => {
    const results: AssistantExecutionResult[] = [];
    for (const [index, call] of toolCalls.entries()) {
      appendAssistantTransientMessage({
        role: "assistant",
        text: `Executing step ${index + 1}/${toolCalls.length}: ${summarizeToolCall(call)}`,
      });
      const result = await dispatchAssistantToolCall(call, assistantRuntimeBridge);
      results.push(result);
      emitAssistantTelemetry("tool_calls_executed", {
        source,
        tool_name: call.tool_name,
        ok: result.ok,
      });

      if (call.tool_name === "run_connector") {
        emitAssistantTelemetry(result.ok ? "run_succeeded" : "run_failed", {
          source,
          ok: result.ok,
        });
      }
      if (call.tool_name === "deploy_connector") {
        emitAssistantTelemetry(result.ok ? "deploy_succeeded" : "deploy_failed", {
          source,
          ok: result.ok,
        });
      }

      appendAssistantTransientMessage({
        role: result.ok ? "tool" : "error",
        text: `${result.ok ? "OK" : "ERR"} · ${summarizeToolCall(call)} · ${result.message}`,
        toolCallId: result.callId,
      });
    }
    return results;
  };

  const sendAssistantPrompt = async () => {
    assistantLastError = null;
    syncAssistantConversationRuntimeState();
    assistantSettingsStatus = null;
    const prompt = assistantPromptDraft.trim();
    if (!prompt) return;
    if (!assistantActiveConversationId) {
      startNewAssistantConversation();
    }
    if (assistantConversationView !== "chat") {
      assistantConversationView = "chat";
    }
    if (!assistantEnabled) {
      assistantLastError = "Assistant is disabled in local settings.";
      syncAssistantConversationRuntimeState();
      return;
    }
    if (!assistantKeyConfigured) {
      assistantLastError = "Assistant API key is missing. Add and save it in settings.";
      syncAssistantConversationRuntimeState();
      return;
    }
    if (assistantBusy) return;

    assistantPromptDraft = "";
    clearAssistantTransientMessages();
    appendAssistantMessage({ role: "user", text: prompt });
    emitAssistantTelemetry("prompt_submitted", {
      prompt_length: prompt.length,
    });

    assistantBusy = true;
    try {
      const context = buildAssistantContextSnapshot();
      const plan = await planAssistantTurn({
        prompt,
        context,
        settings: assistantModelSettings,
      });
      const proposedCalls = plan.envelope.tool_calls;
      emitAssistantTelemetry("tool_calls_proposed", {
        intent: plan.envelope.intent,
        count: proposedCalls.length,
      });

      if (!proposedCalls.length) {
        if (plan.envelope.assistant_response?.trim()) {
          appendAssistantPlanningNarrative(plan.envelope);
        } else {
          appendAssistantMessage({
            role: "assistant",
            text: "No executable actions were proposed. Ask for guidance or specify concrete edits.",
          });
        }
        return;
      }

      appendAssistantTransientMessage({
        role: "assistant",
        text: `Planned actions:\\n${summarizeAssistantToolCalls(proposedCalls)}`,
      });

      const split = splitAssistantToolCallsByConfirmation(proposedCalls);
      let autoExecutionResults: AssistantExecutionResult[] = [];
      if (split.autoExecute.length) {
        autoExecutionResults = await executeAssistantToolCalls(split.autoExecute, "auto");
      }
      let encounteredExecutionFailures = autoExecutionResults.some((result) => !result.ok);

      if (split.requiresConfirmation.length) {
        const confirmationId = `assistant-confirm-${crypto.randomUUID()}`;
        assistantPendingConfirmation = {
          id: confirmationId,
          calls: split.requiresConfirmation,
          createdAt: Date.now(),
          summary: summarizeAssistantToolCalls(split.requiresConfirmation),
        };
        syncAssistantConversationRuntimeState();
        appendAssistantTransientMessage({
          role: "assistant",
          text: `Confirmation required before high-risk actions:\\n${assistantPendingConfirmation.summary}`,
          pendingConfirmationId: confirmationId,
        });
      }

      const failedAutoCalls = autoExecutionResults.filter((result) => !result.ok);
      if (failedAutoCalls.length && !assistantPendingConfirmation) {
        emitAssistantTelemetry("repair_attempted", {
          failed_count: failedAutoCalls.length,
        });
        appendAssistantTransientMessage({
          role: "assistant",
          text: "Some actions failed. I will prepare one corrective plan.",
        });

        const repairPrompt = buildAssistantRepairPrompt({
          originalPrompt: prompt,
          attemptedCalls: split.autoExecute,
          executionResults: autoExecutionResults,
        });
        const repairPlan = await planAssistantTurn({
          prompt: repairPrompt,
          context: buildAssistantContextSnapshot(),
          settings: assistantModelSettings,
        });

        if (!repairPlan.envelope.tool_calls.length) {
          appendAssistantMessage({
            role: "assistant",
            text: "No corrective actions were proposed. Please refine your request or execute manually.",
          });
          emitAssistantTelemetry("repair_failed", {
            failed_count: failedAutoCalls.length,
            reason: "no_repair_calls",
          });
          return;
        }

        appendAssistantTransientMessage({
          role: "assistant",
          text: `Corrective actions:\\n${summarizeAssistantToolCalls(repairPlan.envelope.tool_calls)}`,
        });

        const repairSplit = splitAssistantToolCallsByConfirmation(repairPlan.envelope.tool_calls);
        if (repairSplit.autoExecute.length) {
          const repairResults = await executeAssistantToolCalls(repairSplit.autoExecute, "auto");
          if (repairResults.some((result) => !result.ok)) {
            encounteredExecutionFailures = true;
          }
        }
        if (repairSplit.requiresConfirmation.length) {
          const confirmationId = `assistant-confirm-${crypto.randomUUID()}`;
          assistantPendingConfirmation = {
            id: confirmationId,
            calls: repairSplit.requiresConfirmation,
            createdAt: Date.now(),
            summary: summarizeAssistantToolCalls(repairSplit.requiresConfirmation),
          };
          syncAssistantConversationRuntimeState();
          appendAssistantTransientMessage({
            role: "assistant",
            text: `Confirmation required before high-risk corrective actions:\\n${assistantPendingConfirmation.summary}`,
            pendingConfirmationId: confirmationId,
          });
        }
        emitAssistantTelemetry("repair_succeeded", {
          failed_count: failedAutoCalls.length,
          repair_calls: repairPlan.envelope.tool_calls.length,
        });
      }

      if (!assistantPendingConfirmation && !encounteredExecutionFailures) {
        appendAssistantPlanningNarrative(plan.envelope);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Assistant request failed unexpectedly.";
      assistantLastError = message;
      syncAssistantConversationRuntimeState();
      appendAssistantMessage({
        role: "error",
        text: `Assistant failed: ${message}`,
      });
    } finally {
      assistantBusy = false;
      clearAssistantTransientMessages();
      syncAssistantConversationRuntimeState();
    }
  };

  const confirmAssistantPendingActions = async () => {
    if (!assistantPendingConfirmation || assistantBusy) return;
    const pending = assistantPendingConfirmation;
    assistantPendingConfirmation = null;
    syncAssistantConversationRuntimeState();
    emitAssistantTelemetry("confirmation_accepted", {
      count: pending.calls.length,
    });
    clearAssistantTransientMessages();
    appendAssistantTransientMessage({
      role: "assistant",
      text: "Executing confirmed actions.",
    });
    assistantBusy = true;
    try {
      await executeAssistantToolCalls(pending.calls, "confirmed");
    } finally {
      assistantBusy = false;
      clearAssistantTransientMessages();
      syncAssistantConversationRuntimeState();
    }
  };

  const cancelAssistantPendingActions = () => {
    if (!assistantPendingConfirmation) return;
    emitAssistantTelemetry("confirmation_rejected", {
      count: assistantPendingConfirmation.calls.length,
    });
    clearAssistantTransientMessages();
    appendAssistantMessage({
      role: "assistant",
      text: "High-risk action bundle cancelled.",
    });
    assistantPendingConfirmation = null;
    syncAssistantConversationRuntimeState();
  };

  const loadStudioAuthorUsers = async () => {
    try {
      const users = await listServicesUsers();
      const nextUsersById: Record<string, User> = {};
      users.forEach((user) => {
        const author = mapServicesUserToStudioAuthor(user);
        if (!author) return;
        nextUsersById[author.address] = author;
        if (user.id.trim()) nextUsersById[user.id.trim()] = author;
      });
      servicesAuthorUsersById = nextUsersById;
    } catch (error) {
      console.warn("[Studio] Failed to load services author labels.", error);
    }
  };

  onMount(() => {
    viewportWidthPx = window.innerWidth;
    applyResponsivePanelWidths();
    loadAssistantSettingsFromStorage();
    if (assistantConversations.length === 0) {
      const conversation = createAssistantConversation();
      assistantConversations = [conversation];
      loadAssistantConversation(conversation.id);
      assistantConversationView = "list";
    }

    const handleKey = (event: KeyboardEvent) => {
      if (transformationEditorOpen || conditionEditorOpen) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const hasGraphSelection =
        selectedNodeIds.length > 0 ||
        selectedEdgeIds.length > 0 ||
        selectedNodeId !== null ||
        selectedEdgeId !== null;

      if ((key === "backspace" || key === "delete") && hasGraphSelection) {
        event.preventDefault();
        removeSelectedGraphEntity();
        return;
      }

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

    const handleWindowResize = () => {
      viewportWidthPx = window.innerWidth;
      applyResponsivePanelWidths();
    };

    const handleStudioRiUpdate = (event: Event) => {
      const custom = event as CustomEvent<{
        nodeId?: string;
        patch?: Partial<Pick<StudioNodeData, "riStart" | "riShift" | "riLocked">>;
      }>;
      const nodeId = custom.detail?.nodeId ?? "";
      const patch = custom.detail?.patch;
      if (!nodeId || !patch) return;
      applyConnectorRiPatch(nodeId, patch);
    };

    const handleBeforeUnload = () => {
      persistStudioTabsSession();
    };

    const handleAuthChange = () => {
      const nextServicesToken = getToken() ?? "";
      if (nextServicesToken === lastToolboxServicesToken) return;
      lastToolboxServicesToken = nextServicesToken;
      studioNetworkLibraryLoaded = false;
      networkFeedLibraryIds = createEmptyNetworkFeedLibraryIds();
      void loadToolboxLibraryFromProfile();
      if (nextServicesToken && explorerSource === "network") {
        void ensureStudioNetworkLibraryLoaded();
      }
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("studio-ri-update", handleStudioRiUpdate as EventListener);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("auth:change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
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

    restoreStudioTabsSession();
    tabsSessionRestoreReady = true;
    void loadStudioAuthorUsers();
    void loadToolboxLibraryFromProfile();
    void (async () => {
      await loadNetworkSelectionFromQuery();
      if (explorerSource === "network") {
        await ensureStudioNetworkLibraryLoaded();
      }
    })();

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("studio-ri-update", handleStudioRiUpdate as EventListener);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("auth:change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (persistStudioTabsSessionTimer) {
        clearTimeout(persistStudioTabsSessionTimer);
        persistStudioTabsSessionTimer = null;
      }
      persistStudioTabsSession();
    };
  });

  let toolboxLibrary = $state<ToolboxLibrary>(createEmptyToolboxLibrary());
  let toolboxLoadRequestId = 0;
  let lastToolboxServicesToken = getToken() ?? "";

  const persistToolboxLibrary = async (nextToolboxLibrary: ToolboxLibrary) => {
    try {
      await saveCurrentUserToolboxLibrary({
        connector: [...nextToolboxLibrary.connector],
        transformation: [...nextToolboxLibrary.transformation],
        condition: [...nextToolboxLibrary.condition],
      });
    } catch (error) {
      console.warn("[Studio] Failed to persist toolbox library.", error);
    }
  };

  const addItemToToolboxLibrary = (kind: keyof ToolboxLibrary, id: string) => {
    const {
      library: next,
      id: normalizedId,
      added,
    } = addToolboxLibraryItem(toolboxLibrary, kind, id);
    if (!added) return;
    toolboxLibrary = next;
    if (kind === "connector") {
      void hydrateToolboxConnectorsIntoLibrary([normalizedId]);
    }
    void persistToolboxLibrary(next);
  };

  const loadToolboxLibraryFromProfile = async () => {
    const requestId = (toolboxLoadRequestId += 1);
    toolboxLoadError = null;
    if (!getToken()) {
      toolboxLibrary = createEmptyToolboxLibrary();
      toolboxLoadBusy = false;
      return;
    }

    const applyProfileToolbox = (saved: ToolboxLibrary) => {
      const nextToolboxLibrary = {
        connector: normalizeToolboxListByKind("connector", saved.connector),
        transformation: normalizeToolboxListByKind("transformation", saved.transformation),
        condition: normalizeToolboxListByKind("condition", saved.condition),
      };
      toolboxLibrary = nextToolboxLibrary;
      return nextToolboxLibrary;
    };

    const cachedToolbox = getCachedCurrentUserToolboxLibrary();
    let appliedCachedToolbox = false;
    if (cachedToolbox) {
      applyProfileToolbox(cachedToolbox);
      appliedCachedToolbox = true;
    }

    toolboxLoadBusy = true;
    try {
      const saved = await getCurrentUserToolboxLibrary();
      if (requestId !== toolboxLoadRequestId) return;
      applyProfileToolbox(saved);
    } catch (error) {
      console.warn("[Studio] Failed to load toolbox library from profile.", error);
      if (!appliedCachedToolbox && requestId === toolboxLoadRequestId) {
        toolboxLoadError = "Unable to load toolbox from your services profile.";
      }
    } finally {
      if (requestId === toolboxLoadRequestId) {
        toolboxLoadBusy = false;
      }
    }
  };

  const networkParticles = $derived.by(() =>
    [...deployedParticles].sort((a, b) => b.createdAt - a.createdAt),
  );

  type NetworkLibrary = Record<NetworkLibraryKind, LibraryItem[]>;
  let currentStudioAuthorId = $state("current-user");
  function getCurrentStudioAuthorId() {
    return currentStudioAuthorId || "current-user";
  }

  const networkLibrary = $derived.by(
    (): NetworkLibrary => ({
      feature: [...deployedLibrary.features],
      transformation: [
        ...deployedLibrary.transformations,
        ...standaloneDraftTransformations.map((item) => ({
          id: `draft-transform-${item.id}`,
          name: item.name,
          kind: "transformation" as const,
          authorId: getCurrentStudioAuthorId(),
          summary: "Unpublished in current tab (publish to chain before reuse).",
        })),
      ],
      condition: [...deployedLibrary.conditions],
    }),
  );
  const selectedNode = $derived.by(() => nodes.find((node) => node.id === selectedNodeId) ?? null);
  const selectedEdge = $derived.by(() => edges.find((edge) => edge.id === selectedEdgeId) ?? null);
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
    touchDeps(connectorConditionEdgeFingerprint);
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
      return;
    }
    if (!inspectorAuto) return;
    if (rightMode === "hidden") rightMode = "inspector";
  });

  $effect(() => {
    touchDeps(libraryTab);
    libraryCreateActionError = null;
  });

  $effect(() => {
    const nodeCount = nodes.length;
    const currentTab = activeTab;
    touchDeps(activeTabId, currentTab?.label, currentTab?.particleId, nodeCount);
    if (!currentTab || currentTab.particleId || isConnectorTreeTab(activeTabId)) return;
    ensureActiveDraftTabRootConnector();
  });

  $effect(() => {
    const tabReadOnly = activeTabReadOnly;
    if (!nodes.length) return;
    let changed = false;
    const nextNodes = nodes.map((node) => {
      if (!isConnectorKind(node.data.kind)) return node;
      const hasNetworkSelfStatic =
        Boolean(node.data.fromNetwork) &&
        Boolean(resolveConnectorSelfStaticRi(getConnectorStaticRi(node)));
      const mutability = resolveConnectorRiMutability({
        fromNetwork: Boolean(node.data.fromNetwork),
        tabReadOnly,
        hasNetworkSelfStatic,
      });
      const nextToggleDisabled = mutability.lockToggleDisabled;
      const currentLocked = Boolean(node.data.riLocked);
      const nextLocked = mutability.state === "network-self-static" ? true : currentLocked;
      if (
        Boolean(node.data.riLockToggleDisabled) === nextToggleDisabled &&
        currentLocked === nextLocked
      ) {
        return node;
      }
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          riLockToggleDisabled: nextToggleDisabled,
          riLocked: nextLocked,
        },
      };
    });
    if (changed) {
      nodes = nextNodes;
    }
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

  const isConnectorRiLockToggleDisabled = (connector: StudioNode | null): boolean => {
    if (!connector || !isConnectorKind(connector.data.kind)) return true;
    const hasNetworkSelfStatic = Boolean(
      resolveConnectorSelfStaticRi(getConnectorStaticRi(connector)),
    );
    return resolveConnectorRiMutability({
      fromNetwork: Boolean(connector.data.fromNetwork),
      tabReadOnly: activeTabReadOnly,
      hasNetworkSelfStatic,
    }).lockToggleDisabled;
  };

  const getConnectorRiMutability = (connector: StudioNode | null) => {
    if (!connector || !isConnectorKind(connector.data.kind)) {
      return { state: "network-view-only", lockToggleDisabled: true } as const;
    }
    const hasNetworkSelfStatic = Boolean(
      resolveConnectorSelfStaticRi(getConnectorStaticRi(connector)),
    );
    return resolveConnectorRiMutability({
      fromNetwork: Boolean(connector.data.fromNetwork),
      tabReadOnly: activeTabReadOnly,
      hasNetworkSelfStatic,
    });
  };

  const applyConnectorRiPatch = (
    connectorId: string,
    patch: Partial<Pick<StudioNodeData, "riStart" | "riShift" | "riLocked">>,
  ) => {
    const connector = nodes.find((node) => node.id === connectorId) ?? null;
    if (!connector || !isConnectorKind(connector.data.kind)) return;
    const isNetworkConnector = Boolean(connector.data.fromNetwork);
    const hasNetworkSelfStatic = Boolean(
      resolveConnectorSelfStaticRi(getConnectorStaticRi(connector)),
    );
    const mutability = resolveConnectorRiMutability({
      fromNetwork: isNetworkConnector,
      tabReadOnly: activeTabReadOnly,
      hasNetworkSelfStatic,
    });

    const nextStart = toInt(patch.riStart ?? connector.data.riStart) ?? 0;
    const nextShift = toInt(patch.riShift ?? connector.data.riShift) ?? 0;
    const currentlyLocked = Boolean(connector.data.riLocked);
    const nextLocked = resolveNextRiLocked({
      mutability,
      currentLocked: currentlyLocked,
      requestedLocked: patch.riLocked,
    });

    updateNodeData(connectorId, {
      riStart: nextStart,
      riShift: nextShift,
      riLocked: nextLocked,
    });

    // For network/view-only connectors, RI edits are runtime-only local overrides.
    // Do not mutate connector static_ri definitions.
    if (isNetworkConnector) return;

    const nextStatic = getConnectorStaticRi(connector);
    if (nextLocked) {
      nextStatic["0"] = {
        startPoint: nextStart,
        transformationShift: nextShift,
      };
    } else {
      delete nextStatic["0"];
    }
    setConnectorStaticRi(connectorId, nextStatic);
  };

  const setConnectorStaticRi = (
    connectorId: string,
    staticRi: Record<string, StudioRunningInstanceRef>,
  ) => {
    const connector = nodes.find((node) => node.id === connectorId) ?? null;
    if (!connector || !isConnectorKind(connector.data.kind)) return;
    updateNodeData(connectorId, { staticRi: cloneStaticRiMap(staticRi) });
  };

  let layoutFrame: number | null = null;
  let spacingFrame: number | null = null;
  let manualGraphDragActive = false;
  let manualGraphDragSettleTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelLayoutFrames = () => {
    if (layoutFrame !== null) {
      cancelAnimationFrame(layoutFrame);
      layoutFrame = null;
    }
    if (spacingFrame !== null) {
      cancelAnimationFrame(spacingFrame);
      spacingFrame = null;
    }
  };

  const shouldDeferAutoLayout = () => manualGraphDragActive || manualGraphDragSettleTimer !== null;

  const beginManualGraphDrag = () => {
    manualGraphDragActive = true;
    if (manualGraphDragSettleTimer !== null) {
      clearTimeout(manualGraphDragSettleTimer);
      manualGraphDragSettleTimer = null;
    }
    cancelLayoutFrames();
  };

  const endManualGraphDrag = () => {
    manualGraphDragActive = false;
    cancelLayoutFrames();
    if (manualGraphDragSettleTimer !== null) {
      clearTimeout(manualGraphDragSettleTimer);
    }
    manualGraphDragSettleTimer = setTimeout(() => {
      manualGraphDragSettleTimer = null;
    }, 250);
  };

  const scheduleLayout = ({ connectorTrees = false }: { connectorTrees?: boolean } = {}) => {
    if (!canvasEl) return;
    if (shouldDeferAutoLayout()) return;
    if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      if (shouldDeferAutoLayout()) return;
      layoutFeatureClusters({ connectorTrees });
    });
  };

  const measureNodeSize = (nodeId: string, fallback: { width: number; height: number }) => {
    if (!canvasEl) return fallback;
    const el = canvasEl.querySelector<HTMLElement>(`.svelte-flow__node[data-id="${nodeId}"]`);
    if (!el) return fallback;
    const rect = el.getBoundingClientRect();
    const zoom = Math.max(STUDIO_FLOW_MIN_ZOOM, getZoom?.() ?? 1);
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
    if (shouldDeferAutoLayout()) return;
    if (spacingFrame !== null) cancelAnimationFrame(spacingFrame);
    spacingFrame = requestAnimationFrame(() => {
      spacingFrame = null;
      if (shouldDeferAutoLayout()) return;
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

  const parseConnectorDimensionHandleForLayout = (handle?: string | null): number | null => {
    if (!handle?.startsWith("dim-")) return null;
    const value = Number(handle.replace("dim-", ""));
    return Number.isInteger(value) && value >= 0 ? value : null;
  };

  const buildConnectorTreeLayoutUpdates = (): SvelteMap<string, { x: number; y: number }> => {
    const updates = new SvelteMap<string, { x: number; y: number }>();
    const connectorNodes = nodes.filter((node) => isConnectorKind(node.data.kind) && !node.hidden);
    if (!connectorNodes.length) return updates;

    const connectorById = new SvelteMap<string, StudioNode>(
      connectorNodes.map((node) => [node.id, node] as const),
    );
    const connectorEdges = edges.filter((edge) => {
      const source = connectorById.get(edge.source);
      const target = connectorById.get(edge.target);
      if (!source || !target) return false;
      if ((edge.targetHandle ?? "in") !== "in") return false;
      return parseConnectorDimensionHandleForLayout(edge.sourceHandle) !== null;
    });
    if (!connectorEdges.length) return updates;

    const childrenByConnector = new SvelteMap<string, Edge[]>();
    const incomingConnectorIds = new SvelteSet<string>();
    connectorEdges.forEach((edge) => {
      incomingConnectorIds.add(edge.target);
      const current = childrenByConnector.get(edge.source) ?? [];
      current.push(edge);
      childrenByConnector.set(edge.source, current);
    });

    childrenByConnector.forEach((items) => {
      items.sort((a, b) => {
        const dimA = parseConnectorDimensionHandleForLayout(a.sourceHandle) ?? 0;
        const dimB = parseConnectorDimensionHandleForLayout(b.sourceHandle) ?? 0;
        if (dimA !== dimB) return dimA - dimB;
        const targetA = connectorById.get(a.target);
        const targetB = connectorById.get(b.target);
        return (targetA?.data.label ?? "").localeCompare(targetB?.data.label ?? "");
      });
    });

    const nodeSize = (node: StudioNode) => measureNodeSize(node.id, fallbackNodeSize(node));
    const nodeWidth = (node: StudioNode) => nodeSize(node).width;
    const nodeHeight = (node: StudioNode) => nodeSize(node).height;
    const horizontalGap = 96;
    const subtreeWidthMemo = new SvelteMap<string, number>();

    const computeSubtreeWidth = (nodeId: string, stack = new SvelteSet<string>()): number => {
      const node = connectorById.get(nodeId);
      if (!node) return 0;
      if (stack.has(nodeId)) return nodeWidth(node);
      const memo = subtreeWidthMemo.get(nodeId);
      if (memo !== undefined) return memo;

      const nextStack = new SvelteSet(stack);
      nextStack.add(nodeId);
      const children = (childrenByConnector.get(nodeId) ?? []).filter((edge) =>
        connectorById.has(edge.target),
      );
      const childWidths = children.map((edge) => computeSubtreeWidth(edge.target, nextStack));
      const childrenWidth =
        childWidths.reduce((sum, width) => sum + width, 0) +
        horizontalGap * Math.max(0, childWidths.length - 1);
      const width = Math.max(nodeWidth(node), childrenWidth);
      subtreeWidthMemo.set(nodeId, width);
      return width;
    };

    const roots = connectorNodes
      .filter((node) => !incomingConnectorIds.has(node.id))
      .sort((a, b) => {
        if (Boolean(a.data.tabRoot) !== Boolean(b.data.tabRoot)) {
          return a.data.tabRoot ? -1 : 1;
        }
        return a.position.x - b.position.x || a.position.y - b.position.y;
      });
    const orderedRoots = [
      ...roots,
      ...connectorNodes.filter((node) => incomingConnectorIds.has(node.id)),
    ].filter(
      (node, index, all) => all.findIndex((candidate) => candidate.id === node.id) === index,
    );

    const depthByNodeId = new SvelteMap<string, number>();
    const assignDepth = (nodeId: string, depth: number, stack = new SvelteSet<string>()) => {
      const node = connectorById.get(nodeId);
      if (!node || stack.has(nodeId)) return;
      const existingDepth = depthByNodeId.get(nodeId);
      if (existingDepth !== undefined && existingDepth <= depth) return;
      depthByNodeId.set(nodeId, depth);

      const nextStack = new SvelteSet(stack);
      nextStack.add(nodeId);
      (childrenByConnector.get(nodeId) ?? [])
        .filter((edge) => connectorById.has(edge.target))
        .forEach((edge) => assignDepth(edge.target, depth + 1, nextStack));
    };
    roots.forEach((root) => assignDepth(root.id, 0));
    connectorNodes
      .filter((node) => !depthByNodeId.has(node.id))
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
      .forEach((node) => assignDepth(node.id, 0));

    const rowHeightByDepth = new SvelteMap<number, number>();
    connectorNodes.forEach((node) => {
      const depth = depthByNodeId.get(node.id) ?? 0;
      rowHeightByDepth.set(depth, Math.max(rowHeightByDepth.get(depth) ?? 0, nodeHeight(node)));
    });
    const maxDepth = Math.max(0, ...Array.from(rowHeightByDepth.keys()));
    const rowGap = 140;
    const rowOffsetByDepth = new SvelteMap<number, number>();
    let rowOffset = 0;
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      rowOffsetByDepth.set(depth, rowOffset);
      rowOffset += (rowHeightByDepth.get(depth) ?? 190) + rowGap;
    }

    const placed = new SvelteSet<string>();
    const placeSubtree = (
      nodeId: string,
      left: number,
      rootTop: number,
      stack = new SvelteSet<string>(),
    ) => {
      const node = connectorById.get(nodeId);
      if (!node || placed.has(nodeId) || stack.has(nodeId)) return;
      const width = computeSubtreeWidth(nodeId);
      const ownWidth = nodeWidth(node);
      const depth = depthByNodeId.get(nodeId) ?? 0;
      const y = rootTop + (rowOffsetByDepth.get(depth) ?? depth * 300);
      updates.set(nodeId, { x: left + width / 2 - ownWidth / 2, y });
      placed.add(nodeId);

      const nextStack = new SvelteSet(stack);
      nextStack.add(nodeId);
      const children = (childrenByConnector.get(nodeId) ?? []).filter((edge) =>
        connectorById.has(edge.target),
      );
      const childWidths = children.map((edge) => computeSubtreeWidth(edge.target, nextStack));
      const totalChildrenWidth =
        childWidths.reduce((sum, childWidth) => sum + childWidth, 0) +
        horizontalGap * Math.max(0, childWidths.length - 1);
      let cursorX = left + Math.max(0, (width - totalChildrenWidth) / 2);

      children.forEach((edge, index) => {
        const childWidth = childWidths[index] ?? 0;
        placeSubtree(edge.target, cursorX, rootTop, nextStack);
        cursorX += childWidth + horizontalGap;
      });
    };

    let cursorX = Math.min(...connectorNodes.map((node) => node.position.x));
    const rootY = Math.min(...connectorNodes.map((node) => node.position.y));
    let placedRootCount = 0;
    orderedRoots.forEach((root) => {
      if (placed.has(root.id)) return;
      const width = computeSubtreeWidth(root.id);
      const ownWidth = nodeWidth(root);
      const preferredLeft = root.position.x + ownWidth / 2 - width / 2;
      const left = placedRootCount === 0 ? preferredLeft : Math.max(preferredLeft, cursorX);
      placeSubtree(root.id, left, rootY);
      placedRootCount += 1;
      cursorX = left + width + horizontalGap * 1.5;
    });

    return updates;
  };

  const layoutFeatureClusters = ({ connectorTrees = false }: { connectorTrees?: boolean } = {}) => {
    if (!canvasEl) return;
    const updates = connectorTrees
      ? buildConnectorTreeLayoutUpdates()
      : new SvelteMap<string, { x: number; y: number }>();
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
        const featurePosition = updates.get(feature.id) ?? feature.position;
        const dimensionSizes = dimensions.map((dimension) =>
          measureNodeSize(dimension.id, defaultDimensionSize),
        );
        const maxDimensionHeight = Math.max(...dimensionSizes.map((size) => size.height));

        const totalWidth =
          dimensionSizes.reduce((sum, size) => sum + size.width, 0) +
          gapX * Math.max(0, dimensions.length - 1);
        const featureCenter = featurePosition.x + featureSize.width / 2;
        let cursorX = featureCenter - totalWidth / 2;

        const dimensionRowY = featurePosition.y + featureSize.height + gapY;
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
    touchDeps(nodePositionSignature);
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

  const removeTransformationFromDimension = (dimensionId: string, transformationId: string) => {
    transformationCodeById.delete(transformationId);
    updateDimensionTransformations(dimensionId, (current) =>
      current.filter((tx) => tx.id !== transformationId),
    );
  };

  let transformationDragState = $state<{ dimensionId: string; fromIndex: number } | null>(null);
  let transformationDropState = $state<{ dimensionId: string; dropIndex: number } | null>(null);

  const moveTransformationInDimension = (
    dimensionId: string,
    fromIndex: number,
    toInsertIndex: number,
  ) => {
    updateDimensionTransformations(dimensionId, (current) => {
      if (fromIndex < 0 || fromIndex >= current.length) return current;
      const next = [...current];
      const [picked] = next.splice(fromIndex, 1);
      if (!picked) return current;
      const clampedTarget = Math.max(0, Math.min(toInsertIndex, next.length));
      const adjustedTarget =
        fromIndex < clampedTarget ? Math.max(0, clampedTarget - 1) : clampedTarget;
      next.splice(adjustedTarget, 0, picked);
      return next;
    });
  };

  const handleTransformationDragStart = (
    event: DragEvent,
    dimensionId: string,
    fromIndex: number,
  ) => {
    transformationDragState = { dimensionId, fromIndex };
    transformationDropState = null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `${dimensionId}:${fromIndex}`);
    }
  };

  const handleTransformationDragOver = (
    event: DragEvent,
    dimensionId: string,
    dropIndex: number,
  ) => {
    if (!transformationDragState || transformationDragState.dimensionId !== dimensionId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    transformationDropState = { dimensionId, dropIndex };
  };

  const getTransformationInsertIndexFromRow = (event: DragEvent, rowIndex: number): number => {
    const current = event.currentTarget as HTMLElement | null;
    const bounds = current?.getBoundingClientRect();
    if (!bounds) return rowIndex;
    return event.clientY < bounds.top + bounds.height / 2 ? rowIndex : rowIndex + 1;
  };

  const handleTransformationRowDragOver = (
    event: DragEvent,
    dimensionId: string,
    rowIndex: number,
  ) => {
    if (!transformationDragState || transformationDragState.dimensionId !== dimensionId) return;
    const dropIndex = getTransformationInsertIndexFromRow(event, rowIndex);
    handleTransformationDragOver(event, dimensionId, dropIndex);
  };

  const handleTransformationRowDrop = (event: DragEvent, dimensionId: string, rowIndex: number) => {
    const dropIndex = getTransformationInsertIndexFromRow(event, rowIndex);
    handleTransformationDrop(event, dimensionId, dropIndex);
  };

  const handleTransformationDrop = (event: DragEvent, dimensionId: string, dropIndex: number) => {
    event.preventDefault();
    const dragState = transformationDragState;
    transformationDragState = null;
    transformationDropState = null;
    if (!dragState || dragState.dimensionId !== dimensionId) return;
    moveTransformationInDimension(dimensionId, dragState.fromIndex, dropIndex);
  };

  const endTransformationDrag = () => {
    transformationDragState = null;
    transformationDropState = null;
  };

  const transformationRowDropClass = (dimensionId: string, rowIndex: number): string => {
    if (transformationDropState?.dimensionId !== dimensionId) return "";
    if (transformationDropState.dropIndex === rowIndex) return "is-drop-before";
    if (transformationDropState.dropIndex === rowIndex + 1) return "is-drop-after";
    return "";
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
    const tabRootConnector =
      nodes.find((node) => isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot)) ??
      (activeTab?.particleId
        ? (nodes.find(
            (node) =>
              isConnectorKind(node.data.kind) &&
              normalizeKey(resolveNodeName(node)) === normalizeKey(activeTab.particleId!),
          ) ?? null)
        : null);
    const rootConnectorId = tabRootConnector?.id ?? null;
    const rootConnectorName = tabRootConnector ? resolveNodeName(tabRootConnector) : "";
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

  const selectedConnectorContextFingerprint = $derived.by(() =>
    [
      selectedNodeId ?? "",
      nodes.map((node) => `${node.id}:${node.data.kind ?? ""}`).join("|"),
      edges
        .filter(isConnectorContextEdge)
        .map((edge) => `${edge.source}>${edge.target}:${parseConnectorEdgeRelation(edge)}`)
        .join("|"),
    ].join("::"),
  );

  $effect(() => {
    touchDeps(selectedConnectorContextFingerprint);

    const roles = computeSelectedConnectorContextHighlightRoles(nodes, edges, selectedNodeId);
    const contextNodeIds = new SvelteSet(roles.keys());
    const contextRootConnector =
      nodes.find(
        (node) => isConnectorKind(node.data.kind) && node.data.definitionRole === "root",
      ) ??
      nodes.find((node) => isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot)) ??
      null;
    const contextConnectorNames = Array.from(
      new SvelteSet(
        Array.from(roles.keys())
          .map((nodeId) => nodes.find((item) => item.id === nodeId))
          .filter(
            (node): node is StudioNode => node !== undefined && isConnectorKind(node.data.kind),
          )
          .map((node) => resolveNodeName(node))
          .filter(Boolean),
      ),
    );
    const contextConnectorPathPrefixes = computeConnectorContextPathPrefixes(
      nodes,
      edges,
      contextRootConnector?.id ?? null,
      contextNodeIds,
      resolveNodeName,
    );
    let changed = false;
    const nextNodes = nodes.map((node) => {
      const nextRole = roles.get(node.id) ?? null;
      const currentRole = node.data.contextHighlightRole ?? null;
      const nextContextNames = node.data.kind === "plugin" ? contextConnectorNames : undefined;
      const nextContextPathPrefixes =
        node.data.kind === "plugin" ? contextConnectorPathPrefixes : undefined;
      const currentContextNames =
        node.data.kind === "plugin" ? (node.data.selectedConnectorContextNames ?? []) : undefined;
      const currentContextPathPrefixes =
        node.data.kind === "plugin"
          ? (node.data.selectedConnectorContextPathPrefixes ?? [])
          : undefined;
      const contextNamesChanged =
        node.data.kind === "plugin" &&
        (currentContextNames?.length !== nextContextNames?.length ||
          (currentContextNames ?? []).some((name, index) => name !== nextContextNames?.[index]));
      const contextPathPrefixesChanged =
        node.data.kind === "plugin" &&
        (currentContextPathPrefixes?.length !== nextContextPathPrefixes?.length ||
          (currentContextPathPrefixes ?? []).some(
            (prefix, index) => prefix !== nextContextPathPrefixes?.[index],
          ));
      if (currentRole === nextRole && !contextNamesChanged && !contextPathPrefixesChanged) {
        return node;
      }
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          contextHighlightRole: nextRole,
          ...(node.data.kind === "plugin"
            ? {
                selectedConnectorContextNames: nextContextNames,
                selectedConnectorContextPathPrefixes: nextContextPathPrefixes,
              }
            : {}),
        },
      };
    });

    if (changed) {
      nodes = nextNodes;
    }
  });

  const resolvePreferredEditableDimensionId = (): string | null => {
    if (connectorDropTarget?.type === "dimension") {
      const targetDimension = getDimensionNodeForConnectorIndex(
        connectorDropTarget.connectorId,
        connectorDropTarget.dimensionIndex,
      );
      if (targetDimension && !targetDimension.data.fromNetwork) {
        return targetDimension.id;
      }
    }

    const selected = nodes.find((node) => node.id === selectedNodeId) ?? null;
    if (selected?.data.kind === "dimension" && !selected.data.fromNetwork) {
      return selected.id;
    }

    const connector = getSelectedConnectorNode();
    if (!connector || connector.data.fromNetwork) return null;
    const firstDimension = getDimensionNodesForFeature(connector.id)
      .sort((a, b) => (a.data.dimensionIndex ?? 0) - (b.data.dimensionIndex ?? 0))
      .find((node) => !node.data.fromNetwork);
    return firstDimension?.id ?? null;
  };

  const resolvePreferredEditableConnectorId = (): string | null => {
    const selected = getSelectedConnectorNode();
    if (selected && !selected.data.fromNetwork) return selected.id;
    if (connectorDropTarget?.connectorId) {
      const target = getFeatureNode(connectorDropTarget.connectorId);
      if (target && !target.data.fromNetwork) return target.id;
    }
    return null;
  };

  const openNewTransformationEditor = (
    options: {
      dimensionId?: string | null;
    } = {},
  ) => {
    if (activeTabReadOnly) return;
    libraryCreateActionError = null;
    transformationEditorOpen = true;
    transformationEditorDimensionId = options.dimensionId ?? null;
    transformationEditorStatus = "draft";
    transformationEditorLocked = false;
    transformationDraftName = createEphemeralDeployName("transformation", { scope: "draft" });
    transformationDraftCode = defaultDraftCode;
    transformationDraftError = null;
    transformationAiAssistantOpen = false;
    transformationAiAssistantBusy = false;
    transformationAiAssistantPrompt = "";
    transformationAiAssistantError = null;
    transformationAiAssistantMessages = [];
  };

  const openNewConditionEditor = (
    options: {
      targetConnectorId?: string | null;
    } = {},
  ) => {
    if (activeTabReadOnly) return;
    libraryCreateActionError = null;
    conditionEditorOpen = true;
    conditionEditorNodeId = null;
    conditionEditorTargetConnectorId = options.targetConnectorId ?? null;
    conditionEditorStatus = "draft";
    conditionEditorLocked = false;
    conditionEditorDeployBusy = false;
    conditionDraftName = createEphemeralDeployName("condition", { scope: "draft" });
    conditionDraftCode = defaultConditionDraftCode;
    conditionDraftError = null;
    conditionAiAssistantOpen = false;
    conditionAiAssistantBusy = false;
    conditionAiAssistantPrompt = "";
    conditionAiAssistantError = null;
    conditionAiAssistantMessages = [];
  };

  const openContextualTransformationEditor = () => {
    openNewTransformationEditor({
      dimensionId: resolvePreferredEditableDimensionId(),
    });
  };

  const openContextualConditionEditor = () => {
    openNewConditionEditor({
      targetConnectorId: resolvePreferredEditableConnectorId(),
    });
  };

  const generateTransformationTestName = () => {
    transformationDraftName = createEphemeralDeployName("transformation", { scope: "manual" });
    transformationDraftError = null;
  };

  const generateConditionTestName = () => {
    conditionDraftName = createEphemeralDeployName("condition", { scope: "manual" });
    conditionDraftError = null;
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
    scheduleLayout({ connectorTrees: true });
  };

  const handleZoomToFit = () => {
    fitView?.({ padding: 0.2, duration: 300 });
  };

  const scheduleCanvasFitView = (padding = 0.2, nodeIds: string[] = [], tabId?: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (tabId && activeTabId !== tabId) return;
        void fitView?.({
          padding,
          duration: 250,
          minZoom: STUDIO_FLOW_MIN_ZOOM,
          maxZoom: 1,
          ...(nodeIds.length ? { nodes: nodeIds.map((id) => ({ id })) } : {}),
        });
      });
    });
  };

  const scheduleCanvasCenter = (center: { x: number; y: number }, zoom = 0.7, tabId?: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (tabId && activeTabId !== tabId) return;
        void setCenter?.(center.x, center.y, { zoom, duration: 250 });
      });
    });
  };

  const scheduleDraftTabRootViewportReset = (tabId: string, attempts = 6) => {
    requestAnimationFrame(() => {
      if (activeTabId !== tabId) return;
      const rootNode =
        nodes.find(
          (node) => isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot) && !node.hidden,
        ) ?? null;
      if (!rootNode) {
        if (attempts > 0) scheduleDraftTabRootViewportReset(tabId, attempts - 1);
        return;
      }
      if (!setCenter) {
        if (attempts > 0) scheduleDraftTabRootViewportReset(tabId, attempts - 1);
        return;
      }
      void setCenter(rootNode.position.x + 120, rootNode.position.y + 90, {
        zoom: 1,
        duration: 0,
      }).then(() => {
        if (attempts > 0) {
          window.setTimeout(() => scheduleDraftTabRootViewportReset(tabId, attempts - 1), 60);
        }
      });
    });
  };

  const getPluginTargetNames = (
    pluginId: string,
    nodeLookup: Record<string, StudioNode>,
    graphEdges: Edge[],
  ) => {
    const targets = graphEdges
      .filter((item) => item.source === pluginId && item.target)
      .map((item) => nodeLookup[item.target!])
      .filter((node): node is StudioNode => Boolean(node))
      .filter((node) => isConnectorKind(node.data.kind))
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
          data: {
            ...node.data,
            pluginOutput: [],
            pluginData: undefined,
            pluginTargets: undefined,
          },
        };
      }
      const pluginData = buildStudioPluginRuntimeData(
        node.data.sourceId ?? "",
        targetNames,
        output,
      );
      return {
        ...node,
        data: {
          ...node.data,
          pluginOutput: pluginData.streams,
          pluginData,
          pluginTargets: targetNames,
        },
      };
    });
    nodes = updatedNodes;
  };

  const getDeployedStudioState = (): DeployedStudioState => ({
    registry: deployedRegistry,
    library: deployedLibrary,
    particles: deployedParticles,
  });

  const applyDeployedStudioState = (state: DeployedStudioState) => {
    deployedRegistry = state.registry;
    deployedLibrary = state.library;
    deployedParticles = state.particles;
  };

  const replaceOrAppendLibraryItems = (
    current: LibraryItem[],
    incoming: LibraryItem[],
  ): LibraryItem[] => {
    const incomingById = new Map(incoming.map((item) => [item.id, item]));
    const merged = current.map((item) => incomingById.get(item.id) ?? item);
    const existingIds = new SvelteSet(merged.map((item) => item.id));
    incoming.forEach((item) => {
      if (!existingIds.has(item.id)) {
        merged.push(item);
        existingIds.add(item.id);
      }
    });
    return merged;
  };

  const collectNetworkFeedLibraryIds = (
    library: DeployedLibrary,
  ): Record<NetworkLibraryKind, string[]> => ({
    feature: library.features.map((item) => item.id),
    transformation: library.transformations.map((item) => item.id),
    condition: library.conditions.map((item) => item.id),
  });

  const markNetworkLibraryItemVisible = (kind: NetworkLibraryKind, id: string) => {
    const normalizedId = id.trim();
    if (!normalizedId) return;
    const current = networkFeedLibraryIds[kind] ?? [];
    if (current.includes(normalizedId)) return;
    networkFeedLibraryIds = {
      ...networkFeedLibraryIds,
      [kind]: [...current, normalizedId],
    };
  };

  const applyStudioNetworkFeedLibraryDiscovery = (discovery: StudioEventFeedLibraryDiscovery) => {
    networkFeedLibraryIds = collectNetworkFeedLibraryIds(discovery.library);
    deployedLibrary = {
      features: replaceOrAppendLibraryItems(deployedLibrary.features, discovery.library.features),
      transformations: replaceOrAppendLibraryItems(
        deployedLibrary.transformations,
        discovery.library.transformations,
      ),
      conditions: replaceOrAppendLibraryItems(
        deployedLibrary.conditions,
        discovery.library.conditions,
      ),
    };
  };

  const buildStudioChainSyncSummary = (): string => {
    return formatStudioChainSyncSummary({
      sourceCount: lastStudioSyncedSourcesCount,
      connectorEntryCount: deployedParticles.length,
      connectorCount: deployedLibrary.features.length,
      transformationCount: deployedLibrary.transformations.length,
      conditionCount: deployedLibrary.conditions.length,
    });
  };

  const refreshStudioChainSyncSummary = () => {
    if (lastStudioSyncedSourcesCount <= 0) return;
    chainSyncStatus = buildStudioChainSyncSummary();
  };

  const buildStudioEventFeedSyncSummary = (
    discovery: StudioEventFeedLibraryDiscovery,
    sourceCount: number,
  ): string =>
    `Loaded ${discovery.discoveredItemCount} network library entries from chain feed across ${sourceCount} source(s): ${discovery.library.features.length} connectors, ${discovery.library.transformations.length} transformations, ${discovery.library.conditions.length} conditions.`;

  const resolveStudioChainSyncSources = async (): Promise<
    Array<{ address: string; authorId: string; label: string }>
  > => {
    const profileState = await getCurrentUserProfileState({
      preferCached: true,
    });
    const resolvedCurrentSources = resolveCurrentUserChainSourceAddresses(profileState.me);
    const sources = buildStudioChainSyncSources({
      currentUserChainSourceAddresses: resolvedCurrentSources,
      followedUserAddresses: profileState.social.followedUserAddresses,
    });
    if (import.meta.env.DEV) {
      console.info("[Studio sync] Source derivation", {
        profileSources: resolvedCurrentSources,
        mergedSources: sources.map((source) => source.address),
      });
    }
    return sources;
  };

  type StudioChainAuthContext = {
    servicesUserId: string;
    email: string;
    displayName: string;
    ethereumAddress: string;
    authorId: string;
  };

  const resolveCurrentStudioChainAuthContext = async (): Promise<StudioChainAuthContext> => {
    const mePayload = (await getMe()) as Record<string, unknown>;
    const user =
      mePayload &&
      typeof mePayload === "object" &&
      mePayload.user &&
      typeof mePayload.user === "object"
        ? (mePayload.user as Record<string, unknown>)
        : mePayload;

    const servicesUserId = typeof user?.id === "string" ? user.id.trim() : "";
    if (!servicesUserId) {
      throw new Error("Services account did not include a user id.");
    }

    const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    const displayName =
      typeof user?.display_name === "string"
        ? user.display_name.trim()
        : typeof user?.displayName === "string"
          ? user.displayName.trim()
          : "";
    const ethereumAddress =
      typeof user?.ethereum_address === "string"
        ? user.ethereum_address.trim().toLowerCase()
        : typeof user?.ethereumAddress === "string"
          ? user.ethereumAddress.trim().toLowerCase()
          : "";

    return {
      servicesUserId,
      email,
      displayName,
      ethereumAddress,
      authorId: ethereumAddress || servicesUserId,
    };
  };

  let chainTokenUserId = getChainTokenUserId() ?? "";
  let chainAuthPromise: Promise<void> | null = null;
  const ensureChainAuthForStudio = async (forceRefresh = false) => {
    if (chainAuthPromise && !forceRefresh) return chainAuthPromise;

    const authContext = await resolveCurrentStudioChainAuthContext();
    currentStudioAuthorId = authContext.authorId || getCurrentStudioAuthorId();
    if (forceRefresh) {
      clearChainToken();
      chainTokenUserId = "";
    }

    const walletIdentity = chainTokenIdentityForWalletAddress(authContext.ethereumAddress);
    const storedUserId = getChainTokenUserId() ?? chainTokenUserId;
    if (getChainToken() && walletIdentity && storedUserId === walletIdentity) {
      chainTokenUserId = walletIdentity;
      if (authContext.ethereumAddress) currentStudioAuthorId = authContext.ethereumAddress;
      return;
    }

    chainAuthPromise = loginWithBrowserWalletChainAccount({ patchServicesProfile: true })
      .then((result) => {
        chainTokenUserId = chainTokenIdentityForWalletAddress(result.address);
        currentStudioAuthorId = result.address.trim().toLowerCase() || getCurrentStudioAuthorId();
      })
      .finally(() => {
        chainAuthPromise = null;
      });
    return chainAuthPromise;
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
    const fetched = await fetchChainParticleForStudio(particleName);
    const merged = mergeFetchedChainParticleIntoStudioState(
      getDeployedStudioState(),
      fetched,
      getCurrentStudioAuthorId(),
    );
    if (!merged.merged) return false;
    applyDeployedStudioState(merged.state);
    return true;
  };

  const collectConnectorReferenceNames = (connector: StudioConnectorDef): string[] => {
    const names = new SvelteSet<string>();
    connector.dimensions.forEach((dimension) => {
      const composite = dimension.composite?.trim();
      if (composite) names.add(composite);
      Object.values(dimension.bindings ?? {}).forEach((target) => {
        const name = target.trim();
        if (name) names.add(name);
      });
    });
    return Array.from(names);
  };

  const syncConnectorTreeFromChain = async (
    connectorName: string,
  ): Promise<{ loaded: string[]; missing: string[] }> => {
    const root = connectorName.trim();
    if (!root) return { loaded: [], missing: [] };

    const queued = [root];
    const visited = new SvelteSet<string>();
    const loaded: string[] = [];
    const missing: string[] = [];
    const maxFetches = 64;

    while (queued.length > 0 && visited.size < maxFetches) {
      const name = queued.shift()?.trim() ?? "";
      if (!name || visited.has(name)) continue;
      visited.add(name);

      let connector = deployedRegistry.connectors[name];
      if (!connector) {
        const merged = await syncSingleChainParticle(name);
        if (!merged) {
          missing.push(name);
          continue;
        }
        loaded.push(name);
        connector = deployedRegistry.connectors[name];
      }

      if (!connector) {
        missing.push(name);
        continue;
      }

      collectConnectorReferenceNames(connector).forEach((childName) => {
        if (!visited.has(childName)) queued.push(childName);
      });
    }

    if (queued.length > 0) {
      missing.push(...queued.filter((name) => name.trim().length > 0));
    }

    return {
      loaded,
      missing: Array.from(new SvelteSet(missing)),
    };
  };

  const hydrateDeployedConnectorFromChain = async (connectorName: string) => {
    const name = connectorName.trim();
    if (!name) return;
    try {
      const result = await withChainAuthRetry(() => syncConnectorTreeFromChain(name));
      if (!result.missing.includes(name)) {
        markNetworkLibraryItemVisible("feature", `feature-${name}`);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[Studio] Failed to hydrate deployed connector from chain.", error);
      }
    }
  };

  const hydrateDeployedRuntimeFromChain = async (
    kind: "transformation" | "condition",
    name: string,
  ) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    try {
      const payload =
        kind === "transformation"
          ? await getChainTransformation(trimmedName)
          : await getChainCondition(trimmedName);
      applyDeployedStudioState(
        mergeToolboxRuntimePayloadsIntoStudioState(
          getDeployedStudioState(),
          kind,
          [[trimmedName, payload]],
          getCurrentStudioAuthorId(),
        ),
      );
      markNetworkLibraryItemVisible(
        kind,
        kind === "transformation" ? `transform-${trimmedName}` : `condition-${trimmedName}`,
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[Studio] Failed to hydrate deployed runtime item from chain.", error);
      }
    }
  };

  const hydrateToolboxConnectorsIntoLibrary = async (connectorIds: string[]) => {
    const normalizedConnectorIds = Array.from(
      new SvelteSet(
        connectorIds.map((value) => normalizeConnectorToolboxId(value)).filter(Boolean),
      ),
    );
    if (normalizedConnectorIds.length === 0) return;

    const settled = await Promise.allSettled(
      normalizedConnectorIds.map(
        async (connectorId) =>
          [connectorId, await syncConnectorTreeFromChain(connectorId)] as const,
      ),
    );

    const mergedCount = settled.reduce((count, result) => {
      if (result.status !== "fulfilled") return count;
      return count + result.value[1].loaded.length;
    }, 0);
    if (!chainSyncBusy && mergedCount > 0) {
      refreshStudioChainSyncSummary();
    }

    if (import.meta.env.DEV) {
      const failed = settled.filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value[1].missing.length > 0),
      ).length;
      if (failed > 0) {
        console.warn("[Studio] Some toolbox connectors could not be hydrated from chain.", {
          failed,
          requested: normalizedConnectorIds.length,
        });
      }
    }
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

  const syncStudioNetworkLibrary = async (options: { force?: boolean } = {}) => {
    if (studioNetworkLibraryLoaded && !options.force) return;
    if (studioNetworkLibraryLoadPromise && !options.force) {
      await studioNetworkLibraryLoadPromise;
      return;
    }

    const loadPromise = (async () => {
      chainSyncError = null;
      chainSyncStatus = "Loading Studio network library from chain feed...";
      chainSyncBusy = true;
      const sources = await resolveStudioChainSyncSources();
      if (sources.length === 0) {
        networkFeedLibraryIds = createEmptyNetworkFeedLibraryIds();
        studioNetworkLibraryLoaded = false;
        chainSyncStatus = null;
        chainSyncError =
          "Unable to resolve Studio network sources from your profile. Check connection and retry.";
        return;
      }

      chainSyncStatus = `Loading chain feed for ${sources.length} source(s)...`;
      const discovery = await loadStudioNetworkLibraryFromEventFeed({
        sourceAddresses: sources.map((source) => source.address),
        pageLimit: 256,
        maxPages: 8,
        targetItems: 240,
        includeUnfinalized: true,
      });
      applyStudioNetworkFeedLibraryDiscovery(discovery);
      refreshConnectorTreeTabs();
      lastStudioSyncedSourcesCount = sources.length;
      studioNetworkLibraryLoaded = true;
      chainSyncStatus = buildStudioEventFeedSyncSummary(discovery, sources.length);
      chainSyncError = null;
    })();

    studioNetworkLibraryLoadPromise = loadPromise;
    try {
      await loadPromise;
    } catch (error) {
      studioNetworkLibraryLoaded = false;
      chainSyncError =
        error instanceof Error ? error.message : "Failed to load Studio network library.";
      chainSyncStatus = null;
    } finally {
      if (studioNetworkLibraryLoadPromise === loadPromise) {
        studioNetworkLibraryLoadPromise = null;
      }
      chainSyncBusy = false;
    }
  };

  const ensureStudioNetworkLibraryLoaded = async () => {
    await syncStudioNetworkLibrary();
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
    standaloneDraftTransformations.forEach((tx) => {
      const name = tx.name.trim();
      if (!name) return;
      if (!sources.has(name)) {
        sources.set(name, { code: tx.code });
      }
    });
    return sources;
  };

  const collectLocalConditionSources = (graphNodes: StudioNode[]) => {
    const sources = new SvelteMap<string, string>();
    graphNodes.forEach((node) => {
      if (node.data.kind !== "condition" || node.data.fromNetwork) return;
      sources.set(node.id, getConditionCode(node.id));
    });
    return sources;
  };

  const computeConnectorRiProjectionForGraph = (
    graphNodes: StudioNode[],
    graphEdges: Edge[],
  ): {
    positionByNodeId: Record<string, number>;
    targetPositionByNodeId: Record<string, number>;
    staticByPosition: Record<string, { startPoint: number; transformationShift: number }>;
    warnings: string[];
  } => {
    const positionByNodeId: Record<string, number> = {};
    const targetPositionByNodeId: Record<string, number> = {};
    const staticByPosition: Record<string, { startPoint: number; transformationShift: number }> =
      {};
    const warnings: string[] = [];
    const rootConnectorName = resolveActiveExecuteConnectorName(graphNodes).trim();
    if (!rootConnectorName)
      return { positionByNodeId, targetPositionByNodeId, staticByPosition, warnings };

    let runtime: ReturnType<typeof buildStudioRuntime>;
    try {
      runtime = buildStudioRuntime(
        { nodes: graphNodes, edges: graphEdges },
        { rootLabel: activeTab?.label ?? "Connector", rootParticleId: activeTab?.particleId },
      );
    } catch {
      return { positionByNodeId, targetPositionByNodeId, staticByPosition, warnings };
    }

    if (!runtime.registry.connectors[rootConnectorName]) {
      return { positionByNodeId, targetPositionByNodeId, staticByPosition, warnings };
    }

    let riPlan: ReturnType<typeof buildExecuteRiPlan>;
    try {
      riPlan = buildExecuteRiPlan(runtime.registry.connectors, rootConnectorName, {});
    } catch {
      return { positionByNodeId, targetPositionByNodeId, staticByPosition, warnings };
    }

    const connectorNodes = graphNodes.filter((node) => isConnectorKind(node.data.kind));
    if (!connectorNodes.length)
      return { positionByNodeId, targetPositionByNodeId, staticByPosition, warnings };

    const projection = projectRiPositionsToConnectorNodes({
      rootConnectorName,
      planNodes: riPlan.positioning.nodes,
      planDimensions: riPlan.positioning.dimensions,
      graphNodes: connectorNodes.map((node) => ({
        id: node.id,
        connectorName: resolveNodeName(node),
        tabRoot: Boolean(node.data.tabRoot),
      })),
      graphEdges: graphEdges.map((edge) => ({
        source: edge.source ?? "",
        target: edge.target ?? "",
        sourceHandle: edge.sourceHandle ?? "",
        targetHandle: edge.targetHandle ?? "",
        relation: parseConnectorEdgeRelation(edge),
        bindingSlot: parseConnectorEdgeBindingSlot(edge),
      })),
    });

    Object.assign(positionByNodeId, projection.positionByNodeId);
    Object.assign(targetPositionByNodeId, projection.targetPositionByNodeId);
    warnings.push(...projection.warnings);

    const mappedPositions = new SvelteSet<number>([
      ...Object.values(projection.positionByNodeId),
      ...Object.values(projection.targetPositionByNodeId),
    ]);
    Object.entries(riPlan.staticRiByPosition).forEach(([positionKey, staticEntry]) => {
      const position = toInt(positionKey);
      if (position === undefined || !mappedPositions.has(position)) return;
      if (!staticEntry) return;
      staticByPosition[positionKey] = {
        startPoint: toInt(staticEntry.startPoint) ?? 0,
        transformationShift: toInt(staticEntry.transformationShift) ?? 0,
      };
    });

    return { positionByNodeId, targetPositionByNodeId, staticByPosition, warnings };
  };

  const applyProjectedRiPositionsToGraphNodes = (
    graphNodes: StudioNode[],
    positionByNodeId: Record<string, number>,
    targetPositionByNodeId: Record<string, number> = {},
  ): StudioNode[] => {
    if (!graphNodes.some((node) => isConnectorKind(node.data.kind))) return graphNodes;

    return graphNodes.map((node) => {
      if (!isConnectorKind(node.data.kind)) return node;
      const projectedPosition = positionByNodeId[node.id];
      const nextPosition =
        typeof projectedPosition === "number" && Number.isInteger(projectedPosition)
          ? projectedPosition
          : undefined;
      const projectedTargetPosition = targetPositionByNodeId[node.id];
      const nextTargetPosition =
        typeof projectedTargetPosition === "number" && Number.isInteger(projectedTargetPosition)
          ? projectedTargetPosition
          : nextPosition;
      if (
        node.data.riPosition === nextPosition &&
        node.data.riTargetPosition === nextTargetPosition
      ) {
        return node;
      }
      return {
        ...node,
        data: {
          ...node.data,
          riPosition: nextPosition,
          riTargetPosition: nextTargetPosition,
        },
      };
    });
  };

  const applyComputedRiPositionsToGraphNodes = (
    graphNodes: StudioNode[],
    graphEdges: Edge[],
  ): StudioNode[] => {
    const { positionByNodeId, targetPositionByNodeId } = computeConnectorRiProjectionForGraph(
      graphNodes,
      graphEdges,
    );
    return applyProjectedRiPositionsToGraphNodes(
      graphNodes,
      positionByNodeId,
      targetPositionByNodeId,
    );
  };

  const materializeLockedReferencedRiAsRootStatic = (graphNodes: StudioNode[]): StudioNode[] => {
    const rootNode =
      graphNodes.find(
        (node) =>
          isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot) && !node.data.fromNetwork,
      ) ?? null;
    if (!rootNode) return graphNodes;

    const normalizeMaterializedPositions = (input: unknown): number[] => {
      if (!Array.isArray(input)) return [];
      const normalized = input
        .map((value) => toInt(value as number | string | null | undefined))
        .filter((value): value is number => Number.isInteger(value))
        .sort((a, b) => a - b);
      return Array.from(new Set(normalized));
    };

    const previousMaterializedPositions = normalizeMaterializedPositions(
      rootNode.data.materializedReferencedRiPositions,
    );
    const candidates = graphNodes
      .filter((node) => isConnectorKind(node.data.kind))
      .map((node) => ({
        fromNetwork: Boolean(node.data.fromNetwork),
        riLocked: Boolean(node.data.riLocked),
        riPosition: node.data.riPosition,
        riTargetPosition: node.data.riTargetPosition,
        riStart: toInt(node.data.riStart) ?? 0,
        riShift: toInt(node.data.riShift) ?? 0,
        lockToggleDisabled: isConnectorRiLockToggleDisabled(node),
      }));

    const materialized = materializeReferencedRiIntoRootStatic(
      rootNode.data.staticRi,
      previousMaterializedPositions,
      rootNode.data.materializedReferencedRiSnapshot,
      candidates,
    );
    if (!materialized.changed) return graphNodes;

    const nextTrackedPositions = materialized.materializedPositions.length
      ? materialized.materializedPositions
      : undefined;
    const nextTrackedSnapshot = materialized.materializedPositions.length
      ? materialized.materializedSnapshot
      : undefined;

    return graphNodes.map((node) =>
      node.id === rootNode.id
        ? {
            ...node,
            data: {
              ...node.data,
              staticRi: materialized.staticRi,
              materializedReferencedRiPositions: nextTrackedPositions,
              materializedReferencedRiSnapshot: nextTrackedSnapshot,
            },
          }
        : node,
    );
  };

  const buildDeployPlanForGraph = (
    graphNodes: StudioNode[],
    graphEdges: Edge[],
    compiled: Record<string, RuntimeTransformationDef>,
  ) =>
    buildStudioDeployPlan({
      activeTab,
      nodes: graphNodes,
      edges: graphEdges,
      runtimeOverrides: buildRuntimeOverrides(compiled, graphNodes),
      compiledTransformations: compiled,
      draftTransformationSources: collectDraftTransformationSources(graphNodes),
      conditionSourcesByNodeId: collectLocalConditionSources(graphNodes),
      deployedConnectorNames: Object.keys(deployedRegistry.connectors),
      networkConnectorNames: networkLibrary.feature.map((item) => item.id.replace(/^feature-/, "")),
    });

  const publishDeployPlanToChain = async (plan: StudioDeployPlan) => {
    chainDeployError = null;
    if (!plan.ok) {
      throw new Error(plan.errors.join(" "));
    }
    if (!plan.steps.length) {
      throw new Error("Nothing to deploy.");
    }

    chainDeployStatus = "Authenticating with chain...";
    await ensureChainAuthForStudio();

    for (const step of plan.steps) {
      chainDeployStatus = `Publishing ${step.kind} ${step.name} (${step.order}/${plan.steps.length})...`;
      if (step.kind === "condition") {
        await publishConditionWithTrace(traceStudioChainPost, step.body);
        addItemToToolboxLibrary("condition", step.name);
      } else if (step.kind === "transformation") {
        await publishTransformationWithTrace(traceStudioChainPost, step.body);
        addItemToToolboxLibrary("transformation", step.name);
      } else {
        await publishConnectorWithTrace(traceStudioChainPost, step.body);
        addItemToToolboxLibrary("connector", step.name);
      }
    }

    if (!plan.localConnectorNames.length) {
      return null;
    }
    chainDeployStatus = `Published connector ${plan.rootConnectorName}.`;
    return plan.rootConnectorName;
  };

  const collectRuntimeConnectorClosure = (graphNodes: StudioNode[]) => {
    const graphConnectorNames = graphNodes
      .filter((node) => isConnectorKind(node.data.kind))
      .map((node) => resolveNodeName(node).trim())
      .filter((name) => Boolean(name));

    const queue = [...graphConnectorNames];
    const seen: Record<string, true> = {};
    const scopedConnectors: Record<string, StudioConnectorDef> = {};

    while (queue.length) {
      const next = queue.pop();
      if (!next) continue;
      const key = normalizeKey(next);
      if (seen[key]) continue;
      seen[key] = true;

      const connector = deployedRegistry.connectors[next];
      if (!connector) continue;
      scopedConnectors[next] = connector;

      connector.dimensions.forEach((dimension) => {
        const composite = dimension.composite?.trim();
        if (composite) queue.push(composite);
        Object.values(dimension.bindings ?? {}).forEach((targetRaw) => {
          const target = `${targetRaw ?? ""}`.trim();
          if (target) queue.push(target);
        });
      });
    }

    return scopedConnectors;
  };

  const buildRuntimeOverrides = (
    compiledTransformations: Record<string, RuntimeTransformationDef> = {},
    graphNodes: StudioNode[] = nodes,
  ) => {
    const scopedConnectors = collectRuntimeConnectorClosure(graphNodes);
    const scopedFeatures = Object.fromEntries(
      Object.entries(deployedRegistry.features).filter(([name]) => Boolean(scopedConnectors[name])),
    );
    const scopedParticles = Object.fromEntries(
      Object.entries(deployedRegistry.particles).filter(([name]) =>
        Boolean(scopedConnectors[name]),
      ),
    );

    return {
      connectors: scopedConnectors,
      features: scopedFeatures,
      particles: scopedParticles,
      transformations: { ...deployedRegistry.transformations, ...compiledTransformations },
      conditions: { ...deployedRegistry.conditions, ...collectLocalConditionRuntime(graphNodes) },
    };
  };

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

  const collectExecuteNodeOverrides = (graphNodes: StudioNode[]): ExecuteNodeOverrides => {
    const overrides: ExecuteNodeOverrides = {};
    graphNodes
      .filter((node) => isConnectorKind(node.data.kind))
      .forEach((connectorNode) => {
        if (connectorNode.data.riLocked) return;
        const positionKey = toCanonicalPositionKey(
          connectorNode.data.riTargetPosition ?? connectorNode.data.riPosition,
        );
        if (!positionKey) return;
        const startPoint = toInt(connectorNode.data.riStart) ?? 0;
        const transformationShift = toInt(connectorNode.data.riShift) ?? 0;
        if (startPoint === 0 && transformationShift === 0) return;
        overrides[positionKey] = {
          startPoint,
          transformationShift,
        };
      });
    return overrides;
  };

  type ExecuteRequestPreview = {
    connectorName: string;
    requestBody: ChainExecutePayload;
    error: string | null;
    warnings: string[];
    summary: string;
  };

  type PreparedExecuteRequest = ExecuteRequestPreview & {
    positionedNodes: StudioNode[];
  };

  const resolveActiveExecuteConnectorName = (graphNodes: StudioNode[] = nodes): string => {
    if (!activeTab) return "";
    if (isConnectorTreeTab(activeTabId)) {
      const treeRoot = connectorTreeModelsByTab.get(activeTabId)?.rootConnectorName?.trim();
      if (treeRoot) return treeRoot;
    }

    const fromTab = activeTab.particleId?.trim();
    if (fromTab) return fromTab;

    const rootNode =
      graphNodes.find(
        (node) => isConnectorKind(node.data.kind) && node.data.definitionRole === "root",
      ) ??
      graphNodes.find((node) => isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot)) ??
      graphNodes.find((node) => isConnectorKind(node.data.kind));
    return rootNode ? resolveNodeName(rootNode).trim() : "";
  };

  const resolveActiveTabRootConnectorName = (graphNodes: StudioNode[] = nodes): string => {
    if (!activeTab) return "";
    if (isConnectorTreeTab(activeTabId)) {
      const treeRoot = connectorTreeModelsByTab.get(activeTabId)?.rootConnectorName?.trim();
      if (treeRoot) return treeRoot;
    }

    // Plugin discovery is strictly tab-root based: no fallback to arbitrary connector nodes.
    const rootNode =
      graphNodes.find(
        (node) => isConnectorKind(node.data.kind) && node.data.definitionRole === "root",
      ) ?? graphNodes.find((node) => isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot));
    const rootName = rootNode ? resolveNodeName(rootNode).trim() : "";
    if (rootName) return rootName;

    return activeTab.particleId?.trim() ?? "";
  };

  const buildEmptyExecuteRequestBody = (particlesCount: number): ChainExecutePayload => ({
    connector_name: "",
    particles_count: String(particlesCount),
    dynamic_ri: {},
  });

  const prepareExecuteRequest = (
    graphNodes: StudioNode[] = nodes,
    graphEdges: Edge[] = edges,
  ): PreparedExecuteRequest => {
    const particlesCount = Math.max(1, Math.trunc(runSamplesCount));
    const emptyRequestBody = buildEmptyExecuteRequestBody(particlesCount);
    const connectorName = resolveActiveExecuteConnectorName(graphNodes);
    if (!connectorName) {
      return {
        connectorName: "",
        requestBody: emptyRequestBody,
        error: "No connector selected to run.",
        warnings: [],
        summary: "Execute preview unavailable.",
        positionedNodes: graphNodes,
      };
    }

    try {
      const runtime = buildStudioRuntime(
        { nodes: graphNodes, edges: graphEdges },
        {
          rootLabel: activeTab?.label ?? "Connector",
          rootParticleId: activeTab?.particleId ?? connectorName,
        },
        buildRuntimeOverrides({}, graphNodes),
      );

      const planConnectors = buildExecutePlanConnectorRegistry({
        runtimeConnectors: runtime.registry.connectors,
        deployedConnectors: deployedRegistry.connectors,
        rootConnectorName: connectorName,
      });

      if (!planConnectors[connectorName]) {
        return {
          connectorName,
          requestBody: emptyRequestBody,
          error: `Connector '${connectorName}' is not present in the execute registry.`,
          warnings: [...runtime.warnings],
          summary: "Execute preview unavailable.",
          positionedNodes: graphNodes,
        };
      }

      const projectionPlan = buildExecuteRiPlan(planConnectors, connectorName, {});
      const connectorNodes = graphNodes.filter((node) => isConnectorKind(node.data.kind));
      const projection = connectorNodes.length
        ? projectRiPositionsToConnectorNodes({
            rootConnectorName: connectorName,
            planNodes: projectionPlan.positioning.nodes,
            planDimensions: projectionPlan.positioning.dimensions,
            graphNodes: connectorNodes.map((node) => ({
              id: node.id,
              connectorName: resolveNodeName(node),
              tabRoot: Boolean(node.data.tabRoot),
            })),
            graphEdges: graphEdges.map((edge) => ({
              source: edge.source ?? "",
              target: edge.target ?? "",
              sourceHandle: edge.sourceHandle ?? "",
              targetHandle: edge.targetHandle ?? "",
              relation: parseConnectorEdgeRelation(edge),
              bindingSlot: parseConnectorEdgeBindingSlot(edge),
            })),
          })
        : { positionByNodeId: {}, targetPositionByNodeId: {}, warnings: [] };
      const positionedNodes = applyProjectedRiPositionsToGraphNodes(
        graphNodes,
        projection.positionByNodeId,
        projection.targetPositionByNodeId,
      );
      const dynamicOverrides = collectExecuteNodeOverrides(positionedNodes);
      const riPlan = buildExecuteRiPlanFromPositioning(
        planConnectors,
        projectionPlan.positioning,
        dynamicOverrides,
      );
      const requestBody = buildExecuteRequestBody({
        connectorName,
        particlesCount,
        riPlan,
      });

      const blockedWarnings = riPlan.blockedOverrides.map(
        (entry) =>
          `Blocked dynamic override at pos ${entry.position} (${entry.connectorName}) locked by ${entry.lockedByConnector}.`,
      );

      return {
        connectorName,
        requestBody,
        error: null,
        warnings: [
          ...projection.warnings,
          ...runtime.warnings,
          ...riPlan.warnings,
          ...blockedWarnings,
        ],
        summary: formatExecuteRiSummary(riPlan),
        positionedNodes,
      };
    } catch (error) {
      return {
        connectorName,
        requestBody: emptyRequestBody,
        error:
          error instanceof Error
            ? `Failed to build execute preview: ${error.message}`
            : "Failed to build execute preview.",
        warnings: [],
        summary: "Execute preview unavailable.",
        positionedNodes: graphNodes,
      };
    }
  };

  const buildExecuteRequestPreview = (
    graphNodes: StudioNode[] = nodes,
    graphEdges: Edge[] = edges,
  ): ExecuteRequestPreview => {
    const prepared = prepareExecuteRequest(graphNodes, graphEdges);
    return {
      connectorName: prepared.connectorName,
      requestBody: prepared.requestBody,
      error: prepared.error,
      warnings: prepared.warnings,
      summary: prepared.summary,
    };
  };

  const executeRequestPreview = $derived.by(() => buildExecuteRequestPreview());
  const chainApiExecuteJson = $derived.by(() =>
    JSON.stringify(executeRequestPreview.requestBody, null, 2),
  );
  const chainApiExecutePreviewError = $derived.by(() => executeRequestPreview.error);
  const chainApiExecutePreviewWarnings = $derived.by(() => executeRequestPreview.warnings);
  const chainApiExecutePreviewSummary = $derived.by(() => executeRequestPreview.summary);

  const getDeployedConnectorDefinition = (connectorName: string): StudioConnectorDef | null => {
    const trimmed = connectorName.trim();
    if (!trimmed) return null;
    if (deployedRegistry.connectors[trimmed]) return deployedRegistry.connectors[trimmed];
    const normalized = normalizeKey(trimmed);
    const registryName = Object.keys(deployedRegistry.connectors).find(
      (name) => normalizeKey(name) === normalized,
    );
    return registryName ? deployedRegistry.connectors[registryName] : null;
  };

  const activePluginSourceRootConnectorName = $derived.by(() =>
    resolveActiveTabRootConnectorName(nodes).trim(),
  );
  const activePluginSourceRootConnector = $derived.by(() => {
    const connectorName = activePluginSourceRootConnectorName;
    if (!connectorName) return null;
    return getDeployedConnectorDefinition(connectorName);
  });
  const activePluginSourceFormatHash = $derived.by(() => {
    const formatHash = activePluginSourceRootConnector?.formatHash?.trim();
    if (!formatHash) return "";
    try {
      return normalizeFormatHash(formatHash);
    } catch {
      return "";
    }
  });
  const allStudioPlugins = $derived.by<StudioPluginDescriptor[]>(() => listStudioPlugins());
  const pluginSourceInfoMessage = $derived.by(() => {
    if (!activePluginSourceRootConnectorName) {
      return "No root connector selected in this tab.";
    }
    if (!activePluginSourceRootConnector) {
      return "Worlds are available only for deployed connectors. Deploy this connector first.";
    }
    if (!activePluginSourceFormatHash) {
      return "This connector has no normalized format hash, so world compatibility cannot be resolved.";
    }
    return "";
  });
  const resolvePluginAttachSourceNode = (): StudioNode | null => {
    const rootConnectorName = activePluginSourceRootConnectorName.trim();
    if (!rootConnectorName) return null;
    const rootKey = normalizeKey(rootConnectorName);
    const candidates = nodes.filter(
      (node) => isConnectorKind(node.data.kind) && normalizeKey(resolveNodeName(node)) === rootKey,
    );
    if (!candidates.length) return null;
    return (
      candidates.find(
        (node) => node.data.definitionRole === "root" || Boolean(node.data.tabRoot),
      ) ?? candidates[0]
    );
  };

  const createStudioPluginNode = (
    plugin: StudioPluginDescriptor,
    position: { x: number; y: number } | null = null,
  ): StudioNode => ({
    id: `plugin-${plugin.id}-${crypto.randomUUID()}`,
    type: "plugin",
    selected: true,
    position: position ?? getCanvasCenter(),
    data: {
      label: plugin.name,
      kind: "plugin",
      sourceId: plugin.id,
      fromNetwork: false,
    },
  });

  const addStandaloneStudioPlugin = (
    plugin: StudioPluginDescriptor,
    options?: { position?: { x: number; y: number } | null },
  ) => {
    ensureEditableTabForInsertion();
    const pluginNode = createStudioPluginNode(plugin, options?.position ?? null);
    const nextNodes = [...nodes.map((node) => ({ ...node, selected: false })), pluginNode];
    nodes = nextNodes;
    selectedNodeId = pluginNode.id;
    selectedEdgeId = null;
    setConnectorDropTarget(null);
    refreshPluginOutputs(activeRunOutput ?? [], nextNodes, edges);
    pluginAttachStatus = `Added '${plugin.name}' as a standalone world. Connect it to a compatible root connector when the draft is ready.`;
    scheduleLayout();
  };

  const attachStudioPluginToRoot = (
    plugin: StudioPluginDescriptor,
    options?: { position?: { x: number; y: number } | null },
  ) => {
    pluginAttachStatus = null;
    pluginAttachError = null;

    const sourceNode = resolvePluginAttachSourceNode();
    if (!sourceNode) {
      pluginAttachError = "Could not resolve root connector node for world attachment.";
      return;
    }

    const existingPluginNode = nodes.find(
      (node) =>
        node.data.kind === "plugin" &&
        node.data.sourceId === plugin.id &&
        edges.some((edge) => edge.source === node.id && edge.target === sourceNode.id),
    );
    if (existingPluginNode) {
      selectedNodeId = existingPluginNode.id;
      selectedEdgeId = null;
      pluginAttachStatus = `World '${plugin.name}' is already attached to '${resolveNodeName(sourceNode)}'.`;
      return;
    }

    const reusablePluginNode = nodes.find(
      (node) =>
        node.data.kind === "plugin" &&
        node.data.sourceId === plugin.id &&
        !edges.some((edge) => edge.source === node.id && edge.target === sourceNode.id),
    );

    const attachedPluginCount = edges
      .filter((edge) => edge.target === sourceNode.id)
      .filter((edge) => {
        const sourcePluginNode = nodesById[edge.source] ?? null;
        return sourcePluginNode?.data.kind === "plugin";
      }).length;

    const pluginNode: StudioNode =
      reusablePluginNode ??
      createStudioPluginNode(
        plugin,
        options?.position ?? {
          x: sourceNode.position.x + attachedPluginCount * 26,
          y: sourceNode.position.y - 220 - attachedPluginCount * 24,
        },
      );
    const attachedPluginNode: StudioNode = {
      ...pluginNode,
      selected: true,
      data: {
        ...pluginNode.data,
        networkId: resolveNodeName(sourceNode),
      },
    };

    const pluginEdge: Edge = {
      id: `edge-${attachedPluginNode.id}-${sourceNode.id}-${crypto.randomUUID()}`,
      source: attachedPluginNode.id,
      sourceHandle: "out",
      target: sourceNode.id,
      targetHandle: "plugin-in",
      data: { relation: "plugin", pluginId: plugin.id },
      label: "plugin",
    };

    const nextNodes: StudioNode[] = nodes.map((node) => ({
      ...(node.id === attachedPluginNode.id ? attachedPluginNode : node),
      selected: node.id === attachedPluginNode.id,
    }));
    if (!reusablePluginNode) nextNodes.push(attachedPluginNode);
    const nextEdges = [...edges, pluginEdge];

    nodes = nextNodes;
    edges = nextEdges;
    selectedNodeId = attachedPluginNode.id;
    selectedEdgeId = null;
    setConnectorDropTarget(null);

    if (activeRunOutput) {
      refreshPluginOutputs(activeRunOutput, nextNodes, nextEdges);
    } else {
      refreshPluginOutputs([], nextNodes, nextEdges);
    }

    pluginAttachStatus = `Connected '${plugin.name}' to '${resolveNodeName(sourceNode)}'.`;
    scheduleLayout();
    scheduleCanvasFitView(0.25, [attachedPluginNode.id, sourceNode.id]);
    scheduleCanvasCenter(
      {
        x: (attachedPluginNode.position.x + sourceNode.position.x) / 2,
        y: (attachedPluginNode.position.y + sourceNode.position.y) / 2,
      },
      0.55,
    );
  };

  const addStudioPluginToFlow = (
    plugin: StudioPluginDescriptor,
    options?: { position?: { x: number; y: number } | null },
  ) => {
    pluginAttachStatus = null;
    pluginAttachError = null;

    if (resolvePluginAttachSourceNode()) {
      attachStudioPluginToRoot(plugin, options);
      return;
    }

    addStandaloneStudioPlugin(plugin, options);
  };

  let executePreviewCopyStatus = $state<string | null>(null);
  let executePreviewCopyTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  const copyExecuteRequestPreview = async () => {
    const text = chainApiExecuteJson;
    if (!text.trim()) {
      executePreviewCopyStatus = "No execute request available yet.";
      return;
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      executePreviewCopyStatus = "Execute request JSON copied.";
    } catch {
      executePreviewCopyStatus = "Copy failed. Select and copy manually.";
    } finally {
      if (executePreviewCopyTimer) clearTimeout(executePreviewCopyTimer);
      executePreviewCopyTimer = setTimeout(() => {
        executePreviewCopyStatus = null;
        executePreviewCopyTimer = null;
      }, 2200);
    }
  };

  const copyDeploySequencePreview = async () => {
    const text = chainApiDeployJson;
    if (!text.trim()) {
      deployPreviewCopyStatus = "No deploy sequence available yet.";
      return;
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      deployPreviewCopyStatus = "Deploy sequence JSON copied.";
    } catch {
      deployPreviewCopyStatus = "Copy failed. Select and copy manually.";
    } finally {
      if (deployPreviewCopyTimer) clearTimeout(deployPreviewCopyTimer);
      deployPreviewCopyTimer = setTimeout(() => {
        deployPreviewCopyStatus = null;
        deployPreviewCopyTimer = null;
      }, 2200);
    }
  };

  type StudioRunTimings = {
    save: number;
    prepare: number;
    auth: number;
    execute: number;
    normalize: number;
    jsonStringify: number;
    store: number;
    plugins: number;
  };

  const emptyStudioRunTimings = (): StudioRunTimings => ({
    save: 0,
    prepare: 0,
    auth: 0,
    execute: 0,
    normalize: 0,
    jsonStringify: 0,
    store: 0,
    plugins: 0,
  });

  const formatTimingMs = (value: number) => `${Math.round(value)}ms`;

  const logStudioRunTiming = (
    status: "completed" | "failed" | "blocked",
    timings: StudioRunTimings,
    totalMs: number,
  ) => {
    console.info(
      `[Studio run timing] ${status} · save ${formatTimingMs(timings.save)} · prepare ${formatTimingMs(
        timings.prepare,
      )} · auth ${formatTimingMs(timings.auth)} · execute ${formatTimingMs(
        timings.execute,
      )} · normalize ${formatTimingMs(timings.normalize)} · jsonStringify ${formatTimingMs(
        timings.jsonStringify,
      )} · store ${formatTimingMs(timings.store)} · worlds ${formatTimingMs(
        timings.plugins,
      )} · total ${formatTimingMs(totalMs)}`,
    );
  };

  function measureStudioRunStep<T>(
    timings: StudioRunTimings,
    key: keyof StudioRunTimings,
    fn: () => T,
  ): T {
    const startedAt = performance.now();
    try {
      return fn();
    } finally {
      timings[key] += performance.now() - startedAt;
    }
  }

  async function measureAsyncStudioRunStep<T>(
    timings: StudioRunTimings,
    key: keyof StudioRunTimings,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      return await fn();
    } finally {
      timings[key] += performance.now() - startedAt;
    }
  }

  const executeActiveGraph = async () => {
    if (!activeTab || chainRunBusy || chainDeployBusy) return;
    const runTabId = activeTabId;
    const runStartedAt = performance.now();
    const timings = emptyStudioRunTimings();
    chainRunBusy = true;
    chainDeployError = null;
    chainDeployStatus = "Preparing run...";
    let output: PtOutputFeature[] = [];
    let warnings: string[] = [];
    let runStatus: "completed" | "failed" | "blocked" = "completed";

    try {
      measureStudioRunStep(timings, "save", () => saveActiveGraph());
      const requestPreview = measureStudioRunStep(timings, "prepare", () =>
        prepareExecuteRequest(nodes, edges),
      );
      nodes = requestPreview.positionedNodes;
      const connectorName = requestPreview.connectorName;
      warnings = [...requestPreview.warnings];

      if (!connectorName) {
        runStatus = "blocked";
        const message = requestPreview.error ?? "No connector selected to run.";
        chainRunMessageByTab = {
          ...chainRunMessageByTab,
          [runTabId]: JSON.stringify({ message }, null, 2),
        };
        chainRunTimestampByTab = { ...chainRunTimestampByTab, [runTabId]: Date.now() };
        chainDeployStatus = null;
        return;
      }
      if (requestPreview.error) {
        runStatus = "blocked";
        chainRunMessageByTab = {
          ...chainRunMessageByTab,
          [runTabId]: JSON.stringify({ message: requestPreview.error }, null, 2),
        };
        chainRunTimestampByTab = { ...chainRunTimestampByTab, [runTabId]: Date.now() };
        chainDeployStatus = null;
        return;
      }

      chainDeployStatus = "Authenticating with chain...";
      await measureAsyncStudioRunStep(timings, "auth", () => ensureChainAuthForStudio());
      chainDeployStatus = "Running on chain...";
      const result = await measureAsyncStudioRunStep(timings, "execute", () =>
        withChainAuthRetry(() => postChainExecuteDetailed(requestPreview.requestBody)),
      );
      output = measureStudioRunStep(timings, "normalize", () =>
        result.body.map((stream) => ({
          feature_path: stream.path,
          data: [...stream.data],
        })),
      );

      const responseJson = measureStudioRunStep(timings, "jsonStringify", () =>
        JSON.stringify(result.body, null, 2),
      );
      chainRunMessageByTab = {
        ...chainRunMessageByTab,
        [runTabId]: responseJson,
      };
      chainRunTimestampByTab = { ...chainRunTimestampByTab, [runTabId]: Date.now() };
      chainDeployStatus = "Run completed.";
    } catch (error) {
      runStatus = "failed";
      const err = extractExecuteErrorDetail(error);
      let responseOnly = "";
      if (error instanceof ChainApiRequestError) {
        const body = error.responseBody;
        if (typeof body === "string") {
          responseOnly = body.trim();
        } else if (body !== undefined) {
          responseOnly = JSON.stringify(body, null, 2) ?? "";
        }
      }
      const fallbackErrorJson = JSON.stringify({ message: err.headline }, null, 2);
      chainRunMessageByTab = {
        ...chainRunMessageByTab,
        [runTabId]: responseOnly || fallbackErrorJson,
      };
      chainRunTimestampByTab = { ...chainRunTimestampByTab, [runTabId]: Date.now() };
      warnings = [...warnings, err.headline];
      chainDeployStatus = null;
      chainDeployError = err.headline;
      output = [];
    } finally {
      measureStudioRunStep(timings, "store", () => {
        runOutputByTab = { ...runOutputByTab, [runTabId]: output };
        runWarningsByTab = { ...runWarningsByTab, [runTabId]: warnings };
        runTimestampByTab = { ...runTimestampByTab, [runTabId]: Date.now() };
      });
      measureStudioRunStep(timings, "plugins", () => refreshPluginOutputs(output));
      logStudioRunTiming(runStatus, timings, performance.now() - runStartedAt);
      chainRunBusy = false;
    }
  };

  const compileActiveGraph = () => {
    if (!activeTab) return;
    saveActiveGraph();
    const warnings: string[] = [];
    const compiled = compileDraftTransformations(nodes);
    warnings.push(...compiled.warnings);

    const hasChainConnectorReference = (connectorName: string) => {
      const trimmed = connectorName.trim();
      if (!trimmed) return false;
      if (deployedRegistry.connectors[trimmed]) return true;

      const normalized = normalizeKey(trimmed);
      if (!normalized) return false;

      if (
        Object.keys(deployedRegistry.connectors).some((name) => normalizeKey(name) === normalized)
      )
        return true;

      return networkLibrary.feature.some((item) => {
        const registryName = item.id.replace(/^feature-/, "");
        return normalizeKey(registryName) === normalized || normalizeKey(item.name) === normalized;
      });
    };

    const hasLocalConnectors = nodes.some(
      (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
    );

    if (hasLocalConnectors) {
      const connectorName = activeTab.particleId ?? (activeTab.label.trim() || activeTab.label);
      const connectorKey = normalizeKey(connectorName);
      const networkConnectorKeys = new SvelteSet([
        ...Object.keys(deployedRegistry.connectors).map(normalizeKey),
        ...networkLibrary.feature.map((item) => normalizeKey(item.id.replace(/^feature-/, ""))),
      ]);
      if (!activeTab.particleId && networkConnectorKeys.has(connectorKey)) {
        warnings.push(`Connector already exists in network: ${connectorName}.`);
      }
    }

    nodes.forEach((node) => {
      if (node.data.fromNetwork) return;
      const existing = findRegistryMatch(node.data.kind, node.data.label);
      if (existing && normalizeKey(existing.name) === normalizeKey(node.data.label)) {
        warnings.push(`${titleize(node.data.kind)} already exists: ${node.data.label}.`);
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
        const blockingRuntimeWarnings = runtime.warnings.filter(
          (warning) => !warning.startsWith("Using local override for network connector:"),
        );
        warnings.push(...blockingRuntimeWarnings);

        const rootDef = runtime.registry.connectors[runtime.rootConnector];
        if (!rootDef) {
          warnings.push("Graph does not produce a publishable root connector.");
        } else {
          const localConnectorNodes = nodes.filter(
            (node) => isConnectorKind(node.data.kind) && !node.data.fromNetwork,
          );
          const localConnectorKeys = new SvelteSet(
            localConnectorNodes.map((node) => normalizeKey(resolveNodeName(node))),
          );
          if (
            localConnectorNodes.some(
              (node) =>
                Boolean(node.data.tabRoot) || resolveNodeName(node) === runtime.rootConnector,
            )
          ) {
            localConnectorKeys.add(normalizeKey(runtime.rootConnector));
          }

          rootDef.dimensions.forEach((dimension, index) => {
            const compositeName = dimension.composite ?? null;
            if (!compositeName) return;
            if (
              !hasChainConnectorReference(compositeName) &&
              !localConnectorKeys.has(normalizeKey(compositeName))
            ) {
              warnings.push(
                `Dependency connector is not available on chain (sync required): ${compositeName} (dimension ${index + 1}).`,
              );
            }
          });

          const localConnectorDefs: StudioConnectorDef[] = [];
          const localConnectorDefNames = new SvelteSet<string>();
          localConnectorNodes.forEach((node) => {
            const def = runtime.registry.connectors[resolveNodeName(node)];
            if (!def || localConnectorDefNames.has(def.name)) return;
            localConnectorDefNames.add(def.name);
            localConnectorDefs.push(def);
          });
          if (localConnectorKeys.has(normalizeKey(runtime.rootConnector))) {
            const rootConnectorDef = runtime.registry.connectors[runtime.rootConnector];
            if (rootConnectorDef && !localConnectorDefNames.has(rootConnectorDef.name)) {
              localConnectorDefNames.add(rootConnectorDef.name);
              localConnectorDefs.push(rootConnectorDef);
            }
          }
          warnings.push(...orderConnectorDefsForDeploy(localConnectorDefs).warnings);
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
    const positionedNodes = applyComputedRiPositionsToGraphNodes(nodes, edges);
    nodes = materializeLockedReferencedRiAsRootStatic(positionedNodes);
    chainDeployError = null;
    chainDeployStatus = null;
    const warnings = compileActiveGraph();
    if (warnings && warnings.length) {
      chainDeployError = warnings.join(" ");
      return;
    }

    const compiled = compiledTransformationsByTab[activeTabId] ?? {};
    const deployPlan = buildDeployPlanForGraph(nodes, edges, compiled);
    if (!deployPlan.ok) {
      const message = deployPlan.errors.join(" ");
      chainDeployError = message;
      compileWarningsByTab = {
        ...compileWarningsByTab,
        [activeTabId]: [message],
      };
      compileTimestampByTab = { ...compileTimestampByTab, [activeTabId]: Date.now() };
      return;
    }
    const runtime = deployPlan.runtime;

    const localConditionNodes = nodes.filter(
      (node) => node.data.kind === "condition" && !node.data.fromNetwork,
    );

    deployTraceEntries = [];
    chainDeployBusy = true;
    let publishedRootConnectorName: string | null = null;
    try {
      publishedRootConnectorName = await publishDeployPlanToChain(deployPlan);
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
            authorId: getCurrentStudioAuthorId(),
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
            authorId: getCurrentStudioAuthorId(),
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
            authorId: getCurrentStudioAuthorId(),
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
                  authorId: getCurrentStudioAuthorId(),
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
      chainDeployStatus = `Deployed connector '${publishedRootConnectorName}' to chain.`;
      void hydrateDeployedConnectorFromChain(publishedRootConnectorName);
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
    Object.keys(compiled).forEach((name) => {
      void hydrateDeployedRuntimeFromChain("transformation", name);
    });
    localConditionNodes.forEach((node) => {
      void hydrateDeployedRuntimeFromChain("condition", resolveNodeName(node));
    });
  };

  const closeTransformationEditor = () => {
    transformationEditorOpen = false;
    transformationEditorDimensionId = null;
    transformationEditorStatus = "draft";
    transformationEditorLocked = false;
    transformationDraftError = null;
    transformationAiAssistantOpen = false;
    transformationAiAssistantBusy = false;
    transformationAiAssistantPrompt = "";
    transformationAiAssistantError = null;
    transformationAiAssistantMessages = [];
  };

  const closeConditionEditor = () => {
    conditionEditorOpen = false;
    conditionEditorNodeId = null;
    conditionEditorTargetConnectorId = null;
    conditionEditorStatus = "draft";
    conditionEditorLocked = false;
    conditionEditorDeployBusy = false;
    conditionDraftName = "";
    conditionDraftCode = defaultConditionDraftCode;
    conditionDraftError = null;
    conditionAiAssistantOpen = false;
    conditionAiAssistantBusy = false;
    conditionAiAssistantPrompt = "";
    conditionAiAssistantError = null;
    conditionAiAssistantMessages = [];
  };

  const saveConditionEditor = async () => {
    if (!conditionEditorOpen) return;
    if (conditionEditorReadOnly) {
      closeConditionEditor();
      return;
    }
    const nodeId = conditionEditorNodeId;
    const targetConnectorId = conditionEditorTargetConnectorId;

    const trimmedName = conditionDraftName.trim();
    if (!trimmedName) {
      conditionDraftError = "Condition name is required.";
      return;
    }
    if (isReservedCoreCollectionName("condition", trimmedName)) {
      conditionDraftError =
        `Name '${trimmedName}' is reserved for Core Collection publication. ` +
        "Use a generated test name for experiments.";
      return;
    }

    const snippetParsed = parseSoliditySnippet(conditionDraftCode);
    if (!snippetParsed.ok) {
      conditionDraftError = snippetParsed.error;
      return;
    }
    const compiled = compileConditionCode(conditionDraftCode);

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

    const requestBody = { name: trimmedName, sol_src: conditionDraftCode };
    try {
      await ensureChainAuthForStudio();
      await publishConditionWithTrace(traceStudioChainPost, requestBody);

      const inferredArgsCount = Math.max(
        0,
        inferArgsCountFromSnippet(snippetParsed.value).minArgsCount,
      );
      if (nodeId) {
        conditionCodeById.set(nodeId, conditionDraftCode);
        updateNodeData(nodeId, {
          label: trimmedName,
          fromNetwork: true,
          networkId: trimmedName,
        });
      }

      deployedRegistry = {
        ...deployedRegistry,
        conditions: {
          ...deployedRegistry.conditions,
          [trimmedName]: {
            argc: inferredArgsCount,
            check: compiled.ok ? compiled.value : alwaysTrueConditionCheck,
          },
        },
      };
      deployedLibrary = {
        ...deployedLibrary,
        conditions: upsertLibraryItem(deployedLibrary.conditions, {
          id: `condition-${slugify(trimmedName)}`,
          name: trimmedName,
          kind: "condition",
          authorId: getCurrentStudioAuthorId(),
          summary: "Deployed from Studio.",
        }),
      };
      addItemToToolboxLibrary("condition", trimmedName);
      void hydrateDeployedRuntimeFromChain("condition", trimmedName);

      if (!nodeId && targetConnectorId) {
        attachConditionToConnector(targetConnectorId, {
          label: trimmedName,
          status: "network",
          networkId: trimmedName,
          sourceId: `condition-${slugify(trimmedName)}`,
        });
      }

      chainDeployStatus = `Deployed condition ${trimmedName}.`;
      closeConditionEditor();
    } catch (error) {
      const message = extractChainDeployErrorMessage(error, "Failed to deploy condition.");
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
    if (isReservedCoreCollectionName("transformation", trimmedName)) {
      transformationDraftError =
        `Name '${trimmedName}' is reserved for Core Collection publication. ` +
        "Use a generated test name for experiments.";
      return;
    }

    const snippetParsed = parseSoliditySnippet(transformationDraftCode);
    if (!snippetParsed.ok) {
      transformationDraftError = snippetParsed.error;
      return;
    }
    const inferredArgsCount = Math.max(
      0,
      inferArgsCountFromSnippet(snippetParsed.value).minArgsCount,
    );
    const compiled = compileTransformationCode(transformationDraftCode);

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

    const requestBody = { name: trimmedName, sol_src: transformationDraftCode };
    try {
      await ensureChainAuthForStudio();
      await publishTransformationWithTrace(traceStudioChainPost, requestBody);

      deployedRegistry = {
        ...deployedRegistry,
        transformations: {
          ...deployedRegistry.transformations,
          [trimmedName]: {
            argc: inferredArgsCount,
            run: compiled.ok ? compiled.value : (x: number) => x,
          },
        },
      };
      deployedLibrary = {
        ...deployedLibrary,
        transformations: upsertLibraryItem(deployedLibrary.transformations, {
          id: `transform-${slugify(trimmedName)}`,
          name: trimmedName,
          kind: "transformation",
          authorId: getCurrentStudioAuthorId(),
          summary: "Deployed from Studio.",
        }),
      };
      addItemToToolboxLibrary("transformation", trimmedName);

      const dimensionId = transformationEditorDimensionId;
      if (dimensionId) {
        const dimensionNode = nodesById[dimensionId];
        if (dimensionNode?.data.kind === "dimension" && !dimensionNode.data.fromNetwork) {
          const createdId = addTransformationToDimension(dimensionId, trimmedName, [], "network");
          if (createdId) transformationCodeById.set(createdId, transformationDraftCode);
        }
      }

      standaloneDraftTransformations = standaloneDraftTransformations.filter(
        (item) => normalizeKey(item.name) !== normalizeKey(trimmedName),
      );
      void hydrateDeployedRuntimeFromChain("transformation", trimmedName);
      chainDeployStatus = `Deployed transformation ${trimmedName}.`;
      closeTransformationEditor();
    } catch (error) {
      const message = extractChainDeployErrorMessage(error, "Failed to deploy transformation.");
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
        hidden: Boolean(node.hidden),
      };
      if (isConnectorKind(next.data.kind)) {
        next.data.connectorTreeCollapsible = false;
        next.data.connectorTreeCollapsed = false;
      }
      return next;
    });
    const hiddenNodeIds = new SvelteSet(
      projectedNodes.filter((node) => node.hidden).map((node) => node.id),
    );
    const projectedEdges: Edge[] = model.edges
      .filter((edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target))
      .map((edge) => ({
        ...edge,
      }));
    return { nodes: projectedNodes, edges: projectedEdges };
  };

  const saveActiveGraph = () => {
    const nodeIds = new SvelteSet(nodes.map((node) => node.id));
    const safeEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    tabGraphs.set(activeTabId, { nodes, edges: safeEdges });
    tabViewports.set(activeTabId, normalizeStudioViewport(flowViewport));
  };

  const loadTabGraph = (tabId: string) => {
    flowViewport = normalizeStudioViewport(tabViewports.get(tabId));
    const projectedTree = projectConnectorTreeGraph(tabId);
    if (projectedTree) {
      const overlay = tabGraphs.get(tabId);
      const { nodes: mergedNodes, edges: mergedEdges } = mergeConnectorTreeProjectionWithOverlay(
        projectedTree,
        overlay,
      );
      nodes = mergedNodes;
      edges = mergedEdges;
    } else {
      const graph = tabGraphs.get(tabId);
      const graphNodes = graph?.nodes ?? [];
      const graphNodeIds = new SvelteSet(graphNodes.map((node) => node.id));
      const graphEdges = (graph?.edges ?? []).filter(
        (edge) => graphNodeIds.has(edge.source) && graphNodeIds.has(edge.target),
      );
      nodes = graphNodes;
      edges = graphEdges;
      if (tabId === activeTabId) {
        ensureActiveDraftTabRootConnector();
      }
    }
    nodes = nodes.map((node) =>
      isConnectorKind(node.data.kind)
        ? {
            ...node,
            data: {
              ...node.data,
              riStart: toInt(node.data.riStart) ?? 0,
              riShift: toInt(node.data.riShift) ?? 0,
              riLocked: Boolean(node.data.riLocked),
              showRiControls: true,
            },
          }
        : node,
    );
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
    scheduleDraftTabRootViewportReset(nextTab.id);
  };

  const ensureEditableTabForInsertion = () => {
    if (!activeTabReadOnly) return;
    createEmptyTab();
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) {
      tabGraphs.delete(tabId);
      connectorTreeModelsByTab.delete(tabId);
      tabViewports.delete(tabId);
      const fallback = createStudioTab("Untitled Connector");
      tabs = [fallback];
      activeTabId = fallback.id;
      loadTabGraph(fallback.id);
      scheduleDraftTabRootViewportReset(fallback.id);
      return;
    }
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    tabs = remaining;
    tabGraphs.delete(tabId);
    connectorTreeModelsByTab.delete(tabId);
    tabViewports.delete(tabId);
    if (activeTabId === tabId) {
      const nextActive = remaining[remaining.length - 1];
      activeTabId = nextActive.id;
      loadTabGraph(nextActive.id);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const featureLabel = featureItem?.name ?? feature.name;
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
        conditionLabel: particle.conditionName ? particle.conditionName : null,
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
            createTransformationInstance(transformation.name, transformation.args, "network"),
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
            label: compositeItem?.name ?? compositeName,
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
    connectorName;

  const computeOpenSlotsForBindingTarget = (connectorName: string): number => {
    const trimmed = connectorName.trim();
    if (!trimmed) throw new Error("Connector name is required.");

    try {
      const compiled = compileDraftTransformations(nodes);
      const runtime = buildStudioRuntime(
        { nodes, edges },
        {
          rootLabel: activeTab?.label ?? "Connector",
          rootParticleId: activeTab?.particleId ?? trimmed,
        },
        buildRuntimeOverrides(compiled.registry),
      );
      if (runtime.registry.connectors[trimmed]) {
        return computeConnectorOpenSlotsInRegistry(runtime.registry.connectors, trimmed);
      }
    } catch {
      // Fall through to deployed registry lookup.
    }

    return computeConnectorOpenSlotsInRegistry(deployedRegistry.connectors, trimmed);
  };

  const buildConnectorTreeGraph = (
    rootConnectorName: string,
    origin: { x: number; y: number },
    options: {
      connectorRegistry?: Record<string, StudioConnectorDef>;
      hideReadOnlyLeafOutlets?: boolean;
      markRootAsTabRoot?: boolean;
      idFactoryScope?: string;
    } = {},
  ): ConnectorTreeModel => {
    let idIndex = 0;
    const baseIdPrefix = slugify(rootConnectorName) || "connector";
    const idPrefix = options.idFactoryScope
      ? `${baseIdPrefix}-${options.idFactoryScope}`
      : baseIdPrefix;
    const connectorRegistry = options.connectorRegistry ?? deployedRegistry.connectors;
    return buildConnectorTreeGraphFromRegistry({
      connectorRegistry,
      rootConnectorName,
      origin,
      options: {
        hideReadOnlyLeafOutlets: options.hideReadOnlyLeafOutlets,
        markRootAsTabRoot: options.markRootAsTabRoot,
        idFactory: () => `${idPrefix}-${idIndex++}`,
        labelForConnector: getConnectorLibraryLabel,
      },
    });
  };

  const refreshConnectorTreeTab = (tabId: string) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);
    const rootConnectorName = tab?.particleId?.trim() ?? "";
    if (!rootConnectorName || !connectorTreeModelsByTab.has(tabId)) return;
    const currentGraph = connectorTreeModelsByTab.get(tabId) ?? null;
    const graph = buildConnectorTreeGraph(rootConnectorName, { x: 360, y: 120 });
    if (shouldReplaceConnectorTreeModel(currentGraph, graph)) {
      connectorTreeModelsByTab.set(tabId, graph);
    }
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
    const currentGraph = connectorTreeModelsByTab.get(tabId) ?? null;
    let graph = buildConnectorTreeGraph(connectorName, { x: 360, y: 120 });
    if (shouldReplaceConnectorTreeModel(currentGraph, graph)) {
      connectorTreeModelsByTab.set(tabId, graph);
    }
    tabGraphs.set(tabId, tabGraphs.get(tabId) ?? { nodes: [], edges: [] });
    if (activeTabId === tabId) loadTabGraph(tabId);
    const hasPlaceholderNodes = hasConnectorTreePlaceholderNodes(graph);
    if (graph.nodes.length && !hasPlaceholderNodes) return true;

    try {
      chainSyncError = null;
      chainSyncStatus = `Fetching ${connectorName} from chain...`;
      const result = await withChainAuthRetry(() => syncConnectorTreeFromChain(connectorName));
      if (result.missing.includes(connectorName)) {
        chainSyncStatus = null;
        chainSyncError = `Connector ${connectorName} was not found in chain registry.`;
        return false;
      }
      graph = buildConnectorTreeGraph(connectorName, { x: 360, y: 120 });
      const graphBeforeFetchReload = connectorTreeModelsByTab.get(tabId) ?? null;
      if (shouldReplaceConnectorTreeModel(graphBeforeFetchReload, graph)) {
        connectorTreeModelsByTab.set(tabId, graph);
      }
      tabGraphs.set(tabId, tabGraphs.get(tabId) ?? { nodes: [], edges: [] });
      if (activeTabId === tabId) loadTabGraph(tabId);
      const hasRenderableTree = isCompleteConnectorTreeModel(graph);
      if (hasRenderableTree) {
        chainSyncStatus =
          result.loaded.length > 1
            ? `Loaded ${connectorName} and ${result.loaded.length - 1} composite connector(s).`
            : `Loaded ${connectorName} from chain.`;
      } else {
        const missing = result.missing.length ? ` Missing: ${result.missing.join(", ")}.` : "";
        chainSyncStatus = null;
        chainSyncError = `Fetched ${connectorName}, but no complete tree could be rendered yet.${missing}`;
      }
      return hasRenderableTree;
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
    plugin: [] as RegistryMatch[],
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
    return node.data.label.trim() || node.data.label;
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

  const toggleLibraryToolbox = (item: LibraryItem) => {
    const entry = toolboxEntryForLibraryItem(item);
    if (!entry) return;
    const { library: next, changed } = toggleToolboxLibraryItem(
      toolboxLibrary,
      entry.kind,
      entry.id,
    );
    if (!changed) return;
    toolboxLibrary = next;
    void persistToolboxLibrary(next);
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
      riStart: 0,
      riShift: 0,
      riLocked: false,
      staticRi: {},
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
      const keepDeployedRootIdentity = shouldBeRoot && Boolean(node.data.fromNetwork);
      const nextLabel = shouldBeRoot && !keepDeployedRootIdentity ? tab.label : node.data.label;
      const nextFromNetwork = shouldBeRoot
        ? keepDeployedRootIdentity
          ? node.data.fromNetwork
          : false
        : node.data.fromNetwork;
      const nextTabRoot = shouldBeRoot;
      const nextNetworkId =
        shouldBeRoot && !keepDeployedRootIdentity ? undefined : node.data.networkId;
      const nextParticleId =
        shouldBeRoot && !keepDeployedRootIdentity ? undefined : node.data.particleId;
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

  const libraryKindForTab = (tab: typeof libraryTab): NetworkLibraryKind | null => {
    switch (tab) {
      case "connectors":
        return "feature";
      case "transformations":
        return "transformation";
      case "conditions":
        return "condition";
      default:
        return null;
    }
  };

  const libraryItems = $derived.by(() => {
    const kind = libraryKindForTab(libraryTab);
    if (!kind) return [];

    const source: LibraryItem[] = networkLibrary[kind] ?? [];

    if (explorerSource === "toolbox") {
      return listToolboxLibraryItemsForKind({
        kind,
        source,
        toolboxLibrary,
      });
    }

    if (explorerSource === "network") {
      const networkIds = new SvelteSet(networkFeedLibraryIds[kind] ?? []);
      return source.filter((item) => networkIds.has(item.id));
    }

    return source;
  });

  const savedToolboxIdsForLibraryTab = $derived.by(() => {
    const kind = libraryKindForTab(libraryTab);
    if (!kind) return new SvelteSet<string>();
    const source: LibraryItem[] = networkLibrary[kind] ?? [];
    if (explorerSource === "toolbox") {
      return new SvelteSet(
        listToolboxLibraryItemsForKind({
          kind,
          source,
          toolboxLibrary,
        }).map((item) => item.id),
      );
    }
    return new SvelteSet(
      source
        .filter((item) => isLibraryItemSavedInToolbox(toolboxLibrary, item))
        .map((item) => item.id),
    );
  });

  const listTitle = $derived.by(() => {
    switch (libraryTab) {
      case "connectors":
        return "Connectors";
      case "transformations":
        return "Transformations";
      case "conditions":
        return "Conditions";
      default:
        return "Library";
    }
  });

  const listTooltip = $derived.by(() => {
    switch (libraryTab) {
      case "connectors":
        return "A connector defines dimensions and the transformation chains on those dimensions; each dimension can connect to another connector as a composite input, and can expose bindings.";
      case "transformations":
        return "Transformations live on connector dimensions. Each dimension has its own ordered list of transformations that shape the values flowing through that dimension.";
      case "conditions":
        return "A connector only outputs values if its condition is met. Conditions can be financial (e.g., send funds to an address) or non-financial (artistic, contextual, etc.).";
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

  const getLibraryTransformationName = (item: LibraryItem) => {
    if (item.kind !== "transformation") return item.name;
    if (item.id.startsWith("draft-transform-")) return item.name;
    return getLibraryRegistryName(item);
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
          targetHandle: "condition",
        },
      ];
    }

    setConnectorDropTarget({ type: "condition", connectorId });
    syncConnectorRowPreview(connectorId, { schedule: false });
    scheduleLayout();
    return true;
  };

  const ensureLibraryConnectorDetailLoaded = async (connectorName: string): Promise<boolean> => {
    const name = connectorName.trim();
    if (!name) return false;

    const existingGraph = buildConnectorTreeGraph(name, { x: 0, y: 0 });
    const existingGraphComplete =
      existingGraph.nodes.length > 0 &&
      !existingGraph.nodes.some((node) => Boolean(node.data.placeholder));
    if (existingGraphComplete) return true;

    chainSyncError = null;
    chainSyncStatus = `Fetching ${name} from chain...`;
    let result: Awaited<ReturnType<typeof syncConnectorTreeFromChain>>;
    try {
      result = await withChainAuthRetry(() => syncConnectorTreeFromChain(name));
    } catch (error) {
      chainSyncStatus = null;
      chainSyncError =
        error instanceof Error
          ? `Could not load connector ${name} from chain: ${error.message}`
          : `Could not load connector ${name} from chain.`;
      return false;
    }
    const nextGraph = buildConnectorTreeGraph(name, { x: 0, y: 0 });
    const loaded =
      nextGraph.nodes.length > 0 && !nextGraph.nodes.some((node) => Boolean(node.data.placeholder));

    if (loaded) {
      chainSyncStatus =
        result.loaded.length > 1
          ? `Loaded ${name} and ${result.loaded.length - 1} composite connector(s).`
          : `Loaded ${name} from chain.`;
      return true;
    }

    const missing = result.missing.length ? ` Missing: ${result.missing.join(", ")}.` : "";
    chainSyncStatus = null;
    chainSyncError = `Connector ${name} was discovered in the feed but could not be loaded from chain.${missing}`;
    return false;
  };

  const addHydratedLibraryNode = (
    item: LibraryItem,
    position: { x: number; y: number } | null = null,
  ) => {
    if (activeTabReadOnly) return;
    if (item.kind === "transformation") {
      addTransformationToSelectedDimension(getLibraryTransformationName(item), "network");
      return;
    }
    if (item.kind === "condition" && connectorDropTarget?.type === "condition") {
      const attached = attachConditionToConnector(connectorDropTarget.connectorId, {
        label: getLibraryRegistryName(item),
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
      const graph = buildConnectorTreeGraph(registryName, nodePosition, {
        hideReadOnlyLeafOutlets: false,
        markRootAsTabRoot: false,
        idFactoryScope: `flow-${crypto.randomUUID()}`,
      });
      if (graph.nodes.length) {
        nodes = [...nodes, ...graph.nodes];
        edges = [...edges, ...graph.edges];
        scheduleLayout();
        return;
      }

      chainSyncError = `Connector ${registryName} is not loaded from chain yet.`;
      return;
    }
    const node: StudioNode = {
      id: `${item.kind}-${item.id}-${crypto.randomUUID()}`,
      position: nodePosition,
      type: item.kind === "condition" ? "condition" : undefined,
      data: {
        label: item.name,
        kind: item.kind,
        sourceId: item.id,
        viewId: item.viewId,
        networkId: registryName,
        fromNetwork: true,
      },
    };
    nodes = [...nodes, node];
    if (item.kind === "condition") {
      conditionCodeById.set(node.id, defaultConditionDraftCode);
    }
  };

  const addLibraryNode = async (
    item: LibraryItem,
    position: { x: number; y: number } | null = null,
  ) => {
    if (activeTabReadOnly) return;
    if (item.kind === "feature") {
      const loaded = await ensureLibraryConnectorDetailLoaded(getLibraryRegistryName(item));
      if (!loaded) return;
    }
    addHydratedLibraryNode(item, position);
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
    if (activeTabReadOnly) return;
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
      data: {
        label,
        kind: kind === "feature" ? "connector" : kind,
        dimensions: kind === "feature" || kind === "connector" ? 1 : undefined,
        connectorRows:
          kind === "feature" || kind === "connector"
            ? createPlaceholderConnectorRows(1)
            : undefined,
        fromNetwork: false,
        riStart: kind === "feature" || kind === "connector" ? 0 : undefined,
        riShift: kind === "feature" || kind === "connector" ? 0 : undefined,
        riLocked: kind === "feature" || kind === "connector" ? false : undefined,
        staticRi: kind === "feature" || kind === "connector" ? {} : undefined,
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

  const handlePluginDragStart = (event: DragEvent, plugin: StudioPluginDescriptor) => {
    writeStudioPluginDragData(event.dataTransfer, plugin);
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
    event.stopPropagation();
    const dropTarget = resolveConnectorDropTargetFromEvent(event);
    const plugin = readStudioPluginDropData(event.dataTransfer);
    if (plugin) {
      const position = screenToFlowPosition
        ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX, y: event.clientY };
      addStudioPluginToFlow(plugin, { position });
      return;
    }
    const quickPayload = event.dataTransfer?.getData("application/x-hypermusic-quick");
    if (quickPayload) {
      try {
        const payload = JSON.parse(quickPayload) as {
          kind: QuickNodeKind;
          label: string;
        };
        if (activeTabReadOnly) return;
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
        if (activeTabReadOnly) return;
        if (item.kind === "transformation") {
          if (dropTarget?.type === "dimension") {
            const targetDimension = getDimensionNodeForConnectorIndex(
              dropTarget.connectorId,
              dropTarget.dimensionIndex,
            );
            if (targetDimension && !targetDimension.data.fromNetwork) {
              addTransformationToDimension(
                targetDimension.id,
                getLibraryTransformationName(item),
                [],
                "network",
              );
              setConnectorDropTarget(dropTarget);
            }
          }
          return;
        }
        if (item.kind === "condition" && dropTarget?.type === "condition") {
          attachConditionToConnector(dropTarget.connectorId, {
            label: getLibraryRegistryName(item),
            status: "network",
            networkId: getLibraryRegistryName(item),
            sourceId: item.id,
          });
          return;
        }
        const position = screenToFlowPosition
          ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
          : { x: event.clientX, y: event.clientY };
        void addLibraryNode(item, position);
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
      const copyTypes = ["application/x-hypermusic-quick", "application/x-hypermusic-plugin"];
      event.dataTransfer.dropEffect = types.some((type) => copyTypes.includes(type))
        ? "copy"
        : "move";
    }
  };

  $effect(() => {
    const el = canvasEl;
    if (!el) return;

    return bindStudioCanvasDragDrop(el, {
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    });
  });

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

  const canDeleteNodeByPolicy = (node: StudioNode): boolean => {
    if (node.data.kind === "plugin") return true;
    if (activeTabReadOnly) return false;
    return !(isConnectorKind(node.data.kind) && Boolean(node.data.tabRoot));
  };

  const canDeleteEdgeByPolicy = (edge: Edge): boolean => {
    const sourceNode = edge.source ? nodesById[edge.source] : null;
    const targetNode = edge.target ? nodesById[edge.target] : null;
    if (sourceNode?.data.kind === "plugin" || targetNode?.data.kind === "plugin") return true;
    if (activeTabReadOnly) return false;
    return true;
  };

  const removeEdgeById = (edgeId: string): boolean => {
    const edge = edges.find((item) => item.id === edgeId) ?? null;
    if (!edge || !canDeleteEdgeByPolicy(edge)) return false;

    edges = edges.filter((item) => item.id !== edgeId);
    if (selectedEdgeId === edgeId) selectedEdgeId = null;
    selectedEdgeIds = selectedEdgeIds.filter((id) => id !== edgeId);

    const sourceNode = edge.source ? nodesById[edge.source] : null;
    if (sourceNode && isConnectorKind(sourceNode.data.kind)) {
      syncConnectorRowPreview(sourceNode.id, { schedule: false });
      scheduleLayout();
    }
    return true;
  };

  const removeNodeById = (nodeId: string): boolean => {
    const node = nodesById[nodeId];
    if (!node || !canDeleteNodeByPolicy(node)) return false;

    const removeIds = new SvelteSet<string>([nodeId]);
    if (isConnectorKind(node.data.kind)) {
      nodes
        .filter((candidate) => candidate.data.kind === "dimension")
        .forEach((dimensionNode) => {
          if (dimensionNode.data.parentFeatureId === nodeId) {
            removeIds.add(dimensionNode.id);
          }
        });
    }

    const edgesToRemove = edges.filter(
      (edge) => removeIds.has(edge.source) || removeIds.has(edge.target),
    );
    const connectorSourcesToRefresh = new SvelteSet<string>();
    edgesToRemove.forEach((edge) => {
      const sourceNode = edge.source ? nodesById[edge.source] : null;
      if (sourceNode && isConnectorKind(sourceNode.data.kind) && !removeIds.has(sourceNode.id)) {
        connectorSourcesToRefresh.add(sourceNode.id);
      }
    });

    nodes = nodes.filter((item) => !removeIds.has(item.id));
    edges = edges.filter((edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target));
    const removedEdgeIds = new SvelteSet(edgesToRemove.map((edge) => edge.id));

    connectorSourcesToRefresh.forEach((sourceId) => {
      syncConnectorRowPreview(sourceId, { schedule: false });
    });
    scheduleLayout();

    if (selectedNodeId && removeIds.has(selectedNodeId)) selectedNodeId = null;
    selectedNodeIds = selectedNodeIds.filter((id) => !removeIds.has(id));
    if (selectedEdgeId && edgesToRemove.some((edge) => edge.id === selectedEdgeId)) {
      selectedEdgeId = null;
    }
    selectedEdgeIds = selectedEdgeIds.filter((id) => !removedEdgeIds.has(id));
    return true;
  };

  const removeSelectedGraphEntity = (): boolean => {
    const selectedNodeIdsForRemoval = nodes.filter((node) => node.selected).map((node) => node.id);
    const selectedEdgeIdsForRemoval = edges.filter((edge) => edge.selected).map((edge) => edge.id);

    let removed = false;
    const nodeIdsToRemove =
      selectedNodeIdsForRemoval.length > 0
        ? selectedNodeIdsForRemoval
        : selectedNodeId
          ? [selectedNodeId]
          : [];
    nodeIdsToRemove.forEach((nodeId) => {
      removed = removeNodeById(nodeId) || removed;
    });

    const edgeIdsToRemove =
      selectedEdgeIdsForRemoval.length > 0
        ? selectedEdgeIdsForRemoval
        : selectedEdgeId
          ? [selectedEdgeId]
          : [];
    edgeIdsToRemove.forEach((edgeId) => {
      removed = removeEdgeById(edgeId) || removed;
    });

    return removed;
  };

  const handleSelectionChange: OnSelectionChange<StudioNode, Edge> = ({
    nodes: selectedNodes,
    edges: selectedEdges,
  }) => {
    selectedNodeIds = selectedNodes.map((node) => node.id);
    selectedEdgeIds = selectedEdges.map((edge) => edge.id);
    selectedNodeId = selectedNodes.find((node) => !node.hidden)?.id ?? selectedNodes[0]?.id ?? null;
    selectedEdgeId = selectedNodes.length > 0 ? null : (selectedEdges[0]?.id ?? null);
  };

  const clearGraphSelection = () => {
    clearFlowSelection?.();
    let changed = false;
    const nextNodes = nodes.map((node) => {
      if (!node.selected) return node;
      changed = true;
      return { ...node, selected: false };
    });
    const nextEdges = edges.map((edge) => {
      if (!edge.selected) return edge;
      changed = true;
      return { ...edge, selected: false };
    });

    if (changed) {
      nodes = nextNodes;
      edges = nextEdges;
    }
    selectedNodeIds = [];
    selectedEdgeIds = [];
    selectedNodeId = null;
    selectedEdgeId = null;
  };

  const syncDraggedNodePositions = (draggedNodes: StudioNode[]): boolean => {
    if (draggedNodes.length === 0) return false;
    const draggedById = new SvelteMap(draggedNodes.map((node) => [node.id, node] as const));
    let changed = false;

    const nextNodes = nodes.map((node) => {
      const draggedNode = draggedById.get(node.id);
      if (!draggedNode) return node;
      if (
        Math.abs(node.position.x - draggedNode.position.x) <= 0.5 &&
        Math.abs(node.position.y - draggedNode.position.y) <= 0.5
      ) {
        return node;
      }
      changed = true;
      return {
        ...node,
        position: { ...draggedNode.position },
      };
    });

    if (!changed) return false;
    nodes = nextNodes;
    return true;
  };

  const persistDraggedNodePositions = (draggedNodes: StudioNode[]) => {
    if (draggedNodes.length === 0) return;
    cancelLayoutFrames();
    syncDraggedNodePositions(draggedNodes);
    saveActiveGraph();
    schedulePersistStudioTabsSession();
  };

  const handleNodeDragStart = ({ nodes: draggedNodes }: { nodes: StudioNode[] }) => {
    if (draggedNodes.length === 0) return;
    beginManualGraphDrag();
  };

  const handleNodeDrag = ({ nodes: draggedNodes }: { nodes: StudioNode[] }) => {
    beginManualGraphDrag();
    syncDraggedNodePositions(draggedNodes);
  };

  const handleNodeDragStop = ({ nodes: draggedNodes }: { nodes: StudioNode[] }) => {
    persistDraggedNodePositions(draggedNodes);
    endManualGraphDrag();
  };

  const handleSelectionDrag = (_event: MouseEvent, draggedNodes: StudioNode[]) => {
    beginManualGraphDrag();
    syncDraggedNodePositions(draggedNodes);
  };

  const handleSelectionDragStop = (_event: MouseEvent, draggedNodes: StudioNode[]) => {
    persistDraggedNodePositions(draggedNodes);
    endManualGraphDrag();
  };

  const handlePaneClick = () => {
    window.setTimeout(clearGraphSelection, 0);
  };

  const handleFlowAreaPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(".svelte-flow")) return;
    if (
      target.closest(
        ".svelte-flow__node, .svelte-flow__edge, .svelte-flow__edge-label, .svelte-flow__selection-wrapper, .svelte-flow__handle",
      )
    ) {
      return;
    }
    clearGraphSelection();
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
      const rootSelected = toDelete.some((node) => node.id === rootConnectorId);
      const allowedEdges = rootSelected
        ? toDeleteEdges.filter(
            (edge) => !blockedNodeIds.has(edge.source) && !blockedNodeIds.has(edge.target),
          )
        : toDeleteEdges;
      if (!allowedNodes.length && !allowedEdges.length) return false;
      return { nodes: allowedNodes, edges: allowedEdges };
    }
    const pluginNodeIds = new SvelteSet(
      toDelete.filter((node) => node.data.kind === "plugin").map((node) => node.id),
    );
    const pluginEdges = toDeleteEdges.filter((edge) => {
      const sourceIsPlugin =
        pluginNodeIds.has(edge.source) || nodesById[edge.source]?.data.kind === "plugin";
      const targetIsPlugin =
        pluginNodeIds.has(edge.target) || nodesById[edge.target]?.data.kind === "plugin";
      return sourceIsPlugin || targetIsPlugin;
    });
    const pluginNodes = toDelete.filter((node) => node.data.kind === "plugin");
    if (!pluginNodes.length && !pluginEdges.length) return false;
    return { nodes: pluginNodes, edges: pluginEdges };
  };

  const parseDimensionHandle = (handle?: string | null) => {
    if (!handle) return null;
    if (!handle.startsWith("dim-")) return null;
    const value = Number(handle.replace("dim-", ""));
    return Number.isFinite(value) ? value : null;
  };

  $effect(() => {
    let changed = false;
    const normalizedEdges = edges.map((edge) => {
      const currentLabel = typeof edge.label === "string" ? edge.label.trim() : "";
      if (currentLabel.length > 0) return edge;

      const sourceNode = edge.source ? nodesById[edge.source] : null;
      const targetNode = edge.target ? nodesById[edge.target] : null;
      if (
        !sourceNode ||
        !targetNode ||
        !isConnectorKind(sourceNode.data.kind) ||
        !isConnectorKind(targetNode.data.kind)
      ) {
        return edge;
      }

      const relation = parseConnectorEdgeRelation(edge);
      if (relation === "unknown") return edge;

      const nextLabel =
        relation === "composite"
          ? (() => {
              const dim = parseDimensionHandle(edge.sourceHandle);
              return dim === null ? "composite" : `composite · D${dim + 1}`;
            })()
          : (() => {
              const slot = parseConnectorEdgeBindingSlot(edge);
              return slot === null ? "binding" : `binding · slot ${slot}`;
            })();

      changed = true;
      return {
        ...edge,
        label: nextLabel,
      };
    });

    if (changed) {
      edges = normalizedEdges;
    }
  });

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

    if (sourceNode.data.kind === "plugin" && isConnectorKind(targetNode.data.kind)) {
      if (!targetNode.data.tabRoot) return false;
      return connection.sourceHandle === "out" && connection.targetHandle === "plugin-in";
    }

    return false;
  };

  const handleConnect: OnConnect = (connection) => {
    if (!isValidConnection(connection)) return;
    if (!connection.source || !connection.target) return;
    const sourceNode = nodesById[connection.source];
    const targetNode = nodesById[connection.target];
    const isPluginConnection = Boolean(
      sourceNode &&
      targetNode &&
      sourceNode.data.kind === "plugin" &&
      isConnectorKind(targetNode.data.kind),
    );
    if (activeTabReadOnly && !isPluginConnection) return;
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
            childOpenSlots = computeOpenSlotsForBindingTarget(childConnectorName);
          } catch {
            chainDeployError = `Cannot create binding: failed to resolve open slots for '${childConnectorName}'.`;
            return;
          }

          if (childOpenSlots <= 0) {
            chainDeployError = `Cannot create binding: connector '${childConnectorName}' exposes no open slots.`;
            return;
          }
          const usedSlots = new SvelteSet<number>();
          sameDimensionEdges
            .filter((edge) => parseEdgeRelation(edge) === "binding")
            .forEach((edge) => {
              const slot = parseEdgeBindingSlot(edge);
              if (slot !== null) usedSlots.add(slot);
            });

          let slot: number | null = null;
          for (let candidate = 0; candidate < childOpenSlots; candidate += 1) {
            if (!usedSlots.has(candidate)) {
              slot = candidate;
              break;
            }
          }

          if (slot === null) {
            chainDeployError = `Cannot create binding: no free binding slots left for '${childConnectorName}'.`;
            return;
          }

          nextEdge.label = `binding · slot ${slot}`;
          nextEdge.data = {
            relation: "binding",
            bindingSlot: slot,
            bindingOwnerName: resolveNodeName(sourceNode),
          };
          nextEdge.style = "stroke:#c97500;stroke-dasharray:8 5;";
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

    if (sourceNode?.data.kind === "plugin" && targetNode && isConnectorKind(targetNode.data.kind)) {
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
    selectedEdgeId = null;
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

  const handleEdgeClick = ({ edge }: { edge: Edge; event: MouseEvent | TouchEvent }) => {
    selectedNodeId = null;
    selectedEdgeId = edge.id;
  };

  const buildChainConnectorRequestBodyPreview = () => {
    const compiled = compileDraftTransformations(nodes);
    const positionedNodes = applyComputedRiPositionsToGraphNodes(nodes, edges);
    const previewNodes = materializeLockedReferencedRiAsRootStatic(positionedNodes);
    return buildApiConnectorRequestBodyPreview({
      activeTab,
      nodes: previewNodes,
      edges,
      selectedConnectorNode: getSelectedConnectorNode(),
      deployedConnectors: deployedRegistry.connectors,
      runtimeOverrides: buildRuntimeOverrides(compiled.registry, previewNodes),
    });
  };

  const buildChainDeployPlanPreview = () => {
    const compiled = compileDraftTransformations(nodes);
    const positionedNodes = applyComputedRiPositionsToGraphNodes(nodes, edges);
    const previewNodes = materializeLockedReferencedRiAsRootStatic(positionedNodes);
    return buildDeployPlanForGraph(previewNodes, edges, compiled.registry).preview;
  };

  const chainDeployPlanPreview = $derived.by(() => buildChainDeployPlanPreview());

  const chainApiDeployPreviewSummary = $derived.by(() => {
    const { summary, root_connector: rootConnector } = chainDeployPlanPreview;
    const parts = [
      `${summary.total_requests} request${summary.total_requests === 1 ? "" : "s"}`,
      `${summary.conditions} condition${summary.conditions === 1 ? "" : "s"}`,
      `${summary.transformations} transformation${summary.transformations === 1 ? "" : "s"}`,
      `${summary.connectors} connector${summary.connectors === 1 ? "" : "s"}`,
    ];
    const root = rootConnector ? ` Root: ${rootConnector}.` : "";
    return `${parts.join(" · ")}.${root}`;
  });

  const chainApiDeployPreviewErrors = $derived.by(() => chainDeployPlanPreview.errors);
  const chainApiDeployPreviewWarnings = $derived.by(() => chainDeployPlanPreview.warnings);

  const chainApiProtocolJson = $derived.by(() =>
    JSON.stringify(buildChainConnectorRequestBodyPreview(), null, 2),
  );

  const chainApiDeployJson = $derived.by(() => JSON.stringify(chainDeployPlanPreview, null, 2));

  const buildResolvedConnectorTreePreview = () =>
    buildApiResolvedConnectorTreePreview({
      nodes: materializeLockedReferencedRiAsRootStatic(
        applyComputedRiPositionsToGraphNodes(nodes, edges),
      ),
      edges,
      rootParticleId: activeTab?.particleId ?? null,
    });

  const chainApiResolvedJson = $derived.by(() =>
    JSON.stringify(buildResolvedConnectorTreePreview(), null, 2),
  );

  let apiEditorApplying = false;

  const applyApiPreviewJsonToStudio = (rawJson: string) => {
    if (!activeTab) throw new Error("No active tab.");
    const applied = buildApiGraphFromPreviewJson({
      rawJson,
      currentResolved: buildResolvedConnectorTreePreview(),
      deployedConnectors: deployedRegistry.connectors,
      networkParticles,
    });

    apiEditorApplying = true;
    try {
      applied.conditionCodeByNodeId.forEach((source, nodeId) => {
        conditionCodeById.set(nodeId, source);
      });
      applied.transformationCodeById.forEach((source, transformationId) => {
        transformationCodeById.set(transformationId, source);
      });
      nodes = applied.nodes;
      edges = applied.edges;
      selectedNodeId = null;
      tabs = tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              label: applied.rootConnectorLabel,
              particleId: undefined,
            }
          : tab,
      );
      tabGraphs.set(activeTabId, { nodes: applied.nodes, edges: applied.edges });
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
      role="group"
      aria-label="Connector tab strip"
      ondragover={handleTabDragOver}
      ondrop={handleTabDrop}
    >
      <div class="tab-scroll" role="tablist" aria-label="Connector tabs" tabindex="0">
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
                  {tab.particleId ? "Network (view-only)" : "in-progress"}
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
      </div>
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
            title="New Transformation — Transformations live on connector dimensions and specify how values are selected from the attached connector."
            className="icon-btn"
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openContextualTransformationEditor();
            }}
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
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openContextualConditionEditor();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16l-6 7v6l-4-2v-4z"></path>
            </svg>
          </Button>
        </div>
        <div class="top-action-divider" aria-hidden="true"></div>
        <div class="top-deploy-group">
          <Button
            variant="ghost"
            ariaLabel="Refresh network library"
            title={chainSyncError ??
              chainSyncStatus ??
              "Refresh network connectors, transformations and conditions from chain feed"}
            className="icon-btn"
            disabled={chainSyncBusy || chainDeployBusy || chainRunBusy}
            onclick={() => void syncStudioNetworkLibrary({ force: true })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66"></path>
              <path d="M20 4v6h-6"></path>
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
      resizable
      sizePx={leftPanelWidthPx}
      minSizePx={getLeftPanelBounds().min}
      maxSizePx={getLeftPanelBounds().max}
      contentScale={leftPanelScale}
      onResize={handleLeftPanelResize}
      onHide={() => hidePanel((mode) => (leftMode = mode))}
    >
      <div class="left-panel">
        <div class="source-tabs">
          <button
            type="button"
            class={`source-tab ${explorerSource === "network" ? "is-active" : ""}`}
            onclick={() => {
              explorerSource = "network";
              void ensureStudioNetworkLibraryLoaded();
            }}
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
            class={`source-tab ${explorerSource === "plugins" ? "is-active" : ""}`}
            onclick={() => (explorerSource = "plugins")}
          >
            Worlds
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
        {#if explorerSource === "toolbox" && toolboxLoadError}
          <div
            class="chain-status-strip chain-status-strip--sidebar"
            role="status"
            aria-live="polite"
          >
            <div class="chain-status-chip is-error">
              <span>Toolbox error</span>
              <strong>{toolboxLoadError}</strong>
            </div>
          </div>
        {/if}
        {#if explorerSource === "network" || explorerSource === "toolbox"}
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
          {#if libraryTab === "connectors"}
            <StudioLibraryList
              title="Connectors"
              items={libraryItems}
              toolboxIds={savedToolboxIdsForLibraryTab}
              loading={(explorerSource === "network" && chainSyncBusy) ||
                (explorerSource === "toolbox" && toolboxLoadBusy)}
              usersById={studioUsersById}
              onAdd={(item) => void addLibraryNode(item, null)}
              onToolbox={toggleLibraryToolbox}
              onOpen={(item) => void openConnectorTab(getLibraryRegistryName(item))}
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
                onclick={openContextualTransformationEditor}
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
              toolboxIds={savedToolboxIdsForLibraryTab}
              loading={(explorerSource === "network" && chainSyncBusy) ||
                (explorerSource === "toolbox" && toolboxLoadBusy)}
              usersById={studioUsersById}
              onAdd={(item) => void addLibraryNode(item, null)}
              onToolbox={toggleLibraryToolbox}
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
                onclick={openContextualConditionEditor}
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
              toolboxIds={savedToolboxIdsForLibraryTab}
              loading={(explorerSource === "network" && chainSyncBusy) ||
                (explorerSource === "toolbox" && toolboxLoadBusy)}
              usersById={studioUsersById}
              onAdd={(item) => void addLibraryNode(item, null)}
              onToolbox={toggleLibraryToolbox}
              onDragStart={handleLibraryDragStart}
              draggable
              showHeader={false}
            />
          {/if}
        {:else if explorerSource === "plugins"}
          <div class="plugins-panel">
            <div class="plugins-panel-header">
              <div class="list-title">Worlds</div>
              <div class="plugins-root">
                Root: {activePluginSourceRootConnectorName || "Not selected"}
              </div>
            </div>
            <div class="plugins-meta">
              Format hash:
              {#if activePluginSourceFormatHash}
                <a
                  class="plugins-format-link"
                  href={resolve("/f/[slug]", { slug: activePluginSourceFormatHash })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {activePluginSourceFormatHash}
                </a>
              {:else}
                Unavailable
              {/if}
            </div>
            {#if pluginAttachStatus}
              <p class="plugins-feedback">{pluginAttachStatus}</p>
            {/if}
            {#if pluginAttachError}
              <p class="plugins-feedback is-error">{pluginAttachError}</p>
            {/if}
            {#if pluginSourceInfoMessage}
              <p class="plugins-empty">{pluginSourceInfoMessage}</p>
            {/if}
            {#if allStudioPlugins.length > 0}
              <div class="plugins-list">
                {#each allStudioPlugins as plugin (plugin.id)}
                  <article
                    class="plugin-card"
                    draggable
                    data-disabled={false}
                    ondragstart={(event) => handlePluginDragStart(event, plugin)}
                  >
                    <header class="plugin-card-header">
                      <h4>{plugin.name}</h4>
                    </header>
                    <p>{plugin.summary}</p>
                    <footer class="plugin-card-footer">
                      <span>{plugin.id}</span>
                      <Button
                        variant="ghost"
                        type="button"
                        onclick={() => addStudioPluginToFlow(plugin)}
                      >
                        +
                      </Button>
                    </footer>
                  </article>
                {/each}
              </div>
            {/if}
          </div>
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
    <div class="flow-area" role="presentation" onpointerdowncapture={handleFlowAreaPointerDown}>
      <SvelteFlow
        bind:nodes
        bind:edges
        bind:viewport={flowViewport}
        {nodeTypes}
        onconnect={handleConnect}
        onselectionchange={handleSelectionChange}
        onbeforedelete={handleBeforeDelete}
        onnodedragstart={handleNodeDragStart}
        onnodedrag={handleNodeDrag}
        onnodedragstop={handleNodeDragStop}
        onselectiondrag={handleSelectionDrag}
        onselectiondragstop={handleSelectionDragStop}
        {isValidConnection}
        onnodeclick={handleNodeClick}
        onedgeclick={handleEdgeClick}
        onpaneclick={handlePaneClick}
        fitView
        minZoom={STUDIO_FLOW_MIN_ZOOM}
        nodesDraggable
        nodesConnectable
        deleteKey={activeTabReadOnly ? null : ["Backspace", "Delete"]}
        selectionKey={["Meta", "Control"]}
        multiSelectionKey={["Meta", "Control"]}
        selectionMode={SelectionMode.Partial}
        zoomOnScroll
        zoomOnDoubleClick={false}
        zoomOnPinch
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background bgColor="var(--studio-flow-bg)" patternColor="var(--studio-flow-pattern)" />
        <FlowInstanceBridge
          onReady={({
            screenToFlowPosition: toFlow,
            getZoom: zoomFn,
            setCenter: setCenterFn,
            fitView: fitViewFn,
            clearSelection,
          }) => {
            screenToFlowPosition = toFlow;
            getZoom = zoomFn;
            setCenter = setCenterFn;
            fitView = fitViewFn;
            clearFlowSelection = clearSelection;
          }}
        />
      </SvelteFlow>
    </div>
  </div>

  {#if rightMode === "assistant"}
    <DockPanel
      title="Assistant"
      position="right"
      resizable
      sizePx={rightPanelWidthPx}
      minSizePx={getRightPanelBounds().min}
      maxSizePx={getRightPanelBounds().max}
      contentScale={rightPanelScale}
      onResize={handleRightPanelResize}
      onHide={hideRightPanel}
    >
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
          <button
            type="button"
            class={`right-panel-icon ${runnerVisible ? "is-active" : ""}`}
            aria-label="Toggle run panel"
            onclick={toggleRunner}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5l12 7-12 7z"></path>
            </svg>
          </button>
        </div>
        <div class="assistant-panel">
          <div class="assistant-panel-tabs" role="tablist" aria-label="Assistant views">
            <button
              type="button"
              role="tab"
              aria-selected={assistantPanelTab === "conversations"}
              class={`assistant-panel-tab ${assistantPanelTab === "conversations" ? "is-active" : ""}`}
              onclick={() => {
                assistantPanelTab = "conversations";
              }}
            >
              Conversations
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={assistantPanelTab === "settings"}
              class={`assistant-panel-tab ${assistantPanelTab === "settings" ? "is-active" : ""}`}
              onclick={() => {
                assistantPanelTab = "settings";
              }}
            >
              Settings
            </button>
          </div>

          {#if assistantPanelTab === "settings"}
            <div class="assistant-settings">
              <div class="assistant-settings-title">Model settings</div>
              <label class="assistant-toggle">
                <input
                  type="checkbox"
                  checked={assistantEnabled}
                  onchange={(event) => {
                    const target = event.target as HTMLInputElement | null;
                    assistantEnabled = Boolean(target?.checked);
                    persistAssistantSettingsToStorage();
                  }}
                />
                <span>Assistant enabled</span>
              </label>
              <label class="assistant-settings-label" for="assistant-api-key">API key</label>
              <input
                id="assistant-api-key"
                class="assistant-input"
                type="password"
                placeholder="sk-..."
                autocomplete="off"
                value={assistantApiKeyDraft}
                oninput={(event) => {
                  const target = event.target as HTMLInputElement | null;
                  assistantApiKeyDraft = target?.value ?? "";
                }}
              />
              <div class="assistant-settings-actions">
                <button type="button" onclick={saveAssistantApiKey}>Save key</button>
                <button type="button" onclick={clearAssistantApiKey}>Clear</button>
              </div>
              <label class="assistant-settings-label" for="assistant-endpoint">Endpoint</label>
              <input
                id="assistant-endpoint"
                class="assistant-input"
                type="text"
                value={assistantEndpoint}
                oninput={(event) => {
                  const target = event.target as HTMLInputElement | null;
                  assistantEndpoint = target?.value ?? "";
                }}
                onblur={saveAssistantModelSettings}
              />
              <label class="assistant-settings-label" for="assistant-model">Model</label>
              <input
                id="assistant-model"
                class="assistant-input"
                type="text"
                value={assistantModel}
                oninput={(event) => {
                  const target = event.target as HTMLInputElement | null;
                  assistantModel = target?.value ?? "";
                }}
                onblur={saveAssistantModelSettings}
              />
              <label class="assistant-settings-label" for="assistant-temperature">Temperature</label
              >
              <input
                id="assistant-temperature"
                class="assistant-input"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={assistantTemperature}
                oninput={(event) => {
                  const target = event.target as HTMLInputElement | null;
                  const next = Number(target?.value ?? assistantTemperature);
                  assistantTemperature = Number.isFinite(next)
                    ? Math.min(2, Math.max(0, next))
                    : assistantTemperature;
                }}
                onblur={saveAssistantModelSettings}
              />
              {#if assistantSettingsStatus}
                <div class="assistant-status assistant-status--success">
                  {assistantSettingsStatus}
                </div>
              {/if}
              {#if assistantSettingsError}
                <div class="assistant-status assistant-status--error">{assistantSettingsError}</div>
              {/if}
              {#if !assistantKeyConfigured}
                <div class="assistant-status assistant-status--warn">
                  API key is required before sending prompts.
                </div>
              {/if}
            </div>
          {:else}
            {#if assistantConversationView === "chat"}
              <div class="assistant-conversation-toolbar">
                <button
                  type="button"
                  class="assistant-mini-btn"
                  onclick={openAssistantConversationList}
                >
                  Back to conversations
                </button>
                <button
                  type="button"
                  class="assistant-mini-btn assistant-mini-btn--danger"
                  disabled={assistantBusy || !assistantActiveConversation}
                  onclick={clearActiveAssistantConversation}
                >
                  Erase
                </button>
              </div>
            {:else}
              <div class="assistant-conversation-toolbar">
                <div class="assistant-settings-title">Conversations</div>
                <button
                  type="button"
                  class="assistant-icon-btn"
                  aria-label="Start new conversation"
                  disabled={assistantBusy}
                  onclick={startNewAssistantConversation}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 7v10"></path>
                    <path d="M7 12h10"></path>
                  </svg>
                </button>
              </div>
              <div class="assistant-conversation-list">
                {#if assistantConversations.length === 0}
                  <div class="assistant-status assistant-status--warn">No conversations yet.</div>
                {:else}
                  {#each assistantConversations as conversation (conversation.id)}
                    <div
                      class={`assistant-conversation-item ${conversation.id === assistantActiveConversationId ? "is-active" : ""}`}
                    >
                      <button
                        type="button"
                        class="assistant-conversation-open"
                        onclick={() => loadAssistantConversation(conversation.id)}
                      >
                        <span class="assistant-conversation-title">{conversation.title}</span>
                        <span class="assistant-conversation-meta">
                          {new Date(conversation.updatedAt).toLocaleString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        class="assistant-icon-btn assistant-icon-btn--danger"
                        aria-label={`Delete conversation ${conversation.title}`}
                        disabled={assistantBusy}
                        onclick={() => deleteAssistantConversation(conversation.id)}
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                {/if}
              </div>
            {/if}

            {#if assistantConversationView === "chat"}
              {#if assistantPendingConfirmation}
                <div class="assistant-confirm">
                  <div class="assistant-confirm-title">Confirmation required</div>
                  <pre>{assistantPendingConfirmation.summary}</pre>
                  <div class="assistant-confirm-actions">
                    <button
                      type="button"
                      class="assistant-confirm-accept"
                      disabled={assistantBusy}
                      onclick={confirmAssistantPendingActions}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      class="assistant-confirm-cancel"
                      disabled={assistantBusy}
                      onclick={cancelAssistantPendingActions}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              {/if}
              {#if assistantLastError}
                <div class="assistant-status assistant-status--error">{assistantLastError}</div>
              {/if}
              <div class="assistant-thread">
                {#each assistantThreadMessages as message (message.id)}
                  <div class={`assistant-message assistant-message--${message.role}`}>
                    <div class="assistant-message-meta">
                      <span>{message.role}</span>
                      <span>{new Date(message.at).toLocaleTimeString()}</span>
                    </div>
                    <pre>{message.text}</pre>
                  </div>
                {/each}
              </div>
              <div class="assistant-composer">
                <textarea
                  class="assistant-composer-input"
                  rows="3"
                  placeholder="Ask assistant to edit flow or explain app actions..."
                  value={assistantPromptDraft}
                  disabled={!assistantEnabled || assistantBusy || !assistantKeyConfigured}
                  oninput={(event) => {
                    const target = event.target as HTMLTextAreaElement | null;
                    assistantPromptDraft = target?.value ?? "";
                  }}
                  onkeydown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    void sendAssistantPrompt();
                  }}
                ></textarea>
                <div class="assistant-composer-actions">
                  <button
                    type="button"
                    class="assistant-send"
                    disabled={!assistantCanSend}
                    onclick={() => void sendAssistantPrompt()}
                  >
                    {assistantBusy ? "Working..." : "Send"}
                  </button>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </DockPanel>
  {/if}

  {#if rightMode === "runner"}
    <DockPanel
      title="Run + Deploy"
      position="right"
      resizable
      sizePx={rightPanelWidthPx}
      minSizePx={getRightPanelBounds().min}
      maxSizePx={getRightPanelBounds().max}
      contentScale={rightPanelScale}
      onResize={handleRightPanelResize}
      onHide={hideRightPanel}
    >
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
          <button
            type="button"
            class={`right-panel-icon ${runnerVisible ? "is-active" : ""}`}
            aria-label="Toggle run panel"
            onclick={toggleRunner}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5l12 7-12 7z"></path>
            </svg>
          </button>
        </div>
        <div class="runner-panel">
          <div class="runner-controls">
            <label class="run-label" for="run-samples-panel">N</label>
            <input
              id="run-samples-panel"
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
            <button
              type="button"
              class="runner-action"
              disabled={chainRunBusy || chainDeployBusy}
              onclick={executeActiveGraph}
            >
              {chainRunBusy ? "Running..." : "Run"}
            </button>
            <button
              type="button"
              class="runner-action"
              disabled={chainDeployBusy || chainSyncBusy || chainRunBusy || activeTabReadOnly}
              onclick={deployActiveGraph}
            >
              {chainDeployBusy ? "Deploying..." : "Deploy"}
            </button>
          </div>
          {#if chainDeployStatus}
            <div class="runner-status is-success">{chainDeployStatus}</div>
          {/if}
          {#if chainDeployError}
            <div class="runner-status is-error">{chainDeployError}</div>
          {/if}
          <div class="inspector-section">
            <div class="inspector-section-title">Network run output</div>
            {#if activeChainRunTimestamp}
              <div class="inspector-row">
                <span>Last run</span>
                <span>{new Date(activeChainRunTimestamp).toLocaleTimeString()}</span>
              </div>
            {/if}
            <pre class="runner-output">{activeChainRunMessage || "No run result yet."}</pre>
          </div>
        </div>
      </div>
    </DockPanel>
  {/if}

  {#if rightMode === "inspector"}
    <DockPanel
      title="Inspector"
      position="right"
      resizable
      sizePx={rightPanelWidthPx}
      minSizePx={getRightPanelBounds().min}
      maxSizePx={getRightPanelBounds().max}
      contentScale={rightPanelScale}
      onResize={handleRightPanelResize}
      onHide={hideRightPanel}
    >
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
          <button
            type="button"
            class={`right-panel-icon ${runnerVisible ? "is-active" : ""}`}
            aria-label="Toggle run panel"
            onclick={toggleRunner}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5l12 7-12 7z"></path>
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
                {@const canDeleteSelectedNode = canDeleteNodeByPolicy(selectedNode)}
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
                <button
                  type="button"
                  class="inspector-action inspector-action--danger"
                  disabled={!canDeleteSelectedNode}
                  onclick={() => {
                    removeNodeById(selectedNode.id);
                  }}
                >
                  Remove selected {selectedNode.data.kind === "connector" ? "connector" : "node"}
                </button>
                {#if !canDeleteSelectedNode && isConnectorKind(selectedNode.data.kind) && selectedNode.data.tabRoot}
                  <div class="inspector-hint">Root connector of this tab cannot be removed.</div>
                {/if}
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
                  {@const connectorRiLocked = selectedNode.data.riLocked ?? false}
                  {@const connectorRiMutability = getConnectorRiMutability(selectedNode)}
                  {@const connectorRiToggleDisabled = isConnectorRiLockToggleDisabled(selectedNode)}
                  <div class="inspector-section">
                    <div class="inspector-section-title">Running instance</div>
                    <div class="inspector-inline">
                      <label class="inspector-inline-label" for="connector-ri-start">Start</label>
                      <input
                        id="connector-ri-start"
                        class="inspector-input inspector-input--compact inspector-input--inline"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        step="1"
                        value={selectedNode.data.riStart ?? 0}
                        disabled={connectorRiLocked}
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
                          applyConnectorRiPatch(selectedNode.id, {
                            riStart: toInt(target?.value ?? "0"),
                          });
                        }}
                      />
                      <label class="inspector-inline-label" for="connector-ri-shift">Shift</label>
                      <input
                        id="connector-ri-shift"
                        class="inspector-input inspector-input--compact inspector-input--inline"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        step="1"
                        value={selectedNode.data.riShift ?? 0}
                        disabled={connectorRiLocked}
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
                          applyConnectorRiPatch(selectedNode.id, {
                            riShift: toInt(target?.value ?? "0"),
                          });
                        }}
                      />
                      <button
                        type="button"
                        class={`inspector-toggle ${connectorRiLocked ? "is-locked" : ""}`}
                        disabled={connectorRiToggleDisabled}
                        onclick={() =>
                          applyConnectorRiPatch(selectedNode.id, { riLocked: !connectorRiLocked })}
                      >
                        {connectorRiLocked ? "static" : "open"}
                      </button>
                    </div>
                    <div class="inspector-hint">
                      RI mode: <code>{connectorRiMutability.state}</code> · lock toggle
                      {connectorRiMutability.lockToggleDisabled ? " disabled" : " enabled"}.
                    </div>
                  </div>
                  <div class="inspector-section">
                    <div class="inspector-section-title">Connector dimensions</div>
                    {#if getSortedConnectorDimensions(selectedNode.id).length === 0}
                      <div class="inspector-hint">No dimensions configured yet.</div>
                    {:else}
                      {#each getSortedConnectorDimensions(selectedNode.id) as dimensionNode, dimIndex (dimensionNode.id)}
                        <div class="inspector-row">
                          <span>#{dimIndex + 1}</span>
                          <span>{(dimensionNode.data.transformations ?? []).length} tx</span>
                        </div>
                        {#if (dimensionNode.data.transformations ?? []).length > 0}
                          <div class="inspector-transform-list inspector-transform-list--compact">
                            {#each dimensionNode.data.transformations ?? [] as transformation, transformationIndex (transformation.id)}
                              {@const canEditArgs = !isReadOnly}
                              <div
                                class={`inspector-transform-row ${canEditArgs ? "is-draggable" : ""} ${transformationRowDropClass(
                                  dimensionNode.id,
                                  transformationIndex,
                                )} ${transformationDragState ? "is-drag-active" : ""}`}
                                role="presentation"
                                draggable={canEditArgs}
                                ondragstart={(event) =>
                                  canEditArgs &&
                                  handleTransformationDragStart(
                                    event,
                                    dimensionNode.id,
                                    transformationIndex,
                                  )}
                                ondragend={endTransformationDrag}
                                ondragover={(event) =>
                                  canEditArgs &&
                                  handleTransformationRowDragOver(
                                    event,
                                    dimensionNode.id,
                                    transformationIndex,
                                  )}
                                ondrop={(event) =>
                                  canEditArgs &&
                                  handleTransformationRowDrop(
                                    event,
                                    dimensionNode.id,
                                    transformationIndex,
                                  )}
                              >
                                <div class="inspector-transform-main">
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
                                  {#if canEditArgs}
                                    <button
                                      type="button"
                                      class="inspector-remove"
                                      onclick={() =>
                                        removeTransformationFromDimension(
                                          dimensionNode.id,
                                          transformation.id,
                                        )}
                                    >
                                      Remove
                                    </button>
                                  {/if}
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
                  <div class="inspector-section">
                    <div class="inspector-section-title">Transformations</div>
                    <div class="inspector-transform-list">
                      {#if (selectedNode.data.transformations ?? []).length === 0}
                        <div class="inspector-hint">No transformations on this dimension.</div>
                      {:else}
                        {#each selectedNode.data.transformations ?? [] as transformation, transformationIndex (transformation.id)}
                          {@const canEditArgs = !isReadOnly}
                          <div
                            class={`inspector-transform-row ${canEditArgs ? "is-draggable" : ""} ${transformationRowDropClass(
                              selectedNode.id,
                              transformationIndex,
                            )} ${transformationDragState ? "is-drag-active" : ""}`}
                            role="presentation"
                            draggable={canEditArgs}
                            ondragstart={(event) =>
                              canEditArgs &&
                              handleTransformationDragStart(
                                event,
                                selectedNode.id,
                                transformationIndex,
                              )}
                            ondragend={endTransformationDrag}
                            ondragover={(event) =>
                              canEditArgs &&
                              handleTransformationRowDragOver(
                                event,
                                selectedNode.id,
                                transformationIndex,
                              )}
                            ondrop={(event) =>
                              canEditArgs &&
                              handleTransformationRowDrop(
                                event,
                                selectedNode.id,
                                transformationIndex,
                              )}
                          >
                            <div class="inspector-transform-main">
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
                              {#if canEditArgs}
                                <button
                                  type="button"
                                  class="inspector-remove"
                                  onclick={() =>
                                    removeTransformationFromDimension(
                                      selectedNode.id,
                                      transformation.id,
                                    )}
                                >
                                  Remove
                                </button>
                              {/if}
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
              {:else if selectedEdge}
                {@const sourceLabel =
                  nodesById[selectedEdge.source]?.data.label ?? selectedEdge.source}
                {@const targetLabel =
                  nodesById[selectedEdge.target]?.data.label ?? selectedEdge.target}
                {@const relation = parseConnectorEdgeRelation(selectedEdge)}
                {@const dimension = (() => {
                  const parsed = parseDimensionHandle(selectedEdge.sourceHandle);
                  return parsed === null ? null : parsed + 1;
                })()}
                {@const bindingSlot = parseConnectorEdgeBindingSlot(selectedEdge)}
                <div class="inspector-section">
                  <div class="inspector-section-title">Selected link</div>
                  <div class="inspector-row">
                    <span>From</span>
                    <span>{sourceLabel}</span>
                  </div>
                  <div class="inspector-row">
                    <span>To</span>
                    <span>{targetLabel}</span>
                  </div>
                  <div class="inspector-row">
                    <span>Relation</span>
                    <span>{relation}</span>
                  </div>
                  {#if dimension !== null}
                    <div class="inspector-row">
                      <span>Dimension</span>
                      <span>D{dimension}</span>
                    </div>
                  {/if}
                  {#if bindingSlot !== null}
                    <div class="inspector-row">
                      <span>Binding slot</span>
                      <span>{bindingSlot}</span>
                    </div>
                  {/if}
                  <button
                    type="button"
                    class="inspector-action inspector-action--danger"
                    disabled={!canDeleteEdgeByPolicy(selectedEdge)}
                    onclick={() => {
                      removeEdgeById(selectedEdge.id);
                    }}
                  >
                    Remove selected link
                  </button>
                </div>
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
                  <span>Connector</span>
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
                  class={`inspector-tab ${apiJsonView === "deploy" ? "is-active" : ""}`}
                  role="tab"
                  aria-selected={apiJsonView === "deploy"}
                  onclick={() => (apiJsonView = "deploy")}
                >
                  Deploy sequence
                </button>
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
              {#if apiJsonView === "deploy"}
                <div class="inspector-hint">
                  Ordered API calls generated from the current flow. Deploy executes this sequence.
                </div>
                <div class="inspector-inline-controls">
                  <button type="button" class="inspector-edit" onclick={copyDeploySequencePreview}>
                    Copy JSON
                  </button>
                  {#if deployPreviewCopyStatus}
                    <span class="inspector-hint">{deployPreviewCopyStatus}</span>
                  {/if}
                </div>
                <div class="inspector-hint">{chainApiDeployPreviewSummary}</div>
                {#if chainApiDeployPreviewErrors.length}
                  <div class="inspector-alert">
                    <div class="inspector-alert-text">
                      {chainApiDeployPreviewErrors.join("; ")}
                    </div>
                  </div>
                {/if}
                {#if chainApiDeployPreviewWarnings.length}
                  <div class="inspector-alert">
                    <div class="inspector-alert-text">
                      {chainApiDeployPreviewWarnings.join("; ")}
                    </div>
                  </div>
                {/if}
                <pre class="inspector-code-preview">{chainApiDeployJson}</pre>
              {:else if apiJsonView === "protocol"}
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
              <div class="inspector-section-title">Execute request preview</div>
              <div class="inspector-hint">
                Exact `POST /execute` body generated from the current flow and `N`.
              </div>
              <div class="inspector-inline-controls">
                <button type="button" class="inspector-edit" onclick={copyExecuteRequestPreview}>
                  Copy JSON
                </button>
                {#if executePreviewCopyStatus}
                  <span class="inspector-hint">{executePreviewCopyStatus}</span>
                {/if}
              </div>
              <pre class="inspector-code-preview">{chainApiExecuteJson}</pre>
              <div class="inspector-hint">{chainApiExecutePreviewSummary}</div>
              {#if chainApiExecutePreviewError}
                <div class="inspector-alert">
                  <div class="inspector-alert-text">{chainApiExecutePreviewError}</div>
                </div>
              {/if}
              {#if chainApiExecutePreviewWarnings.length}
                <div class="inspector-alert">
                  <div class="inspector-alert-text">
                    {chainApiExecutePreviewWarnings.join("; ")}
                  </div>
                </div>
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
      <button
        class="panel-tab"
        type="button"
        title="Run panel"
        aria-label="Run panel"
        onclick={toggleRunner}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5l12 7-12 7z"></path>
        </svg>
      </button>
    </div>
  {/if}

  {#if transformationEditorOpen}
    <div class="confirm-overlay" role="dialog" aria-modal="true">
      <div class="editor-modal">
        <div class="editor-header">
          <div class="editor-title">Publish transformation</div>
          <div class="editor-header-actions">
            <span class="editor-status">
              {transformationEditorStatus === "network" ? "Published" : "Unpublished"}
            </span>
            <button type="button" class="editor-fork" onclick={toggleTransformationAiAssistant}>
              AI assistant
            </button>
            <button type="button" class="editor-close" onclick={closeTransformationEditor}>
              Close
            </button>
          </div>
        </div>
        <div class="editor-hint">
          Deploy-oriented flow: this publishes directly to chain and adds the transformation to your
          toolbox.
        </div>
        {#if transformationEditorDimensionId}
          <div class="editor-hint">
            After publish, it will be attached to the selected dimension.
          </div>
        {/if}
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
          <div class="editor-name-tools">
            <button
              type="button"
              class="editor-fork"
              disabled={transformationEditorReadOnly || transformationEditorDeployBusy}
              onclick={generateTransformationTestName}
            >
              Generate test name
            </button>
            <span class="editor-name-note">
              Published names are permanent. Use generated test names for experiments.
            </span>
          </div>
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
        {#if transformationAiAssistantOpen}
          <div class="editor-ai-assistant">
            <div class="editor-ai-assistant-title">Transformation AI assistant</div>
            <div class="editor-ai-assistant-hint">
              Describe the behavior you want. The assistant edits this Solidity snippet directly.
            </div>
            <div class="editor-ai-assistant-thread">
              {#if transformationAiAssistantMessages.length === 0}
                <div class="editor-ai-assistant-empty">No AI messages yet.</div>
              {:else}
                {#each transformationAiAssistantMessages as message (message.id)}
                  <div
                    class={`editor-ai-assistant-message editor-ai-assistant-message--${message.role}`}
                  >
                    <div class="editor-ai-assistant-message-meta">
                      <span>{message.role}</span>
                      <span>{new Date(message.at).toLocaleTimeString()}</span>
                    </div>
                    <pre>{message.text}</pre>
                  </div>
                {/each}
              {/if}
            </div>
            {#if transformationAiAssistantError}
              <div class="editor-error">{transformationAiAssistantError}</div>
            {/if}
            <div class="editor-ai-assistant-composer">
              <textarea
                class="editor-ai-assistant-input"
                rows="3"
                placeholder="Example: Keep name, make this transformation clamp x between args[0] and args[1]."
                value={transformationAiAssistantPrompt}
                disabled={transformationAiAssistantBusy || transformationEditorReadOnly}
                oninput={(event) => {
                  const target = event.target as HTMLTextAreaElement | null;
                  transformationAiAssistantPrompt = target?.value ?? "";
                  transformationAiAssistantError = null;
                }}
                onkeydown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  void requestTransformationCodeEdit();
                }}
              ></textarea>
              <button
                type="button"
                class="editor-fork"
                disabled={transformationEditorReadOnly ||
                  transformationAiAssistantBusy ||
                  transformationAiAssistantPrompt.trim().length === 0}
                onclick={() => void requestTransformationCodeEdit()}
              >
                {transformationAiAssistantBusy ? "Applying..." : "Apply AI edit"}
              </button>
            </div>
          </div>
        {/if}
        <div class="editor-actions">
          <button type="button" onclick={closeTransformationEditor}>Cancel</button>
          <button
            type="button"
            class="primary"
            disabled={transformationEditorReadOnly || transformationEditorDeployBusy}
            onclick={saveTransformationEditor}
          >
            {transformationEditorDeployBusy ? "Publishing..." : "Publish to chain"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if conditionEditorOpen}
    <div class="confirm-overlay" role="dialog" aria-modal="true">
      <div class="editor-modal">
        <div class="editor-header">
          <div class="editor-title">Publish condition</div>
          <div class="editor-header-actions">
            <span class="editor-status"
              >{conditionEditorStatus === "network" ? "Published" : "Unpublished"}</span
            >
            <button type="button" class="editor-fork" onclick={toggleConditionAiAssistant}>
              AI assistant
            </button>
            <button type="button" class="editor-close" onclick={closeConditionEditor}>Close</button>
          </div>
        </div>
        <div class="editor-hint">
          Deploy-oriented flow: this publishes directly to chain and adds the condition to your
          toolbox.
        </div>
        {#if conditionEditorTargetConnectorId}
          {@const targetConnectorLabel =
            nodesById[conditionEditorTargetConnectorId]?.data.label ?? "selected connector"}
          <div class="editor-hint">
            After publish, it will be attached to <code>{targetConnectorLabel}</code>.
          </div>
        {/if}
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
          <div class="editor-name-tools">
            <button
              type="button"
              class="editor-fork"
              disabled={conditionEditorReadOnly || conditionEditorDeployBusy}
              onclick={generateConditionTestName}
            >
              Generate test name
            </button>
            <span class="editor-name-note">
              Published names are permanent. Use generated test names for experiments.
            </span>
          </div>
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
        {#if conditionAiAssistantOpen}
          <div class="editor-ai-assistant">
            <div class="editor-ai-assistant-title">Condition AI assistant</div>
            <div class="editor-ai-assistant-hint">
              Describe the rule you want. The assistant edits this Solidity snippet directly.
            </div>
            <div class="editor-ai-assistant-thread">
              {#if conditionAiAssistantMessages.length === 0}
                <div class="editor-ai-assistant-empty">No AI messages yet.</div>
              {:else}
                {#each conditionAiAssistantMessages as message (message.id)}
                  <div
                    class={`editor-ai-assistant-message editor-ai-assistant-message--${message.role}`}
                  >
                    <div class="editor-ai-assistant-message-meta">
                      <span>{message.role}</span>
                      <span>{new Date(message.at).toLocaleTimeString()}</span>
                    </div>
                    <pre>{message.text}</pre>
                  </div>
                {/each}
              {/if}
            </div>
            {#if conditionAiAssistantError}
              <div class="editor-error">{conditionAiAssistantError}</div>
            {/if}
            <div class="editor-ai-assistant-composer">
              <textarea
                class="editor-ai-assistant-input"
                rows="3"
                placeholder="Example: Return true only when args[0] is between 12 and 72."
                value={conditionAiAssistantPrompt}
                disabled={conditionAiAssistantBusy || conditionEditorReadOnly}
                oninput={(event) => {
                  const target = event.target as HTMLTextAreaElement | null;
                  conditionAiAssistantPrompt = target?.value ?? "";
                  conditionAiAssistantError = null;
                }}
                onkeydown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  void requestConditionCodeEdit();
                }}
              ></textarea>
              <button
                type="button"
                class="editor-fork"
                disabled={conditionEditorReadOnly ||
                  conditionAiAssistantBusy ||
                  conditionAiAssistantPrompt.trim().length === 0}
                onclick={() => void requestConditionCodeEdit()}
              >
                {conditionAiAssistantBusy ? "Applying..." : "Apply AI edit"}
              </button>
            </div>
          </div>
        {/if}
        <div class="editor-actions">
          <button type="button" onclick={closeConditionEditor}>Cancel</button>
          <button
            type="button"
            class="primary"
            disabled={conditionEditorReadOnly || conditionEditorDeployBusy}
            onclick={saveConditionEditor}
          >
            {conditionEditorDeployBusy ? "Publishing..." : "Publish to chain"}
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
    @apply flex flex-col border-b;
    background: var(--surface-header);
    border-bottom-color: var(--border-subtle);
  }

  .canvas {
    grid-area: canvas;
    @apply relative min-h-0 flex flex-col;
    background: var(--studio-flow-bg);
  }

  .tab-bar {
    @apply flex min-w-0 items-center gap-2 px-3 py-2;
  }

  .tab-scroll {
    @apply flex min-w-0 flex-1 items-center gap-2 overflow-x-auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .tab-scroll::-webkit-scrollbar {
    display: none;
  }

  .top-action-group {
    @apply flex flex-wrap items-center gap-2;
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
      tracking-[0.08em] text-white/60 hover:border-white/30 hover:text-white;
    @apply inline-flex shrink-0 items-center gap-2;
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
      text-[0.6rem] tracking-[0.08em] text-emerald-200 outline-none;
  }

  .tab-add {
    @apply w-8 justify-center px-0 text-white/70;
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
    --xy-background-color: var(--studio-flow-bg);
    --xy-background-pattern-dots-color-default: var(--studio-flow-pattern);
    --xy-background-pattern-lines-color-default: var(--studio-flow-pattern);
    --xy-background-pattern-cross-color-default: var(--studio-flow-pattern);
    --xy-handle-background-color: var(--surface-panel-strong);
    --xy-handle-border-color: var(--color-accent);
    --xy-selection-background-color: var(--color-accent-soft);
    --xy-edge-label-color: var(--text-primary);
    --xy-edge-label-background-color: transparent;
    background: var(--studio-flow-bg);
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
    @apply grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-black/30 p-1;
  }

  .source-tab {
    @apply rounded px-2 py-1.5 text-[0.55rem] uppercase tracking-[0.16em]
      text-white/60 border border-transparent bg-transparent;
  }

  .source-tab.is-active {
    @apply text-white border-white/20 bg-black/80;
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

  .plugins-panel {
    @apply mt-1 flex min-h-0 flex-1 flex-col gap-2;
  }

  .plugins-panel-header {
    @apply flex flex-col gap-1;
  }

  .plugins-root {
    @apply text-[0.65rem] text-white/60;
    word-break: break-word;
  }

  .plugins-meta {
    @apply rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[0.62rem] text-white/55;
    word-break: break-word;
  }

  .plugins-format-link {
    @apply text-emerald-200/90 underline decoration-transparent underline-offset-2 transition;
    text-decoration-thickness: 1px;
    word-break: break-all;
  }

  .plugins-format-link:hover {
    @apply decoration-emerald-200/80;
  }

  .plugins-feedback {
    @apply rounded-md border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[0.62rem] text-emerald-100/90;
  }

  .plugins-feedback.is-error {
    @apply border-rose-300/25 bg-rose-500/10 text-rose-100/90;
  }

  .plugins-empty {
    @apply rounded-md border border-dashed border-white/15 bg-black/30 px-2 py-2 text-[0.64rem] text-white/55;
  }

  .plugins-list {
    @apply flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1;
  }

  .plugin-card {
    @apply rounded-md border border-white/10 bg-black/70 p-2 cursor-grab;
  }

  .plugin-card:active {
    cursor: grabbing;
  }

  .plugin-card-header {
    @apply flex items-center justify-between gap-2;
  }

  .plugin-card-header h4 {
    @apply m-0 text-[0.72rem] font-semibold text-white/90;
  }

  .plugin-card p {
    @apply mt-2 text-[0.62rem] leading-5 text-white/70;
  }

  .plugin-card-footer {
    @apply mt-2 flex items-center justify-between gap-2;
  }

  .plugin-card-footer span {
    @apply text-[0.53rem] uppercase tracking-[0.16em] text-white/45;
    word-break: break-all;
  }

  .studio :global(.svelte-flow__node) {
    @apply rounded-md border;
    box-shadow: var(--studio-node-shadow);
    background-color: var(--studio-node-bg) !important;
    color: var(--text-secondary) !important;
    border-color: var(--studio-node-border) !important;
  }

  .studio :global(.svelte-flow__node.selected) {
    @apply border-emerald-400/60 text-emerald-200;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      var(--studio-node-shadow);
    border-color: rgba(52, 211, 153, 0.6) !important;
    color: var(--color-accent-strong) !important;
  }

  .studio :global(.svelte-flow__node .svelte-flow__node-content) {
    @apply text-[0.7rem] font-semibold tracking-[0.08em];
  }

  .studio :global(.svelte-flow__edge-text) {
    fill: var(--text-primary) !important;
  }

  .studio :global(.svelte-flow__edge-textbg) {
    fill: transparent !important;
    stroke: transparent !important;
  }

  .studio :global(.svelte-flow__edge-label) {
    color: var(--text-primary) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none;
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

  .inspector-inline-controls {
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
    @apply flex min-w-0 items-center rounded-md border border-white/10 bg-black/60 px-2 py-1;
  }

  .inspector-transform-row.is-draggable {
    @apply cursor-grab active:cursor-grabbing;
  }

  .inspector-transform-row.is-drag-active * {
    pointer-events: none;
  }

  .inspector-transform-row.is-drop-before {
    box-shadow: inset 0 2px 0 rgba(52, 211, 153, 0.9);
  }

  .inspector-transform-row.is-drop-after {
    box-shadow: inset 0 -2px 0 rgba(52, 211, 153, 0.9);
  }

  .inspector-transform-main {
    @apply flex min-w-0 flex-1 flex-wrap items-center gap-2;
  }

  .inspector-transform-main--ri {
    @apply flex-nowrap;
  }

  .inspector-transform-name {
    @apply basis-full text-[0.66rem] font-medium text-white/90;
    overflow-wrap: anywhere;
  }

  .inspector-transform-args {
    @apply whitespace-nowrap text-[0.56rem] uppercase tracking-[0.16em] text-white/45;
  }

  .inspector-transform-args-input {
    @apply mt-0 min-w-0 flex-1 text-[0.62rem] normal-case tracking-normal;
  }

  .inspector-transform-main .inspector-remove {
    margin-left: auto;
  }

  .inspector-input--args {
    @apply w-24 flex-none text-[0.65rem];
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

  .inspector-action--danger {
    @apply border-rose-400/35 text-rose-200/90 hover:border-rose-300/60 hover:text-rose-100;
  }

  .inspector-action--danger:disabled {
    @apply cursor-not-allowed border-white/10 text-white/35 hover:border-white/10 hover:text-white/35;
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

  .assistant-panel {
    @apply mt-2 flex h-full min-h-0 flex-1 flex-col gap-2;
  }

  .assistant-panel-tabs {
    @apply inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/70 p-1;
  }

  .assistant-panel-tab {
    @apply rounded-md px-2 py-1 text-[0.56rem] uppercase tracking-[0.18em] text-white/50 hover:text-white/80;
  }

  .assistant-panel-tab.is-active {
    @apply border border-white/15 bg-white/10 text-white/90;
  }

  .assistant-settings {
    @apply rounded-md border border-white/10 bg-black/70 p-2;
  }

  .assistant-settings-title {
    @apply text-[0.55rem] uppercase tracking-[0.2em] text-white/50;
  }

  .assistant-toggle {
    @apply mt-2 inline-flex items-center gap-2 text-[0.65rem] text-white/75;
  }

  .assistant-toggle input {
    accent-color: rgb(16 185 129);
  }

  .assistant-settings-label {
    @apply mt-2 block text-[0.55rem] uppercase tracking-[0.18em] text-white/45;
  }

  .assistant-input {
    @apply mt-1 w-full rounded-md border border-white/15 bg-black/80 px-2 py-1 text-[0.68rem]
      text-white/80 outline-none focus:border-emerald-400/60;
  }

  .assistant-settings-actions {
    @apply mt-2 flex items-center gap-2;
  }

  .assistant-settings-actions button {
    @apply rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.16em] text-white/70 hover:border-white/35 hover:text-white;
  }

  .assistant-status {
    @apply mt-2 rounded-md border px-2 py-1 text-[0.62rem] leading-5;
  }

  .assistant-status--success {
    @apply border-emerald-400/30 bg-emerald-500/10 text-emerald-200;
  }

  .assistant-status--error {
    @apply border-rose-400/35 bg-rose-500/10 text-rose-200;
  }

  .assistant-status--warn {
    @apply border-amber-400/30 bg-amber-500/10 text-amber-100;
  }

  .assistant-confirm {
    @apply rounded-md border border-amber-400/25 bg-amber-500/10 p-2 text-[0.65rem] text-amber-100;
  }

  .assistant-confirm-title {
    @apply text-[0.55rem] uppercase tracking-[0.2em] text-amber-100/80;
  }

  .assistant-confirm pre {
    @apply mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[0.62rem] leading-5 text-amber-100/90;
  }

  .assistant-confirm-actions {
    @apply mt-2 flex items-center gap-2;
  }

  .assistant-confirm-accept {
    @apply rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.16em] text-emerald-100 hover:border-emerald-300/70 disabled:opacity-55;
  }

  .assistant-confirm-cancel {
    @apply rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[0.55rem]
      uppercase tracking-[0.16em] text-rose-100 hover:border-rose-300/70 disabled:opacity-55;
  }

  .assistant-thread {
    @apply min-h-0 flex-1 space-y-2 overflow-auto rounded-md border border-white/10 bg-black/75 p-2;
  }

  .assistant-thread--compact {
    @apply max-h-64;
  }

  .assistant-message {
    @apply rounded-md border p-2;
  }

  .assistant-message-meta {
    @apply mb-1 flex items-center justify-between text-[0.52rem] uppercase tracking-[0.18em] text-white/45;
  }

  .assistant-message pre {
    @apply whitespace-pre-wrap text-[0.64rem] leading-5 text-white/80;
  }

  .assistant-message--system {
    @apply border-blue-400/20 bg-blue-500/5;
  }

  .assistant-message--user {
    @apply border-white/15 bg-white/5;
  }

  .assistant-message--assistant {
    @apply border-emerald-400/20 bg-emerald-500/5;
  }

  .assistant-message--tool {
    @apply border-cyan-400/20 bg-cyan-500/5;
  }

  .assistant-message--error {
    @apply border-rose-400/30 bg-rose-500/10;
  }

  .assistant-composer {
    @apply rounded-md border border-white/10 bg-black/70 p-2;
  }

  .assistant-composer-input {
    @apply w-full rounded-md border border-white/15 bg-black/80 px-2 py-1 text-[0.67rem]
      text-white/80 outline-none focus:border-emerald-400/60 disabled:opacity-55;
    resize: vertical;
    min-height: 58px;
  }

  .assistant-composer-actions {
    @apply mt-2 flex items-center justify-end;
  }

  .assistant-send {
    @apply rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[0.56rem]
      uppercase tracking-[0.18em] text-emerald-100 hover:border-emerald-300/70 disabled:cursor-not-allowed disabled:opacity-45;
  }

  .assistant-mini-btn {
    @apply rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[0.52rem]
      uppercase tracking-[0.16em] text-white/75 hover:border-white/35 hover:text-white disabled:opacity-45;
  }

  .assistant-mini-btn--danger {
    @apply border-rose-400/35 bg-rose-500/10 text-rose-100 hover:border-rose-300/70;
  }

  .assistant-conversation-toolbar {
    @apply flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/70 p-2;
  }

  .assistant-icon-btn {
    @apply inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 p-0
      text-[0.62rem] font-medium leading-none text-white/80 hover:border-white/35 hover:text-white disabled:opacity-45;
  }

  .assistant-icon-btn svg {
    @apply h-2.5 w-2.5;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .assistant-icon-btn--danger {
    @apply border-rose-400/35 bg-rose-500/10 text-rose-100 hover:border-rose-300/70;
  }

  .assistant-conversation-list {
    @apply min-h-0 flex-1 space-y-2 overflow-auto rounded-md border border-white/10 bg-black/75 p-2;
  }

  .assistant-conversation-item {
    @apply flex items-start justify-between gap-2 rounded-md border border-white/10 bg-white/5 p-2;
  }

  .assistant-conversation-item.is-active {
    @apply border-emerald-400/35 bg-emerald-500/10;
  }

  .assistant-conversation-open {
    @apply flex min-w-0 flex-1 flex-col items-start gap-1 rounded-md border border-transparent bg-transparent px-0 py-0 text-left;
  }

  .assistant-conversation-title {
    @apply truncate text-[0.65rem] font-medium text-white/85;
  }

  .assistant-conversation-meta {
    @apply mt-1 text-[0.55rem] uppercase tracking-[0.12em] text-white/45;
  }

  .runner-panel {
    @apply mt-3 flex min-h-0 flex-1 flex-col gap-3;
  }

  .runner-controls {
    @apply flex items-center gap-2 rounded-md border border-white/10 bg-black/70 p-2;
  }

  .runner-action {
    @apply inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5
      px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.15em] text-white/80 transition
      hover:border-white/35 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .runner-status {
    @apply rounded-md border px-2 py-1.5 text-[0.7rem] leading-5;
  }

  .runner-status.is-success {
    @apply border-emerald-400/35 bg-emerald-500/10 text-emerald-200;
  }

  .runner-status.is-error {
    @apply border-rose-400/35 bg-rose-500/10 text-rose-200;
  }

  .runner-output {
    @apply mt-2 max-h-80 min-h-28 overflow-auto rounded-md border border-white/10 bg-black/90 p-2
      text-[0.63rem] leading-5 text-white/80;
    white-space: pre-wrap;
    word-break: break-word;
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

  .editor-name-tools {
    @apply flex flex-wrap items-center gap-2;
  }

  .editor-name-note {
    @apply text-[0.6rem] text-white/45;
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

  .editor-ai-assistant {
    @apply flex flex-col gap-2 rounded-md border border-white/10 bg-black/70 p-2;
  }

  .editor-ai-assistant-title {
    @apply text-[0.6rem] uppercase tracking-[0.2em] text-white/60;
  }

  .editor-ai-assistant-hint {
    @apply text-[0.62rem] text-white/50;
  }

  .editor-ai-assistant-thread {
    @apply max-h-44 overflow-auto rounded-md border border-white/10 bg-black/80 p-2 flex flex-col gap-2;
  }

  .editor-ai-assistant-empty {
    @apply text-[0.62rem] text-white/45;
  }

  .editor-ai-assistant-message {
    @apply rounded-md border border-white/10 bg-black/70 p-2;
  }

  .editor-ai-assistant-message-meta {
    @apply mb-1 flex items-center justify-between text-[0.52rem] uppercase tracking-[0.18em] text-white/45;
  }

  .editor-ai-assistant-message pre {
    @apply whitespace-pre-wrap break-words text-[0.64rem] text-white/80 leading-5;
  }

  .editor-ai-assistant-message--assistant {
    @apply border-emerald-400/20 bg-emerald-950/10;
  }

  .editor-ai-assistant-message--error {
    @apply border-rose-400/30 bg-rose-950/20 text-rose-100;
  }

  .editor-ai-assistant-composer {
    @apply flex flex-col gap-2;
  }

  .editor-ai-assistant-input {
    @apply w-full rounded-md border border-white/10 bg-black/80 px-2 py-1 text-[0.7rem] text-white/85
      outline-none focus:border-emerald-400/60;
    resize: vertical;
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
    @apply inline-flex max-w-full items-start gap-2 rounded-md border px-2 py-1 text-[0.62rem];
    background: var(--surface-card);
    border-color: var(--border-subtle);
    color: var(--text-secondary);
  }

  .chain-status-chip span {
    @apply shrink-0 uppercase tracking-[0.18em];
    color: var(--text-muted);
  }

  .chain-status-chip strong {
    @apply break-words font-medium;
    color: var(--text-secondary);
  }

  .chain-status-chip.is-error {
    background: rgba(244, 63, 94, 0.1);
    border-color: rgba(244, 63, 94, 0.32);
    color: #be123c;
  }

  .chain-status-chip.is-error span {
    color: #be123c;
  }

  .chain-status-chip.is-success {
    background: var(--color-accent-soft);
    border-color: color-mix(in srgb, var(--color-accent) 36%, transparent);
    color: var(--color-accent-strong);
  }

  .chain-status-chip.is-success span {
    color: var(--color-accent-strong);
  }
</style>
