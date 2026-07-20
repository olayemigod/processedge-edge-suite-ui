from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


def test_sidebar_sections_are_collapsible_and_persistent():
	component = (APP_ROOT / "public/js/edgeui/professional_components.js").read_text(encoding="utf-8")
	for expected in (
		"collapsibleSections",
		"rememberSectionState",
		"edge-sidebar__section-toggle",
		'"aria-expanded"',
		"localStorage",
		"chevron-down",
	):
		assert expected in component


def test_sidebar_refinement_has_desktop_gutter_and_mobile_reset():
	styles = (APP_ROOT / "public/css/edgeui_sidebar_refinement.css").read_text(encoding="utf-8")
	for expected in (
		"--edge-shell-gutter",
		"column-gap: var(--edge-shell-gutter)",
		".edge-sidebar__section-toggle",
		".edge-sidebar__section.is-collapsed",
		".edge-sidebar__items[hidden]",
		"padding-inline-end: 0",
	):
		assert expected in styles
