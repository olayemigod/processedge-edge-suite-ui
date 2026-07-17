from pathlib import Path

from edgesuite_ui import __version__

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
JS_ROOT = PACKAGE_ROOT / "public" / "js"
CSS_ROOT = PACKAGE_ROOT / "public" / "css"
HOOKS = PACKAGE_ROOT / "hooks.py"


def _javascript_source() -> str:
	return "\n".join(path.read_text(encoding="utf-8") for path in sorted(JS_ROOT.rglob("*.js")))


def test_frappe_app_discovery_markers_are_present():
	for marker in ("hooks.py", "modules.txt", "patches.txt"):
		assert (PACKAGE_ROOT / marker).is_file()


def test_runtime_exports_the_compatibility_contract():
	source = _javascript_source()

	for required_symbol in (
		"EdgeSuiteUI",
		"EdgeUI",
		"createEdgeApp",
		"components",
		"EdgeAppShell",
		"EdgePageLayout",
		"EdgePageHeader",
		"EdgeFilterBar",
		"EdgeStatCard",
		"EdgeStatusBadge",
		"EdgeEmptyState",
		"EdgeLoadingState",
		"EdgeErrorState",
		"EdgeNotificationBell",
		"EdgeNotificationDrawer",
	):
		assert required_symbol in source


def test_runtime_does_not_import_platform_or_product_apps():
	source = _javascript_source().lower()

	for forbidden_import in ("coreedge/", "vetedge/", "retailedge/", "edgepay/"):
		assert forbidden_import not in source


def test_runtime_version_matches_python_package_version():
	entrypoint = (JS_ROOT / "edgeui.bundle.js").read_text(encoding="utf-8")
	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in entrypoint


def test_frappe_hooks_include_local_runtime_assets():
	hooks = HOOKS.read_text(encoding="utf-8")
	for asset in ("edgeui.bundle.js", "edgeui.bundle.css", "edgeui_compat.bundle.css"):
		assert f'"{asset}"' in hooks

	assert (JS_ROOT / "edgeui.bundle.js").is_file()
	assert (CSS_ROOT / "edgeui.bundle.css").is_file()
	assert (CSS_ROOT / "edgeui_compat.bundle.css").is_file()


def test_bundle_entrypoint_uses_frappe_bundle_naming_and_local_modules():
	entrypoint = (JS_ROOT / "edgeui.bundle.js").read_text(encoding="utf-8")

	assert (JS_ROOT / "edgeui" / "components.js").is_file()
	assert (JS_ROOT / "edgeui" / "runtime.js").is_file()
	assert '"./edgeui/components"' in entrypoint
	assert '"./edgeui/runtime"' in entrypoint


def test_migrated_product_compatibility_surface_is_present():
	source = _javascript_source()
	for prop_or_event in (
		"menuItems",
		"activeRoute",
		"tenantName",
		"branchName",
		"userName",
		'emit("navigate"',
		'emit("mark-all-read"',
		'emit("update:filter"',
	):
		assert prop_or_event in source
