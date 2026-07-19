import { baseComponents } from "./edgeui/components";
import { applyFrappeCompatibility } from "./edgeui/frappe_compat";
import { modalComponents } from "./edgeui/modal_components";
import { modalPortalComponents } from "./edgeui/modal_portal";
import { professionalComponents } from "./edgeui/professional_components";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";

export const EDGE_SUITE_UI_VERSION = "0.2.1";

applyFrappeCompatibility(professionalComponents);

const components = Object.freeze({
  ...baseComponents,
  ...professionalComponents,
  ...modalComponents,
  ...modalPortalComponents,
});

const runtime = createEdgeSuiteRuntime({
  version: EDGE_SUITE_UI_VERSION,
  components,
});

if (typeof globalThis !== "undefined") {
  exposeEdgeSuiteRuntime(runtime, globalThis);
}

export * from "./edgeui/components";
export * from "./edgeui/frappe_compat";
export * from "./edgeui/icons";
export * from "./edgeui/modal_components";
export * from "./edgeui/modal_portal";
export * from "./edgeui/product_menu";
export * from "./edgeui/professional_components";
export * from "./edgeui/runtime";
export default runtime;
