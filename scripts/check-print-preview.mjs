import { resolve } from "node:path";
import { build } from "esbuild";

const repositoryRoot = resolve(import.meta.dirname, "..");
const entrypoint = resolve(
  repositoryRoot,
  "edgesuite_ui/public/js/edgeui/printing_virtual_transport.js",
);

const bundled = await build({
  entryPoints: [entrypoint],
  bundle: true,
  format: "esm",
  logLevel: "warning",
  platform: "node",
  write: false,
});
const module = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const text = (value) => [...new TextEncoder().encode(value)];
const payload = Uint8Array.from([
  0x1b, 0x40,
  0x1b, 0x61, 0x01,
  0x1b, 0x45, 0x01,
  0x1d, 0x21, 0x00,
  ...text("RetailEdge Consulting\n"),
  0x1d, 0x21, 0x00,
  0x1b, 0x45, 0x00,
  0x1b, 0x61, 0x00,
  0x1b, 0x61, 0x01,
  0x1b, 0x45, 0x01,
  0x1d, 0x21, 0x00,
  ...text("Sales Invoice\n"),
  0x1d, 0x21, 0x00,
  0x1b, 0x45, 0x00,
  0x1b, 0x61, 0x00,
  ...text("ACC-SINV-2026-00011\n"),
  0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
  0x1d, 0x6b, 73, 3, 0x41, 0x42, 0x43,
  0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00, 0x41,
  ...text("Thank you\n"),
  0x1b, 0x64, 0x02,
  0x1d, 0x56, 0x01,
]);

const inspected = module.inspectVirtualPrintJob(payload);
const preview = inspected.previewText;

for (const expected of [
  "RetailEdge Consulting",
  "Sales Invoice",
  "ACC-SINV-2026-00011",
  "Thank you",
]) {
  if (!preview.includes(expected)) {
    throw new Error(`Virtual receipt preview lost printable text: ${expected}\n${preview}`);
  }
}

for (const forbidden of ["@aE!", "dV", "1A2", "ABC"]) {
  if (preview.includes(forbidden)) {
    throw new Error(`Virtual receipt preview leaked ESC/POS command data: ${forbidden}\n${preview}`);
  }
}

if (inspected.commands.cuts !== 1 || inspected.commands.feedLines !== 2) {
  throw new Error("Virtual receipt command summary changed while cleaning preview text.");
}

if (inspected.commands.drawerPulses !== 0) {
  throw new Error("Virtual receipt preview fixture unexpectedly detected a drawer pulse.");
}

console.log("Virtual receipt preview decoder: OK");
