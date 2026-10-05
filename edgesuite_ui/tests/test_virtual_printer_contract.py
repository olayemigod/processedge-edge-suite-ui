from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EDGEUI = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui"
VIRTUAL_TRANSPORT = EDGEUI / "printing_virtual_transport.js"
RUNTIME = EDGEUI / "printing_runtime.js"
PAGE = ROOT / "edgesuite_ui" / "edgesuite_ui" / "page" / "edge_printing" / "edge_printing.js"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"


def test_virtual_printer_is_a_transport_not_a_persisted_profile_or_device():
    source = VIRTUAL_TRANSPORT.read_text()

    for expected in (
        "createVirtualPrinterTransport",
        "normalizePrintBytes",
        "inspectVirtualPrintJob",
        "VIRTUAL_PRINTER_WRITE_FAILED",
        "getLastJob",
        "getHistory",
        "setFailureMode",
        'virtual: true',
    ):
        assert expected in source

    for forbidden in (
        "frappe.call",
        "frappe.db",
        "localStorage",
        "Edge Print Profile",
        "insert(",
        "save(",
    ):
        assert forbidden not in source


def test_adapter_swaps_only_the_serial_transport_and_can_restore_physical_mode():
    source = RUNTIME.read_text()
    physical_restore = (
        "manager.registerTransport(EDGE_PRINT_TRANSPORTS.SERIAL, physicalSerialTransport, { replace: true })"
    )

    for expected in (
        'import { createVirtualPrinterTransport } from "./printing_virtual_transport"',
        "physicalSerialTransport",
        "virtualSerialTransport",
        "simulationEnabled",
        'manager.registerTransport(EDGE_PRINT_TRANSPORTS.SERIAL, virtualSerialTransport, { replace: true })',
        physical_restore,
        "simulation,",
        "createVirtualPrinterTransport:",
        'serialReason: "virtual_printer"',
        "catch (error)",
    ):
        assert expected in source

    assert source.count(physical_restore) >= 2
    assert "profiles = createPrintProfileClient" in source
    assert "encodeEscPosDocument" in source
    assert "manager.printReceipt(document, options)" in source


def test_devices_and_printing_exposes_system_manager_virtual_printer_qa_controls():
    source = PAGE.read_text()

    for expected in (
        "Virtual Printer (QA)",
        "Enable Virtual Printer",
        "Return to Physical Printer",
        "View Last Virtual Print",
        "Fail Next Print",
        "Clear Simulated Failure",
        "Thermal Text Preview",
        "ESC/POS Byte Sample",
        "simulation.enable()",
        "simulation.disable()",
        'simulation.setFailureMode(failureMode === "write" ? null : "write")',
        "canManageProfiles()",
        "edge-status-badge",
        "edge-button",
        "edge-card",
    ):
        assert expected in source

    assert 'frappe.set_route("List", "Edge Print Profile")' not in source


def test_virtual_print_inspection_tracks_receipt_hardware_commands_without_executing_them():
    source = VIRTUAL_TRANSPORT.read_text()

    for expected in (
        "cuts",
        "drawerPulses",
        "qrCommands",
        "barcodes",
        "feedLines",
        "hexSample",
        "previewText",
    ):
        assert expected in source

    assert "navigator.serial" not in source
    assert "requestPort(" not in source


def test_virtual_transport_is_exported_through_edgesuite_bundle():
    source = BUNDLE.read_text()
    assert 'export * from "./edgeui/printing_virtual_transport";' in source
