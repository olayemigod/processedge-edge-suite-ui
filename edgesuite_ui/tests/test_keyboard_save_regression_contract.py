from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_ctrl_s_saves_normal_editing_surfaces_but_leaves_code_editors_in_control():
    guard = (APP / "public/js/edgeui_ctrl_s_guard.js").read_text()

    assert "textarea, input, [contenteditable='true']" in guard
    assert "function editorOwnsSaveShortcut" in guard
    assert 'target.closest(".CodeMirror, .ace_editor, .monaco-editor")' in guard
    assert "if (isEditing && editorOwnsSaveShortcut(event.target)) return;" in guard

    # Normal text/rich-text editing must not be the old silent no-op path.
    assert "if (editingSurface(event.target)) return;" not in guard
    assert "event.preventDefault();" in guard
    assert "event.stopImmediatePropagation?.();" in guard


def test_ctrl_s_uses_safe_request_bridge_for_custom_pages_and_preserves_submitted_docs():
    guard = (APP / "public/js/edgeui_ctrl_s_guard.js").read_text()
    bridge = (APP / "public/js/edgeui/workflow_save_bridge.js").read_text()

    for expected in (
        'new globalThis.CustomEvent("edgesuite:save-request", { detail })',
        "if (await saveViaRequestEvent()) return true;",
        "Number(form.doc.docstatus || 0) !== 0",
        "Submitted documents cannot be changed with this shortcut.",
        "if (saveInFlight) return;",
    ):
        assert expected in guard

    for expected in (
        "function explicitPageSaveButton",
        'document.querySelectorAll("[data-edgesuite-save]:not([disabled])")',
        "candidates.length === 1 ? candidates[0] : null",
        "const explicitPageSave = explicitPageSaveButton(document, target);",
        "if (explicitPageSave) return explicitPageSave;",
    ):
        assert expected in bridge

    # Explicit save discovery must not broaden into dangerous workflow actions.
    for forbidden in ("submit()", "cancel()", "ignore_permissions"):
        assert forbidden not in guard
        assert forbidden not in bridge
