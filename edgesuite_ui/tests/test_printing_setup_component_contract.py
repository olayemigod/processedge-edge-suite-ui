from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMPONENT = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_components.js"
PROFILE_RUNTIME = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_profile_runtime.js"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_printing.css"


def test_shared_printer_setup_component_is_registered():
    component = COMPONENT.read_text()
    bundle = BUNDLE.read_text()

    assert 'name: "EdgePrinterSetupCard"' in component
    assert "printingComponents" in component
    assert 'import { printingComponents } from "./edgeui/printing_components"' in bundle
    assert "...printingComponents" in bundle


def test_printer_setup_component_uses_shared_profile_binding_and_transport_layers():
    source = COMPONENT.read_text()

    for expected in (
        "adapter.profiles.resolve",
        "adapter.devices.restoreSerial",
        "adapter.devices.requestAndBindSerial",
        "adapter.devices.connectBoundSerial",
        "adapter.printReceipt",
        "Connect Printer",
        "Reconnect",
        "Test Print",
        "Disconnect",
        "Forget Printer",
    ):
        assert expected in source

    assert "navigator.serial" not in source
    assert "frappe.call" not in source


def test_print_profile_runtime_bridges_frappe_policy_without_device_access():
    source = PROFILE_RUNTIME.read_text()

    assert "edgesuite_ui.api.printing.resolve_print_profile" in source
    assert "edgesuite_ui.api.printing.get_active_print_profiles" in source
    assert "normalizePrintProfile" in source
    assert "receiptDocumentOptionsFromProfile" in source
    assert "connectionOptionsFromProfile" in source

    assert "navigator.serial" not in source
    assert "localStorage" not in source


def test_printer_setup_styles_are_loaded_globally():
    hooks = HOOKS.read_text()
    css = CSS.read_text()

    assert "/assets/edgesuite_ui/css/edgeui_printing.css" in hooks
    for expected in (
        ".edge-printer-setup",
        ".edge-printer-setup__status",
        ".edge-printer-setup__meta",
        ".edge-printer-setup__actions",
    ):
        assert expected in css
