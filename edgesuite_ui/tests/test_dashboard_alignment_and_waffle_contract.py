from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
JS_ROOT = ROOT / "edgesuite_ui" / "public" / "js"
CSS_ROOT = ROOT / "edgesuite_ui" / "public" / "css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"
BUNDLE = JS_ROOT / "edgeui.bundle.js"
MOUNT = JS_ROOT / "edgeui" / "product_menu_mount.js"
ALIGNMENT = CSS_ROOT / "edgeui_dashboard_alignment.css"


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


def test_product_menu_mounts_in_product_topbar_or_native_desk_navbar():
	content = read(MOUNT)

	for contract in (
		"visibleShellTarget",
		"visibleNativeTarget",
		".edge-app-shell[data-edge-product] .edge-topbar-actions",
		"NATIVE_NAVBAR_SELECTORS",
		"moveHost(document)",
		"desktop_screen",
		"page-change",
		"MutationObserver",
	):
		assert contract in content


def test_alignment_and_waffle_enhancements_are_loaded_globally():
	hooks = read(HOOKS)
	bundle = read(BUNDLE)

	assert "/assets/edgesuite_ui/css/edgeui_dashboard_alignment.css" in hooks
	assert 'installProductMenuMountEnhancements(runtime)' in bundle
	assert 'export * from "./edgeui/product_menu_mount"' in bundle
