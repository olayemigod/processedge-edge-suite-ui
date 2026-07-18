import { baseComponents } from "./edgeui/components";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";
import { exposeVueBridge } from "./edgeui/vue-bridge";

export const EDGE_SUITE_UI_VERSION = "0.1.0";

const runtime = createEdgeSuiteRuntime({
  version: EDGE_SUITE_UI_VERSION,
  components: baseComponents,
});

if (typeof globalThis !== "undefined") {
  exposeVueBridge(globalThis);
  exposeEdgeSuiteRuntime(runtime, globalThis);
}

export * from "./edgeui/components";
export * from "./edgeui/runtime";
export * from "./edgeui/vue-bridge";
export default runtime;
