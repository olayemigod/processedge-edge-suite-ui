from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]


def test_edge_modal_resets_body_scroll_on_fresh_open_only():
	patch = (APP_ROOT / "public/js/edgeui/modal_cross_runtime.js").read_text(encoding="utf-8")

	for expected in (
		'function resetModalBodyScroll(root)',
		'root?.querySelector?.(".edge-modal__body")',
		'body.scrollTop = 0;',
		'body.scrollLeft = 0;',
		'const wasBodyLocked = Boolean(this.bodyLocked);',
		'if (!wasBodyLocked && this.bodyLocked) resetModalBodyScroll(root);',
	):
		assert expected in patch


def test_edge_modal_does_not_reset_scroll_during_normal_open_updates():
	component = (APP_ROOT / "public/js/edgeui/modal_components.js").read_text(encoding="utf-8")
	patch = (APP_ROOT / "public/js/edgeui/modal_cross_runtime.js").read_text(encoding="utf-8")

	assert 'updated() {\n    if (this.open) this.portalToBody();\n  }' in component
	assert 'if (!wasBodyLocked && this.bodyLocked) resetModalBodyScroll(root);' in patch
	assert 'if (this.bodyLocked || typeof document === "undefined") return;' in component


def test_modal_scroll_compatibility_is_applied_to_shared_runtime():
	bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")

	assert 'from "./edgeui/modal_cross_runtime"' in bundle
	assert "applyModalCrossRuntimeCompatibility(modalComponents);" in bundle
