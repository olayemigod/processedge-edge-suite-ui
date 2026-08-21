import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { build } from "esbuild";

const repositoryRoot = resolve(import.meta.dirname, "..");
const javascriptRoot = resolve(repositoryRoot, "edgesuite_ui/public/js");
const entrypoint = resolve(javascriptRoot, "edgeui.bundle.js");
const productContextEntrypoint = resolve(javascriptRoot, "edgeui/product_context.js");
const themeRuntimeEntrypoint = resolve(javascriptRoot, "edgeui/theme_runtime.js");

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

const productContextBuild = await build({
  entryPoints: [productContextEntrypoint],
  bundle: true,
  format: "esm",
  logLevel: "warning",
  platform: "node",
  write: false,
});
const productContextModule = await import(
  `data:text/javascript;base64,${Buffer.from(productContextBuild.outputFiles[0].text).toString("base64")}`
);
const routeCases = [
  ["/app/retailedge*", "/app/retailedge-home"],
  ["/app/retailedge*", "retailedge-home"],
  ["/app/veterinary-*", "/app/veterinary-consultation"],
  ["/app/veterinary-*", "veterinary-consultation"],
  ["/app/query-report/RetailEdge*", "query-report/RetailEdge Branch Performance Summary"],
];
for (const [pattern, route] of routeCases) {
  if (!productContextModule.routeMatches(pattern, route)) {
    throw new Error(`Product route did not match: ${pattern} -> ${route}`);
  }
}
if (productContextModule.routeMatches("/app/retailedge*", "vetedge")) {
  throw new Error("RetailEdge route pattern incorrectly matched VetEdge.");
}

const themeRuntimeBuild = await build({
  entryPoints: [themeRuntimeEntrypoint],
  bundle: true,
  format: "esm",
  logLevel: "warning",
  platform: "node",
  write: false,
});
const themeRuntimeModule = await import(
  `data:text/javascript;base64,${Buffer.from(themeRuntimeBuild.outputFiles[0].text).toString("base64")}`
);
const autoPreference = {
  palette: "edge-blue",
  appearance: "auto",
  autoLightStart: "06:00",
  autoDarkStart: "18:00",
};
if (
  themeRuntimeModule.resolveThemeAppearance(
    autoPreference,
    {},
    new Date(2026, 7, 11, 12, 0, 0),
  ) !== "light"
) {
  throw new Error("Auto theme should resolve to light during the configured daytime window.");
}
if (
  themeRuntimeModule.resolveThemeAppearance(
    autoPreference,
    {},
    new Date(2026, 7, 11, 22, 0, 0),
  ) !== "dark"
) {
  throw new Error("Auto theme should resolve to dark outside the configured daytime window.");
}
if (
  themeRuntimeModule.resolveThemeAppearance(
    { ...autoPreference, appearance: "system" },
    { matchMedia: () => ({ matches: true }) },
  ) !== "dark"
) {
  throw new Error("System theme should respect prefers-color-scheme dark mode.");
}
const normalizedTheme = themeRuntimeModule.normalizeThemePreference({
  palette: "unapproved",
  appearance: "unknown",
});
if (normalizedTheme.palette !== "edge-blue" || normalizedTheme.appearance !== "light") {
  throw new Error("Invalid theme preferences should fall back to the approved defaults.");
}

await build({
  entryPoints: [entrypoint],
  bundle: true,
  format: "esm",
  logLevel: "warning",
  platform: "browser",
  write: false,
});

await build({
  stdin: {
    contents: `
      import {
        createApp,
        createElementBlock,
        openBlock,
        resolveComponent,
        vModelSelect,
        vModelText,
        withDirectives,
        withKeys
      } from "./edgesuite_ui/public/js/edgeui/vue-bridge.js";
      console.log(createApp, createElementBlock, openBlock, resolveComponent, vModelSelect, vModelText, withDirectives, withKeys);
    `,
    resolveDir: repositoryRoot,
    sourcefile: "vue-bridge-consumer.js",
    loader: "js",
  },
  bundle: true,
  format: "esm",
  logLevel: "warning",
  platform: "browser",
  write: false,
});

console.log("Frontend syntax, product routes, theme resolution, runtime bundle, and Vue bridge validation passed.");
