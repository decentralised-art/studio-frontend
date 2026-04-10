# Profile JSON Migration Note (Toolbox + Following)

This note documents the `profile_json` shape the frontend now expects and writes.

## Canonical keys

1. Toolbox library keys:

```json
{
  "public": {
    "toolbox_library": {
      "connector": ["c3", "time"],
      "transformation": ["transform-add", "transform-identity"],
      "condition": ["condition-always-true"]
    }
  }
}
```

2. Social preference keys:

```json
{
  "public": {
    "social_preferences": {
      "followed_user_ids": ["user-jun", "43e7e391-55fb-4956-950f-85f99fe7900f"],
      "followed_format_ids": ["format-123abc", "format-xyz789"]
    }
  }
}
```

## Write behavior (`PATCH /services/users/:id`)

Frontend patches `profile_json` only, preserving unrelated profile fields.

Example patch body:

```json
{
  "profile_json": {
    "public": {
      "toolbox": ["c3", "time"],
      "toolbox_library": {
        "connector": ["c3", "time"],
        "transformation": ["transform-add"],
        "condition": ["condition-always-true"]
      },
      "followed_user_ids": ["user-jun"],
      "followed_format_ids": ["format-123abc"],
      "followed_format_hashes": ["format-123abc"],
      "social_preferences": {
        "followed_user_ids": ["user-jun"],
        "followed_format_ids": ["format-123abc"],
        "followed_format_hashes": ["format-123abc"]
      }
    }
  }
}
```

Notes:

1. `toolbox` is kept as a connector ID mirror for compatibility.
2. `followed_format_hashes` is also mirrored for compatibility.
3. Toolbox no longer stores `particles`, `feature`, or `plugin`.
4. Formats are followable, but are not toolbox items.

## Read fallback behavior

Frontend reads these aliases if present:

1. Toolbox:
   - `public.toolbox_library.connector` (canonical)
   - `public.toolbox_library.feature` (legacy fallback)
   - `public.toolbox` (legacy fallback)

2. Social:
   - `public.social_preferences.followed_user_ids` (canonical)
   - `public.followed_user_ids` (fallback)
   - `public.social_preferences.followed_format_ids` (canonical)
   - `public.followed_format_ids` (fallback)
   - `*_hashes` variants are accepted as fallback values for formats

## Prototype bootstrap behavior

When loading social preferences with bootstrap enabled, if `followed_user_ids` is empty the frontend can auto-seed followed users from known mock/services users and persist the result. This is prototype-only behavior to keep Explore usable before global search/discovery is implemented.
