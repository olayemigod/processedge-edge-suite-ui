from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
PRINTING_RUNTIME = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_runtime.js"
SERIAL_TRANSPORT = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_serial_transport.js"
USB_TRANSPORT = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_usb_transport.js"
CAPABILITIES = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_capabilities.js"
CONTRACT = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_contract.js"


def test_shared_print_adapter_is_registered_on_edgesuite_runtime():
    source = BUNDLE.read_text()

    assert 'runtime.registerAdapter("print", edgePrintAdapter)' in source
    assert "runtime.print = edgePrintAdapter" in source
    assert 'export * from "./edgeui/printing_runtime"' in source


def test_printing_runtime_owns_transport_contract_not_product_business_logic():
    runtime = PRINTING_RUNTIME.read_text().lower()
    serial = SERIAL_TRANSPORT.read_text().lower()
    usb = USB_TRANSPORT.read_text().lower()
    source = runtime + serial + usb

    for product_term in ("retailedge", "vetedge", "eduedge", "posnext"):
        assert product_term not in source

    for expected in (
        "createprintmanager",
        "registertransport",
        "createwebserialtransport",
        "createwebusbtransport",
        "detectprintcapabilities",
        "writebytes",
        "writequeues",
    ):
        assert expected in source.replace(" ", "").replace("_", "").lower()


def test_serial_transport_fails_closed_and_remains_byte_oriented():
    source = SERIAL_TRANSPORT.read_text()

    for expected in (
        "SERIAL_UNSUPPORTED",
        "SERIAL_DEVICE_REQUIRED",
        "SERIAL_NOT_CONNECTED",
        "SERIAL_WRITE_FAILED",
        "normalizePrintBytes(bytes)",
        "writeChunkSize = 256",
        "writer.ready",
        "payload.subarray",
        "chunksWritten",
        "completedState",
        'addEventListener?.("disconnect"',
        "deviceConnected",
        "writer.releaseLock()",
    ):
        assert expected in source


def test_webusb_transport_uses_explicit_printer_selection_and_transfer_out():
    source = USB_TRANSPORT.read_text()

    for expected in (
        "USB_PRINTER_CLASS = 0x07",
        "USB_UNSUPPORTED",
        "USB_DEVICE_SELECTION_FAILED",
        "USB_DEVICE_REQUIRED",
        "USB_CONNECT_FAILED",
        "USB_NOT_CONNECTED",
        "USB_WRITE_FAILED",
        "requestDevice",
        "authorizedDevices",
        "getDevices",
        "claimInterface",
        "transferOut",
        "releaseInterface",
        "payload.subarray",
        "writeChunkSize = 4096",
        "normal system printing",
    ):
        assert expected in source

    assert "frappe.call" not in source
    assert "frappe.db" not in source


def test_capability_detection_is_secure_context_aware_for_serial_and_usb():
    source = CAPABILITIES.read_text()

    for expected in (
        "navigator?.serial",
        "navigator?.usb",
        "webSerial",
        "webUsb",
        "serialReason",
        "usbReason",
        "usbRequest",
        "usbAuthorizedDevices",
    ):
        assert expected in source


def test_shared_print_state_and_transport_contract_includes_usb_and_terminal_states():
    source = CONTRACT.read_text()

    for expected in (
        'USB: "usb"',
        'PERMISSION_REQUIRED: "permission_required"',
        'PRINTED: "printed"',
        'FAILED: "failed"',
    ):
        assert expected in source
