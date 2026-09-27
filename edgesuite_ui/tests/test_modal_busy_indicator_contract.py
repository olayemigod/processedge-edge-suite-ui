from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_shared_edge_modal_exposes_visible_busy_feedback():
    modal = read("edgesuite_ui/public/js/edgeui/modal_components.js")
    css = read("edgesuite_ui/public/css/edgeui_modal.css")

    # EdgeModal makes busy state authoritative for interaction safety and
    # renders explicit accessible feedback rather than inferring it in CSS.
    assert "disabled: this.busy" in modal
    assert "if (!this.busy) this.$emit(\"close\")" in modal
    assert 'busyLabel: { type: String, default: "Processing…" }' in modal
    assert '"aria-busy": this.busy ? "true" : "false"' in modal
    assert 'class: "edge-modal__busy"' in modal
    assert 'role: "status"' in modal
    assert '"aria-live": "polite"' in modal
    assert 'class: "edge-modal__busy-spinner"' in modal
    assert 'class: "edge-modal__busy-label"' in modal

    # Product-neutral shared styling remains theme-safe and respects reduced
    # motion without requiring a logo asset or extra network request.
    assert ".edge-modal--busy { cursor: wait; }" in css
    assert ".edge-modal__busy {" in css
    assert ".edge-modal__busy-spinner {" in css
    assert "edge-modal-busy-spin" in css
    assert "var(--edge-color-brand-600" in css
    assert "prefers-reduced-motion: reduce" in css
    assert ":has(.edge-modal__close:disabled)" not in css
