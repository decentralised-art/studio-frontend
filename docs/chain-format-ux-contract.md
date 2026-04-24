# Chain Format UX Contract

Status: implemented
Scope: frontend only (no backend changes in this step)
Last verified: 2026-04-24

## 1) Canonical route

- On-chain format pages are canonicalized as:
  - `/f/[hash]`
- `hash` means connector `format_hash` (32-byte hex).

## 2) Naming and display

- Chain formats do not have canonical on-chain names.
- Display label is a fallback short hash label:
  - `Format 0x12345678...cdef12`

## 3) Data authority

- Chain format membership is sourced only from:
  - `GET /chain/format/:hash?limit=:n`
  - next pages use `after=:cursor` from `cursor.next_after`
- Connector-level format identity is sourced only from:
  - `GET /chain/connector/:name -> format_hash`

## 4) Local formats vs chain formats

- Local saved formats (existing client-only feature) are kept as non-canonical UX artifacts.
- Local formats do not override on-chain format membership.
- During migration, local and chain formats may coexist in UI, but chain-backed `/f/[hash]` is the source of truth.

## 5) Pagination requirements

- `/chain/format/:hash` requires:
  - `limit`
- Further pages use:
  - `after`
- Cursor fields are resolved from the current backend response:
  - `cursor.has_more`
  - `cursor.next_after`
- The frontend still accepts legacy flat cursor fields for compatibility:
  - `has_more`
  - `next_after`
- Frontend must support full pagination to fetch complete connector membership sets.

## 6) Error behavior

- Invalid format hash input is rejected client-side before API calls.
- Partial format fetch failures must not break feed/network rendering globally.
