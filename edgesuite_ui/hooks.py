app_name = "edgesuite_ui"
app_title = "EdgeSuite UI"
app_publisher = "ProcessEdge Solutions"
app_description = "Independent EdgeSuite UI runtime and shared component library."
app_email = "processedgeng@gmail.com"
app_license = "mit"

# EdgeSuite UI is loaded locally on every product site. It does not require
# CoreEdge or any remote platform service to render product pages.
#
# Files named *.bundle.* are resolved through Frappe's hashed asset manifest.
# The canonical JS name is intentionally unique so it cannot collide with the
# legacy CoreEdge edgeui.bundle.js while downstream consumers are migrated.
# Plain CSS files are served directly from the app's public asset directory.
app_include_css = [
	"edgeui.bundle.css",
	"edgeui_compat.bundle.css",
	"/assets/edgesuite_ui/css/edgeui_product_menu.css",
	"/assets/edgesuite_ui/css/edgeui_product_menu_reliability.css",
	"/assets/edgesuite_ui/css/edgeui_product_switcher_flyout.css",
	"/assets/edgesuite_ui/css/edgeui_product_menu_host_bridge.css",
	"/assets/edgesuite_ui/css/edgeui_professional.css",
	"/assets/edgesuite_ui/css/edgeui_sidebar_refinement.css",
	"/assets/edgesuite_ui/css/edgeui_action_contrast.css",
	"/assets/edgesuite_ui/css/edgeui_flat_chrome.css",
	"/assets/edgesuite_ui/css/edgeui_modal.css",
	"/assets/edgesuite_ui/css/edgeui_multiselect.css",
	"/assets/edgesuite_ui/css/edgeui_shell_enhancements.css",
	"/assets/edgesuite_ui/css/edgeui_dashboard_alignment.css",
	"/assets/edgesuite_ui/css/edgeui_sidebar_focus.css",
	"/assets/edgesuite_ui/css/edgeui_form_controls.css",
	"/assets/edgesuite_ui/css/edgeui_context.css",
	"/assets/edgesuite_ui/css/edgeui_documents.css",
	"/assets/edgesuite_ui/css/edgeui_child_table_layout.css",
	"/assets/edgesuite_ui/css/edgeui_density.css",
	"/assets/edgesuite_ui/css/edgeui_theme.css",
	"/assets/edgesuite_ui/css/edgeui_theme_controls.css",
	"/assets/edgesuite_ui/css/edgeui_theme_dark_compat.css",
	"/assets/edgesuite_ui/css/edgeui_frappe_dialog_compat.css",
	"/assets/edgesuite_ui/css/edgeui_frappe_control_compat.css",
	"/assets/edgesuite_ui/css/edgeui_theme_transition_guard.css",
	"/assets/edgesuite_ui/css/edgeui_navigation_shell.css",
	"/assets/edgesuite_ui/css/edgeui_navigation_active_path.css",
	"/assets/edgesuite_ui/css/edgeui_desk_access_guard.css",
	"/assets/edgesuite_ui/css/edgeui_report_export.css",
	"/assets/edgesuite_ui/css/edgeui_reporting_presentation.css",
	"/assets/edgesuite_ui/css/edgeui_report_comparison.css",
	"/assets/edgesuite_ui/css/edgeui_report_grouping.css",
	"/assets/edgesuite_ui/css/edgeui_report_exceptions.css",
	"edgeui_report_smart_date.bundle.css",
	"/assets/edgesuite_ui/css/edgeui_dark_contrast.css",
	"/assets/edgesuite_ui/css/edgeui_dark_form_controls.css",
]
app_include_js = [
	"/assets/edgesuite_ui/js/edgeui_theme_bootstrap.js",
	"edgesuite_ui.bundle.js",
	"/assets/edgesuite_ui/js/edgeui_desk_access_guard.js",
	"/assets/edgesuite_ui/js/edgeui_theme_controls.js",
	"/assets/edgesuite_ui/js/edgeui_frappe_dialog_bridge.js",
	"/assets/edgesuite_ui/js/edgeui_navigation_shell.js",
	"/assets/edgesuite_ui/js/edgeui_navigation_component_bridge.js",
	"/assets/edgesuite_ui/js/edgeui_product_menu_host_bridge.js",
	"/assets/edgesuite_ui/js/edgeui_product_switcher_flyout.js",
	"/assets/edgesuite_ui/js/edgeui_ctrl_k_guard.js",
	"/assets/edgesuite_ui/js/edgeui_ctrl_s_guard.js",
]

# Desk access management is an additive interface-exposure layer only. Frappe
# permissions, User Permissions, Page/Report permissions and product-owned
# company/branch/workflow authorization remain authoritative.
extend_bootinfo = "edgesuite_ui.access_control.extend_bootinfo"
after_install = "edgesuite_ui.access_control.ensure_advanced_desk_role"
after_migrate = "edgesuite_ui.access_control.ensure_advanced_desk_role"
