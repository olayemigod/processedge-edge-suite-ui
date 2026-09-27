from pathlib import Path

from edgesuite_ui import __version__

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"
PACKAGE = ROOT / "package.json"


def test_latest_runtime_installs_switcher_commands_density_and_menu_extras():
	bundle = (APP / "public/js/edgeui.bundle.js").read_text()
	interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
	extras = (APP / "public/js/edgeui/product_menu_extras.js").read_text()
	mount = (APP / "public/js/edgeui/product_menu_mount.js").read_text()
	sidebar = (APP / "public/js/edgeui/sidebar_accordion_runtime.js").read_text()
	workflow_bridge = (APP / "public/js/edgeui/workflow_save_bridge.js").read_text()
	ctrl_k_guard = (APP / "public/js/edgeui_ctrl_k_guard.js").read_text()
	ctrl_s_guard = (APP / "public/js/edgeui_ctrl_s_guard.js").read_text()
	hooks = (APP / "hooks.py").read_text()
	package = PACKAGE.read_text()

	for expected in (
		'installProductContextBridge(runtime, globalThis)',
		'installEdgeSuiteInteractionRuntime(runtime, globalThis)',
		'installSidebarAccordionRuntime(globalThis)',
		'installWorkflowSaveBridge(globalThis)',
		'installProductMenuExtras(runtime, globalThis)',
		f'EDGE_SUITE_UI_VERSION = "{__version__}"',
		'export * from "./edgeui/interaction_runtime"',
		'export * from "./edgeui/product_menu_extras"',
		'export * from "./edgeui/sidebar_accordion_runtime"',
		'export * from "./edgeui/workflow_save_bridge"',
	):
		assert expected in bundle
	assert f'"version": "{__version__}"' in package

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
		"runtime.toggleCurrentPageFavorite",
		"Add current page to Favorites",
		"dispatchFavoritesChanged",
		"runtime.setDensity?.(select.value)",
		"withoutGeneratedSections",
	):
		assert expected in extras

	for expected in (
		'["resize", "orientationchange", "hashchange", "popstate", "pageshow"].forEach',
		'document.addEventListener("visibilitychange", scheduleMount)',
		"mountAtPreferredTarget();",
		"preferredTarget(document)",
	):
		assert expected in mount

	for expected in (
		'SIDEBAR_OPEN_SECTION_KEY = "edgeOpenSidebarSection"',
		"function enforceSidebar",
		"shell.dataset.edgeMultiSection = \"true\"",
		"sectionIdentity(section)",
		"preferred || expanded[0]",
		"if (routePending && active)",
		"keep = active",
		"if (keep && !sectionExpanded(keep))",
		"setSectionExpanded(shell, keep, true)",
		"delete shell.dataset[SIDEBAR_OPEN_SECTION_KEY]",
		"scheduleEnforce()",
	):
		assert expected in sidebar
	assert "preferred || active || expanded[0]" not in sidebar

	for expected in (
		"function workflowSaveButton",
		"function focusedEditContainer",
		"function uniqueSaveButton",
		"STANDARD_SAVE_LABELS",
		"FORBIDDEN_SAVE_WORDS",
		'".edge-workflow-bar__actions button.edge-button--primary:not([disabled])"',
		'target.addEventListener("edgesuite:save-request"',
		"event.detail.handled = true",
		"button.click()",
	):
		assert expected in workflow_bridge

	for expected in (
		'const GUARD_KEY = "__edgeSuiteCtrlKGuard"',
		"globalThis.addEventListener?.(\"keydown\", onKeydown, true)",
		"edgeRuntime.openProductMenu()",
		"event.stopImmediatePropagation?.()",
		'"#edge-product-menu-dropdown:not([hidden]) .edge-product-menu__search"',
	):
		assert expected in ctrl_k_guard

	for expected in (
		'const GUARD_KEY = "__edgeSuiteCtrlSGuard"',
		"function activeFrappeForm",
		"function saveActiveFrappeForm",
		"Number(form.doc.docstatus || 0) !== 0",
		"Submitted documents cannot be changed with this shortcut.",
		"No unsaved changes.",
		"saveInFlight",
		"editingSurface(event.target)",
		"event.stopImmediatePropagation?.()",
		"globalThis.addEventListener?.(\"keydown\", onKeydown, true)",
	):
		assert expected in ctrl_s_guard

	assert '"/assets/edgesuite_ui/css/edgeui_density.css"' in hooks
	assert '"/assets/edgesuite_ui/js/edgeui_ctrl_k_guard.js"' in hooks
	assert '"/assets/edgesuite_ui/js/edgeui_ctrl_s_guard.js"' in hooks


def test_ctrl_s_preserves_submitted_document_and_business_rule_safety():
	interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
	workflow_bridge = (APP / "public/js/edgeui/workflow_save_bridge.js").read_text()
	ctrl_s_guard = (APP / "public/js/edgeui_ctrl_s_guard.js").read_text()
	for expected in (
		"Number(form.doc.docstatus || 0) !== 0",
		"Submitted documents cannot be changed with this shortcut.",
		"await form.save()",
		"textarea, [contenteditable='true']",
		"routeType !== \"form\"",
		"if (saveInFlight) return",
	):
		assert expected in ctrl_s_guard
	for expected in (
		'[data-edgesuite-save]:not([disabled])',
		"FORBIDDEN_SAVE_WORDS",
		"candidates.length === 1",
	):
		assert expected in workflow_bridge
	for forbidden in (
		"frappe.db.set_value",
		"ignore_permissions",
		".submit()",
		".cancel()",
		'querySelectorAll("button:not([disabled])")',
	):
		assert forbidden not in interaction
		assert forbidden not in workflow_bridge
		assert forbidden not in ctrl_s_guard


def test_latest_runtime_keeps_one_sidebar_and_user_selected_waffle_group_open():
	interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
	density = (APP / "public/css/edgeui_density.css").read_text()
	for expected in (
		"function reconcileSidebar",
		"expanded.length <= 1",
		"expanded.filter((section) => section !== keep).forEach(closeSection)",
		"function reconcileProductMenu",
		"PRODUCT_MENU_OPEN_SECTION_KEY",
		"productSectionIdentity",
		"preferred || active || sections[0]",
		"panel.dataset[PRODUCT_MENU_OPEN_SECTION_KEY] = productSectionIdentity(section)",
		'delete panel.dataset[PRODUCT_MENU_OPEN_SECTION_KEY]',
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
	assert ".edge-app-shell .edge-sidebar__section + .edge-sidebar__section" in density
	assert "margin-top: 0" in density
