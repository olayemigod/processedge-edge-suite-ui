import { baseComponents } from "./edgeui/components";
import { modalComponents } from "./edgeui/modal_components";
import { professionalComponents } from "./edgeui/professional_components";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";

export const EDGE_SUITE_UI_VERSION = "0.2.0";

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
}

export * from "./edgeui/components";
export * from "./edgeui/icons";
export * from "./edgeui/modal_components";
export * from "./edgeui/product_menu";
export * from "./edgeui/professional_components";
export * from "./edgeui/runtime";
export default runtime;
