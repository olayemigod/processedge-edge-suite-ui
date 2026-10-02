from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
PRINTING_RUNTIME = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_runtime.js"
SERIAL_TRANSPORT = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_serial_transport.js"


def test_shared_print_adapter_is_registered_on_edgesuite_runtime():
    source = BUNDLE.read_text()

    assert 'runtime.registerAdapter("print", edgePrintAdapter)' in source
    assert "runtime.print = edgePrintAdapter" in source
    assert 'export * from "./edgeui/printing_runtime"' in source


def test_printing_runtime_owns_transport_contract_not_product_business_logic():
    runtime = PRINTING_RUNTIME.read_text().lower()
    serial = SERIAL_TRANSPORT.read_text().lower()
    source = runtime + serial

    for product_term in ("retailedge", "vetedge", "eduedge", "posnext"):
        assert product_term not in source

    for expected in (
        "createprintmanager",
        "registertransport",
        "createwebserialtransport",
        "detectprintcapabilities",
        "writebytes",
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
        "writer.releaseLock()",
    ):
        assert expected in source
