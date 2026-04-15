# Studio Corpus Authoring Checklist

Last updated: 2026-04-15

## Purpose

Provide a repeatable, deploy-oriented workflow for publishing reusable DCN corpus elements
(transformations, conditions, connectors) from Studio.

## Scope

- `hypermusic-frontend` Studio authoring UX
- Deploy + execute flow parity with current `dcn-server` contract
- Toolbox-first reuse loop

## Preconditions

1. User authenticated in Studio (prototype login or connected account flow).
2. Chain sync completed at least once in the session.
3. Active tab is an in-progress connector tab (not `Network (view-only)`).

## Publish Workflow (Transformation/Condition First)

1. Select connector context.

- Select the target connector or a target dimension in canvas.
- This scopes where newly published elements are attached after publish.

2. Publish transformation.

- Open `Publish transformation` (left panel or runner checklist action).
- Provide exact chain-safe name (case-sensitive, no auto-capitalization assumptions).
- Provide Solidity snippet.
- Click `Publish to chain`.
- Confirm deploy trace contains `POST /chain/transformation` success.

3. Publish condition (optional).

- Open `Publish condition`.
- Provide name + Solidity snippet.
- Click `Publish to chain`.
- Confirm deploy trace contains `POST /chain/condition` success.

4. Verify toolbox auto-save.

- Newly published transformation/condition should be auto-added to toolbox.
- Switch left panel source to `Toolbox` and verify visibility.

## Connector Publish Workflow

1. Build connector graph using published elements.

- Attach transformations to dimensions.
- Attach condition if required.
- Set RI mode and values per connector (open/static semantics per protocol context).

2. Preflight request.

- Open `Inspector -> API`.
- Verify `Execute request preview` shape and warnings.

3. Run before deploy.

- Use runner `Run` with target `N`.
- Verify output JSON paths/data are valid.

4. Deploy connector.

- Click `Deploy` in runner.
- Confirm deploy trace success for connector requests.
- Confirm connector appears in network library and can be opened as `Network (view-only)`.

## Quality Gates

1. Naming

- Keep exact intended chain names for connectors/transformations/conditions.

2. Deploy trace fidelity

- Every publish/deploy action must produce endpoint-level request/response entries.

3. Contract fidelity

- Execute payload must use current contract (`connector_name`, `particles_count`, `dynamic_ri`).
- No legacy execute payload variants.

4. Reuse loop

- Newly published elements available in toolbox without manual profile edits.

## Manual Smoke Cases

1. Publish single transformation + attach to selected dimension.
2. Publish single condition + auto-attach to selected connector.
3. Deploy connector referencing published elements.
4. Run deployed connector in Studio and confirm parity with direct `/chain/execute` call.

## Notes

- Published transformations/conditions are immutable; changes require publishing a new name/version.
- Treat `Unpublished` Studio status as pre-deploy working state only.
- For corpus release batches, prefer small, composable elements over large monolithic connectors.
