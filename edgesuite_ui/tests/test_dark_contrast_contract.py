from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRAST = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_dark_contrast.css"
FORM_CONTROLS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_dark_form_controls.css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_dark_contrast_layers_exist_and_form_controls_load_last():
	assert CONTRAST.exists(), CONTRAST
	assert FORM_CONTROLS.exists(), FORM_CONTROLS
	hooks = read(HOOKS)
	contrast_asset = "/assets/edgesuite_ui/css/edgeui_dark_contrast.css"
	form_asset = "/assets/edgesuite_ui/css/edgeui_dark_form_controls.css"
	assert contrast_asset in hooks
	assert form_asset in hooks
	assert hooks.index("edgeui_navigation_active_path.css") < hooks.index("edgeui_dark_contrast.css")
	assert hooks.index("edgeui_dark_contrast.css") < hooks.index("edgeui_dark_form_controls.css")
	css_list = hooks.split("app_include_css = [", 1)[1].split("]", 1)[0]
	last_asset_line = [line.strip() for line in css_list.splitlines() if line.strip().startswith('"')][-1]
	assert "edgeui_dark_form_controls.css" in last_asset_line


def test_shared_dark_popup_and_edgelink_surfaces_pair_background_and_text_tokens():
	content = read(CONTRAST)
	for contract in (
		".edge-dropdown__menu",
		".edge-link-field__menu",
		".edge-link-field__input",
		".edge-link-field__option",
		".edge-link-field__option-label",
		".edge-link-field__option-description",
		".edge-link-field__create",
		".edge-export-menu__options",
		"--edge-color-overlay-surface:",
		"--edge-color-overlay-hover:",
		"var(--edge-color-ink-950)",
		"var(--edge-color-ink-800)",
		"var(--edge-color-ink-500)",
	):
		assert contract in content


def test_shared_dark_modal_copy_and_controls_are_explicitly_themed():
	content = read(CONTRAST)
	for contract in (
		".edge-modal__body h1",
		".edge-modal__body p",
		".edge-modal__body label",
		".edge-modal__body td",
		".edge-form-field__label",
		".edge-form-control",
		".edge-input__control",
		".edge-textarea__control",
		".edge-dropdown__trigger",
		".edge-checkbox__surface",
		"--edge-color-disabled-surface:",
		"--edge-color-disabled-text:",
	):
		assert contract in content


def test_dark_form_control_layer_covers_native_editable_readonly_and_date_states():
	content = read(FORM_CONTROLS)
	for contract in (
		'.edge-app-shell input:not([type="checkbox"])',
		".edge-app-shell .form-control",
		".edge-modal .form-control",
		"input:disabled",
		"input[readonly]",
		"textarea[readonly]",
		"--disabled-control-bg:",
		"-webkit-text-fill-color:",
		'input[type="date"]',
		"::-webkit-calendar-picker-indicator",
		"color-scheme: dark",
		".like-disabled-input",
		".control-value",
		".readonly-value",
		".form-control:focus",
	):
		assert contract in content


def test_native_frappe_overlays_are_dark_safe_when_edgesuite_shell_is_active():
	content = read(CONTRAST)
	for contract in (
		"body.edge-suite-shell-active .dropdown-menu",
		"body.edge-suite-shell-active .popover",
		"body.edge-suite-shell-active .datepicker",
		"body.edge-suite-shell-active .awesomplete > ul",
		".dropdown-item:hover",
		'[aria-selected="true"]',
	):
		assert contract in content


def test_decorated_frappe_dialog_nested_copy_and_links_use_dark_semantics():
	content = read(CONTRAST)
	for contract in (
		".modal.edge-frappe-dialog-host .modal-content",
		".modal.edge-frappe-dialog-host .modal-body h1",
		".modal.edge-frappe-dialog-host .modal-body p",
		".modal.edge-frappe-dialog-host .modal-body label",
		".modal.edge-frappe-dialog-host .text-muted",
		".modal.edge-frappe-dialog-host a:not(.btn)",
		"var(--edge-color-brand-text, var(--edge-color-info))",
	):
		assert contract in content
