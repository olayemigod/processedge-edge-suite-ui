from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTROLS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui_theme_controls.js"
STYLES = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_theme_controls.css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_theme_controls_are_loaded_after_runtime_and_before_product_bridges():
	for path in (CONTROLS, STYLES):
		assert path.exists(), path

	hooks = read(HOOKS)
	assert "/assets/edgesuite_ui/js/edgeui_theme_controls.js" in hooks
	assert "/assets/edgesuite_ui/css/edgeui_theme_controls.css" in hooks
	assert hooks.index("edgesuite_ui.bundle.js") < hooks.index("edgeui_theme_controls.js")
	assert hooks.index("edgeui_theme.css") < hooks.index("edgeui_theme_controls.css")
	assert hooks.index("edgeui_theme_controls.css") < hooks.index("edgeui_theme_dark_compat.css")


def test_auto_schedule_controls_use_existing_theme_runtime_api():
	content = read(CONTROLS)
	for contract in (
		"EdgeUI?.theme",
		"EdgeSuiteUI?.theme",
		'input.type = "time"',
		'heading.textContent = "Auto schedule"',
		'"Light from"',
		'"Dark from"',
		"controller.setAutoSchedule",
		"preference.autoLightStart",
		"preference.autoDarkStart",
	):
		assert contract in content

	assert "frappe.call" not in content


def test_theme_controls_keep_open_avatar_menu_in_sync_with_runtime_changes():
	content = read(CONTROLS)
	for contract in (
		"updatePressedState",
		"updateStatus",
		"syncAutoSchedule",
		'addEventListener?.(THEME_EVENT, syncMenu)',
		"MutationObserver",
		'addEventListener?.("page-change", syncMenu)',
	):
		assert contract in content


def test_theme_control_sync_does_not_rewrite_unchanged_dom_and_loop_observer():
	content = read(CONTROLS)
	assert 'if (status.textContent !== text) status.textContent = text' in content
	assert 'if (button.getAttribute("aria-pressed") !== value)' in content
	assert "inputs[0].value !== preference.autoLightStart" in content
	assert "inputs[1].value !== preference.autoDarkStart" in content


def test_theme_time_fields_follow_shared_semantic_tokens():
	content = read(STYLES)
	for contract in (
		"var(--edge-color-surface-soft)",
		"var(--edge-color-border)",
		"var(--edge-color-ink-800)",
		"var(--edge-color-brand-500)",
		".edge-theme-menu__time-input:focus-visible",
	):
		assert contract in content
