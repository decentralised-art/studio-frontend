import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStudioSource = (): string =>
  readFileSync(resolve(process.cwd(), "src/routes/studio/+page.svelte"), "utf8");

describe("Studio templates tab", () => {
  it("adds Templates as a top-level Studio left-panel source", () => {
    const source = readStudioSource();

    expect(source).toContain(
      'type ExplorerSource = "network" | "toolbox" | "plugins" | "templates";',
    );
    expect(source).toContain(
      'class={`source-tab ${explorerSource === "templates" ? "is-active" : ""}`}',
    );
    expect(source).toContain('{:else if explorerSource === "templates"}');
    expect(source).toContain('<div class="templates-panel">');
  });

  it("keeps library kind tabs scoped to Network and Toolbox", () => {
    const source = readStudioSource();

    expect(source).toContain('{#if explorerSource === "network" || explorerSource === "toolbox"}');
  });

  it("lists plugins and template plugin options from the installed plugin registry", () => {
    const source = readStudioSource();

    expect(source).toContain(
      "const allStudioPlugins = $derived.by<StudioPluginDescriptor[]>(() => listStudioPlugins());",
    );
    expect(source).toContain(
      "const templatePluginOptions = $derived.by<StudioPluginDescriptor[]>(() => allStudioPlugins);",
    );
    expect(source).toContain("{#each allStudioPlugins as plugin (plugin.id)}");
    expect(source).not.toContain("{#each compatibleStudioPlugins as plugin (plugin.id)}");
  });

  it("allows plugins to be inserted without an existing compatible root", () => {
    const source = readStudioSource();

    expect(source).toContain("const addStandaloneStudioPlugin = (");
    expect(source).toContain("const addStudioPluginToFlow = (");
    expect(source).toContain("addStandaloneStudioPlugin(plugin, options);");
    expect(source).toContain("draggable\n                    data-disabled={false}");
  });

  it("fetches template connector archetypes by name before insertion", () => {
    const source = readStudioSource();

    expect(source).toContain("const loadTemplateConnectorDefinitions = async (");
    expect(source).toContain("const getTemplateInsertTitle = (");
    expect(source).toContain('data-status="available"');
    expect(source).toContain("<span>Ready</span>");
    expect(source).toContain(
      "const knownName = resolveKnownTemplateConnectorName(connectorName) ?? connectorName;",
    );
    expect(source).toContain("onclick={() => void insertStudioPluginTemplate(template)}");
    expect(source).not.toContain("const resolveTemplateUnloadedConnectors = (");
    expect(source).not.toContain("fetch-required");
  });

  it("instantiates template connectors from loaded network definitions", () => {
    const source = readStudioSource();

    expect(source).toContain("const createTemplateConnectorNode = ({");
    expect(source).toContain("const definition = deployedRegistry.connectors[connectorName];");
    expect(source).toContain("sourceId: `feature-${connectorName}`,");
    expect(source).toContain("networkId: connectorName,");
    expect(source).toContain("fromNetwork: true,");
    expect(source).toContain("cloneStaticRiMap(definition.staticRi)");
    expect(source).toContain(
      "formatTransformationPreviewLabel(transformation.name, transformation.args)",
    );
    expect(source).not.toContain('sourceId: `template-${slugify(label) || "connector"}`,');
  });

  it("lays out inserted connector templates as dimension-ordered connector trees", () => {
    const source = readStudioSource();

    expect(source).toContain("const buildConnectorTreeLayoutUpdates = ()");
    expect(source).toContain("childrenByConnector.forEach((items) => {");
    expect(source).toContain("return dimA - dimB;");
    expect(source).toContain("const updates = connectorTrees");
    expect(source).toContain("? buildConnectorTreeLayoutUpdates()");
    expect(source).toContain("scheduleLayout({ connectorTrees: true });");
  });

  it("exposes the template catalog to the Studio assistant runtime context", () => {
    const source = readStudioSource();

    expect(source).toContain("plugin_templates: Array<{");
    expect(source).toContain("plugin_templates: listStudioPluginTemplates().map((template) => ({");
    expect(source).toContain("archetype_connectors: template.archetypeConnectors");
    expect(source).toContain("slot_connectors: template.slotConnectors");
    expect(source).toContain("editable_draft: true");
  });
});
