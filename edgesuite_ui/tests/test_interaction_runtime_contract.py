from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_shared_runtime_installs_keyboard_commands_density_and_accordion():
    bundle = (APP / "public/js/edgeui.bundle.js").read_text()
    interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
    menu_extras = (APP / "public/js/edgeui/product_menu_extras.js").read_text()
    hooks = (APP / "hooks.py").read_text()

    for expected in (
        'import { installEdgeSuiteInteractionRuntime } from "./edgeui/interaction_runtime"',
        'import { installProductMenuExtras } from "./edgeui/product_menu_extras"',
        "installEdgeSuiteInteractionRuntime(runtime, globalThis)",
        "installProductMenuExtras(runtime, globalThis)",
        'export * from "./edgeui/interaction_runtime"',
        'export * from "./edgeui/product_menu_extras"',
        'EDGE_SUITE_UI_VERSION = "0.5.6"',
    ):
        assert expected in bundle

    for expected in (
        'const COMMAND_VERSION = "1.0.0"',
        "registerSaveHandler",
        "activateSaveHandler",
        "saveCurrentContext",
        "openCommandPalette",
        "runtime?.openProductMenu?.()",
        'new target.CustomEvent("edgesuite:save-request"',
        'document.querySelectorAll(".edge-app-shell")',
        'document.getElementById("edge-product-menu-dropdown")',
        'target.EdgeSuiteCommands = commands',
        'runtime.setDensity = density.setDensity',
    ):
        assert expected in interaction

    for expected in (
        'const QUICK_ACTION_SECTION_KEY = "quick-actions"',
        "normalizedQuickActions",
        "withQuickActions",
        'label: "Quick Actions"',
        "runtime.setDensity?.(select.value)",
        "runtime.getProductMenuSourceConfig",
    ):
        assert expected in menu_extras

    assert '"/assets/edgesuite_ui/css/edgeui_density.css"' in hooks


def test_ctrl_s_preserves_workflow_and_submitted_document_safety():
    interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()

    for expected in (
        "Number(form.doc.docstatus || 0) !== 0",
        "Submitted documents cannot be changed with this shortcut.",
        "await form.save()",
        '[data-edgesuite-save]:not([disabled])',
        "textarea, [contenteditable='true']",
    ):
        assert expected in interaction

    for forbidden in (
        "frappe.db.set_value",
        "ignore_permissions",
        ".submit()",
        ".cancel()",
        'querySelectorAll("button:not([disabled])")',
    ):
        assert forbidden not in interaction


def test_shared_accordion_keeps_one_sidebar_and_waffle_section_open():
    interaction = (APP / "public/js/edgeui/interaction_runtime.js").read_text()
    density = (APP / "public/css/edgeui_density.css").read_text()

    for expected in (
        "function reconcileSidebar",
        "expanded.length <= 1",
        "expanded.filter((section) => section !== keep).forEach(closeSection)",
        "function reconcileProductMenu",
        'section.classList.toggle("is-collapsed", collapse)',
        'heading.setAttribute("aria-expanded"',
    ):
        assert expected in interaction

    for mode in ("compact", "comfortable", "touch"):
        assert f'html[data-edge-density="{mode}"]' in density
