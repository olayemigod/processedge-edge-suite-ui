from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


def test_professional_shell_groups_navigation_and_uses_svg_icons():
	component = (APP_ROOT / "public/js/edgeui/professional_components.js").read_text(encoding="utf-8")
	for expected in (
		"normalizedGroups",
		"EdgeIcon",
		"edge-sidebar__section",
		"edge-sidebar-item__description",
		"edge-sidebar-toggle",
		"edge-sidebar-backdrop",
	):
		assert expected in component
	assert "item.icon)" not in component


def test_professional_shell_is_safe_across_product_vue_bundles():
	component = (APP_ROOT / "public/js/edgeui/professional_components.js").read_text(encoding="utf-8")
	assert 'import { defineComponent, h } from "vue"' in component
	assert "onMounted" not in component
	assert "ref(" not in component
	assert "watch(" not in component
	assert "data()" in component
	assert "mounted()" in component
	assert "this.collapsedSections" in component
	assert 'emits: ["navigate"]' in component


def test_professional_design_has_spacing_responsive_and_native_sidebar_contracts():
	styles = (APP_ROOT / "public/css/edgeui_professional.css").read_text(encoding="utf-8")
	for expected in (
		"--edge-page-padding",
		"--edge-section-gap",
		"--edge-content-max-width",
		"@media (max-width: 61.99rem)",
		"@media (max-width: 47.99rem)",
		'[data-title="EduEdge"]',
		".sidebar-item-icon svg",
		"box-shadow: inset 3px 0 0",
	):
		assert expected in styles


def test_icon_library_is_independent_and_has_brand_relevant_icons():
	icons = (APP_ROOT / "public/js/edgeui/icons.js").read_text(encoding="utf-8")
	for expected in (
		"graduation",
		"students",
		"assessment",
		"settings",
		"shield",
		"edgeIconMarkup",
		"frappe?.utils?.icon",
	):
		assert expected in icons
