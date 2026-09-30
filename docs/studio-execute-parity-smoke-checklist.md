# Studio Execute Parity Smoke Checklist

Last updated: 2026-04-15

Purpose:

- Verify Studio graph projection and execute payload generation match current `chain-backend` behavior.
- Focus on high-risk cases: duplicated connector names and binding-slot disambiguation.

Scope:

- `studio-frontend` Studio UI (`/studio`)
- Chain API `/execute` parity against server debug interface.

## 1. Preconditions

1. Frontend runs in dev mode with chain endpoint configured (proxy-first or explicit env).
2. User can authenticate and open Studio.
3. At least one connector tree on chain includes:
   - repeated connector names in different branches or dimensions,
   - at least one binding relation with explicit slot.
4. Open Inspector -> API tab (to access execute request preview).

## 2. Scenario A: Duplicate Composite Name Projection

Goal:

- Confirm two same-named connectors in different dimensions map to different RI positions.

Steps:

1. Open a draft tab (new connector root).
2. Add two references with the same connector name under different dimensions of the same parent.
3. Ensure both references are visible as separate nodes in flow.
4. Open Inspector -> API tab and inspect `POST /execute` preview.
5. Run the graph.

Expected:

- No projection warning like `Unable to project RI position ...`.
- Execute preview `dynamic_ri` keys map to distinct positions for each structural branch.
- Run succeeds (or fails for business reasons, but not parser/projection mismatch).

## 3. Scenario B: Duplicate Binding Target Name by Slot

Goal:

- Confirm binding projection picks target by slot+structure, not by name only.

Steps:

1. Use/open a connector where one dimension has multiple binding targets sharing the same connector name.
2. Keep slot metadata distinct (e.g., slot `1` vs slot `4`).
3. Open Inspector -> API tab and verify execute preview.
4. Run graph.

Expected:

- Mapped binding RI position corresponds to correct slot target.
- No misprojection to sibling same-name binding target.
- No `Failed to parse execute request` caused by malformed preview payload.

## 4. Scenario C: RI Mutability Context Guard

Goal:

- Confirm lock-toggle behavior respects context:
  - view-only root tab,
  - referenced on-chain connector in editable draft tab.

Steps:

1. Open on-chain connector tab (view-only).
2. Verify dynamic RI lock toggle cannot be changed where forbidden.
3. Open draft tab and reference same on-chain connector.
4. Verify toggle is available when protocol context permits static materialization.
5. Toggle to static and run/deploy preview.

Expected:

- View-only root context remains non-mutable.
- Editable referenced context allows permitted lock materialization.
- No static override rejection due frontend trying to override immutable self-static nodes.

## 5. Scenario D: Studio vs Server Debug Execute Parity

Goal:

- Confirm exact request body from Studio executes identically in server debug interface.

Steps:

1. In Inspector -> API, click `Copy JSON` in `Execute request preview`.
2. Run from Studio and capture output.
3. Paste copied JSON into server debug `/execute` request body for same connector.
4. Compare response payloads.

Expected:

- Same request shape:
  - `connector_name`
  - `particles_count` (decimal string)
  - `dynamic_ri` (position-keyed object)
- Equivalent result streams (`path/feature_path`, `data`) for same inputs.

### 5.1 Two-Minute Strict Verification Protocol

Use this exact flow to close Scenario D:

1. Open `/studio`, load connector `t0` or `t1` in a tab, set `N` to `12`.
2. Go to `Inspector -> API`.
3. Click `Copy JSON` under `Execute request preview`.
4. Save the copied body as `payload_studio.json`.
5. Click `Run` in Studio and copy the raw response JSON as `response_studio.json`.
6. Open `https://api.decentralised.art/chain/` -> `Execute`.
7. Paste the exact body from `payload_studio.json` and run.
8. Copy raw response JSON as `response_debug.json`.
9. Compare:
   - request body must be byte-identical after whitespace normalization,
   - result array length must match,
   - each item must match by `path` and `data`.

Pass if all comparisons match exactly.

### 5.2 Comparison Rules

- Do not reorder RI keys manually.
- Do not coerce `particles_count` to number; it must stay a decimal string.
- Ignore only whitespace differences.
- Any difference in `path`, `feature_path`, `data`, or stream count is `server_behavior_delta`.

### 5.3 Evidence Template (copy/paste)

```md
Scenario D Evidence

- connector: <name>
- particles_count: <value>
- run timestamp (UTC): <yyyy-mm-ddThh:mm:ssZ>

Request parity:

- studio payload hash: <sha256>
- debug payload hash: <sha256>
- match: <yes/no>

Response parity:

- studio response hash: <sha256>
- debug response hash: <sha256>
- match: <yes/no>

Result:

- status: PASS | FAIL
- failure_category (if FAIL): execute_contract_failure | server_behavior_delta
- notes: <short note>
```

### 5.3.1 Recorded Evidence (2026-04-15)

```md
Scenario D Evidence

- connector: t1
- particles_count: 12
- run timestamp (UTC): 2026-04-15T08:00:00Z

Request parity:

- studio payload hash: n/a (manually verified byte-equivalent JSON content)
- debug payload hash: n/a (same payload pasted into debug Execute)
- match: yes

Response parity:

- studio response hash: n/a (manually compared full payload)
- debug response hash: n/a (manually compared full payload)
- match: yes

Result:

- status: PASS
- failure_category (if FAIL): n/a
- notes: identical stream count, paths, and data arrays between Studio and debug Execute.
```

### 5.4 Hash Commands (optional but recommended)

```bash
cat payload_studio.json | tr -d '\n\r\t ' | shasum -a 256
cat payload_debug.json  | tr -d '\n\r\t ' | shasum -a 256
cat response_studio.json | tr -d '\n\r\t ' | shasum -a 256
cat response_debug.json  | tr -d '\n\r\t ' | shasum -a 256
```

### 5.5 Re-runnable Live Smoke Command

From `studio-frontend`:

```bash
npm run smoke:live
```

## 6. Failure Classification

Use these categories when logging issues:

1. `projection_mismatch`

- Wrong RI position assigned to structurally distinct same-name node.

2. `slot_disambiguation_failure`

- Binding mapped to wrong same-name target despite slot distinction.

3. `mutability_guard_failure`

- UI allows forbidden lock edits, or blocks allowed reference-level lock edits.

4. `execute_contract_failure`

- Request rejected as parse error due invalid payload shape.

5. `server_behavior_delta`

- Same request accepted in one surface and rejected in the other.

## 7. Pass Criteria

All scenarios A-D pass with:

- no projection warnings for valid graphs,
- no execute parse errors from Studio-generated payloads,
- deterministic parity between Studio run and server debug execute response for same request body.
