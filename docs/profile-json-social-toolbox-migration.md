# Profile JSON Migration Note (Toolbox + Following)

This note documents the `profile_json` shape the frontend currently reads and writes for the
Studio toolbox and social follow state.

## Canonical keys

1. Toolbox library keys:

```json
{
  "public": {
    "toolbox": ["pitch", "time"],
    "toolbox_library": {
      "connector": ["pitch", "time"],
      "transformation": ["add", "identity"],
      "condition": ["always_true"]
    }
  }
}
```

`toolbox_library` is the structured source of truth. `toolbox` is still written as a connector-ID
mirror for older profile/user views.

2. Social preference keys:

```json
{
  "public": {
    "followed_user_addresses": [
      "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
      "0xfa71ff2394596f824d69961293d095a50d322e4e"
    ],
    "followed_format_hashes": [
      "0x1111111111111111111111111111111111111111111111111111111111111111"
    ],
    "social_preferences": {
      "followed_user_addresses": [
        "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
        "0xfa71ff2394596f824d69961293d095a50d322e4e"
      ],
      "followed_format_hashes": [
        "0x1111111111111111111111111111111111111111111111111111111111111111"
      ]
    }
  }
}
```

User follows are chain-source Ethereum addresses. Format follows are 32-byte `0x...` format hashes.
The top-level `public.*` mirrors and nested `public.social_preferences.*` fields are intentionally
both written so older and newer UI paths see the same state.

## Write behavior (`PATCH /services/users/:id`)

Frontend patches `profile_json` only, preserving unrelated profile fields.

Toolbox saves write normalized IDs by kind:

```json
{
  "profile_json": {
    "public": {
      "toolbox": ["pitch", "time"],
      "toolbox_library": {
        "connector": ["pitch", "time"],
        "transformation": ["add"],
        "condition": ["always_true"]
      }
    }
  }
}
```

Social saves write canonical address/hash fields and remove legacy user-follow aliases from both
`public` and `public.social_preferences`:

```json
{
  "profile_json": {
    "public": {
      "followed_user_addresses": ["0xfa71ff2394596f824d69961293d095a50d322e4e"],
      "followed_format_hashes": [
        "0x1111111111111111111111111111111111111111111111111111111111111111"
      ],
      "social_preferences": {
        "followed_user_addresses": ["0xfa71ff2394596f824d69961293d095a50d322e4e"],
        "followed_format_hashes": [
          "0x1111111111111111111111111111111111111111111111111111111111111111"
        ]
      }
    }
  }
}
```

Notes:

1. `toolbox_library.connector` accepts current connector IDs and legacy `feature-*`/`particle-*`
   IDs, but saved values are normalized connector IDs without those prefixes.
2. `toolbox_library.transformation` strips a legacy `transform-` prefix on save.
3. `toolbox_library.condition` strips a legacy `condition-` prefix on save.
4. Toolbox no longer stores `particles`, `feature`, or `plugin` as canonical categories.
5. Formats are followable, but are not toolbox items.
6. `followedUserAddresses` and `followedFormatHashes` are legacy read aliases only. Social saves
   write canonical snake_case address/hash arrays and remove legacy camelCase aliases plus legacy
   user-id aliases.

## Read fallback behavior

Frontend reads these aliases if present:

1. Toolbox:
   - `public.toolbox_library.connector` (canonical)
   - `public.toolbox_library.feature` (legacy connector fallback)
   - `public.toolbox` (legacy connector fallback)
   - `public.toolbox_library.transformation`
   - `public.toolbox_library.condition`

2. Social user follows:
   - `public.social_preferences.followed_user_addresses` (canonical)
   - `public.followed_user_addresses` (canonical mirror)
   - `followedUserAddresses` camelCase aliases (legacy)

Legacy `followed_user_ids` / `followedUserIds` are no longer resolved by the frontend. A services
profile follows only the Ethereum addresses explicitly stored in the canonical address arrays.
Values that are already Ethereum addresses are lowercased and kept.

3. Social format follows:
   - `public.social_preferences.followed_format_hashes` (canonical)
   - `public.followed_format_hashes` (canonical mirror)
   - `followedFormatHashes` camelCase aliases (legacy)

`followed_format_ids` is not a current read source. Historical values may be preserved as unrelated
profile fields if already present, but the frontend follows formats by format hash.

## Bootstrap Behavior

The frontend no longer seeds mock/prototype follow addresses into an empty profile. Newly registered
or empty services accounts start with an empty follow list until the user follows an address or
format explicitly.

Toolbox entries are also services-profile state. An authenticated empty profile is not automatically
filled with toolbox items; entries are added through explicit save/deploy/toggle actions.
