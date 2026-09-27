from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"
CONTROL_COMPAT = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_frappe_control_compat.css"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_frappe_control_compatibility_loads_after_dialog_compatibility():
	assert CONTROL_COMPAT.exists(), CONTROL_COMPAT
	hooks = read(HOOKS)
	assert "/assets/edgesuite_ui/css/edgeui_frappe_control_compat.css" in hooks
	assert hooks.index("edgeui_frappe_dialog_compat.css") < hooks.index("edgeui_frappe_control_compat.css")


def test_dark_dialog_check_labels_use_edgesuite_foreground_and_full_opacity():
	content = read(CONTROL_COMPAT)
	for contract in (
		"--text-color: var(--edge-color-ink-950",
		"--text-muted: var(--edge-color-ink-500",
		'.frappe-control[data-fieldtype="Check"] .checkbox label',
		'.frappe-control[data-fieldtype="Check"] .label-area',
		'.frappe-control[data-fieldtype="Check"] .disp-area',
		"color: var(--edge-color-ink-950, #f1f6fb) !important;",
		"opacity: 1 !important;",
	):
		assert contract in content
