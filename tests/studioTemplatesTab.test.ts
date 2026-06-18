import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStudioSource = (): string =>
  readFileSync(resolve(process.cwd(), "src/routes/studio/+page.svelte"), "utf8");

describe("Studio left panel templates removal", () => {
  it("does not expose Templates as a Studio left-panel source", () => {
    const source = readStudioSource();

    expect(source).toContain('type ExplorerSource = "network" | "toolbox" | "plugins";');
    expect(source).not.toContain('explorerSource === "templates"');
    expect(source).not.toContain('explorerSource = "templates"');
    expect(source).not.toContain('<div class="templates-panel">');
    expect(source).not.toContain("insertStudioPluginTemplate");
  });

  it("keeps library kind tabs scoped to Network and Toolbox", () => {
    const source = readStudioSource();

    expect(source).toContain('{#if explorerSource === "network" || explorerSource === "toolbox"}');
  });

  it("keeps plugins available from the installed plugin registry", () => {
    const source = readStudioSource();

    expect(source).toContain(
      "const allStudioPlugins = $derived.by<StudioPluginDescriptor[]>(() => [",
    );
    expect(source).toContain("...listStudioPlugins(),");
    expect(source).toContain("...listStudioWorldPlugins(studioBackendWorlds),");
    expect(source).toContain("const result = await loadWorldRegistry({");
    expect(source).toContain('surface: "studio-plugin"');
    expect(source).toContain("includeFirstParty: false");
    expect(source).toContain("{#each allStudioPlugins as plugin (plugin.id)}");
    expect(source).toContain("const addStandaloneStudioPlugin = (");
    expect(source).toContain("const addStudioPluginToFlow = (");
    expect(source).toContain("addStandaloneStudioPlugin(plugin, options);");
  });

  it("does not expose plugin template catalog data to assistant context", () => {
    const source = readStudioSource();

    expect(source).not.toContain("plugin_templates: Array<{");
    expect(source).not.toContain("plugin_templates: listStudioPluginTemplates()");
    expect(source).not.toContain("archetype_connectors: template.archetypeConnectors");
    expect(source).not.toContain("slot_connectors: template.slotConnectors");
  });
});
