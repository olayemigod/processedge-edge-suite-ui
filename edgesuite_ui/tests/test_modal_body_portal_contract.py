from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_ROOT.parent


def test_modal_moves_rendered_root_to_document_body_without_vue_teleport():
	component = (APP_ROOT / "public/js/edgeui/modal_components.js").read_text(encoding="utf-8")
	for expected in (
		"portalToBody",
		"document.body.appendChild(root)",
		"this.$nextTick(this.portalToBody)",
		"if (this.open) this.portalToBody()",
	):
		assert expected in component
	assert "Teleport" not in component
	assert 'to: "body"' not in component


def test_modal_cross_runtime_patch_removes_vue_owned_template_refs():
	patch = (APP_ROOT / "public/js/edgeui/modal_cross_runtime.js").read_text(encoding="utf-8")
	bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")
	for expected in (
		"applyModalCrossRuntimeCompatibility",
		"renderRuntimeNeutralModal",
		"dialogElement",
		'root?.querySelector?.(".edge-modal")',
		"EdgeModal.render = renderRuntimeNeutralModal",
	):
		assert expected in patch
	assert 'ref: "dialog"' not in patch
	assert "this.$refs.dialog" not in patch
	assert 'from "./edgeui/modal_cross_runtime"' in bundle
	assert "applyModalCrossRuntimeCompatibility(modalComponents)" in bundle


def test_edgeui_032_versions_stay_aligned():
	bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")
	python_version = (APP_ROOT / "__init__.py").read_text(encoding="utf-8")
	package = (REPO_ROOT / "package.json").read_text(encoding="utf-8")
	assert 'EDGE_SUITE_UI_VERSION = "0.3.2"' in bundle
	assert '__version__ = "0.3.2"' in python_version
	assert '"version": "0.3.2"' in package
