<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount, tick } from "svelte";

  import ConnectorPostFeed from "$lib/components/feed/ConnectorPostFeed.svelte";
  import { getCurrentUserProfileState, listServicesUsers } from "$lib/auth/api";
  import Button from "$lib/components/ui/Button.svelte";
  import WorldFrame from "$lib/components/worlds/WorldFrame.svelte";
  import { ChainApiRequestError } from "$lib/chain/registryApi";
  import type { ConnectorPostEvent } from "$lib/feed/particlePostData";
  import type { ScorePluginRuntimeData } from "$lib/score/types";
  import {
    buildAuthorAvatarMapFromServicesUsers,
    buildAuthorLabelMapFromServicesUsers,
    normalizeAuthorAddress,
    shortAuthorAddress,
  } from "$lib/social/authorLabels";
  import {
    DEFAULT_MIDI_WORLD_PARTICLES_COUNT,
    buildMidiRuntimeSearchParams,
    createRandomMidiRuntimeSelectionFromRegistry,
    executeMidiWorldRun,
    normalizeMidiParticlesCount,
  } from "$lib/worlds/midiWorldRun";
  import {
    DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
    buildMusicXmlRuntimeSearchParams,
    createDefaultMusicXmlRuntimeSelectionFromRegistry,
    createRandomMusicXmlRuntimeSelectionFromRegistry,
    executeMusicXmlWorldRun,
    fetchMusicXmlWorldConnectorContext,
    formatWorldConnectorScalarCompatibilityError,
    getWorldConnectorScalarCompatibility,
    normalizeParticlesCount,
    type DynamicRiInput,
    type MusicXmlWorldConnectorContext,
    type MusicXmlWorldRiField,
    type MusicXmlRuntimeSelection,
  } from "$lib/worlds/musicXmlWorldRun";
  import {
    FIRST_PARTY_WORLDS,
    loadWorldRegistry,
    MIDI_CLIP_WORLD_ID,
    MUSICXML_SCORE_WORLD,
    resolveWorldBySlugOrId,
    TONE_WORLD_ID,
  } from "$lib/worlds/registry";
  import {
    DEFAULT_TONE_WORLD_PARTICLES_COUNT,
    buildToneRuntimeSearchParams,
    createRandomToneRuntimeSelectionFromRegistry,
    executeToneWorldRun,
    normalizeToneParticlesCount,
  } from "$lib/worlds/toneWorldRun";
  import { fetchWorldFormatConnectorEvents } from "$lib/worlds/formatDiscovery";
  import { deleteWorld, updateWorldBundle, WorldApiRequestError } from "$lib/worlds/api";
  import { backendWorldToFrontendDescriptor } from "$lib/worlds/contract";
  import {
    buildBackendWorldRuntimeInput,
    initializeConnectorSetBindingValues,
    type ConnectorBindingValues,
  } from "$lib/worlds/runtimeInput";
  import { type WorldDescriptor, type WorldRuntimeInput } from "$lib/worlds/types";

  const CONNECTOR_FEED_PAGE_SIZE = 24;
  const UINT32_MAX = 0xffff_ffff;

  let connectorName = $state("");
  let particlesCountInput = $state(String(DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT));
  let dynamicRiInput = $state<DynamicRiInput>({});
  let runBusy = $state(false);
  let runError = $state("");
  let worldInput = $state<WorldRuntimeInput | null>(null);
  let worldFrameSrc = $state<string>(resolve("/world-runtimes/musicxml-score"));
  let connectorContext = $state<MusicXmlWorldConnectorContext | null>(null);
  let connectorContextLoading = $state(false);
  let appliedRouteConnectorName = $state<string | null>(null);
  let connectorFeedEvents = $state<ConnectorPostEvent[]>([]);
  let connectorFeedLoading = $state(true);
  let connectorFeedLoadingMore = $state(false);
  let connectorFeedHasMore = $state(false);
  let connectorFeedError = $state("");
  let connectorFeedLimit = $state(CONNECTOR_FEED_PAGE_SIZE);
  let connectorFeedWorldId = $state("");
  let authorLabelById = $state<Record<string, string>>({});
  let authorAvatarUrlById = $state<Record<string, string>>({});
  let worldStateRevision = $state(0);
  let selectedWorld = $state<WorldDescriptor | null>(null);
  let worldRegistryLoading = $state(false);
  let worldRegistryLoadWarning = $state(false);
  let worldRegistryRequestId = 0;
  let currentServicesUserId = $state<string | null>(null);
  let currentServicesUserIsAdmin = $state(false);
  let worldManagementBundle = $state<File | null>(null);
  let worldManagementBusy = $state(false);
  let worldManagementOperation = $state<"update" | "delete" | null>(null);
  let worldManagementStatus = $state("");
  let worldManagementError = $state("");
  let deleteConfirmation = $state("");
  let appliedManagementWorldId = $state("");
  let selectedBackendConnectorSetIndex = $state(0);
  let backendConnectorBindingValues = $state<ConnectorBindingValues>({});
  let selectedRuntimeConnectorContext = $state<{
    position: number;
    connectorName: string;
    contextPathPrefix?: string;
  } | null>(null);

  const decodeRouteParam = (value: string | null | undefined): string => {
    if (typeof value !== "string") return "";
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return value.trim();
    }
  };

  const routeWorldSlug = $derived(decodeRouteParam(page.params.slug));
  const activeWorld = $derived(selectedWorld ?? MUSICXML_SCORE_WORLD);
  const hasResolvedWorld = $derived(selectedWorld !== null);
  const isBackendWorld = $derived(activeWorld.source === "backend");
  const activeBackendConnectorSets = $derived(activeWorld.acceptedConnectorSets ?? []);
  const activeBackendConnectorSetsKey = $derived.by(() =>
    activeBackendConnectorSets
      .map((set) => `${set.connectors.join(",")}:${set.optionalConnectors.join(",")}`)
      .join("|"),
  );
  const activeAcceptedConnectorNames = $derived.by(() => {
    const names: string[] = [];
    activeBackendConnectorSets.forEach((set) => {
      [...set.connectors, ...set.optionalConnectors].forEach((name) => {
        const normalized = name.trim();
        if (!normalized || names.includes(normalized)) return;
        names.push(normalized);
      });
    });
    return names;
  });
  const activeAcceptedConnectorNamesKey = $derived(activeAcceptedConnectorNames.join(","));
  const resolvedBackendConnectorSetIndex = $derived.by(() => {
    if (!isBackendWorld || activeBackendConnectorSets.length === 0) return undefined;
    return Math.min(
      Math.max(selectedBackendConnectorSetIndex, 0),
      activeBackendConnectorSets.length - 1,
    );
  });
  const supportsFirstPartyRuntimeControls = $derived(!isBackendWorld);
  const supportsCompatibleConnectorFeed = $derived(
    Boolean(
      activeAcceptedConnectorNames.length ||
      activeWorld.acceptedFormatHashes?.length ||
      (activeWorld.acceptedScalars?.length &&
        (activeWorld.requiredScalarSets?.length || activeWorld.requiredScalars?.length)),
    ),
  );
  const canManageActiveBackendWorld = $derived(
    Boolean(
      isBackendWorld &&
      activeWorld.backend &&
      (currentServicesUserIsAdmin ||
        (currentServicesUserId && currentServicesUserId === activeWorld.backend.ownerId)),
    ),
  );
  const worldManagementBundleLabel = $derived(
    worldManagementBundle
      ? `${worldManagementBundle.name} · ${Math.ceil(worldManagementBundle.size / 1024).toLocaleString()} KB`
      : "No replacement bundle selected",
  );
  const normalizedDeleteConfirmation = $derived(
    deleteConfirmation
      .trim()
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .toLowerCase(),
  );
  const normalizedActiveWorldSlug = $derived(
    activeWorld.slug
      .trim()
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .toLowerCase(),
  );
  const canUpdateBackendWorld = $derived(
    Boolean(canManageActiveBackendWorld && activeWorld.backend && worldManagementBundle) &&
      !worldManagementBusy,
  );
  const canDeleteBackendWorld = $derived(
    Boolean(
      canManageActiveBackendWorld &&
      activeWorld.backend &&
      normalizedDeleteConfirmation === normalizedActiveWorldSlug,
    ) && !worldManagementBusy,
  );
  const showBackendWorldManagement = $derived(
    Boolean(isBackendWorld && canManageActiveBackendWorld),
  );
  const isMidiWorld = $derived(activeWorld.id === MIDI_CLIP_WORLD_ID);
  const isToneWorld = $derived(activeWorld.id === TONE_WORLD_ID);
  const activeWorldCompatibilityKey = $derived(
    [
      activeWorld.id,
      activeWorld.acceptedFormatHashes?.join(",") ?? "",
      activeWorld.requiredScalars?.join(",") ?? "",
      activeWorld.requiredScalarSets
        ?.map((set) => `${set.id}:${set.scalars.join(",")}`)
        .join("|") ?? "",
      activeWorld.acceptedScalars?.join(",") ?? "",
      activeAcceptedConnectorNamesKey,
    ].join("|"),
  );
  const defaultParticlesCount = $derived(
    isToneWorld
      ? DEFAULT_TONE_WORLD_PARTICLES_COUNT
      : isMidiWorld
        ? DEFAULT_MIDI_WORLD_PARTICLES_COUNT
        : DEFAULT_MUSICXML_WORLD_PARTICLES_COUNT,
  );
  const routeConnectorName = $derived.by(() => {
    return decodeRouteParam(page.params.connector);
  });
  const hasLoadedConnector = $derived(
    isBackendWorld
      ? Boolean(connectorName.trim())
      : Boolean(connectorName.trim() && connectorContext),
  );
  const canOpenStandalone = $derived(Boolean((worldInput || isBackendWorld) && !runBusy));
  const canLoadRandomConnector = $derived(
    !connectorFeedLoading &&
      connectorFeedEvents.some((event) => Boolean(event.particleId || event.particleLabel)),
  );
  const selectedConnectorEvent = $derived.by(() =>
    connectorFeedEvents.find(
      (event) => event.particleId === connectorName || event.particleLabel === connectorName,
    ),
  );
  const connectorAuthorRaw = $derived(
    connectorContext?.ownerAddress || selectedConnectorEvent?.authorId || "",
  );
  const connectorAuthorRouteId = $derived.by(() => {
    const normalized = normalizeAuthorAddress(connectorAuthorRaw);
    return normalized || connectorAuthorRaw.trim();
  });
  const connectorAuthorLabel = $derived.by(() => {
    const normalized = normalizeAuthorAddress(connectorAuthorRaw);
    if (!normalized) return connectorAuthorRaw || "Unknown";
    return authorLabelById[normalized] || shortAuthorAddress(normalized) || normalized;
  });
  const riFields = $derived(connectorContext?.riFields ?? []);

  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const hasWorldAdminRole = (me: unknown): boolean => {
    const root = asRecord(me);
    const user = asRecord(root.user);
    const roles = [root.roles, user.roles].flatMap((value) => (Array.isArray(value) ? value : []));
    return roles.some((role) => {
      if (typeof role !== "string") return false;
      const normalized = role.trim().toLowerCase();
      return (
        normalized === "admin" || normalized === "worlds:admin" || normalized === "world_admin"
      );
    });
  };

  const formatWorldManagementError = (error: unknown, fallback: string): string => {
    if (error instanceof WorldApiRequestError) return error.message;
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return fallback;
  };

  const resolveActiveWorldEntry = () =>
    isBackendWorld
      ? activeWorld.entry
      : isToneWorld
        ? resolve("/world-runtimes/tone-world")
        : isMidiWorld
          ? resolve("/world-runtimes/midi-clip")
          : resolve("/world-runtimes/musicxml-score");

  const buildBackendWorldInput = (connector: string): WorldRuntimeInput =>
    buildBackendWorldRuntimeInput({
      world: activeWorld,
      surface: "world-page",
      connectorName: connector,
      connectorAddress: selectedConnectorEvent?.authorId,
      connectorFormatHash: selectedConnectorEvent?.formatHash,
      connectorSetIndex: resolvedBackendConnectorSetIndex,
      connectorBindingValues: backendConnectorBindingValues,
      particlesCount: normalizeActiveParticlesCount(particlesCountInput),
    });

  const buildStandaloneRuntimeUrl = (selection: MusicXmlRuntimeSelection) => {
    const params = isToneWorld
      ? buildToneRuntimeSearchParams(selection)
      : isMidiWorld
        ? buildMidiRuntimeSearchParams(selection)
        : buildMusicXmlRuntimeSearchParams(selection);
    return `${resolveActiveWorldEntry()}?${params.toString()}`;
  };

  const normalizeActiveParticlesCount = (value: unknown) =>
    isBackendWorld
      ? normalizeParticlesCount(
          value,
          defaultParticlesCount,
          activeWorld.backend?.valueLimits?.particlesCount,
        )
      : isToneWorld
        ? normalizeToneParticlesCount(
            value,
            defaultParticlesCount,
            activeWorld.valueLimits?.particlesCount,
          )
        : isMidiWorld
          ? normalizeMidiParticlesCount(
              value,
              defaultParticlesCount,
              activeWorld.valueLimits?.particlesCount,
            )
          : normalizeParticlesCount(
              value,
              defaultParticlesCount,
              activeWorld.valueLimits?.particlesCount,
            );

  const randomIndex = (length: number): number => {
    if (length <= 1) return 0;
    if (browser && crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  };

  const getRandomCompatibleConnectorId = () => {
    const currentConnectorName = connectorName.trim();
    const connectorIds = Array.from(
      new Set(
        connectorFeedEvents
          .map((event) => event.particleId || event.particleLabel)
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );
    const candidates =
      connectorIds.length > 1
        ? connectorIds.filter((id) => id !== currentConnectorName)
        : connectorIds;
    if (candidates.length === 0) return "";
    return candidates[randomIndex(candidates.length)];
  };

  const refreshEmbeddedWorldFrame = () => {
    worldStateRevision += 1;
    worldFrameSrc = `${resolveActiveWorldEntry()}?state=${worldStateRevision}`;
  };

  const runBackendWorldIteration = async () => {
    const name = connectorName.trim();
    if (!name) {
      runError = "Load a connector from the compatible connector posts first.";
      return;
    }
    runBusy = true;
    runError = "";
    try {
      const particlesCount = normalizeActiveParticlesCount(particlesCountInput);
      particlesCountInput = String(particlesCount);
      worldInput = {
        ...buildBackendWorldInput(name),
        requestId: `backend-world-${Date.now().toString(36)}`,
      };
      await waitForRuntimeSettingsPaint();
    } finally {
      runBusy = false;
    }
  };

  const resetBackendConnectorBindings = (primaryConnectorName: string) => {
    selectedBackendConnectorSetIndex = 0;
    backendConnectorBindingValues = initializeConnectorSetBindingValues(
      activeBackendConnectorSets[0],
      { primaryConnectorName },
    );
  };

  const clampUint32 = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(UINT32_MAX, Math.trunc(parsed)));
  };

  const getDynamicRiValue = (position: number) =>
    dynamicRiInput[String(position)] ?? { start_point: 0, transformation_shift: 0 };

  const getRiFieldStartPoint = (field: MusicXmlWorldRiField) =>
    field.isStatic ? field.startPoint : getDynamicRiValue(field.position).start_point;

  const getRiFieldTransformationShift = (field: MusicXmlWorldRiField) =>
    field.isStatic
      ? field.transformationShift
      : getDynamicRiValue(field.position).transformation_shift;

  const withSelectedConnectorContext = (input: WorldRuntimeInput): WorldRuntimeInput => ({
    ...input,
    selectedConnectorContextNames: selectedRuntimeConnectorContext
      ? [selectedRuntimeConnectorContext.connectorName]
      : [],
    selectedConnectorContextPathPrefixes: selectedRuntimeConnectorContext?.contextPathPrefix
      ? [selectedRuntimeConnectorContext.contextPathPrefix]
      : [],
  });

  const syncSelectedConnectorContextToWorld = () => {
    if (!worldInput) return;
    worldInput = withSelectedConnectorContext(worldInput);
    refreshEmbeddedWorldFrame();
  };

  const isRiFieldSelected = (field: MusicXmlWorldRiField) =>
    selectedRuntimeConnectorContext?.position === field.position;

  const toggleRuntimeConnectorContext = (field: MusicXmlWorldRiField) => {
    selectedRuntimeConnectorContext = isRiFieldSelected(field)
      ? null
      : {
          position: field.position,
          connectorName: field.connectorName,
          contextPathPrefix: field.contextPathPrefix,
        };
    syncSelectedConnectorContextToWorld();
  };

  const handleRiRowClick = (event: MouseEvent, field: MusicXmlWorldRiField) => {
    const target = event.target;
    if (target instanceof Element && target.closest("input, button")) return;
    toggleRuntimeConnectorContext(field);
  };

  const updateDynamicRiField = (
    position: number,
    key: "start_point" | "transformation_shift",
    value: string,
  ) => {
    const positionKey = String(position);
    const previous = getDynamicRiValue(position);
    dynamicRiInput = {
      ...dynamicRiInput,
      [positionKey]: {
        ...previous,
        [key]: clampUint32(value),
      },
    };
  };

  const refreshConnectorFeed = async (force = false) => {
    if (!force && connectorFeedEvents.length > 0) return;
    connectorFeedLoading = !connectorFeedLoadingMore;
    connectorFeedError = "";
    try {
      const result = await fetchWorldFormatConnectorEvents({
        acceptedConnectorNames: activeAcceptedConnectorNames,
        acceptedFormatHashes: activeWorld.acceptedFormatHashes,
        acceptedScalars: activeWorld.acceptedScalars,
        excludedConnectorNames: activeWorld.excludedConnectorNames,
        requiredScalars: activeWorld.requiredScalars,
        requiredScalarSets: activeWorld.requiredScalarSets,
        connectorLimit: connectorFeedLimit,
      });
      connectorFeedEvents = result.events;
      connectorFeedHasMore = result.hasMore;
      if (result.errors.length > 0) {
        connectorFeedError = `Some compatible connector candidates could not be loaded (${result.errors.length}).`;
        console.warn("[Worlds] Format connector discovery warnings", result.errors);
      }
    } catch (error) {
      connectorFeedError =
        error instanceof Error ? error.message : "Could not load compatible connector posts.";
    } finally {
      connectorFeedLoading = false;
    }
  };

  const refreshAuthorIdentityMaps = async () => {
    try {
      const users = await listServicesUsers();
      authorLabelById = buildAuthorLabelMapFromServicesUsers(users);
      authorAvatarUrlById = buildAuthorAvatarMapFromServicesUsers(users);
    } catch (error) {
      console.warn("[Worlds] Could not load service user display labels.", error);
    }
  };

  const refreshCurrentServicesUser = async () => {
    if (!browser) return;
    try {
      const profileState = await getCurrentUserProfileState({ preferCached: true });
      currentServicesUserId = profileState.userId;
      currentServicesUserIsAdmin = hasWorldAdminRole(profileState.me);
    } catch (error) {
      currentServicesUserId = null;
      currentServicesUserIsAdmin = false;
      console.warn("[Worlds] Could not resolve current services user.", error);
    }
  };

  const handleWorldManagementBundleChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement | null;
    worldManagementBundle = input?.files?.[0] ?? null;
    worldManagementError = "";
    worldManagementStatus = worldManagementBundle ? "Replacement bundle ready." : "";
  };

  const updateBackendWorldBundle = async () => {
    if (!activeWorld.backend || !worldManagementBundle || !canUpdateBackendWorld) return;
    worldManagementBusy = true;
    worldManagementOperation = "update";
    worldManagementError = "";
    worldManagementStatus = "Updating world bundle.";
    try {
      const updatedWorld = await updateWorldBundle(activeWorld.id, worldManagementBundle);
      const nextWorld = backendWorldToFrontendDescriptor(updatedWorld);
      selectedWorld = nextWorld;
      worldInput = buildBackendWorldInput(connectorName.trim());
      refreshEmbeddedWorldFrame();
      worldManagementBundle = null;
      worldManagementStatus = "World bundle updated.";
    } catch (error) {
      worldManagementError = formatWorldManagementError(error, "World bundle update failed.");
      worldManagementStatus = "";
    } finally {
      worldManagementBusy = false;
      worldManagementOperation = null;
    }
  };

  const deleteBackendWorld = async () => {
    if (
      !activeWorld.backend ||
      !canManageActiveBackendWorld ||
      normalizedDeleteConfirmation !== normalizedActiveWorldSlug ||
      worldManagementBusy
    )
      return;
    worldManagementBusy = true;
    worldManagementOperation = "delete";
    worldManagementError = "";
    worldManagementStatus = "Deleting world.";
    try {
      await deleteWorld(activeWorld.id);
      worldManagementStatus = "World deleted.";
      await goto(resolve("/worlds"));
    } catch (error) {
      worldManagementError = formatWorldManagementError(error, "World deletion failed.");
      worldManagementStatus = "";
    } finally {
      worldManagementBusy = false;
      worldManagementOperation = null;
    }
  };

  const loadConnectorContext = async (name: string) => {
    const normalizedName = name.trim();
    connectorContext = null;
    if (!normalizedName) return;

    connectorContextLoading = true;
    try {
      const context = await fetchMusicXmlWorldConnectorContext(normalizedName);
      const compatibility = getWorldConnectorScalarCompatibility(
        context.registry,
        normalizedName,
        activeWorld,
      );
      if (!compatibility.compatible) {
        runError = formatWorldConnectorScalarCompatibilityError(activeWorld, compatibility);
        connectorContext = null;
        worldInput = null;
        dynamicRiInput = {};
        selectedRuntimeConnectorContext = null;
        return;
      }
      connectorContext = context;
      const defaultSelection = createDefaultMusicXmlRuntimeSelectionFromRegistry(
        normalizedName,
        context.registry,
        normalizeActiveParticlesCount(particlesCountInput),
      );
      particlesCountInput = String(defaultSelection.particlesCount);
      dynamicRiInput = { ...defaultSelection.dynamicRiInput };
    } catch (error) {
      runError = getErrorMessage(error);
    } finally {
      connectorContextLoading = false;
    }
  };

  const loadMoreConnectorPosts = async () => {
    if (connectorFeedLoadingMore || !connectorFeedHasMore) return;
    connectorFeedLoadingMore = true;
    connectorFeedLimit += CONNECTOR_FEED_PAGE_SIZE;
    try {
      await refreshConnectorFeed(true);
    } finally {
      connectorFeedLoadingMore = false;
    }
  };

  const openConnectorInStudio = (targetConnectorId: string) => {
    if (!browser || !targetConnectorId) return;
    const target = new URL(resolve("/studio"), window.location.origin);
    target.searchParams.set("network_kind", "connector");
    target.searchParams.set("network_id", targetConnectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const loadConnectorInWorld = (targetConnectorId: string) => {
    if (!browser || !targetConnectorId) return;
    void goto(
      resolve("/worlds/[slug]/[connector]", {
        slug: activeWorld.slug,
        connector: targetConnectorId,
      }),
    );
  };

  const loadRandomConnectorInWorld = async () => {
    runError = "";
    if (connectorFeedLoading || connectorFeedLoadingMore) return;
    if (connectorFeedEvents.length === 0) {
      await refreshConnectorFeed(true);
    }

    const targetConnectorId = getRandomCompatibleConnectorId();
    if (!targetConnectorId) {
      runError = connectorFeedError || "No compatible connectors are available for this world yet.";
      return;
    }
    loadConnectorInWorld(targetConnectorId);
  };

  const getErrorMessage = (error: unknown) => {
    const responseBody =
      error instanceof ChainApiRequestError && typeof error.responseBody === "string"
        ? error.responseBody
        : "";
    return (
      responseBody || (error instanceof Error ? error.message : "Could not render this world.")
    );
  };

  const logScoreDiagnostics = (data: ScorePluginRuntimeData, context: string) => {
    if (!data.diagnostics.length) return;
    console.groupCollapsed(`[HyperMusic Worlds] ${context} score diagnostics`);
    data.diagnostics.forEach((diagnostic) => {
      const message = diagnostic.path
        ? `${diagnostic.message} (${diagnostic.path})`
        : diagnostic.message;
      if (diagnostic.level === "error") {
        console.error(message, diagnostic);
      } else if (diagnostic.level === "warning") {
        console.warn(message, diagnostic);
      } else {
        console.info(message, diagnostic);
      }
    });
    console.groupEnd();
  };

  const applySelection = (selection: MusicXmlRuntimeSelection) => {
    connectorName = selection.connectorName;
    particlesCountInput = String(selection.particlesCount);
    dynamicRiInput = { ...selection.dynamicRiInput };
  };

  const waitForRuntimeSettingsPaint = async () => {
    await tick();
    if (!browser) return;
    await new Promise<void>((resolvePaint) => requestAnimationFrame(() => resolvePaint()));
  };

  const runSelection = async (
    selection: MusicXmlRuntimeSelection,
    diagnosticContext = "Manual runtime",
  ) => {
    runBusy = true;
    runError = "";

    try {
      if (isToneWorld) {
        const result = await executeToneWorldRun({
          connectorName: selection.connectorName,
          particlesCount: selection.particlesCount,
          dynamicRiInput: selection.dynamicRiInput,
          surface: "world-page",
          worldName: activeWorld.name,
          world: activeWorld,
        });
        worldInput = withSelectedConnectorContext(result.worldInput);
        refreshEmbeddedWorldFrame();
        if (result.streams.length === 0) {
          runError = "The connector ran, but this world did not receive Tone material output.";
        }
        return;
      }

      if (isMidiWorld) {
        const result = await executeMidiWorldRun({
          connectorName: selection.connectorName,
          particlesCount: selection.particlesCount,
          dynamicRiInput: selection.dynamicRiInput,
          surface: "world-page",
          worldName: activeWorld.name,
          world: activeWorld,
        });
        worldInput = withSelectedConnectorContext(result.worldInput);
        refreshEmbeddedWorldFrame();
        if (result.midiClip.notes.length === 0) {
          runError = "The connector ran, but this world did not receive MIDI-compatible output.";
        }
        return;
      }

      const result = await executeMusicXmlWorldRun({
        connectorName: selection.connectorName,
        particlesCount: selection.particlesCount,
        dynamicRiInput: selection.dynamicRiInput,
        surface: "world-page",
        worldName: activeWorld.name,
        world: activeWorld,
      });
      logScoreDiagnostics(result.scoreData, diagnosticContext);
      worldInput = withSelectedConnectorContext(result.worldInput);
      refreshEmbeddedWorldFrame();
      if (!result.scoreData.musicXml) {
        runError = "The connector ran, but this world did not receive MusicXML-compatible output.";
      }
    } catch (error) {
      runError = getErrorMessage(error);
      worldInput = null;
    } finally {
      runBusy = false;
    }
  };

  const runRandomWorld = async () => {
    if (isBackendWorld) {
      await runBackendWorldIteration();
      return;
    }
    const name = connectorName.trim();
    if (!name) {
      runError = "Load a connector from the compatible connector posts first.";
      return;
    }
    runBusy = true;
    runError = "";

    try {
      let context = connectorContext?.connectorName === name ? connectorContext : null;
      if (!context) {
        connectorContextLoading = true;
        context = await fetchMusicXmlWorldConnectorContext(name);
        connectorContext = context;
      }

      const selection = isMidiWorld
        ? createRandomMidiRuntimeSelectionFromRegistry(
            name,
            context.registry,
            undefined,
            activeWorld,
          )
        : isToneWorld
          ? createRandomToneRuntimeSelectionFromRegistry(
              name,
              context.registry,
              undefined,
              activeWorld,
            )
          : createRandomMusicXmlRuntimeSelectionFromRegistry(
              name,
              context.registry,
              undefined,
              activeWorld,
            );
      applySelection(selection);
      await waitForRuntimeSettingsPaint();
      await runSelection(selection, "Random runtime");
    } catch (error) {
      runError = getErrorMessage(error);
      worldInput = null;
    } finally {
      runBusy = false;
      connectorContextLoading = false;
    }
  };

  const runCurrentSettings = async () => {
    if (isBackendWorld) {
      await runBackendWorldIteration();
      return;
    }
    const name = connectorName.trim();
    if (!name) {
      runError = "Load a connector from the compatible connector posts first.";
      return;
    }
    if (!connectorContext) {
      runError = "Load a compatible connector from the compatible connector posts first.";
      return;
    }

    const selection: MusicXmlRuntimeSelection = {
      connectorName: name,
      particlesCount: normalizeActiveParticlesCount(particlesCountInput),
      dynamicRiInput,
    };
    applySelection(selection);
    await runSelection(selection);
  };

  const openStandaloneTab = () => {
    if (!browser || !worldInput) return;
    if (isBackendWorld) {
      const route = connectorName.trim()
        ? resolve("/worlds/[slug]/[connector]", {
            slug: activeWorld.slug,
            connector: connectorName.trim(),
          })
        : resolve("/worlds/[slug]", { slug: activeWorld.slug });
      window.open(
        new URL(route, window.location.origin).toString(),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    const standaloneUrl = buildStandaloneRuntimeUrl({
      connectorName: connectorName.trim(),
      particlesCount: normalizeActiveParticlesCount(particlesCountInput),
      dynamicRiInput,
    });
    window.open(standaloneUrl, "_blank", "noopener,noreferrer");
  };

  const resolveBundledWorld = (slugOrId: string): WorldDescriptor | null =>
    resolveWorldBySlugOrId(FIRST_PARTY_WORLDS, slugOrId) ?? null;

  const loadRouteWorld = async (
    slugOrId: string,
    requestId: number,
    bundledWorld: WorldDescriptor | null,
  ) => {
    try {
      const result = await loadWorldRegistry({ surface: "world-page" });
      if (requestId !== worldRegistryRequestId) return;

      const resolvedWorld = resolveWorldBySlugOrId(result.worlds, slugOrId) ?? null;
      selectedWorld = resolvedWorld;
      worldRegistryLoadWarning = result.backendError !== null && bundledWorld === null;
    } catch {
      if (requestId !== worldRegistryRequestId) return;
      selectedWorld = bundledWorld;
      worldRegistryLoadWarning = bundledWorld === null;
    } finally {
      if (requestId === worldRegistryRequestId) {
        worldRegistryLoading = false;
      }
    }
  };

  $effect(() => {
    const slugOrId = routeWorldSlug;
    const requestId = ++worldRegistryRequestId;

    if (!slugOrId) {
      selectedWorld = null;
      worldRegistryLoading = false;
      worldRegistryLoadWarning = false;
      return;
    }

    const bundledWorld = resolveBundledWorld(slugOrId);
    selectedWorld = bundledWorld;
    worldRegistryLoading = true;
    worldRegistryLoadWarning = false;
    void loadRouteWorld(slugOrId, requestId, bundledWorld);
  });

  $effect(() => {
    if (!hasResolvedWorld) return;
    if (appliedManagementWorldId !== activeWorld.id) {
      appliedManagementWorldId = activeWorld.id;
      worldManagementBundle = null;
      worldManagementStatus = "";
      worldManagementError = "";
      deleteConfirmation = "";
    }

    const nextConnectorName = routeConnectorName;
    const routeKey = `${activeWorld.id}:${nextConnectorName}:${activeBackendConnectorSetsKey}`;
    if (appliedRouteConnectorName === routeKey) return;
    appliedRouteConnectorName = routeKey;
    connectorName = nextConnectorName;
    particlesCountInput = String(defaultParticlesCount);
    dynamicRiInput = {};
    selectedRuntimeConnectorContext = null;
    worldInput = null;
    worldFrameSrc = resolveActiveWorldEntry();
    runError = "";
    if (!supportsFirstPartyRuntimeControls) {
      resetBackendConnectorBindings(nextConnectorName);
      worldInput = buildBackendWorldInput(nextConnectorName);
      return;
    }
    void loadConnectorContext(nextConnectorName);
  });

  $effect(() => {
    if (!browser || !hasResolvedWorld || !supportsCompatibleConnectorFeed) return;
    const worldKey = activeWorldCompatibilityKey;
    if (connectorFeedWorldId === worldKey) return;
    connectorFeedWorldId = worldKey;
    connectorFeedEvents = [];
    connectorFeedLimit = CONNECTOR_FEED_PAGE_SIZE;
    connectorFeedHasMore = false;
    connectorFeedError = "";
    void refreshConnectorFeed(true);
  });

  onMount(() => {
    void refreshAuthorIdentityMaps();
    void refreshCurrentServicesUser();
    window.addEventListener("auth:change", refreshCurrentServicesUser);
    window.addEventListener("storage", refreshCurrentServicesUser);
    return () => {
      window.removeEventListener("auth:change", refreshCurrentServicesUser);
      window.removeEventListener("storage", refreshCurrentServicesUser);
    };
  });
</script>

<svelte:head>
  <title>{hasResolvedWorld ? activeWorld.name : "World"} · Worlds</title>
</svelte:head>

{#if worldRegistryLoading && !hasResolvedWorld}
  <main class="world-page">
    <div class="world-route-state" role="status" aria-live="polite">Loading world...</div>
  </main>
{:else if !hasResolvedWorld}
  <main class="world-page">
    <div class="world-route-state" role="status" aria-live="polite">
      <h1>{worldRegistryLoadWarning ? "World registry unavailable" : "World not found"}</h1>
      <a href={resolve("/worlds")}>Browse worlds</a>
    </div>
  </main>
{:else}
  <main class="world-page">
    <section class="world-project">
      <div class="world-renderer-column">
        <div class="world-renderer-panel">
          <WorldFrame
            world={activeWorld}
            input={worldInput}
            srcOverride={worldFrameSrc}
            showStatus={isBackendWorld}
          />
        </div>
        <div class="world-renderer-actions" aria-label="World actions">
          <Button
            className="world-icon-button"
            variant="ghost"
            onclick={() => void loadRandomConnectorInWorld()}
            disabled={runBusy ||
              connectorFeedLoading ||
              connectorFeedLoadingMore ||
              !canLoadRandomConnector}
            ariaLabel={connectorFeedLoading ? "Loading compatible connectors" : "Random connector"}
            title={canLoadRandomConnector
              ? "Random compatible connector"
              : "No compatible connectors loaded yet"}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <rect x="4" y="4" width="6" height="6" rx="1.4"></rect>
              <rect x="14" y="4" width="6" height="6" rx="1.4"></rect>
              <rect x="9" y="14" width="6" height="6" rx="1.4"></rect>
              <path d="M10 7h4"></path>
              <path d="M7 10v1a3 3 0 0 0 3 3h2"></path>
              <path d="M17 10v1a3 3 0 0 1-3 3h-2"></path>
            </svg>
          </Button>
          <Button
            className="world-icon-button"
            onclick={() => void runRandomWorld()}
            disabled={runBusy || !hasLoadedConnector}
            ariaLabel={runBusy ? "Rendering random iteration" : "Random iteration"}
            title={hasLoadedConnector
              ? runBusy
                ? "Rendering random iteration"
                : "Random iteration"
              : "Load a connector first"}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M16 3h5v5"></path>
              <path d="M4 20 21 3"></path>
              <path d="M21 16v5h-5"></path>
              <path d="M15 15l6 6"></path>
              <path d="M4 4l5 5"></path>
            </svg>
          </Button>
          <Button
            className="world-icon-button"
            variant="ghost"
            onclick={openStandaloneTab}
            disabled={!canOpenStandalone}
            ariaLabel="Open current world in a new tab"
            title="Open current world in a new tab"
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M15 3h6v6"></path>
              <path d="M10 14 21 3"></path>
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>
            </svg>
          </Button>
        </div>
      </div>

      <aside class="world-info-panel">
        <div class="world-meta">
          <h1>{activeWorld.name}</h1>
          <div class="world-meta-row">
            <span>World's author:</span>
            <strong
              >{isBackendWorld
                ? (activeWorld.backend?.ownerId ?? "Uploaded world")
                : "decentralised.art"}</strong
            >
          </div>
          <p class="world-description">{activeWorld.shortDescription ?? activeWorld.description}</p>
        </div>

        {#if supportsFirstPartyRuntimeControls}
          <div class="runtime-summary">
            <div>
              <span>Connector:</span>
              <strong>
                {#if connectorName}
                  <a class="runtime-summary-link" href={resolve("/c/[id]", { id: connectorName })}>
                    {connectorName}
                  </a>
                {:else}
                  Select a connector below
                {/if}
              </strong>
            </div>
            <div>
              <span>Connector's author:</span>
              <strong>
                {#if connectorName && connectorAuthorRouteId}
                  <a
                    class="runtime-summary-link"
                    href={resolve("/u/[id]", { id: connectorAuthorRouteId })}
                  >
                    {connectorAuthorLabel}
                  </a>
                {:else}
                  {connectorName ? connectorAuthorLabel : "None loaded"}
                {/if}
              </strong>
            </div>
          </div>

          <details class="advanced-panel">
            <summary>Runtime settings</summary>
            <form
              class="runtime-panel"
              onsubmit={(event) => {
                event.preventDefault();
                void runCurrentSettings();
              }}
            >
              <label>
                <span>Particles</span>
                <input bind:value={particlesCountInput} inputmode="numeric" />
              </label>
              <div class="ri-editor" aria-label="Running instances">
                <span>Running instances</span>
                {#if connectorContextLoading}
                  <p class="ri-editor-note">Loading connector RI layout...</p>
                {:else if !connectorName}
                  <p class="ri-editor-note">
                    Load a connector from the compatible connector posts.
                  </p>
                {:else if riFields.length === 0}
                  <p class="ri-editor-note">
                    No editable RI positions were found for this connector.
                  </p>
                {:else}
                  <div class="ri-scroll">
                    {#each riFields as field (field.position)}
                      <div
                        class={`ri-row ${field.isStatic ? "is-static" : ""} ${isRiFieldSelected(field) ? "is-selected" : ""}`}
                        role="button"
                        tabindex="0"
                        aria-pressed={isRiFieldSelected(field)}
                        aria-label={`Show output from ${field.label}`}
                        onclick={(event) => handleRiRowClick(event, field)}
                        onkeydown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          toggleRuntimeConnectorContext(field);
                        }}
                      >
                        <div class="ri-row-head">
                          <button
                            type="button"
                            class="ri-select-button"
                            aria-pressed={isRiFieldSelected(field)}
                            aria-label={`Show output from ${field.label}`}
                            title="Show output from this connector in the world preview"
                            onclick={() => toggleRuntimeConnectorContext(field)}
                          >
                            <span aria-hidden="true"></span>
                            <strong>{field.label}</strong>
                          </button>
                          <span>{field.isStatic ? "Static" : "Open"} · RI {field.position}</span>
                        </div>
                        <div class="ri-values">
                          <label>
                            <span>Start</span>
                            <input
                              value={getRiFieldStartPoint(field)}
                              inputmode="numeric"
                              readonly={field.isStatic}
                              oninput={(event) => {
                                updateDynamicRiField(
                                  field.position,
                                  "start_point",
                                  event.currentTarget.value,
                                );
                              }}
                            />
                          </label>
                          <label>
                            <span>Shift</span>
                            <input
                              value={getRiFieldTransformationShift(field)}
                              inputmode="numeric"
                              readonly={field.isStatic}
                              oninput={(event) => {
                                updateDynamicRiField(
                                  field.position,
                                  "transformation_shift",
                                  event.currentTarget.value,
                                );
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
              <Button type="submit" variant="ghost" disabled={runBusy || !hasLoadedConnector}>
                Render settings
              </Button>
            </form>
          </details>
        {:else}
          <div class="runtime-summary">
            <div>
              <span>Source:</span>
              <strong>Backend world</strong>
            </div>
            <div>
              <span>Version:</span>
              <strong>{activeWorld.version}</strong>
            </div>
            <div>
              <span>Status:</span>
              <strong>{activeWorld.backend?.status ?? "active"}</strong>
            </div>
            <div>
              <span>Connector:</span>
              <strong>
                {#if connectorName}
                  <a class="runtime-summary-link" href={resolve("/c/[id]", { id: connectorName })}>
                    {connectorName}
                  </a>
                {:else}
                  Select a connector below
                {/if}
              </strong>
            </div>
          </div>

          <details class="advanced-panel">
            <summary>Runtime settings</summary>
            <form
              class="runtime-panel"
              onsubmit={(event) => {
                event.preventDefault();
                void runCurrentSettings();
              }}
            >
              <label>
                <span>Particles</span>
                <input bind:value={particlesCountInput} inputmode="numeric" />
              </label>
              <Button type="submit" variant="ghost" disabled={runBusy || !hasLoadedConnector}>
                Render settings
              </Button>
            </form>
          </details>

          {#if showBackendWorldManagement}
            <details class="advanced-panel" aria-label="World management">
              <summary>Owner controls</summary>
              <div class="runtime-panel world-management-panel">
                <label class="management-file-input">
                  <span>Replacement bundle</span>
                  <strong>{worldManagementBundleLabel}</strong>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    aria-label="Replacement world ZIP bundle"
                    onchange={handleWorldManagementBundleChange}
                  />
                </label>
                <Button
                  variant="ghost"
                  disabled={!canUpdateBackendWorld}
                  onclick={() => void updateBackendWorldBundle()}
                >
                  {worldManagementOperation === "update" ? "Updating" : "Update bundle"}
                </Button>
                <label class="delete-confirmation">
                  <span>Confirm slug</span>
                  <input
                    bind:value={deleteConfirmation}
                    aria-label="Confirm world slug"
                    autocomplete="off"
                    placeholder={activeWorld.slug}
                  />
                </label>
                <Button
                  variant="ghost"
                  disabled={!canDeleteBackendWorld}
                  onclick={() => void deleteBackendWorld()}
                >
                  {worldManagementOperation === "delete" ? "Deleting" : "Delete world"}
                </Button>
                {#if worldManagementStatus}
                  <p class="management-status" role="status" aria-live="polite">
                    {worldManagementStatus}
                  </p>
                {/if}
                {#if worldManagementError}
                  <p class="management-status is-error" role="alert">{worldManagementError}</p>
                {/if}
              </div>
            </details>
          {/if}
        {/if}

        {#if runError}
          <div class="runtime-error">{runError}</div>
        {/if}
      </aside>
    </section>

    {#if supportsCompatibleConnectorFeed}
      <section class="compatible-connectors" aria-label="Compatible connectors">
        <div class="compatible-heading">
          <div>
            <p>Compatible Connectors</p>
          </div>
          {#if connectorFeedError}
            <span>{connectorFeedError}</span>
          {/if}
        </div>

        <ConnectorPostFeed
          loading={connectorFeedLoading}
          loadingMore={connectorFeedLoadingMore}
          hasMore={connectorFeedHasMore}
          events={connectorFeedEvents}
          onLoadMore={loadMoreConnectorPosts}
          onConnectorOpen={openConnectorInStudio}
          onLoadInWorld={loadConnectorInWorld}
          {authorLabelById}
          {authorAvatarUrlById}
          emptyMessage="No compatible connector posts have been indexed for this world yet."
        />
      </section>
    {/if}
  </main>
{/if}

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .world-page {
    @apply min-h-0 flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6;
    background: var(--surface-page);
    color: var(--text-primary);
    --social-feed-card-width: min(68rem, 100%);
  }

  .world-route-state {
    @apply mx-auto grid min-h-[50vh] max-w-3xl place-items-center gap-4 rounded-md border p-8 text-center;
    border-color: var(--border-subtle);
    background: var(--surface-panel);
  }

  .world-route-state h1 {
    @apply m-0 text-xl font-semibold;
  }

  .world-route-state a {
    @apply text-sm underline-offset-4 hover:underline;
    color: var(--text-secondary);
  }

  .world-project {
    @apply mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)];
  }

  .world-renderer-column {
    @apply flex min-w-0 flex-col items-center gap-3;
  }

  .world-renderer-panel {
    @apply relative w-full overflow-hidden rounded-md border;
    aspect-ratio: 1 / 1;
    border-color: var(--border-subtle);
    background: #fff;
    max-width: min(100%, 72vh, 760px);
  }

  .world-renderer-panel :global(.world-frame-shell) {
    @apply h-full min-h-0 rounded-none border-0;
  }

  .world-renderer-actions {
    @apply flex items-center justify-center gap-2;
  }

  .world-renderer-actions :global(.world-icon-button) {
    @apply h-11 w-11 items-center justify-center p-0;
  }

  .world-renderer-actions :global(.world-icon-button svg) {
    @apply h-5 w-5;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.9;
  }

  .world-info-panel {
    @apply flex flex-col gap-4 rounded-md border p-4;
    border-color: var(--border-subtle);
    background: var(--surface-panel);
  }

  .runtime-summary span,
  .advanced-panel summary,
  .runtime-panel span,
  .compatible-heading p {
    @apply text-[0.62rem] uppercase tracking-[0.16em];
    color: var(--text-muted);
  }

  .world-meta {
    @apply grid gap-1.5;
  }

  .world-meta-row {
    @apply grid gap-0.5;
  }

  .world-meta-row span {
    @apply text-[0.62rem] uppercase tracking-[0.16em];
    color: var(--text-muted);
  }

  .world-meta-row strong {
    @apply text-xs font-semibold;
    color: var(--text-primary);
  }

  .world-info-panel h1 {
    @apply m-0 text-lg font-semibold leading-tight;
  }

  .world-author {
    @apply m-0 text-xs;
    color: var(--text-muted);
  }

  .world-description {
    @apply m-0 text-xs leading-5;
    color: var(--text-muted);
  }

  .runtime-summary strong {
    @apply block truncate text-xs font-semibold leading-tight;
    color: var(--text-primary);
  }

  .runtime-summary-link {
    @apply truncate transition;
    color: var(--text-primary);
    text-decoration: none;
  }

  .runtime-summary-link:hover {
    color: var(--accent-primary);
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .runtime-summary {
    @apply grid gap-1.5 rounded-md border px-2.5 py-2;
    border-color: var(--border-subtle);
    background: var(--surface-panel-soft);
  }

  .runtime-summary div {
    @apply grid gap-0.5;
  }

  .advanced-panel {
    @apply rounded-md border;
    border-color: var(--border-subtle);
    background: var(--surface-panel-soft);
  }

  .advanced-panel summary {
    @apply cursor-pointer px-3 py-1.5;
  }

  .runtime-panel {
    @apply grid gap-2 border-t p-2.5;
    border-color: var(--border-subtle);
  }

  .runtime-panel label {
    @apply flex min-w-0 flex-col gap-0.5;
  }

  .runtime-panel input {
    @apply w-full rounded-md border px-2 py-1 text-xs outline-none;
    background: var(--surface-input);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .runtime-panel input[readonly] {
    @apply cursor-default opacity-70;
  }

  .world-management-panel {
    @apply gap-2;
  }

  .world-management-panel strong {
    @apply text-xs font-semibold;
    color: var(--text-primary);
  }

  .world-management-panel p {
    @apply m-0 text-xs leading-5;
    color: var(--text-muted);
  }

  .management-file-input {
    @apply cursor-pointer rounded-md border p-2;
    border-color: var(--border-subtle);
    background: var(--surface-panel);
  }

  .management-file-input:hover {
    border-color: color-mix(in srgb, var(--accent-primary) 45%, var(--border-subtle));
  }

  .management-file-input input {
    @apply sr-only;
  }

  .delete-confirmation input {
    @apply w-full rounded-md border px-2 py-1 text-xs outline-none;
    background: var(--surface-input);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .management-status {
    @apply rounded-md border px-2 py-1.5;
    border-color: var(--border-subtle);
    background: var(--surface-panel);
  }

  .management-status.is-error {
    @apply border-rose-300/30;
    color: var(--text-primary);
    background: color-mix(in srgb, #9f1239 14%, var(--surface-panel));
  }

  .ri-editor {
    @apply grid gap-1.5;
  }

  .ri-editor-note {
    @apply m-0 rounded-md border px-2 py-1.5 text-[0.68rem];
    border-color: var(--border-subtle);
    background: var(--surface-panel);
    color: var(--text-muted);
  }

  .ri-scroll {
    @apply grid gap-1.5 overflow-y-auto pr-1;
    max-height: min(18rem, 34vh);
    overscroll-behavior: contain;
  }

  .ri-row {
    @apply grid gap-1.5 rounded-md border p-2;
    border-color: var(--border-subtle);
    background: var(--surface-panel);
  }

  .ri-row[role="button"] {
    @apply cursor-pointer;
  }

  .ri-row.is-selected {
    border-color: color-mix(in srgb, var(--accent-primary) 62%, var(--border-subtle));
    background: color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel));
  }

  .ri-row.is-static {
    opacity: 0.82;
  }

  .ri-row-head {
    @apply grid gap-0.5;
  }

  .ri-row-head strong {
    @apply truncate text-[0.72rem] font-semibold;
  }

  .ri-select-button {
    @apply flex min-w-0 items-center gap-1.5 text-left;
    color: var(--text-primary);
  }

  .ri-select-button > span {
    @apply h-1.5 w-1.5 shrink-0 rounded-full border;
    border-color: var(--border-subtle);
    background: transparent;
  }

  .ri-select-button[aria-pressed="true"] > span {
    border-color: var(--accent-primary);
    background: var(--accent-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 18%, transparent);
  }

  .ri-select-button:hover strong {
    color: var(--accent-primary);
  }

  .ri-row-head span {
    @apply text-[0.52rem] uppercase tracking-[0.12em];
    color: var(--text-faint);
  }

  .ri-values {
    @apply grid grid-cols-2 gap-1.5;
  }

  .runtime-error {
    @apply rounded-md border px-3 py-2 text-xs;
    @apply border-rose-300/30;
    color: var(--text-primary);
    background: color-mix(in srgb, #9f1239 14%, var(--surface-panel));
  }

  .compatible-connectors {
    @apply mx-auto mt-6 grid max-w-6xl gap-3 rounded-md border p-4;
    border-color: var(--border-subtle);
    background: var(--surface-panel);
  }

  .compatible-heading {
    @apply flex items-end justify-between gap-3;
  }

  .compatible-heading p {
    @apply m-0;
  }

  .compatible-heading span {
    @apply text-xs;
    color: var(--text-muted);
  }

  .compatible-connectors :global(.social-feed) {
    max-height: none;
    overflow-y: visible;
  }

  @media (max-width: 900px) {
    .world-project {
      @apply grid-cols-1;
    }

    .world-renderer-panel {
      max-width: min(100%, 82vh);
    }
  }
</style>
