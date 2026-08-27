from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_report_print_runtime_is_shared_and_exported():
    bundle = (APP / "public/js/edgeui.bundle.js").read_text()
    print_runtime = (APP / "public/js/edgeui/report_print.js").read_text()

    for expected in (
        'import { installEdgeSuiteReportPrintRuntime } from "./edgeui/report_print"',
        "installEdgeSuiteReportPrintRuntime(runtime, globalThis)",
        'export * from "./edgeui/report_print"',
    ):
        assert expected in bundle

    for expected in (
        'REPORT_PRINT_VERSION = "1.0.0"',
        "validateReportPrintHtml",
        "openReportPrintWindow",
        "runtime.reportPrint = api",
        "target.EdgeSuiteReportPrint = api",
        "win.document.write(content)",
        "win.print?.()",
    ):
        assert expected in print_runtime


def test_print_runtime_rejects_invalid_server_content_and_has_no_data_loader():
    print_runtime = (APP / "public/js/edgeui/report_print.js").read_text()

    assert 'throw new Error("The generated print document is empty.")' in print_runtime
    assert 'throw new Error("The server did not return a valid report print document.")' in print_runtime
    for forbidden in ("frappe.call", "fetch(", "XMLHttpRequest", "ignore_permissions", "setInterval("):
        assert forbidden not in print_runtime
