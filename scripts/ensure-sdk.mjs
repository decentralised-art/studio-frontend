import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdkDir = resolve(projectRoot, "submodules/sdk/js");
const distEntry = resolve(sdkDir, "dist/index.js");
const sourceEntries = [
  "package.json",
  "src/index.ts",
  "src/client.ts",
  "src/worlds/host.ts",
  "src/worlds/protocol.ts",
  "src/worlds/runtime.ts",
].map((path) => resolve(sdkDir, path));

const run = (args) => {
  const result = spawnSync("npm", args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const isDistFresh = () => {
  if (!existsSync(distEntry)) return false;
  const distMtime = statSync(distEntry).mtimeMs;
  return sourceEntries.every((entry) => existsSync(entry) && statSync(entry).mtimeMs <= distMtime);
};

if (isDistFresh()) {
  process.exit(0);
}

if (!existsSync(resolve(sdkDir, "package.json"))) {
  console.error("Missing sdk submodule. Run: git submodule update --init --recursive");
  process.exit(1);
}

run(["--prefix", sdkDir, "install", "--ignore-scripts"]);
run(["--prefix", sdkDir, "run", "prepack"]);
