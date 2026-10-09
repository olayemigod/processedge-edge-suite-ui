import { build } from "esbuild";
import { resolve } from "node:path";

const entrypoint = resolve(
  import.meta.dirname,
  "../edgesuite_ui/public/js/edgeui/frappe_desk_ui.js",
);

const result = await build({
  entryPoints: [entrypoint],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`;
const { createFrappeDeskUIAdapter, detectFrappeDeskUICapabilities } = await import(moduleUrl);

const legacyTarget = {};
const legacyCapabilities = detectFrappeDeskUICapabilities(legacyTarget);
if (legacyCapabilities.dropdown || legacyCapabilities.contextMenu || legacyCapabilities.toast) {
  throw new Error("Frappe Desk UI capabilities must fail closed when native components are unavailable.");
}

const legacyAdapter = createFrappeDeskUIAdapter({ target: legacyTarget });
if (legacyAdapter.dropdown({}) !== null || legacyAdapter.contextMenu({}) !== null || legacyAdapter.toast({}) !== null) {
  throw new Error("Frappe Desk UI adapter must return null instead of failing on older Framework builds.");
}

const calls = [];
class Dropdown {
  constructor(options) {
    calls.push(["dropdown", options]);
    this.options = options;
  }
}
class ContextMenu {
  constructor(options) {
    calls.push(["context-menu", options]);
    this.options = options;
  }
}
const nativeTarget = {
  frappe: {
    ui: {
      Dropdown,
      ContextMenu,
      toast(options) {
        calls.push(["toast", options]);
        return options;
      },
    },
  },
};

const nativeAdapter = createFrappeDeskUIAdapter({ target: nativeTarget });
const nativeCapabilities = nativeAdapter.capabilities();
if (!nativeCapabilities.dropdown || !nativeCapabilities.contextMenu || !nativeCapabilities.toast) {
  throw new Error("Frappe Desk UI adapter did not detect the expected native components.");
}

const dropdownOptions = { button: { label: "Actions" }, options: [{ label: "Open" }] };
const contextOptions = { target: {}, options: [{ label: "Open" }] };
const toastOptions = { message: "Saved", type: "success" };

const dropdown = nativeAdapter.dropdown(dropdownOptions);
const contextMenu = nativeAdapter.contextMenu(contextOptions);
const toast = nativeAdapter.toast(toastOptions);

if (!(dropdown instanceof Dropdown) || dropdown.options !== dropdownOptions) {
  throw new Error("Native Dropdown constructor was not delegated correctly.");
}
if (!(contextMenu instanceof ContextMenu) || contextMenu.options !== contextOptions) {
  throw new Error("Native ContextMenu constructor was not delegated correctly.");
}
if (toast !== toastOptions) {
  throw new Error("Native toast helper was not delegated correctly.");
}
if (!nativeAdapter.isAvailable("dropdown") || nativeAdapter.isAvailable("missing")) {
  throw new Error("Capability lookup returned an invalid result.");
}

const helperCalls = [];
const helperTarget = {
  frappe: {
    ui: {
      dropdown(options) {
        helperCalls.push(options);
        return { helper: true, options };
      },
    },
  },
};
const helperAdapter = createFrappeDeskUIAdapter({ target: helperTarget });
const helperResult = helperAdapter.dropdown(dropdownOptions);
if (!helperResult?.helper || helperCalls[0] !== dropdownOptions) {
  throw new Error("Functional frappe.ui.dropdown fallback was not delegated correctly.");
}

console.log("Frappe Desk UI adapter checks passed.");
