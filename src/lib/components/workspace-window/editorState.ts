/* editorState.ts
 * Pure reducer + view-model computation.
 */

import type {
  ConditionId,
  EditorState,
  FlowSelection,
  SolidityDomain,
  TopBarState,
  TransformationId,
} from "./editorDomain";
import { COND_NONE, FLOW_NONE, TX_NONE } from "./editorDomain";

export type Action =
  | { readonly kind: "OpenFlow"; readonly selection: FlowSelection }
  | { readonly kind: "OpenSolidityTab"; readonly domain: SolidityDomain } // tab switch only (no id)
  | { readonly kind: "BackToFlow" }
  | { readonly kind: "SelectFlow"; readonly selection: FlowSelection }
  | { readonly kind: "InspectTransformationCode"; readonly id: TransformationId }
  | { readonly kind: "InspectConditionCode"; readonly id: ConditionId }
  | { readonly kind: "SelectSolidityTransformation"; readonly id: TransformationId }
  | { readonly kind: "SelectSolidityCondition"; readonly id: ConditionId };

export function reduceEditorState(state: EditorState, action: Action): EditorState {
  switch (action.kind) {
    case "OpenFlow": {
      return {
        kind: "flow",
        lastSolidityDomain: state.lastSolidityDomain,
        selection: action.selection,
      };
    }

    case "OpenSolidityTab": {
      if (action.domain === "transformation") {
        return {
          kind: "solidity",
          lastSolidityDomain: "transformation",
          domain: "transformation",
          selection: TX_NONE,
        };
      }
      return {
        kind: "solidity",
        lastSolidityDomain: "condition",
        domain: "condition",
        selection: COND_NONE,
      };
    }

    case "InspectTransformationCode": {
      return {
        kind: "solidity",
        lastSolidityDomain: "transformation",
        domain: "transformation",
        selection: { kind: "transformation", id: action.id },
      };
    }

    case "InspectConditionCode": {
      return {
        kind: "solidity",
        lastSolidityDomain: "condition",
        domain: "condition",
        selection: { kind: "condition", id: action.id },
      };
    }

    case "BackToFlow": {
      if (state.kind === "solidity") {
        if (state.domain === "transformation" && state.selection.kind === "transformation") {
          return {
            kind: "flow",
            lastSolidityDomain: state.lastSolidityDomain,
            selection: { kind: "transformation", id: state.selection.id },
          };
        }
        if (state.domain === "condition" && state.selection.kind === "condition") {
          return {
            kind: "flow",
            lastSolidityDomain: state.lastSolidityDomain,
            selection: { kind: "condition", id: state.selection.id },
          };
        }
      }
      return { kind: "flow", lastSolidityDomain: state.lastSolidityDomain, selection: FLOW_NONE };
    }

    case "SelectFlow": {
      if (state.kind !== "flow") return state;
      return { ...state, selection: action.selection };
    }

    case "SelectSolidityTransformation": {
      if (state.kind !== "solidity" || state.domain !== "transformation") return state;
      return { ...state, selection: { kind: "transformation", id: action.id } };
    }

    case "SelectSolidityCondition": {
      if (state.kind !== "solidity" || state.domain !== "condition") return state;
      return { ...state, selection: { kind: "condition", id: action.id } };
    }
  }
}

function normalizeToFlowSelection(state: EditorState): FlowSelection {
  if (state.kind === "flow") return state.selection;

  if (state.kind === "solidity") {
    if (state.domain === "transformation") {
      return state.selection.kind === "transformation"
        ? { kind: "transformation", id: state.selection.id }
        : FLOW_NONE;
    }
    return state.selection.kind === "condition"
      ? { kind: "condition", id: state.selection.id }
      : FLOW_NONE;
  }

  return FLOW_NONE;
}

export function computeTopBarState(state: EditorState): TopBarState | null {
  if (state.kind === "flow") {
    return {
      mode: "flow",
      solidityDomain: state.lastSolidityDomain,
      selection: state.selection,
    };
  }

  return {
    mode: "solidity",
    solidityDomain: state.domain,
    selection: normalizeToFlowSelection(state),
  };
}
