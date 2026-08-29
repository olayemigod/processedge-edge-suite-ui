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


def test_sidebar_accordion_keeps_active_section_open_after_navigation():
	runtime = (APP_ROOT / "public/js/edgeui/sidebar_accordion_runtime.js").read_text(encoding="utf-8")
	for expected in (
		"let keep = preferred || active || expanded[0] || null",
		"if (routePending && active)",
		"keep = active",
		"SIDEBAR_ROUTE_PENDING_KEY",
		"if (keep && !sectionExpanded(keep))",
		'attributeFilter: ["class", "hidden", "aria-expanded", "aria-current"]',
		'document.addEventListener("page-change", resetForNavigation)',
		'document.addEventListener(ROUTE_EVENT, resetForNavigation)',
	):
		assert expected in runtime


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
