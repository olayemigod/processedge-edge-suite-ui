import { baseComponents } from "./edgeui/components";
import { professionalComponents } from "./edgeui/professional_components";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";

export const EDGE_SUITE_UI_VERSION = "0.2.0";

const components = Object.freeze({
  ...baseComponents,
  ...professionalComponents,
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
export * from "./edgeui/product_menu";
export * from "./edgeui/professional_components";
export * from "./edgeui/runtime";
export default runtime;
