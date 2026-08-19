import { baseComponents } from "./edgeui/components";
import { contextComponents } from "./edgeui/context_components";
import { installContextIdentityResolver } from "./edgeui/context_identity";
import { documentComponents } from "./edgeui/document_components";
import { emptyStateComponents } from "./edgeui/empty_state_components";
import { exportComponents } from "./edgeui/export_components";
import { edgeExportAdapter } from "./edgeui/export_runtime";
import { applyFrappeCompatibility } from "./edgeui/frappe_compat";
import { formComponents } from "./edgeui/form_components";
import { formPrimitiveComponents } from "./edgeui/form_primitives";
import { installEdgeSuiteInteractionRuntime } from "./edgeui/interaction_runtime";
import { modalComponents } from "./edgeui/modal_components";
import { applyModalCrossRuntimeCompatibility } from "./edgeui/modal_cross_runtime";
import { applyMultiSelectCompatibility } from "./edgeui/multiselect_compat";
import { suppressNativeNotificationRuntime } from "./edgeui/notification_runtime";
import { installProductContextBridge } from "./edgeui/product_context_bridge";
import { installProductMenuExtras } from "./edgeui/product_menu_extras";
import { installProductMenuMountEnhancements } from "./edgeui/product_menu_mount";
import { installProductMenuReliability } from "./edgeui/product_menu_reliability";
import { professionalComponents } from "./edgeui/professional_components";
import { reportComparisonComponents } from "./edgeui/report_comparison";
import { installEdgeSuiteReportExportRuntime, reportComponents } from "./edgeui/report_export";
import { installEdgeSuiteReportPrintRuntime } from "./edgeui/report_print";
import { reportPresentationComponents } from "./edgeui/report_presentation";
import { reportShellActionComponents } from "./edgeui/report_shell_actions";
import { installEdgeSuiteReportRuntime } from "./edgeui/report_runtime";
import { createEdgeSuiteRuntime, exposeEdgeSuiteRuntime } from "./edgeui/runtime";
import { createCompatibleRuntimeComponents } from "./edgeui/runtime_component_compat";
import { installSharedShellEnhancements } from "./edgeui/shell_enhancements";
import { installSidebarAccordionRuntime } from "./edgeui/sidebar_accordion_runtime";
import { installSidebarFocusLifecycle } from "./edgeui/sidebar_focus";
import { installThemeRuntime } from "./edgeui/theme_runtime";
import { installWorkflowSaveBridge } from "./edgeui/workflow_save_bridge";

export const EDGE_SUITE_UI_VERSION = "0.6.3";

applyFrappeCompatibility(professionalComponents);
applyModalCrossRuntimeCompatibility(modalComponents);
applyMultiSelectCompatibility(modalComponents);

const components = Object.freeze(
  createCompatibleRuntimeComponents({
    baseComponents: {
      ...baseComponents,
      ...exportComponents,
      ...reportComparisonComponents,
      ...reportPresentationComponents,
      ...reportShellActionComponents,
    },
    professionalComponents,
    modalComponents,
    formComponents: { ...formComponents, ...formPrimitiveComponents },
    contextComponents,
    documentComponents,
    emptyStateComponents,
    reportComponents,
  }),
);

const runtime = createEdgeSuiteRuntime({
  version: EDGE_SUITE_UI_VERSION,
  components,
});

runtime.registerAdapter("export", edgeExportAdapter);

if (typeof globalThis !== "undefined") {
  exposeEdgeSuiteRuntime(runtime, globalThis);
  installThemeRuntime(runtime, globalThis);
  installProductContextBridge(runtime, globalThis);
  installProductMenuMountEnhancements(runtime);
  installSharedShellEnhancements(runtime);
  installSidebarFocusLifecycle(runtime);
  suppressNativeNotificationRuntime(runtime);
  installContextIdentityResolver();
  installEdgeSuiteInteractionRuntime(runtime, globalThis);
  installEdgeSuiteReportRuntime(runtime, globalThis);
  installEdgeSuiteReportExportRuntime(runtime, globalThis);
  installEdgeSuiteReportPrintRuntime(runtime, globalThis);
  installSidebarAccordionRuntime(globalThis);
  installWorkflowSaveBridge(globalThis);
  installProductMenuExtras(runtime, globalThis);
  installProductMenuReliability(runtime, globalThis);
}

export * from "./edgeui/components";
export * from "./edgeui/context_components";
export * from "./edgeui/context_identity";
export * from "./edgeui/document_components";
export { EdgeEmptyState, emptyStateComponents } from "./edgeui/empty_state_components";
export * from "./edgeui/export_components";
export * from "./edgeui/export_runtime";
export * from "./edgeui/form_components";
export * from "./edgeui/form_primitives";
export * from "./edgeui/frappe_compat";
export * from "./edgeui/icons";
export * from "./edgeui/interaction_runtime";
export * from "./edgeui/modal_components";
export * from "./edgeui/modal_cross_runtime";
export * from "./edgeui/multiselect_compat";
export * from "./edgeui/notification_runtime";
export * from "./edgeui/product_context";
export * from "./edgeui/product_context_bridge";
export * from "./edgeui/product_menu";
export * from "./edgeui/product_menu_extras";
export * from "./edgeui/product_menu_mount";
export * from "./edgeui/product_menu_reliability";
export * from "./edgeui/professional_components";
export * from "./edgeui/report_comparison";
export * from "./edgeui/report_export";
export * from "./edgeui/report_print";
export * from "./edgeui/report_presentation";
export * from "./edgeui/report_shell_actions";
export * from "./edgeui/report_runtime";
export * from "./edgeui/runtime";
export * from "./edgeui/runtime_component_compat";
export * from "./edgeui/shell_enhancements";
export * from "./edgeui/sidebar_accordion_runtime";
export * from "./edgeui/sidebar_focus";
export * from "./edgeui/theme_runtime";
export * from "./edgeui/workflow_save_bridge";

export default runtime;