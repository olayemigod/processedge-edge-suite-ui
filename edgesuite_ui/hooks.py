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
# Plain CSS files are served directly from the app's public asset directory.
app_include_css = [
	"edgeui.bundle.css",
	"edgeui_compat.bundle.css",
	"/assets/edgesuite_ui/css/edgeui_product_menu.css",
	"/assets/edgesuite_ui/css/edgeui_professional.css",
	"/assets/edgesuite_ui/css/edgeui_sidebar_refinement.css",
]
app_include_js = ["edgeui.bundle.js"]
