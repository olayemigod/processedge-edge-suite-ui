from pathlib import Path

from edgesuite_ui import __version__

ROOT = Path(__file__).resolve().parents[2]
PRIMITIVES = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "form_primitives.js"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_form_controls.css"
BASE_CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui.bundle.css"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
PACKAGE = ROOT / "package.json"
INIT = ROOT / "edgesuite_ui" / "__init__.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_063_exports_shared_form_and_action_primitives():
	primitives = read(PRIMITIVES)
	bundle = read(BUNDLE)

	for component in ("EdgeButton", "EdgeInput", "EdgeTextarea", "EdgeCheckbox"):
		assert f'export const {component}' in primitives
		assert component in primitives.split("export const formPrimitiveComponents", 1)[1]

	assert 'from "./edgeui/form_primitives"' in bundle
	assert "...formPrimitiveComponents" in bundle
	assert 'export * from "./edgeui/form_primitives"' in bundle


def test_063_button_uses_shared_edgesuite_action_contract():
	primitives = read(PRIMITIVES)
	styles = read(BASE_CSS)

	button = primitives.split("export const EdgeButton", 1)[1].split("export const EdgeInput", 1)[0]
	for contract in (
		'"primary", "secondary"',
		'"button", "submit", "reset"',
		'"edge-button"',
		'"edge-button--primary"',
		'"aria-disabled"',
		'"aria-busy"',
		'"aria-label"',
		'props.disabled || props.loading',
		'emit("click", event)',
	):
		assert contract in button

	assert 'edge-button--outline' not in button
	assert 'edge-button--ghost' not in button
	assert 'edge-button--danger' not in button
	assert ".edge-button" in styles
	assert ".edge-button--primary" in styles


def test_063_primitives_follow_edgesuite_form_contract():
	primitives = read(PRIMITIVES)

	for contract in (
		'emit("update:modelValue"',
		'"aria-invalid"',
		"required",
		"disabled",
		"readonly",
		"description",
		"error",
		"edge-input__control",
		"edge-textarea__control",
		"edge-checkbox__surface",
	):
		assert contract in primitives

	assert "frappe." not in primitives
	assert "form-control" not in primitives


def test_063_primitives_are_styled_by_shared_form_controls_css():
	styles = read(CSS)

	for selector in (
		".edge-input",
		".edge-input__label",
		".edge-input__control",
		".edge-textarea",
		".edge-textarea__control",
		".edge-checkbox",
		".edge-checkbox__surface",
		".edge-checkbox__control",
		".edge-checkbox__label",
	):
		assert selector in styles

	assert ".edge-input.has-error .edge-input__control" in styles
	assert ".edge-textarea.has-error .edge-textarea__control" in styles
	assert ".edge-checkbox.has-error .edge-checkbox__surface" in styles


def test_063_version_is_consistent():
	bundle = read(BUNDLE)
	package = read(PACKAGE)
	init = read(INIT)

	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in bundle
	assert f'"version": "{__version__}"' in package
	assert f'__version__ = "{__version__}"' in init
