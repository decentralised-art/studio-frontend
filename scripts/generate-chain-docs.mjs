import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(projectRoot, "src/lib/site/docs/chain-openapi.json");
const result = spawnSync(
  process.execPath,
  [
    resolve(projectRoot, "submodules/sdk/js/scripts/bundle-openapi.mjs"),
    "--spec-root",
    resolve(projectRoot, "submodules/sdk/submodules/api-spec"),
    "--output",
    output,
  ],
  { cwd: projectRoot, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await writeFile(
  output,
  await format(await readFile(output, "utf8"), {
    ...(await resolveConfig(output)),
    filepath: output,
  }),
);
