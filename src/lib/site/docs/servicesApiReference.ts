// The services API (decentralised-art/services-backend) has no OpenAPI specification yet;
// these entries are written from its route handlers (src/api/*.rs, src/app.rs).
import { SERVICES_BASE, type EndpointGroup, type FieldRow } from "$lib/site/docs/apiReference";

const field = (
  name: string,
  type: string,
  description: string,
  extra: Partial<FieldRow> = {},
): FieldRow => ({ name, type, required: false, description, depth: 0, ...extra });

const required = (name: string, type: string, description: string, extra: Partial<FieldRow> = {}) =>
  field(name, type, description, { required: true, ...extra });

const json = (value: unknown) => JSON.stringify(value, null, 2);
const ADDRESS = "0xfa71Ff2394596F824D69961293D095A50d322e4E";

export const servicesSchemas: { name: string; description: string; fields: FieldRow[] }[] = [
  {
    name: "UserPublic",
    description: "A user's public record. Fields are snake_case.",
    fields: [
      required(
        "id",
        "string",
        "The user's Ethereum address (EIP-55 checksummed). Users are identified by address.",
      ),
      required("display_name", "string, nullable", "Name shown on the platform."),
      required("status", '"active" | "suspended" | "deleted"', "Account status."),
      required("roles", 'array of "user" | "admin" | "moderator"', "Roles of the user."),
      required(
        "profile_json",
        "object",
        "Free-form profile data, such as public.nickname, public.bio and public.kind.",
      ),
      required("created_at", "string (date-time)", "When the user first signed in."),
      required("updated_at", "string (date-time)", "Last profile change."),
      required("last_login_at", "string (date-time), nullable", "Last sign-in."),
    ],
  },
  {
    name: "WorldDescriptor",
    description: "A published World. Fields are camelCase.",
    fields: [
      required("id", "string", "World id, used in asset URLs."),
      required("slug, name, version, description", "string", "From the World's manifest."),
      required(
        "entryUrn",
        "string",
        "Where the World's entry page is served, under /world-assets.",
      ),
      required("entryPath", "string", "Entry file inside the bundle."),
      required("runtime", '"iframe"', "How the World runs."),
      required(
        "surfaces",
        'array of "world-page" | "studio-plugin"',
        "Where the World can be shown.",
      ),
      required("permissions", "array of string", "Permissions granted to the World."),
      field(
        "shortDescription, heroLabel, accentColor, preview",
        "string",
        "Optional presentation details from the manifest.",
      ),
      required("acceptedFormatHashes", "array of string", "Formats the World understands."),
      required(
        "acceptedConnectorSets",
        "array of { connectors, optionalConnectors }",
        "Connector names the World understands.",
      ),
      field(
        "valueLimits",
        "object",
        "Ranges for particlesCount and for values on specific output paths.",
      ),
      required("ownerId", "string", "Address of the user who uploaded it."),
      required(
        "bundleHash, manifestHash",
        "string",
        "Hashes of the uploaded bundle and its manifest.",
      ),
      required("status", '"active" | "deleted"', "World status."),
      required("createdAt, updatedAt", "string (date-time)", "Timestamps."),
    ],
  },
];

const sessionHeader = '  -H "Authorization: Bearer $SESSION" \\\n';
const sessionOnly = '  -H "Authorization: Bearer $SESSION"';

export const servicesGroups: EndpointGroup[] = [
  {
    id: "services-health",
    title: "Health",
    intro: "Liveness check.",
    endpoints: [
      {
        id: "get-health",
        method: "GET",
        path: "/health",
        summary: "Health check",
        description: "Answers ok when the service is running.",
        auth: "none",
        params: [],
        responses: [{ status: "200", description: "The text ok.", type: "text/plain" }],
        example: { request: `curl ${SERVICES_BASE}/health`, response: "ok", responseLang: "bash" },
      },
    ],
  },
  {
    id: "services-auth",
    title: "Sign-in (SIWE)",
    intro:
      "Sign-In with Ethereum (EIP-4361). Ask for a challenge, sign its message with the wallet (EIP-191), and verify it to get a session token. Send the token as Authorization: Bearer <token>. Sessions last 24 hours. This session is separate from the chain API's access token.",
    endpoints: [
      {
        id: "post-auth-siwe-challenge",
        method: "POST",
        path: "/auth/siwe/challenge",
        summary: "Request a sign-in message",
        description:
          "Creates a single-use SIWE message for the address, valid for five minutes. Its domain and URI come from the request's Origin header (or app_origin), which must be an allowed origin. At most five unexpired challenges can exist per address.",
        auth: "none",
        params: [],
        body: {
          contentType: "application/json",
          fields: [
            required("address", "string", "The wallet's Ethereum address."),
            required(
              "chain_id",
              "integer",
              "The wallet's chain. Must be a chain the server allows (by default Ethereum mainnet 1, Sepolia 11155111 and local development chains).",
            ),
            field(
              "app_origin",
              "string",
              "The page's origin, used when the request carries no Origin header.",
            ),
          ],
        },
        responses: [
          {
            status: "200",
            description: "The message to sign and when it expires.",
            type: "{ message, expires_at }",
          },
          { status: "400", description: "Invalid address, chain not allowed, or invalid origin." },
          { status: "403", description: "The origin is not allowed." },
          { status: "429", description: "Too many active challenges for this address." },
        ],
        example: {
          request: `curl -X POST ${SERVICES_BASE}/auth/siwe/challenge \\\n  -H "Content-Type: application/json" \\\n  -H "Origin: https://decentralised.art" \\\n  -d '{"address":"${ADDRESS}","chain_id":11155111}'`,
          response: json({
            message:
              "decentralised.art wants you to sign in with your Ethereum account:\n0xfa71Ff…2e4E\n\nSign in to decentralised.art.\n\nURI: https://decentralised.art/auth/siwe/verify\nVersion: 1\nChain ID: 11155111\nNonce: …\nIssued At: …\nExpiration Time: …",
            expires_at: "2026-10-02T10:05:00Z",
          }),
          illustrative: true,
        },
      },
      {
        id: "post-auth-siwe-verify",
        method: "POST",
        path: "/auth/siwe/verify",
        summary: "Verify the signed message",
        description:
          "Checks the signature against an unused, unexpired challenge and opens a session. The response body is the session token itself, as a JSON string. The user record is created on first sign-in.",
        auth: "none",
        params: [],
        body: {
          contentType: "application/json",
          fields: [
            required("message", "string", "The exact message from the challenge."),
            required(
              "signature",
              "string",
              "The wallet's EIP-191 signature of the message, hex encoded.",
            ),
          ],
        },
        responses: [
          {
            status: "200",
            description: "The session token: two 64-character hex parts joined by a dot.",
            type: "string",
          },
          { status: "400", description: "Malformed message or signature." },
          {
            status: "401",
            description: "Unknown, used or expired challenge, or the signature does not match.",
          },
        ],
        example: {
          request: `curl -X POST ${SERVICES_BASE}/auth/siwe/verify \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"decentralised.art wants you to sign in…","signature":"0x…"}'`,
          response: '"6f1c…e2a0.b94d…07c3"',
          illustrative: true,
        },
      },
      {
        id: "get-auth-me",
        method: "GET",
        path: "/auth/me",
        summary: "Current user",
        description: "The signed-in user's record.",
        auth: "session",
        params: [],
        responses: [
          { status: "200", description: "The user.", type: "UserPublic", ref: "UserPublic" },
          { status: "401", description: "Missing, invalid or expired session." },
        ],
        example: { request: `curl ${SERVICES_BASE}/auth/me \\\n${sessionOnly}` },
      },
      {
        id: "post-auth-logout",
        method: "POST",
        path: "/auth/logout",
        summary: "Sign out",
        description: "Ends the current session.",
        auth: "session",
        params: [],
        responses: [
          { status: "204", description: "Signed out." },
          { status: "401", description: "Missing, invalid or expired session." },
        ],
        example: { request: `curl -X POST ${SERVICES_BASE}/auth/logout \\\n${sessionOnly}` },
      },
    ],
  },
  {
    id: "services-users",
    title: "Users",
    intro: "Public profiles. A user's id is their Ethereum address.",
    endpoints: [
      {
        id: "get-users",
        method: "GET",
        path: "/users",
        summary: "List users",
        description: "Addresses of registered users, one page at a time.",
        auth: "none",
        params: [
          field("page", "integer", "Zero-based page number (default 0).", { location: "query" }),
          field("limit", "integer", "Page size (default 50).", { location: "query" }),
        ],
        responses: [{ status: "200", description: "User addresses.", type: "array of string" }],
        example: {
          request: `curl "${SERVICES_BASE}/users?limit=50"`,
          response: json([ADDRESS, "0xb530bF08D76015080C67D6b5f00CdeE53b45bdDA"]),
        },
      },
      {
        id: "get-users-address",
        method: "GET",
        path: "/users/{address}",
        summary: "Get a user",
        description: "A user's public record.",
        auth: "none",
        params: [
          required("address", "string", "Ethereum address, in any letter case.", {
            location: "path",
          }),
        ],
        responses: [
          { status: "200", description: "The user.", type: "UserPublic", ref: "UserPublic" },
          { status: "400", description: "Not a valid address." },
          { status: "404", description: "No user with this address." },
        ],
        example: {
          request: `curl ${SERVICES_BASE}/users/${ADDRESS}`,
          response: json({
            id: ADDRESS,
            display_name: "Sawyer",
            status: "active",
            roles: ["user"],
            profile_json: { public: { bio: "", kind: "human", nickname: "Sawyer" } },
            created_at: "2026-10-01T00:48:26.030755101Z",
            updated_at: "2026-10-01T03:09:12.648956949Z",
            last_login_at: "2026-10-01T03:09:12.648956949Z",
          }),
        },
      },
      {
        id: "patch-users-address",
        method: "PATCH",
        path: "/users/{address}",
        summary: "Update your profile",
        description:
          "Changes your own display name or profile. Fields you leave out are not changed.",
        auth: "session-owner",
        params: [required("address", "string", "Your own address.", { location: "path" })],
        body: {
          contentType: "application/json",
          fields: [
            field("display_name", "string, nullable", "New display name; null clears it."),
            field("profile_json", "object", "Replaces the profile data."),
          ],
        },
        responses: [
          {
            status: "200",
            description: "The updated user.",
            type: "UserPublic",
            ref: "UserPublic",
          },
          { status: "400", description: "Not a valid address." },
          { status: "401", description: "Missing, invalid or expired session." },
          { status: "403", description: "This is not your profile." },
        ],
        example: {
          request: `curl -X PATCH ${SERVICES_BASE}/users/${ADDRESS} \\\n${sessionHeader}  -H "Content-Type: application/json" \\\n  -d '{"display_name":"Sawyer","profile_json":{"public":{"nickname":"Sawyer","bio":"Composer"}}}'`,
        },
      },
      {
        id: "delete-users-address",
        method: "DELETE",
        path: "/users/{address}",
        summary: "Delete your account",
        description: "Deletes your own user record.",
        auth: "session-owner",
        params: [required("address", "string", "Your own address.", { location: "path" })],
        responses: [
          { status: "204", description: "Deleted." },
          { status: "401", description: "Missing, invalid or expired session." },
          { status: "403", description: "This is not your account." },
        ],
      },
    ],
  },
  {
    id: "services-follows",
    title: "Follows",
    intro: "Follow other users. These endpoints act on the signed-in user.",
    endpoints: [
      {
        id: "get-social-following",
        method: "GET",
        path: "/social/following",
        summary: "Who you follow",
        description: "Addresses the signed-in user follows.",
        auth: "session",
        also: "GET /social/followers returns the addresses that follow the signed-in user.",
        params: [],
        responses: [
          { status: "200", description: "Addresses.", type: "array of string" },
          { status: "401", description: "Missing, invalid or expired session." },
        ],
      },
      {
        id: "post-social-follow",
        method: "POST",
        path: "/social/follow",
        summary: "Follow a user",
        description: "Starts following another user.",
        auth: "session",
        also: "POST /social/unfollow takes the same body and stops following.",
        params: [],
        body: {
          contentType: "application/json",
          fields: [required("followed_id", "string", "Address of the user to follow.")],
        },
        responses: [
          { status: "204", description: "Done." },
          { status: "400", description: "Empty id, or your own address." },
          { status: "401", description: "Missing, invalid or expired session." },
          { status: "404", description: "No such user." },
        ],
        example: {
          request: `curl -X POST ${SERVICES_BASE}/social/follow \\\n${sessionHeader}  -H "Content-Type: application/json" \\\n  -d '{"followed_id":"${ADDRESS}"}'`,
        },
      },
    ],
  },
  {
    id: "services-worlds",
    title: "Worlds",
    intro:
      "Browse and publish Worlds. Uploads are multipart/form-data with the ZIP in a field named bundle (up to 25 MB). The bundle rules are described in SDK → Building a World. World endpoints answer errors with a plain-text message.",
    endpoints: [
      {
        id: "get-worlds",
        method: "GET",
        path: "/worlds",
        summary: "List Worlds",
        description: "Active Worlds, one page at a time.",
        auth: "none",
        params: [
          field("page", "integer", "Zero-based page number (default 0).", { location: "query" }),
          field("limit", "integer", "Page size, 1–100 (default 50).", { location: "query" }),
          field(
            "surface",
            '"world-page" | "studio-plugin"',
            "Only Worlds that support this surface.",
            { location: "query" },
          ),
          field("q", "string", "Search text.", { location: "query" }),
        ],
        responses: [
          {
            status: "200",
            description: "Worlds.",
            type: "array of WorldDescriptor",
            ref: "WorldDescriptor",
          },
          { status: "400", description: "Invalid surface." },
        ],
        example: { request: `curl "${SERVICES_BASE}/worlds?surface=world-page&limit=30"` },
      },
      {
        id: "get-worlds-id",
        method: "GET",
        path: "/worlds/{id}",
        summary: "Get a World",
        description: "One World's descriptor.",
        auth: "none",
        params: [required("id", "string", "World id.", { location: "path" })],
        responses: [
          {
            status: "200",
            description: "The World.",
            type: "WorldDescriptor",
            ref: "WorldDescriptor",
          },
          { status: "404", description: "World not found." },
        ],
      },
      {
        id: "post-worlds-validate",
        method: "POST",
        path: "/worlds/validate",
        summary: "Validate a bundle",
        description: "Checks a World bundle without publishing it. No sign-in needed.",
        auth: "none",
        params: [],
        body: {
          contentType: "multipart/form-data",
          fields: [
            required(
              "bundle",
              "file (ZIP)",
              "The World bundle, with world-manifest.json at its root.",
            ),
          ],
        },
        responses: [
          {
            status: "200",
            description:
              "The manifest as it would be published, bundle and manifest hashes, and warnings.",
            type: "{ descriptor, bundleHash, manifestHash, warnings }",
          },
          {
            status: "400",
            description: "Invalid bundle or manifest; the message says what is wrong.",
          },
          { status: "413", description: "The bundle is larger than 25 MB." },
        ],
        example: {
          request: `curl -X POST ${SERVICES_BASE}/worlds/validate \\\n  -F "bundle=@my-world.zip"`,
        },
      },
      {
        id: "post-worlds-upload",
        method: "POST",
        path: "/worlds/upload",
        summary: "Publish a World",
        description: "Validates and publishes a bundle. You become the World's owner.",
        auth: "session",
        params: [],
        body: {
          contentType: "multipart/form-data",
          fields: [required("bundle", "file (ZIP)", "The World bundle.")],
        },
        responses: [
          {
            status: "200",
            description: "The published World.",
            type: "WorldDescriptor",
            ref: "WorldDescriptor",
          },
          { status: "400", description: "Invalid bundle or manifest." },
          { status: "401", description: "Missing, invalid or expired session." },
          { status: "409", description: "The World already exists." },
          { status: "413", description: "The bundle is larger than 25 MB." },
        ],
        example: {
          request: `curl -X POST ${SERVICES_BASE}/worlds/upload \\\n${sessionHeader}  -F "bundle=@my-world.zip"`,
        },
      },
      {
        id: "patch-worlds-id",
        method: "PATCH",
        path: "/worlds/{id}",
        summary: "Replace a World's bundle",
        description:
          "Publishes a new bundle for a World you own (administrators can update any World).",
        auth: "session-owner",
        params: [required("id", "string", "World id.", { location: "path" })],
        body: {
          contentType: "multipart/form-data",
          fields: [required("bundle", "file (ZIP)", "The new World bundle.")],
        },
        responses: [
          {
            status: "200",
            description: "The updated World.",
            type: "WorldDescriptor",
            ref: "WorldDescriptor",
          },
          { status: "400", description: "Invalid bundle or manifest." },
          { status: "401", description: "Missing, invalid or expired session." },
          { status: "403", description: "You do not own this World." },
          { status: "404", description: "World not found." },
          { status: "409", description: "The bundle conflicts with the World's current content." },
        ],
      },
      {
        id: "delete-worlds-id",
        method: "DELETE",
        path: "/worlds/{id}",
        summary: "Delete a World",
        description: "Removes a World you own from the gallery and stops serving its files.",
        auth: "session-owner",
        params: [required("id", "string", "World id.", { location: "path" })],
        responses: [
          { status: "204", description: "Deleted." },
          { status: "401", description: "Missing, invalid or expired session." },
          { status: "403", description: "You do not own this World." },
          { status: "404", description: "World not found." },
        ],
      },
    ],
  },
  {
    id: "services-files",
    title: "World files and SDK",
    intro: "Static files served for Worlds.",
    endpoints: [
      {
        id: "get-world-assets",
        method: "GET",
        path: "/world-assets/{id}/{path}",
        summary: "World file",
        description:
          "A file from a published World's bundle, such as its entry page. Files are served with a Content-Security-Policy that keeps the World from reaching the network directly; it talks to its host through the World runtime.",
        auth: "none",
        params: [
          required("id", "string", "World id.", { location: "path" }),
          required("path", "string", "File path inside the bundle.", { location: "path" }),
        ],
        responses: [
          { status: "200", description: "The file." },
          { status: "404", description: "Unknown or deleted World, or no such file." },
        ],
      },
      {
        id: "get-js-sdk",
        method: "GET",
        path: "/js/sdk/{file}",
        summary: "World runtime and host scripts",
        description:
          "The platform's builds of the SDK's World modules: world-runtime.js (imported by Worlds) and world-host.js (used by pages that embed Worlds).",
        auth: "none",
        params: [
          required("file", '"world-runtime.js" | "world-host.js"', "Script name.", {
            location: "path",
          }),
        ],
        responses: [
          { status: "200", description: "JavaScript module." },
          { status: "404", description: "Any other file name." },
        ],
        example: { request: `curl ${SERVICES_BASE}/js/sdk/world-runtime.js` },
      },
    ],
  },
];
