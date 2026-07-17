import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { build } from "esbuild";

const repositoryRoot = resolve(import.meta.dirname, "..");
const javascriptRoot = resolve(repositoryRoot, "edgesuite_ui/public/js");
const entrypoint = resolve(javascriptRoot, "edgeui.bundle.js");

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? javascriptFiles(path) : entry.name.endsWith(".js") ? [path] : [];
    }),
  );
  return nested.flat();
}

for (const path of await javascriptFiles(javascriptRoot)) {
  await readFile(path, "utf8");
  const result = spawnSync(process.execPath, ["--check", path], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await build({
  entryPoints: [entrypoint],
  bundle: true,
  format: "esm",
  logLevel: "warning",
  platform: "browser",
  write: false,
});

console.log("Frontend syntax and bundle validation passed.");
