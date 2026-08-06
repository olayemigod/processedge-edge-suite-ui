from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_ROOT.parent


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_runtime_and_package_versions_are_aligned_to_062():
	bundle = read(APP_ROOT / "public" / "js" / "edgeui.bundle.js")
	package = read(REPO_ROOT / "package.json")
	version = read(APP_ROOT / "__init__.py")
	assert 'EDGE_SUITE_UI_VERSION = "0.6.2"' in bundle
	assert '"version": "0.6.2"' in package
	assert '__version__ = "0.6.2"' in version


def test_runtime_restores_stat_card_and_data_table_compatibility():
	bundle = read(APP_ROOT / "public" / "js" / "edgeui.bundle.js")
	compat = read(APP_ROOT / "public" / "js" / "edgeui" / "runtime_component_compat.js")
	assert 'from "./edgeui/runtime_component_compat"' in bundle
	assert "createCompatibleRuntimeComponents" in bundle
	assert 'export * from "./edgeui/runtime_component_compat"' in bundle
	for contract in (
		"normalizeEdgeStatIcon",
		"createCompatibleEdgeStatCard",
		"fieldname: column.fieldname || column.key",
		'column.type === "status"',
		'column.fieldtype === "Status"',
		"createCompatibleEdgeDataTable",
	):
		assert contract in compat


def test_frappe_v16_product_menu_host_bridge_is_loaded_after_runtime():
	hooks = read(APP_ROOT / "hooks.py")
	bridge = read(APP_ROOT / "public" / "js" / "edgeui_product_menu_host_bridge.js")
	assert hooks.index('"edgesuite_ui.bundle.js"') < hooks.index("edgeui_product_menu_host_bridge.js")
	assert "edgeui_product_menu_host_bridge.css" in hooks
	for contract in (
		".desk-sidebar .sidebar-header",
		".workspace-sidebar",
		".layout-side-section",
		"edge-product-menu-navbar-bridge--floating",
		"mountProductMenu",
		"MutationObserver",
	):
		assert contract in bridge
	assert "coreedge" not in bridge.lower()
	assert "switch_product_app" not in bridge.lower()
