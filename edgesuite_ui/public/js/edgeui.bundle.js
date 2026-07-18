import { baseComponents } from "./edgeui/components";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";

export const EDGE_SUITE_UI_VERSION = "0.1.1";

const runtime = createEdgeSuiteRuntime({
  version: EDGE_SUITE_UI_VERSION,
  components: baseComponents,
});

if (typeof globalThis !== "undefined") {
  exposeEdgeSuiteRuntime(runtime, globalThis);
}

export * from "./edgeui/components";
export * from "./edgeui/product_menu";
export * from "./edgeui/runtime";
export default runtime;
