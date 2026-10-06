<script lang="ts">
  import { onMount, tick } from "svelte";

  export type WorkshopLesson =
    | "draft"
    | "selection"
    | "formats"
    | "publish"
    | "conditions"
    | "custom-elements";
  type State = {
    tabId: string;
    rootId: string;
    rootName: string;
    pitchId: string;
    selectedId: string | null;
    panel: string;
    inspectorTab: string;
    apiView: string;
    rootStart: number;
    rootShift: number;
    pitchStart: number;
    pitchShift: number;
    pitchLocked: boolean;
    addArgs: number[] | null;
    dimensionCount: number;
    linked: boolean;
    signedIn: boolean;
    local: boolean;
    published: boolean;
    ready: boolean;
    busy: boolean;
    samples: number;
    values: unknown[];
    resultAt: number | null;
    runMode: string | null;
    explorerSource: string;
    error: string | null;
    transformationEditorOpen: boolean;
    transformationEditorDimension: boolean;
    transformationCode: string;
    customTransformationAttached: boolean;
    conditionEditorOpen: boolean;
    conditionEditorRoot: boolean;
    conditionCode: string;
    conditionDraftName: string;
    attachedConditionName: string;
    attachedConditionArgs: number[];
    attachedConditionArgc: number | null;
  };
  const {
    lesson,
    snapshot,
    onclose,
  }: { lesson: WorkshopLesson; snapshot: State; onclose: () => void } = $props();
  let step = $state(0);
  let initialTab = $state("");
  let baseline = $state<number | null>(null);
  let publicationValues = $state<unknown[]>([]);
  let customConditionName = $state("");
  let compact = $state(false);
  let rectangle = $state<{ left: number; top: number; width: number; height: number } | null>(null);
  let position = $state({ left: 16, top: 90 });
  let heading = $state<HTMLHeadingElement>();
  const stride = $derived(lesson === "selection" ? 12 : 2);
  const expected = $derived([60, 60 + stride, 60 + stride * 2, 60 + stride * 3]);
  const rootSelected = $derived(
    snapshot.selectedId === snapshot.rootId &&
      snapshot.panel === "inspector" &&
      snapshot.inspectorTab === "node",
  );
  const pitchSelected = $derived(
    snapshot.selectedId === snapshot.pitchId &&
      snapshot.panel === "inspector" &&
      snapshot.inspectorTab === "node",
  );
  const rootStartNeedsReset = $derived(snapshot.rootStart !== 0 || snapshot.rootShift !== 0);
  function inspectorTarget(connector: "root" | "pitch", section: string) {
    const id = connector === "root" ? snapshot.rootId : snapshot.pitchId;
    if (snapshot.selectedId !== id) return connector;
    if (snapshot.panel !== "inspector") return '[aria-label="Toggle inspector panel"]';
    if (snapshot.inspectorTab !== "node") return '[data-tutorial="inspector-node"]';
    return section;
  }
  const settingsOK = $derived(
    snapshot.dimensionCount === 1 &&
      snapshot.linked &&
      snapshot.addArgs?.length === 1 &&
      snapshot.addArgs[0] === stride &&
      snapshot.rootStart === 0 &&
      snapshot.rootShift === 0 &&
      snapshot.pitchStart === 60 &&
      snapshot.pitchShift === 0 &&
      snapshot.pitchLocked,
  );
  const matched = $derived(
    snapshot.resultAt !== null &&
      snapshot.resultAt !== baseline &&
      !snapshot.busy &&
      snapshot.runMode === "simulate" &&
      snapshot.values.length === 4 &&
      snapshot.values.every((value, index) => String(value) === String(expected[index])),
  );
  const executed = $derived(
    snapshot.resultAt !== null &&
      snapshot.resultAt !== baseline &&
      !snapshot.busy &&
      snapshot.runMode === "execute" &&
      snapshot.values.length === 4 &&
      snapshot.values.every((value, index) => String(value) === String(publicationValues[index])),
  );
  const conditionExecuted = $derived(
    snapshot.rootName === "tutorial_threshold_pass_v1" &&
      snapshot.published &&
      snapshot.resultAt !== null &&
      snapshot.resultAt !== baseline &&
      !snapshot.busy &&
      snapshot.runMode === "execute" &&
      snapshot.values.length === 4 &&
      snapshot.values.every((value, index) => String(value) === String([60, 62, 64, 66][index])),
  );
  const validName = $derived(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(snapshot.rootName) && !/^untitled/i.test(snapshot.rootName),
  );
  const customExpected = [60, 61, 62, 63, 60, 61];
  const customMatched = $derived(
    snapshot.resultAt !== null &&
      snapshot.resultAt !== baseline &&
      !snapshot.busy &&
      snapshot.runMode === "simulate" &&
      snapshot.values.length === 6 &&
      snapshot.values.every((value, index) => String(value) === String(customExpected[index])),
  );
  $effect(() => {
    if (lesson === "custom-elements" && snapshot.conditionEditorOpen) {
      customConditionName =
        snapshot.conditionCode.replace(/\s/g, "") === "returnargs[0]>=args[1];"
          ? snapshot.conditionDraftName
          : "";
    }
  });
  const steps = $derived(
    lesson === "custom-elements"
      ? [
          {
            title: "Sign in to create your rules",
            text: "Use Login with MetaMask, then Proceed to login. These are local drafts: no Sepolia ETH or blockchain transaction is needed. Sign in before starting your new graph.",
            target: ".wallet-auth",
            done: snapshot.signedIn,
          },
          {
            title: "Start a new connector",
            text: "Click + in the connector tab strip. We’ll build a new selection using your own transformation and condition.",
            target: '[aria-label="Create new connector tab"]',
            done:
              snapshot.tabId !== initialTab &&
              !!snapshot.rootId &&
              !snapshot.local &&
              !snapshot.published,
          },
          {
            title: "Name your experiment",
            text: "Select the new root on the canvas. In Inspector → Node, set Name to a unique name such as tutorial_yourname_cycle and press Enter.",
            target: "#node-name",
            done: rootSelected && validName,
          },
          {
            title: "Reference shared pitch",
            text: "In Published → Connectors, add pitch to the flow. Connect your root’s D1 bottom outlet to pitch’s top inlet. Keep the root at Start 0, Shift 0.",
            target: ".left-panel",
            done:
              snapshot.linked &&
              snapshot.dimensionCount === 1 &&
              snapshot.rootStart === 0 &&
              snapshot.rootShift === 0,
          },
          {
            title: "Open the transformation editor",
            text: "Click D1 in your new root to select its dimension. Choose Transformations → New transformation in Add element. The editor should say the new rule will attach to the selected dimension.",
            target: '[aria-label="New Transformation"]',
            done:
              (snapshot.transformationEditorOpen && snapshot.transformationEditorDimension) ||
              snapshot.customTransformationAttached,
          },
          {
            title: "Write a four-value loop",
            text: "Click Generate test name. In the lower, editable Solidity pane, replace the body with: return (x + 1) % 4; Then click Create locally. It has no arguments and chooses indexes 0, 1, 2, 3, then starts again.",
            target: '[data-tutorial="transformation-editor"] .editor-shell',
            done:
              snapshot.customTransformationAttached &&
              snapshot.transformationCode.replace(/\s/g, "") === "return(x+1)%4;",
          },
          {
            title: "Open the condition editor",
            text: "Select the root connector again. Choose Conditions → New condition in Add element. This condition belongs on the root, so it is checked before your selector runs.",
            target: '[aria-label="New Condition"]',
            done:
              (snapshot.conditionEditorOpen && snapshot.conditionEditorRoot) ||
              (!!customConditionName && snapshot.attachedConditionName === customConditionName),
          },
          {
            title: "Write a threshold check",
            text: "Click Generate test name. Replace the lower Solidity body with: return args[0] >= args[1]; Then click Create locally. This condition takes two fixed arguments: a value and a minimum.",
            target: '[data-tutorial="condition-editor"] .editor-shell',
            done:
              !!customConditionName &&
              snapshot.attachedConditionName === customConditionName &&
              snapshot.attachedConditionArgc === 2,
          },
          {
            title: "Choose arguments that pass",
            text: "Select your root and open Inspector → Node. Under Condition arguments, set Args to 12, 10. The condition will compare 12 with 10; it does not inspect the generated pitch values.",
            target: '[data-tutorial="condition-settings"]',
            done:
              rootSelected &&
              snapshot.attachedConditionArgs.length === 2 &&
              snapshot.attachedConditionArgs[0] === 12 &&
              snapshot.attachedConditionArgs[1] === 10,
          },
          {
            title: "Set the referenced stream to 60",
            text: "Select referenced pitch on the canvas. In Inspector → Node, set Start to 60, leave Shift 0, then switch its running instance to static. Your selector’s indexes 0–3 will now choose pitch values 60–63.",
            target: '[data-tutorial="running-settings"]',
            done: snapshot.pitchStart === 60 && snapshot.pitchShift === 0 && snapshot.pitchLocked,
          },
          {
            title: "Save the connector",
            text: "Open Run + Publish with the play button. Set N to 6, then click Create locally. This saves the connector using your two new local elements, without publishing any of them.",
            target: '[data-tutorial="create"]',
            done: snapshot.local && snapshot.samples === 6,
          },
          {
            title: "Run the allowed example",
            text: "Click Simulate. The threshold should pass because 12 ≥ 10; the loop should return 60, 61, 62, 63, 60, 61. The guide checks the actual returned values before continuing.",
            target: '[data-tutorial="simulate"]',
            done: customMatched,
          },
          {
            title: "Your custom rules work together",
            text: "Keep the three saved names. Return to the Tutorial to make a second connector with condition arguments 8, 10 and see a rejected run. To share these rules on Sepolia, publish the transformation and condition before the connector.",
            target: '[data-tutorial="simulate"]',
            done: true,
          },
        ]
      : lesson === "draft" || lesson === "selection"
        ? [
            {
              title: "Sign in to save your draft",
              text: "Use Login with MetaMask in the page header, then Proceed to login. Unlock the extension and approve the message signature. Saving and simulation need no test ETH. If you’re already signed in, continue.",
              target: ".wallet-auth",
              done: snapshot.signedIn,
            },
            {
              title: "Start a new connector",
              text: "Click + in the connector tab strip. You’ll build your own selection without changing published pitch. This walkthrough will save a real draft only when you click Create locally.",
              target: '[aria-label="Create new connector tab"]',
              done:
                snapshot.tabId !== initialTab &&
                !!snapshot.rootId &&
                !snapshot.local &&
                !snapshot.published,
            },
            {
              title: "Give your connector a name",
              text:
                "Select the new root on the canvas and open the Inspector (information button), on its Node tab. Set Name to a unique name such as tutorial_yourname_step" +
                stride +
                " and press Enter. Use letters, digits and underscores; begin with a letter or underscore.",
              target: "#node-name",
              done: rootSelected && validName,
            },
            {
              title: "Connect your selection to pitch",
              text: "In Add element, choose Published → Connectors. Find the connector named pitch and click Add to flow. Draw a connection from your new connector’s bottom D1 outlet to pitch’s top inlet. This connects your selection to the values supplied by pitch.",
              target: ".left-panel",
              done: snapshot.linked && snapshot.dimensionCount === 1,
            },
            {
              title: "Add a selecting rule",
              text: "In Add element, choose Published → Transformations. Find the transformation named add and drag its card onto D1 inside your new connector. This transformation generates the indexes used to choose values from pitch.",
              target: ".left-panel",
              done: !!snapshot.addArgs,
            },
            {
              title: rootSelected
                ? "Choose every " + (stride === 2 ? "second" : "twelfth") + " value"
                : snapshot.selectedId !== snapshot.rootId
                  ? "Select your new connector"
                  : "Open its Node Inspector",
              text: rootSelected
                ? "In the Inspector for “" +
                  snapshot.rootName +
                  "”, under Connector dimensions, change the add transformation’s argument to " +
                  stride +
                  ". Keep this connector at Start 0, Shift 0. Its indexes will be 0, " +
                  stride +
                  ", " +
                  stride * 2 +
                  ", " +
                  stride * 3 +
                  "."
                : "Click your newly created connector, “" +
                  snapshot.rootName +
                  "”, on the canvas. This is what we mean by the root connector. Open the Inspector with the information button and choose its Node tab to edit the selecting rule.",
              target: inspectorTarget("root", '[data-tutorial="dimension-settings"]'),
              done:
                rootSelected &&
                snapshot.addArgs?.length === 1 &&
                snapshot.addArgs[0] === stride &&
                snapshot.rootStart === 0 &&
                snapshot.rootShift === 0,
            },
            {
              title: rootStartNeedsReset
                ? "Reset your selection’s starting point"
                : pitchSelected
                  ? "Fix pitch’s starting point"
                  : "Select the referenced pitch connector",
              text: rootStartNeedsReset
                ? "Your connector, “" +
                  snapshot.rootName +
                  "”, must choose indexes starting at 0. Select it and open Inspector → Node. In Running instance, click static to unlock the fields if needed, then set Start 0 and Shift 0. Leave it open. We’ll set the referenced pitch to 60 next."
                : pitchSelected
                  ? "In pitch’s Running instance, set Start to 60 and Shift to 0. Then click open so it changes to static. This fixes the starting point of the pitch reference in “" +
                    snapshot.rootName +
                    "”; the published pitch definition stays unchanged."
                  : "Click the connector named pitch below “" +
                    snapshot.rootName +
                    "” on the canvas, then open Inspector → Node. Pitch is the shared source whose values your new connector selects. We’ll set this reference’s starting point to 60.",
              target: inspectorTarget(
                rootStartNeedsReset ? "root" : "pitch",
                '[data-tutorial="running-settings"]',
              ),
              done: pitchSelected && settingsOK,
            },
            {
              title: "Save four values to test",
              text: "Open Run + Publish (play button), set N to 4 and click Create locally. Approve the chain-account message signature if asked. Wait for Created locally before continuing. A reserved name needs a new name; an authentication failure needs a fresh sign-in.",
              target: '[data-tutorial="create"]',
              done:
                snapshot.local &&
                snapshot.samples === 4 &&
                snapshot.panel === "runner" &&
                !snapshot.busy,
            },
            {
              title: "Simulate your saved draft",
              text:
                "Click Simulate. Expect " +
                expected.join(", ") +
                ". This tests your saved definition on the simulation server; Execute on the Network is for published connectors.",
              target: '[data-tutorial="simulate"]',
              done: matched,
            },
            {
              title: "Your selection is saved and tested",
              text:
                "You got " +
                expected.join(", ") +
                " through the pitch reference. Keep the saved name: " +
                snapshot.rootName +
                ". Return to the Tutorial tab to compare another selection or see how a World reads it. A saved definition cannot be overwritten; further edits need a new name.",
              target: ".runner-output",
              done: matched,
            },
          ]
        : lesson === "publish"
          ? [
              {
                title: "Open your saved draft",
                text: "Sign in as the draft’s owner. In Add element, choose Local → Connectors, then Open in Studio for your tutorial draft. You can also select its existing tab. This guide never signs or sends a transaction for you.",
                target: ".left-panel",
                done: snapshot.local || snapshot.published,
              },
              {
                title: "Check it before publication",
                text: "Open Run + Publish, set N to 4 and click Simulate. Check that these are the values you intend to share. Publication keeps the saved definition permanently.",
                target: '[data-tutorial="simulate"]',
                done:
                  snapshot.panel === "runner" &&
                  snapshot.samples === 4 &&
                  snapshot.resultAt !== null &&
                  snapshot.resultAt !== baseline &&
                  snapshot.runMode === "simulate" &&
                  !snapshot.busy &&
                  snapshot.values.length === 4,
              },
              {
                title: "Publish when you choose",
                text: "Switch MetaMask to Sepolia and use this draft’s owner account with test ETH for gas. Click Publish to the Network, review the wallet’s transaction and fee, then approve only if you want to publish. Wait for the published address. If a transaction is pending, keep its hash and wait; don’t send a second one.",
                target: '[data-tutorial="publish"]',
                done: snapshot.published && !snapshot.busy,
              },
              {
                title: "Read it from the network",
                text: "Click Execute on the Network. If the API’s execution block hasn’t reached your publication yet, wait and retry this read. Discovery can also lag. Publication does not need to be repeated.",
                target: '[data-tutorial="execute"]',
                done: executed,
              },
              {
                title: "Share the name and check the block",
                text:
                  "The network returned four values. Compare them with your simulation and keep the execution block number and hash from the output. Share the connector name: " +
                  snapshot.rootName +
                  ".",
                target: ".runner-output",
                done: executed,
              },
            ]
          : lesson === "formats"
            ? [
                {
                  title: "Select the shared connector",
                  text: "Click pitch on the canvas. We’ll inspect what it supplies before choosing a World. This exercise needs no wallet.",
                  target: "root",
                  done: snapshot.rootName === "pitch" && snapshot.selectedId === snapshot.rootId,
                },
                {
                  title: "Open the API view",
                  text: "Open the Inspector with the information button, then select its API tab. This view describes the real connector on your canvas.",
                  target: '[data-tutorial="inspector-api"]',
                  done: snapshot.panel === "inspector" && snapshot.inspectorTab === "api",
                },
                {
                  title: "Read the reference tree",
                  text: "Choose Protocol JSON. Find pitch’s one dimension and add with argument 1. A selector that references pitch keeps that terminal label; it does not create time, duration or velocity streams. Our pitch-only draft therefore lacks three properties the MIDI World needs.",
                  target: '[data-tutorial="protocol-json"]',
                  done:
                    snapshot.panel === "inspector" &&
                    snapshot.inspectorTab === "api" &&
                    snapshot.apiView === "protocol",
                },
                {
                  title: "See which Worlds can use it",
                  text: "In Add element, click Worlds. Look at Format hash and the compatibility information on each World card. A pitch-only connector cannot supply all four properties the MIDI World needs. The World’s requirements tell you what to add.",
                  target: ".left-panel",
                  done: snapshot.explorerSource === "plugins",
                },
                {
                  title: "Choose a World that understands the output",
                  text: "Return to the Tutorial tab and try its musical score and painting previews. A World supplies the meaning of numbers. Read its required properties, units and grouping before building a contribution for it.",
                  target: '[data-tutorial="json-views"]',
                  done: true,
                },
              ]
            : [
                {
                  title: "Select the published threshold example",
                  text: "Click tutorial_threshold_pass_v1 at the top of the canvas. This published connector has a real condition and uses the same add 2 selection you tried earlier. No sign-in, test ETH or transaction is needed to run it.",
                  target: "root",
                  done:
                    snapshot.rootName === "tutorial_threshold_pass_v1" &&
                    snapshot.published &&
                    snapshot.selectedId === snapshot.rootId,
                },
                {
                  title: "Check the two fixed arguments",
                  text: "Open Inspector → Node and find Condition arguments. The attached rule is tutorial_threshold_v1. Its Args are 12, 10: the supplied number and its minimum. Since 12 ≥ 10, this check should allow the run. These saved arguments cannot be changed here.",
                  target: '[data-tutorial="condition-settings"]',
                  done:
                    rootSelected &&
                    snapshot.attachedConditionName === "tutorial_threshold_v1" &&
                    snapshot.attachedConditionArgs.length === 2 &&
                    snapshot.attachedConditionArgs[0] === 12 &&
                    snapshot.attachedConditionArgs[1] === 10,
                },
                {
                  title: "Ask for four values",
                  text: "Open Run + Publish with the play button. Set N to 4. If the condition passes, the saved add 2 selection should return pitch values 60, 62, 64, 66.",
                  target: "#run-samples-panel",
                  done: snapshot.panel === "runner" && snapshot.samples === 4,
                },
                {
                  title: "Run the allowed connector",
                  text: "Click Execute on the Network. The condition is checked during this public read; it sends no cryptocurrency. The guide waits for a fresh network result with all four expected pitch values.",
                  target: '[data-tutorial="execute"]',
                  done: conditionExecuted,
                },
                {
                  title: "The condition allowed this run",
                  text: "Look for 60, 62, 64, 66 and the execution block number and hash in the output. The check allowed the selection because 12 meets the minimum of 10. Return to the Tutorial and open its 8 < 10 example to try a rejected run, or compare the divisibility examples.",
                  target: ".runner-output",
                  done: conditionExecuted,
                },
              ],
  );
  const current = $derived(steps[step]);
  const targetSelector = $derived(current.target);
  function target() {
    if (compact) return null;
    if (current.target === "root" || current.target === "pitch")
      return document.querySelector(
        '.svelte-flow__node[data-id="' +
          CSS.escape(current.target === "root" ? snapshot.rootId : snapshot.pitchId) +
          '"]',
      );
    return (
      document.querySelector(current.target) ??
      document.querySelector('[aria-label="Toggle inspector panel"]')
    );
  }
  function locate() {
    if (document.hidden) return;
    compact = window.innerWidth < 1024;
    const rect = target()?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) {
      rectangle = null;
      position = { left: Math.max(12, (window.innerWidth - 340) / 2), top: 90 };
      return;
    }
    // Only visible parts of long, scrollable panels need a highlight.
    const top = Math.max(70, rect.top);
    rectangle = {
      left: rect.left - 4,
      top: top - 4,
      width: rect.width + 8,
      height: Math.max(0, Math.min(rect.bottom, window.innerHeight - 12) - top) + 8,
    };
    const width = Math.min(340, window.innerWidth - 24);
    position = {
      left: Math.max(
        12,
        rect.left >= width + 28
          ? rect.left - width - 18
          : Math.min(rect.right + 18, window.innerWidth - width - 12),
      ),
      top: Math.min(Math.max(76, top - 10), Math.max(76, window.innerHeight - 390)),
    };
  }
  async function move(next: number) {
    if (next > step && !current.done) return;
    if (lesson === "publish" && next === 2) publicationValues = [...snapshot.values];
    step = next;
    if (
      (lesson === "draft" || lesson === "selection" || lesson === "custom-elements") &&
      next === 1
    )
      initialTab = snapshot.tabId;
    if (
      (lesson === "publish" && (next === 1 || next === 3)) ||
      (lesson === "conditions" && next === 3) ||
      ((lesson === "draft" || lesson === "selection") && next === 8) ||
      (lesson === "custom-elements" && next === 11)
    )
      baseline = snapshot.resultAt;
    await tick();
    target()?.scrollIntoView({ block: "nearest", inline: "nearest" });
    locate();
    heading?.focus({ preventScroll: true });
  }
  $effect(() => {
    const selector = targetSelector;
    void tick().then(() => {
      if (selector !== targetSelector) return;
      target()?.scrollIntoView({ block: "nearest", inline: "nearest" });
      locate();
    });
  });
  onMount(() => {
    initialTab = snapshot.tabId;
    baseline = snapshot.resultAt;
    locate();
    const timer = window.setInterval(locate, 300);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onclose();
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
    };
  });
</script>

{#if rectangle}
  <div
    class="guide-highlight"
    aria-hidden="true"
    style:left={rectangle.left + "px"}
    style:top={rectangle.top + "px"}
    style:width={rectangle.width + "px"}
    style:height={rectangle.height + "px"}
  ></div>
{/if}
<aside
  class="studio-guide"
  role="region"
  aria-label="Studio guided tutorial"
  style:left={position.left + "px"}
  style:top={position.top + "px"}
>
  <div class="guide-meta">
    <span>Tutorial · {step + 1} of {steps.length}</span>
    <button type="button" aria-label="Close guided tutorial" onclick={onclose}>×</button>
  </div>
  {#if compact}
    <h2>Give the Studio a little more room</h2>
    <p>
      Widen this window or use a laptop or desktop to work with the canvas and Inspector together.
    </p>
  {:else}
    <div aria-live="polite" aria-atomic="true">
      <h2 tabindex="-1" bind:this={heading}>{current.title}</h2>
      <p>{current.text}</p>
    </div>
    {#if !snapshot.ready}
      <p class="guide-notice">
        Waiting for Studio to finish loading. If the network library fails, use Refresh network
        library and retry.
      </p>
    {:else if snapshot.busy}
      <p class="guide-notice" role="status">Working… wait for the request to finish.</p>
    {:else if lesson === "publish" && step === 3 && snapshot.resultAt !== baseline && !executed && !snapshot.error}
      <p class="guide-notice" role="status">
        This run doesn’t match your simulation yet. Keep the same saved name, check N 4 and retry
        the network read.
      </p>
    {:else if lesson === "conditions" && step === 3 && snapshot.resultAt !== baseline && !conditionExecuted && !snapshot.error}
      <p class="guide-notice" role="status">
        This result hasn’t matched yet. Check the opened connector’s name, set N to 4 and retry
        Execute on the Network.
      </p>
    {:else if snapshot.error}
      <p class="guide-notice" role="status">
        {snapshot.error} Read the panel’s message before retrying.
      </p>
    {:else if (lesson === "draft" || lesson === "selection") && step === 6 && !current.done}
      <p class="guide-notice" role="status">
        {#if !snapshot.linked}
          Connect your new connector’s D1 outlet to pitch before fixing its starting point.
        {:else if rootStartNeedsReset}
          “{snapshot.rootName}” is currently at Start {snapshot.rootStart}, Shift {snapshot.rootShift}.
          Restore Start 0 and Shift 0 on this connector.
        {:else if !pitchSelected}
          This edit belongs to the referenced pitch connector. Select pitch and open Inspector →
          Node.
        {:else if snapshot.pitchStart !== 60 || snapshot.pitchShift !== 0}
          Referenced pitch is currently at Start {snapshot.pitchStart}, Shift {snapshot.pitchShift}.
          Set it to Start 60, Shift 0.
        {:else if !snapshot.pitchLocked}
          Start 60 and Shift 0 are set. Click the open button so it changes to static.
        {:else if !settingsOK}
          Pitch’s settings are fixed. Check your new connector: one dimension, add with argument
          {stride}, Start 0 and Shift 0.
        {:else}
          The settings are ready. Select the referenced pitch and open Inspector → Node to continue.
        {/if}
      </p>
    {:else if (lesson === "draft" || lesson === "selection") && step === 8 && snapshot.resultAt !== baseline && !matched}
      <p class="guide-notice" role="status">
        The output hasn’t matched yet. Check N 4 and your saved settings. If creation saved the
        wrong definition, start a corrected draft with a new name.
      </p>
    {:else if lesson === "custom-elements" && step === 11 && snapshot.resultAt !== baseline && !customMatched}
      <p class="guide-notice" role="status">
        The output hasn’t matched yet. Check N 6, the loop, fixed pitch Start 60, and condition
        arguments 12, 10. Corrected saved definitions need a new name.
      </p>
    {/if}
    <div class="guide-actions">
      {#if step > 0}<button type="button" onclick={() => move(step - 1)}>Back</button>{/if}
      {#if step === steps.length - 1}
        <button class="guide-next" type="button" onclick={onclose}>Finish walkthrough</button>
      {:else}
        <button
          class="guide-next"
          type="button"
          disabled={!snapshot.ready || !current.done || snapshot.busy}
          onclick={() => move(step + 1)}>Next</button
        >
      {/if}
    </div>
  {/if}
  <p class="guide-footnote">You’re using the real Studio controls. Close the guide at any time.</p>
</aside>

<style>
  .guide-highlight {
    position: fixed;
    pointer-events: none;
    z-index: 10000;
    border: 2px solid #50e1c4;
    border-radius: 8px;
    box-shadow:
      0 0 0 4px #50e1c428,
      0 0 28px #50e1c43d;
  }
  .studio-guide {
    position: fixed;
    z-index: 10001;
    width: min(340px, calc(100vw - 24px));
    padding: 1.1rem;
    border: 1px solid #50e1c4;
    border-radius: 1rem;
    background: linear-gradient(140deg, #203d3b, #15282d);
    color: #f0fffa !important;
    box-shadow: 0 16px 50px #0005;
    font:
      14px/1.6 system-ui,
      sans-serif;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }
  .guide-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    color: #abdfd0;
    font-size: 11px;
    letter-spacing: 0.04em;
  }
  .studio-guide button {
    padding: 0.4rem 0.7rem;
    border: 1px solid #638b83 !important;
    border-radius: 0.4rem;
    background: transparent !important;
    color: #f0fffa !important;
    cursor: pointer;
    font: inherit;
  }
  .guide-meta button {
    font-size: 22px;
    line-height: 1;
    padding: 0.2rem 0.5rem;
  }
  .studio-guide h2 {
    margin: 0.7rem 0 0.5rem;
    color: #f0fffa !important;
    font-size: 19px;
    line-height: 1.3;
  }
  .studio-guide p {
    margin: 0.5rem 0;
    color: #d2e6e0 !important;
  }
  .guide-notice {
    border-left: 2px solid #f7cc80;
    padding-left: 0.7rem;
    font-size: 12px;
  }
  .guide-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  .studio-guide .guide-next {
    background: #50e1c4 !important;
    color: #102925 !important;
    border-color: #50e1c4 !important;
    font-weight: 600;
  }
  .studio-guide button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .studio-guide button:focus-visible {
    outline: 2px solid #f7cc80;
    outline-offset: 3px;
  }
  .studio-guide .guide-footnote {
    margin-bottom: 0;
    font-size: 11px;
    color: #abdfd0 !important;
  }
  @media (max-width: 1023px) {
    .studio-guide {
      top: auto !important;
      left: 12px !important;
      bottom: 12px;
    }
  }
</style>
