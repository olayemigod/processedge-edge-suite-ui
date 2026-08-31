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
		"function removeNativeMenuArtifacts",
		"function shellProductNavigationTarget",
		'slot.style.display = "inline-flex"',
		'slot.style.minWidth = "2rem"',
		'slot.style.minHeight = "2rem"',
		'slot.style.pointerEvents = "auto"',
		'if (!edgeShellPresent(document)) return null',
		"target.appendChild(slot)",
		'trigger.style.pointerEvents = "auto"',
		'trigger.removeEventListener("click", existing, true)',
		'trigger.addEventListener("click", handler, true)',
		"event.stopImmediatePropagation()",
		"directToggle = edgeUI.toggleProductMenu",
		'new target.CustomEvent("edgesuite:product-menu-opened"',
		'document.addEventListener("visibilitychange", scheduleMount)',
		'"hashchange", "popstate", "pageshow"',
		'attributeFilter: ["class", "style", "hidden", "aria-hidden"]',
	):
		assert expected in mount

	for visibility_contract in (
		'current.hidden',
		'current.getAttribute?.("aria-hidden") === "true"',
		'style?.contentVisibility === "hidden"',
		'.some(\n    visibleElement,\n  )',
		'const target = nodes.find(visibleElement);',
	):
		assert visibility_contract in mount

	for forbidden in (
		"NATIVE_NAVBAR_SELECTORS",
		"visibleNativeTarget",
		"ensureFallbackSlot",
		'|| nodes.find((node) => node?.isConnected)',
	):
		assert forbidden not in mount

	assert 'document.addEventListener(\n    "click"' not in mount

	for expected in (
		"function prepareAccordion",
		"function toggleSection",
		"currentlyOpen",
		"runtime.toggleFavoriteMenuItem?.(button.__edgeFavoriteItem)",
		"button.__edgeFavoriteItem = item",
		"function favoriteIconMarkup",
		'class="edge-product-menu__favorite-icon"',
		'button.innerHTML = `${favoriteIconMarkup(pinned)}',
		'"Add to Favorites"',
		'"Current pinned"',
		"function currentRoutePaths",
		"function addRoutePath",
		'if (text.startsWith("/desk/")) return `/app/${text.slice(6)}`',
		"target?.frappe?.get_route?.()",
		"target?.frappe?.router?.current_route",
		"routePaths.has(itemRoute)",
		"export { OPENED_EVENT, currentRoutePaths, normalizePath, refreshPanel }",
		'target.addEventListener?.(OPENED_EVENT',
		"observer.observe(panel, { childList: true, subtree: true })",
	):
		assert expected in reliability

	assert "runtime.toggleCurrentPageFavorite?.()" not in reliability
	assert 'button.textContent = pinned ? "★ Current pinned" : "☆ Add current"' not in reliability
	assert '"/assets/edgesuite_ui/css/edgeui_product_menu_reliability.css"' in hooks
	assert ".edge-topbar__brand > .edge-product-menu-slot" in styles
	assert "pointer-events: auto !important" in styles
	assert ".edge-product-menu-slot--fallback" not in styles
	assert ".edge-product-menu__favorite-control" in styles
	assert ".edge-product-menu__favorite-icon .edge-svg-icon" in styles
	assert "grid-template-columns: 0.85rem minmax(3.75rem, auto) 0.7rem" in styles
	assert '@media (max-width: 48rem)' in styles
