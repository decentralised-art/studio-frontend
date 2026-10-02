// Code samples for the MCP documentation page. Paths use /path/to/mcp for the folder the
// repository was cloned into.

import type { CodeLanguage } from "$lib/site/docs/highlight";

type Sample = { label: string; lang: CodeLanguage; code: string };

export const install: Sample[] = [
  {
    label: "macOS / Linux",
    lang: "bash",
    code: `git clone https://github.com/decentralised-art/mcp.git
cd mcp
make install   # creates .venv and installs the server
make smoke     # runs the test suite and a local tool call`,
  },
  {
    label: "Windows",
    lang: "bash",
    code: `git clone https://github.com/decentralised-art/mcp.git
cd mcp
py scripts\\bootstrap_venv.py
.venv\\Scripts\\python -m unittest discover -s tests`,
  },
];

export const hosts: Sample[] = [
  {
    label: "Claude Code",
    lang: "bash",
    code: `claude mcp add --transport stdio --scope user \\
  --env API_BASE=https://api.decentralised.art/chain \\
  --env DECENTRALISED_ART_ARTIFACT_ROOT=/path/to/mcp/decentralised-art-mcp-artifacts \\
  --env PRIVATE_KEY=0xYourTestnetKey \\
  decentralised-art -- /path/to/mcp/.venv/bin/python -m decentralised_art_mcp.server stdio

claude mcp list   # "decentralised-art" should be listed as connected`,
  },
  {
    label: "Claude Desktop",
    lang: "bash",
    code: `# Requires uv (https://docs.astral.sh/uv/) on the machine running Claude Desktop.
cd /path/to/mcp
make mcpb   # writes dist/decentralised-art-mcp-<version>.mcpb

# Then double-click the .mcpb file, drag it into Claude Desktop, or install it from
# Claude Desktop's extension settings. It asks for the API base URL, an optional
# private key, the timeout and the artifact folder.`,
  },
  {
    label: "Codex",
    lang: "toml",
    code: `# ~/.codex/config.toml
[mcp_servers.decentralised-art]
command = "/path/to/mcp/.venv/bin/python"
args = ["-m", "decentralised_art_mcp.server", "stdio"]

[mcp_servers.decentralised-art.env]
API_BASE = "https://api.decentralised.art/chain"
DECENTRALISED_ART_TIMEOUT = "15"
DECENTRALISED_ART_ARTIFACT_ROOT = "/path/to/mcp/decentralised-art-mcp-artifacts"
PRIVATE_KEY = "0xYourTestnetKey"   # optional`,
  },
  {
    label: "Cursor",
    lang: "json",
    code: `{
  "mcpServers": {
    "decentralised-art": {
      "type": "stdio",
      "command": "/path/to/mcp/.venv/bin/python",
      "args": ["-m", "decentralised_art_mcp.server", "stdio"],
      "env": {
        "API_BASE": "https://api.decentralised.art/chain",
        "DECENTRALISED_ART_TIMEOUT": "15",
        "DECENTRALISED_ART_ARTIFACT_ROOT": "/path/to/mcp/decentralised-art-mcp-artifacts"
      }
    }
  }
}`,
  },
  {
    label: "VS Code",
    lang: "json",
    code: `{
  "servers": {
    "decentralised-art": {
      "type": "stdio",
      "command": "/path/to/mcp/.venv/bin/python",
      "args": ["-m", "decentralised_art_mcp.server", "stdio"],
      "env": {
        "API_BASE": "https://api.decentralised.art/chain",
        "DECENTRALISED_ART_TIMEOUT": "15",
        "DECENTRALISED_ART_ARTIFACT_ROOT": "/path/to/mcp/decentralised-art-mcp-artifacts"
      }
    }
  }
}`,
  },
  {
    label: "Other hosts",
    lang: "json",
    code: `{
  "command": "/path/to/mcp/.venv/bin/python",
  "args": ["-m", "decentralised_art_mcp.server", "stdio"],
  "cwd": "/path/to/mcp",
  "env": {
    "API_BASE": "https://api.decentralised.art/chain",
    "DECENTRALISED_ART_TIMEOUT": "15",
    "DECENTRALISED_ART_ARTIFACT_ROOT": "/path/to/mcp/decentralised-art-mcp-artifacts",
    "PRIVATE_KEY": "<optional>"
  }
}`,
  },
];

export const projectConfig = `{
  "mcpServers": {
    "decentralised-art": {
      "command": "/path/to/mcp/.venv/bin/python",
      "args": ["-m", "decentralised_art_mcp.server", "stdio"],
      "env": {
        "API_BASE": "https://api.decentralised.art/chain",
        "DECENTRALISED_ART_ARTIFACT_ROOT": "/path/to/mcp/decentralised-art-mcp-artifacts",
        "PRIVATE_KEY": "\${PRIVATE_KEY}"
      }
    }
  }
}`;

export const inspector = `npx @modelcontextprotocol/inspector \\
  /path/to/mcp/.venv/bin/python -m decentralised_art_mcp.server stdio`;

export const toolCall = `{
  "name": "core.execute_connector",
  "arguments": { "connector_name": "pitch", "particles_count": 4 }
}`;

export const toolResult = `{
  "ok": true,
  "data": {
    "block_number": 11825265,
    "block_hash": "0xfa8ee7fe85e17439d69d98aef0418556a9d9a0d5794d5568fd32de300853acc5",
    "runner": "0xe0e70f522b64a6c8d2301697cd7133be33eae77f",
    "particles": [{ "path": "/pitch:0", "data": [0, 1, 2, 3] }],
    "execution_mode": "chain"
  }
}`;

export const toolError = `{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "params.particles_count is required",
    "details": { "path": "params.particles_count", "required": true }
  }
}`;

export const publishCall = `{
  "name": "core.publish_entity",
  "arguments": {
    "kind": "transformation",
    "name": "shift_up",
    "max_fee_per_gas": 50000000000,
    "max_total_fee": 5000000000000000,
    "record_path": "publications/shift_up.json"
  }
}`;

export const cli = `cd /path/to/mcp
source .venv/bin/activate

decentralised-art-mcp list-tools                         # every tool with its input schema
decentralised-art-mcp list-resources
decentralised-art-mcp read-resource core.primer
decentralised-art-mcp invoke core.get_connector '{"name": "pitch"}'
decentralised-art-mcp invoke core.execute_connector '{"connector_name": "pitch", "particles_count": 4}'`;
