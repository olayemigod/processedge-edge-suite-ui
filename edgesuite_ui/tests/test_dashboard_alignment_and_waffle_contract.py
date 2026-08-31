from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS_ROOT = ROOT / "edgesuite_ui" / "public" / "js"
CSS_ROOT = ROOT / "edgesuite_ui" / "public" / "css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"
BUNDLE = JS_ROOT / "edgeui.bundle.js"
MOUNT = JS_ROOT / "edgeui" / "product_menu_mount.js"
HOST_BRIDGE = JS_ROOT / "edgeui_product_menu_host_bridge.js"
ALIGNMENT = CSS_ROOT / "edgeui_dashboard_alignment.css"
RELIABILITY = CSS_ROOT / "edgeui_product_menu_reliability.css"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_dashboard_sections_share_one_outer_width_contract():
	content = read(ALIGNMENT)

	for contract in (
		".edge-page-layout > .edge-page-layout__filters",
		".edge-page-layout > .edge-page-layout__content",
		"padding-inline: 0 !important",
		"width: 100% !important",
		".edge-page-layout__content > *",
	):
		assert contract in content


def test_kpi_typography_scales_for_long_financial_values():
	content = read(ALIGNMENT)

	for contract in (
		"container-type: inline-size",
		".edge-stat-card__value",
		"font-size: clamp(1.05rem, 10cqi, 1.75rem) !important",
		"font-variant-numeric: tabular-nums",
		"overflow-wrap: anywhere",
		"font-weight: 700 !important",
	):
		assert contract in content


def test_product_navigation_is_shell_only_and_never_mounts_on_native_desk_actions():
	content = read(MOUNT)
	bridge = read(HOST_BRIDGE)

	for contract in (
		"shellProductNavigationTarget",
		"ensureShellSlot(document)",
		".edge-app-shell[data-edge-product] .edge-topbar__brand",
		"removeNativeMenuArtifacts",
		"if (!edgeShellPresent(document)) return null",
		"document.getElementById(HOST_ID)?.remove()",
		"document.getElementById(PANEL_ID)?.remove()",
		"desktop_screen",
		"page-change",
		"MutationObserver",
	):
		assert contract in content

	for forbidden in (
		"NATIVE_NAVBAR_SELECTORS",
		"visibleNativeTarget",
		"ensureFallbackSlot",
	):
		assert forbidden not in content

	assert 'state.mode = "native-desk-hidden"' in bridge
	assert 'state.mode = "edge-shell"' in bridge
	assert 'resolveEmbeddedTarget' not in bridge
	assert 'edge-product-menu-navbar-bridge--floating' not in bridge


def test_product_navigation_uses_compact_brand_side_controls():
	content = read(RELIABILITY)

	for contract in (
		".edge-topbar__brand > .edge-product-menu-slot",
		"grid-template-columns: 0.85rem minmax(3.75rem, auto) 0.7rem",
		"min-height: 1.9rem",
		"max-width: 7.5rem",
		"height: 1.9rem",
		"width: 1.9rem",
	):
		assert contract in content

	assert ".edge-product-menu-slot--fallback" not in content


def test_alignment_and_waffle_enhancements_are_loaded_globally():
	hooks = read(HOOKS)
	bundle = read(BUNDLE)

	assert "/assets/edgesuite_ui/css/edgeui_dashboard_alignment.css" in hooks
	assert "installProductMenuMountEnhancements(runtime)" in bundle
	assert 'export * from "./edgeui/product_menu_mount"' in bundle
