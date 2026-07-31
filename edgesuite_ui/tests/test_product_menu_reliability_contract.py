from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_runtime_installs_deterministic_waffle_reliability():
	bundle = (APP / "public/js/edgeui.bundle.js").read_text()
	mount = (APP / "public/js/edgeui/product_menu_mount.js").read_text()
	reliability = (APP / "public/js/edgeui/product_menu_reliability.js").read_text()
	hooks = (APP / "hooks.py").read_text()
	styles = (APP / "public/css/edgeui_product_menu_reliability.css").read_text()

	for expected in (
		'installProductMenuReliability(runtime, globalThis)',
		'export * from "./edgeui/product_menu_reliability"',
	):
		assert expected in bundle

	for expected in (
		'const SLOT_ID = "edge-product-menu-slot"',
		'const DIRECT_HANDLER_KEY = "__edgeSuiteProductMenuDirectHandler"',
		"ensureShellSlot(document)",
		"function edgeShellPresent",
		"function stabilizeSlot",
		"function stabilizeTrigger",
		"function bindDirectTrigger",
		'slot.style.display = "inline-flex"',
		'slot.style.minWidth = "2.5rem"',
		'slot.style.minHeight = "2.5rem"',
		'slot.style.order = "-20"',
		'slot.style.pointerEvents = "auto"',
		"if (edgeShellPresent(document)) return null",
		"actions.insertBefore(slot, actions.firstChild || null)",
		'trigger.style.pointerEvents = "auto"',
		'trigger.removeEventListener("click", existing, true)',
		'trigger.addEventListener("click", handler, true)',
		"event.stopImmediatePropagation()",
		"directToggle = edgeUI.toggleProductMenu",
		'new target.CustomEvent("edgesuite:product-menu-opened"',
		'target.addEventListener?.("orientationchange", scheduleMount)',
	):
		assert expected in mount

	assert 'document.addEventListener(\n    "click"' not in mount

	for expected in (
		"function prepareAccordion",
		"function toggleSection",
		"currentlyOpen",
		"runtime.toggleCurrentPageFavorite?.()",
		'button.textContent = pinned ? "★ Current pinned" : "☆ Add current"',
		'target.addEventListener?.(OPENED_EVENT',
		"observer.observe(panel, { childList: true, subtree: true })",
	):
		assert expected in reliability

	assert '"/assets/edgesuite_ui/css/edgeui_product_menu_reliability.css"' in hooks
	assert ".edge-topbar-actions > .edge-product-menu-slot" in styles
	assert "order: -20 !important" in styles
	assert "pointer-events: auto !important" in styles
	assert ".edge-topbar-actions > .edge-topbar-action-wrap" in styles
	assert ".edge-product-menu-slot--fallback" in styles
	assert '@media (max-width: 48rem)' in styles
