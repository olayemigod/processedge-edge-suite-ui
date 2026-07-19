import { baseComponents } from "./edgeui/components";
import { installContextIdentityResolver } from "./edgeui/context_identity";
import { applyFrappeCompatibility } from "./edgeui/frappe_compat";
import { modalComponents } from "./edgeui/modal_components";
import { professionalComponents } from "./edgeui/professional_components";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";
import { installSharedShellEnhancements } from "./edgeui/shell_enhancements";

export const EDGE_SUITE_UI_VERSION = "0.3.0";

applyFrappeCompatibility(professionalComponents);

const components = Object.freeze({
  ...baseComponents,
  ...professionalComponents,
  ...modalComponents,
});

const runtime = createEdgeSuiteRuntime({
  version: EDGE_SUITE_UI_VERSION,
  components,
});

if (typeof globalThis !== "undefined") {
  exposeEdgeSuiteRuntime(runtime, globalThis);
  installSharedShellEnhancements(runtime);
  installContextIdentityResolver();
}

export * from "./edgeui/components";
export * from "./edgeui/context_identity";
export * from "./edgeui/frappe_compat";
export * from "./edgeui/icons";
export * from "./edgeui/modal_components";
export * from "./edgeui/product_menu";
export * from "./edgeui/professional_components";
export * from "./edgeui/runtime";
export * from "./edgeui/shell_enhancements";
export default runtime;
