from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BINDING = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_device_binding.js"


def test_device_binding_is_local_and_does_not_persist_browser_port_objects():
    source = BINDING.read_text()

    for expected in (
        "createPrinterBindingStore",
        "createPrinterDeviceManager",
        "requestAndBindSerial",
        "restoreSerial",
        "connectBoundSerial",
        "SERIAL_BINDING_AMBIGUOUS",
        "SERIAL_BOUND_DEVICE_UNAVAILABLE",
        "localStorage",
        "portInfo",
    ):
        assert expected in source

    for forbidden in (
        "mac_address",
        "macAddress",
        "bluetoothAddress",
        "frappe.db",
        "frappe.call",
    ):
        assert forbidden not in source


def test_ambiguous_authorized_serial_devices_fail_closed():
    source = BINDING.read_text()

    assert "if (matches.length > 1)" in source
    assert "Select the printer again" in source
    assert "if (!matches.length) return null" in source
