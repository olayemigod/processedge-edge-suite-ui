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
]
app_include_js = [
	"edgesuite_ui.bundle.js",
	"/assets/edgesuite_ui/js/edgeui_ctrl_k_guard.js",
	"/assets/edgesuite_ui/js/edgeui_ctrl_s_guard.js",
]
