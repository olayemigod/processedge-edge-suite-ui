from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_shared_edge_modal_exposes_visible_busy_feedback():
    modal = read("edgesuite_ui/public/js/edgeui/modal_components.js")
    css = read("edgesuite_ui/public/css/edgeui_modal.css")

    # EdgeModal already makes busy state authoritative for interaction safety.
    assert "disabled: this.busy" in modal
    assert "if (!this.busy) this.$emit(\"close\")" in modal

    # The shared CSS converts that same state into central visible feedback for
    # every product app without requiring a product-specific logo or network asset.
    assert ".edge-modal:has(.edge-modal__close:disabled)::before" in css
    assert ".edge-modal:has(.edge-modal__close:disabled)::after" in css
    assert 'content: "Processing\\2026";' in css
    assert "edge-modal-busy-spin" in css
    assert "cursor: wait" in css
    assert "var(--edge-color-brand-600" in css
    assert "prefers-reduced-motion: reduce" in css
