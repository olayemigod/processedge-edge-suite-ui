from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BINDING = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_device_binding.js"


def test_device_binding_is_local_and_does_not_persist_browser_device_objects():
    source = BINDING.read_text()

    for expected in (
        "createPrinterBindingStore",
        "createPrinterDeviceManager",
        "bindingMatchesStatus",
        "requestAndBindSerial",
        "restoreSerial",
        "connectBoundSerial",
        "requestAndBindUsb",
        "restoreUsb",
        "connectBoundUsb",
        "SERIAL_BINDING_AMBIGUOUS",
        "USB_BINDING_AMBIGUOUS",
        "SERIAL_BOUND_DEVICE_UNAVAILABLE",
        "USB_BOUND_DEVICE_UNAVAILABLE",
        "localStorage",
        "portInfo",
        "deviceInfo",
        "vendorId",
        "productId",
        "serialNumber",
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

    assert "SERIAL_BINDING_AMBIGUOUS" in source
    assert "More than one authorized printer matches this device binding" in source
    assert "if (!matches.length) return null" in source


def test_ambiguous_authorized_usb_devices_fail_closed():
    source = BINDING.read_text()

    assert "USB_BINDING_AMBIGUOUS" in source
    assert "More than one authorized USB printer matches this device binding" in source
    assert "safeUsbDeviceInfo" in source
    assert "sameUsbDeviceInfo" in source
    assert "transport.useDevice(matches[0])" in source


def test_bound_device_status_matching_stays_transport_aware():
    source = BINDING.read_text()

    assert "statusTransport && statusTransport !== binding.transport" in source
    assert "samePortInfo(status?.portInfo || {}, binding.portInfo || {})" in source
    assert "sameUsbDeviceInfo(status?.deviceInfo || {}, binding.deviceInfo || {})" in source
