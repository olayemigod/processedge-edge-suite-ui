import { baseComponents } from "./edgeui/components";
import { installContextIdentityResolver } from "./edgeui/context_identity";
import { contextComponents } from "./edgeui/context_components";
import { applyFrappeCompatibility } from "./edgeui/frappe_compat";
import { formComponents } from "./edgeui/form_components";
import { modalComponents } from "./edgeui/modal_components";
import { applyModalCrossRuntimeCompatibility } from "./edgeui/modal_cross_runtime";
import { applyMultiSelectCompatibility } from "./edgeui/multiselect_compat";
import { suppressNativeNotificationRuntime } from "./edgeui/notification_runtime";
import { installProductMenuMountEnhancements } from "./edgeui/product_menu_mount";
import { professionalComponents } from "./edgeui/professional_components";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";
import { installSharedShellEnhancements } from "./edgeui/shell_enhancements";

export const EDGE_SUITE_UI_VERSION = "0.4.1";

applyFrappeCompatibility(professionalComponents);
applyModalCrossRuntimeCompatibility(modalComponents);
applyMultiSelectCompatibility(modalComponents);

const components = Object.freeze({
  ...baseComponents,
  ...professionalComponents,
  ...modalComponents,
  ...formComponents,
  ...contextComponents,
});

const runtime = createEdgeSuiteRuntime({
  version: EDGE_SUITE_UI_VERSION,
  components,
});

if (typeof globalThis !== "undefined") {
  exposeEdgeSuiteRuntime(runtime, globalThis);
  installProductMenuMountEnhancements(runtime);
  installSharedShellEnhancements(runtime);
  suppressNativeNotificationRuntime(runtime);
  installContextIdentityResolver();
}

export * from "./edgeui/components";
export * from "./edgeui/context_components";
export * from "./edgeui/context_identity";
export * from "./edgeui/frappe_compat";
export * from "./edgeui/form_components";
export * from "./edgeui/icons";
export * from "./edgeui/modal_components";
export * from "./edgeui/modal_cross_runtime";
export * from "./edgeui/multiselect_compat";
export * from "./edgeui/notification_runtime";
export * from "./edgeui/product_menu";
export * from "./edgeui/product_menu_mount";
export * from "./edgeui/professional_components";
export * from "./edgeui/runtime";
export * from "./edgeui/shell_enhancements";
export default runtime;
