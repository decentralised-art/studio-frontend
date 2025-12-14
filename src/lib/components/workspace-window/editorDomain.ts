/* editorDomain.ts
 * Pure domain model. No Svelte, no IO.
 */

export type SolidityDomain = "transformation" | "condition";

/** Nominal IDs (no casts) */
export type FeatureId = { readonly kind: "FeatureId"; readonly value: string };
export type TransformationId = { readonly kind: "TransformationId"; readonly value: string };
export type ConditionId = { readonly kind: "ConditionId"; readonly value: string };

export type FlowSelection =
  | { readonly kind: "none" }
  | { readonly kind: "feature"; readonly id: FeatureId }
  | { readonly kind: "transformation"; readonly id: TransformationId }
  | { readonly kind: "condition"; readonly id: ConditionId };

export type SoliditySelectionTx =
  | { readonly kind: "none" }
  | { readonly kind: "transformation"; readonly id: TransformationId };

export type SoliditySelectionCond =
  | { readonly kind: "none" }
  | { readonly kind: "condition"; readonly id: ConditionId };

/** Single source of truth */
export type EditorState =
  | {
      readonly kind: "flow";
      readonly lastSolidityDomain: SolidityDomain;
      readonly selection: FlowSelection;
    }
  | {
      readonly kind: "solidity";
      readonly lastSolidityDomain: SolidityDomain;
      readonly domain: "transformation";
      readonly selection: SoliditySelectionTx;
    }
  | {
      readonly kind: "solidity";
      readonly lastSolidityDomain: SolidityDomain;
      readonly domain: "condition";
      readonly selection: SoliditySelectionCond;
    };

export type TopBarState = {
  readonly mode: "flow" | "solidity";
  /** in flow: last used solidity domain; in solidity: current domain */
  readonly solidityDomain: SolidityDomain;
  /** normalized for display (flow selection shape) */
  readonly selection: FlowSelection;
};

/** Useful constants */
export const FLOW_NONE: FlowSelection = { kind: "none" };
export const TX_NONE: SoliditySelectionTx = { kind: "none" };
export const COND_NONE: SoliditySelectionCond = { kind: "none" };
