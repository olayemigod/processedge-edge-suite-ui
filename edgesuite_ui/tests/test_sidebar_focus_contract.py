from pathlib import Path

from edgesuite_ui import __version__


APP_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_ROOT.parent


def read(relative: str) -> str:
	return (APP_ROOT / relative).read_text(encoding="utf-8")


def test_native_sidebar_hiding_requires_a_visible_focused_product_shell():
	lifecycle = read("public/js/edgeui/sidebar_focus.js")
	for contract in (
		'.querySelectorAll(".edge-app-shell[data-edge-product]")',
		"elementIsVisible",
		'body.classList.toggle("edge-suite-shell-focused", focused)',
		'body.classList.toggle("edge-suite-native-sidebar-hidden", hideNativeSidebar)',
		"shells.some((shell) => shouldHideNativeSidebar(shell, registry))",
		"element.getClientRects",
		'style.display === "none"',
		'current.getAttribute?.("aria-hidden") === "true"',
	):
		assert contract in lifecycle
	assert "localStorage" not in lifecycle


def test_sidebar_focus_is_resynchronised_on_frappe_navigation_and_dom_visibility_changes():
	lifecycle = read("public/js/edgeui/sidebar_focus.js")
	for contract in (
		'new MutationObserver(scheduleSidebarFocusSync)',
		'document.addEventListener("page-change", scheduleSidebarFocusSync)',
		'globalThis.frappe?.router?.on?.("change", scheduleSidebarFocusSync)',
		'globalThis.addEventListener?.("hashchange", scheduleSidebarFocusSync)',
		'globalThis.addEventListener?.("popstate", scheduleSidebarFocusSync)',
		'attributeFilter: ["class", "style", "hidden", "aria-hidden"]',
	):
		assert contract in lifecycle


def test_stale_hide_class_cannot_suppress_native_frappe_navigation():
	styles = read("public/css/edgeui_sidebar_focus.css")
	hooks = read("hooks.py")
	for contract in (
		"body.edge-suite-native-sidebar-hidden:not(.edge-suite-shell-focused) .body-sidebar-container",
		"display: flex !important",
		"body.edge-suite-shell-focused.edge-suite-native-sidebar-hidden .body-sidebar-container",
		"display: none !important",
	):
		assert contract in styles
	assert "edgeui_sidebar_focus.css" in hooks
	assert hooks.index("edgeui_sidebar_focus.css") > hooks.index("edgeui_flat_chrome.css")


def test_sidebar_focus_lifecycle_is_installed_before_runtime_use_and_versions_align():
	bundle = read("public/js/edgeui.bundle.js")
	package = (REPO_ROOT / "package.json").read_text(encoding="utf-8")
	assert 'import { installSidebarFocusLifecycle } from "./edgeui/sidebar_focus"' in bundle
	assert "installSidebarFocusLifecycle(runtime)" in bundle
	assert 'export * from "./edgeui/sidebar_focus"' in bundle
	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in bundle
	assert f'"version": "{__version__}"' in package
