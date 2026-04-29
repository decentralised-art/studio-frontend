# DCN Event Feed Backend Contract Gaps

This note tracks backend contract improvements that would simplify the frontend event-feed integration.
None of these should block the current frontend migration. The frontend is intentionally written around a
small adapter surface so each backend improvement can become a focused frontend change later.

## Current Frontend Adapter Boundary

Frontend event-feed handling is centralized in these modules:

- `src/lib/chain/eventFeedApi.ts`
  - Raw `/feed` and `/feed/stream` contract parsing.
  - Cursor normalization.
  - SSE frame parsing.
  - Request query construction.
- `src/lib/feed/chainEventFeed.ts`
  - Feed item and stream delta projection into existing network activity shapes.
  - Deduplication by `feed_id`.
  - Status updates and removed-event hiding.
- `src/lib/feed/chainEventHydration.ts`
  - Canonical detail hydration through exact entity endpoints:
    - connector -> `/connector/:name`
    - transformation -> `/transformation/:name`
    - condition -> `/condition/:name`
- `src/lib/feed/particlePostData.ts`
  - Route-facing feed cache, filtering, pagination, stream handling, and detail merge.
- `src/lib/feed/profileActivity.ts`
  - Account and public profile activity filtering by chain owner address.
- `src/lib/studio/studioEventFeedLibrary.ts`
  - Studio Network library discovery from feed metadata.

Routes should not parse backend feed payloads directly. If the backend contract improves, update these
adapter modules and their tests first, then route behavior should mostly inherit the improvement.

## Requested Backend Improvements

| Gap                                                  | Current frontend behavior                                                                             | Why backend support helps                                                                                                  | Future frontend change                                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/feed` should support `owner=<address>`             | Fetches global feed pages, then filters by normalized owner addresses in the frontend.                | Reduces payload size and removes client-side scanning for `/network`, `/account`, `/u/[id]`, and Studio Network discovery. | Add optional `owner` to `getChainFeedPage()` in `eventFeedApi.ts`; pass owners from `particlePostData.ts`, `profileActivity.ts`, and `studioEventFeedLibrary.ts`. |
| Connector feed payload should include `format_hash`  | Hydrates connector details for followed-format filtering and visible connector cards.                 | Allows cheap feed-level filtering by followed formats and avoids unnecessary connector detail fetches.                     | Extend `ChainFeedPayload` normalization in `eventFeedApi.ts`; let `chainEventFeed.ts` project `formatHash` directly; reduce hydration in `particlePostData.ts`.   |
| Runtime feed payload should include `args_count`     | Fetches transformation/condition details and infers arg count from Solidity source when needed.       | Lets search/library metadata show runtime arity without exact detail fetches.                                              | Add optional `argsCount` normalization in `eventFeedApi.ts`; project into runtime search/library records in `chainEventFeed.ts` and Studio library metadata.      |
| Runtime feed payload should include `entity_address` | Runtime event cards currently hydrate exact details for entity address-like metadata if needed later. | Lets cards and Studio library entries link or identify deployed runtime contracts without another request.                 | Add optional `entityAddress` normalization in `eventFeedApi.ts`; expose it from `chainEventHydration.ts`-compatible detail shapes where needed.                   |
| SSE deltas should expose `op`                        | Frontend infers removal from `status === "removed"` and page items also use `visible`.                | Makes stream semantics explicit and less coupled to status naming.                                                         | Add optional `op` to `ChainFeedStreamDelta`; update `chainEventFeed.ts` removal logic to prefer `op` while keeping status compatibility during transition.        |
| `/feed` should allow omitted `limit`                 | Frontend always sends a bounded `limit`.                                                              | Simplifies callers and leaves default page-size policy to the backend.                                                     | Make `limit` optional in `GetChainFeedPageOptions`; keep an explicit frontend limit where UX wants a specific page size.                                          |

## Backend-Compatible Frontend Principles

- The frontend should continue treating `/feed` as discovery/activity metadata, not canonical entity detail.
- Exact entity endpoints remain the canonical detail contract for connectors, transformations, and conditions.
- Services profile data remains the source of truth for follows, toolbox, display names, and avatars.
- Feed payload extensions should be additive. Existing normalized types should accept older payloads while the
  backend rolls forward, unless the backend explicitly announces a breaking version.
- Route code should call adapter helpers instead of reading raw feed fields. This keeps future backend changes
  localized.

## Tests To Update When Backend Adds These Fields

- `tests/eventFeedApi.test.ts`
  - Add raw parsing coverage for new fields and query params.
- `tests/chainEventFeed.test.ts`
  - Assert projection uses feed-level `format_hash`, `args_count`, `entity_address`, and `op` where present.
- `tests/particlePostData.eventFeed.test.ts`
  - Assert followed-format filtering can avoid connector detail hydration when `format_hash` is present.
- `tests/profileActivity.test.ts`
  - Assert owner-filtered feed queries are used for profile activity once `owner` is available.
- `tests/studioEventFeedLibrary.test.ts`
  - Assert Studio Network library passes owner filters and uses feed-level metadata.
- `e2e/app-smoke.spec.ts`
  - Keep route-level assertions that broad feed views do not use `/chain/account`.

## Priority

Recommended backend order:

1. Add `/feed?owner=<address>`.
2. Include `format_hash` in connector feed payloads.
3. Include `args_count` and `entity_address` in runtime feed payloads.
4. Include `op` in SSE deltas.
5. Allow omitted `limit`.

The first two items remove the largest amount of frontend over-fetching. Runtime metadata and explicit stream
operations improve correctness and UI richness. Optional `limit` is convenience-level and lowest priority.
