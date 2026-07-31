from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_latest_runtime_installs_switcher_commands_density_and_menu_extras():
	bundle = (APP / "public/js/edgeui.bundle.js").read_text()
	interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
	extras = (APP / "public/js/edgeui/product_menu_extras.js").read_text()
	hooks = (APP / "hooks.py").read_text()

	for expected in (
		'installProductContextBridge(runtime, globalThis)',
		'installEdgeSuiteInteractionRuntime(runtime, globalThis)',
		'installProductMenuExtras(runtime, globalThis)',
		'EDGE_SUITE_UI_VERSION = "0.6.1"',
		'export * from "./edgeui/interaction_runtime"',
		'export * from "./edgeui/product_menu_extras"',
	):
		assert expected in bundle

	for expected in (
		'const COMMAND_VERSION = "1.0.0"',
		"registerSaveHandler",
		"activateSaveHandler",
		"saveCurrentContext",
		"openCommandPalette",
		"runtime?.openProductMenu?.()",
		'new target.CustomEvent("edgesuite:save-request"',
		"runtime.setDensity = density.setDensity",
		"target.EdgeSuiteCommands = commands",
	):
		assert expected in interaction

	for expected in (
		'const QUICK_ACTION_SECTION_KEY = "quick-actions"',
		'const FAVORITES_SECTION_KEY = "favorites"',
		'const FAVORITES_STORAGE_VERSION = "v1"',
		'label: "Quick Actions"',
		'label: "Favorites"',
		"runtime.getFavoriteMenuItems",
		"runtime.toggleFavoriteMenuItem",
		"Pin current page to Favorites",
		"runtime.setDensity?.(select.value)",
	):
		assert expected in extras

	assert '"/assets/edgesuite_ui/css/edgeui_density.css"' in hooks


def test_ctrl_s_preserves_submitted_document_and_business_rule_safety():
	interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
	for expected in (
		"Number(form.doc.docstatus || 0) !== 0",
		"Submitted documents cannot be changed with this shortcut.",
		"await form.save()",
		'[data-edgesuite-save]:not([disabled])',
		"textarea, [contenteditable='true']",
	):
		assert expected in interaction
	for forbidden in (
		"frappe.db.set_value",
		"ignore_permissions",
		".submit()",
		".cancel()",
		'querySelectorAll("button:not([disabled])")',
	):
		assert forbidden not in interaction


def test_latest_runtime_keeps_one_sidebar_and_waffle_group_open():
	interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
	density = (APP / "public/css/edgeui_density.css").read_text()
	for expected in (
		"function reconcileSidebar",
		"expanded.length <= 1",
		"expanded.filter((section) => section !== keep).forEach(closeSection)",
		"function reconcileProductMenu",
		'section.classList.toggle("is-collapsed", collapse)',
		'heading?.setAttribute("aria-expanded"',
	):
		assert expected in interaction
	for mode in ("compact", "comfortable", "touch"):
		assert f'html[data-edge-density="{mode}"]' in density
	for selector in (
		".edge-product-menu__density",
		".edge-product-menu__favorite-control",
		'.edge-product-menu__favorite-control[data-pinned="1"]',
	):
		assert selector in density
