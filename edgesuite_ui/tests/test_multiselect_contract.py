from pathlib import Path

from edgesuite_ui import __version__

APP_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_ROOT.parent


def test_shared_multiselect_is_registered_before_runtime_exposure():
	bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")
	component = (APP_ROOT / "public/js/edgeui/multiselect_compat.js").read_text(encoding="utf-8")

	assert 'import { applyMultiSelectCompatibility } from "./edgeui/multiselect_compat"' in bundle
	assert "applyMultiSelectCompatibility(modalComponents)" in bundle
	assert bundle.index("applyMultiSelectCompatibility(modalComponents)") < bundle.index(
		"const components = Object.freeze"
	)
	for contract in (
		"admission_programs",
		"edge-multiselect",
		"updateValue(field, next)",
		"__edgeMultiSelectCompatible",
	):
		assert contract in component


def test_multiselect_styles_are_loaded_and_version_is_aligned():
	hooks = (APP_ROOT / "hooks.py").read_text(encoding="utf-8")
	styles = (APP_ROOT / "public/css/edgeui_multiselect.css").read_text(encoding="utf-8")
	bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")
	package = (REPO_ROOT / "package.json").read_text(encoding="utf-8")

	assert "edgeui_multiselect.css" in hooks
	assert ".edge-form-field--multiselect" in styles
	assert ".edge-multiselect__option" in styles
	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in bundle
	assert f'"version": "{__version__}"' in package
