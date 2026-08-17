from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_report_runtime_is_exported_and_installed():
    bundle = (APP / "public/js/edgeui.bundle.js").read_text()
    runtime = (APP / "public/js/edgeui/report_runtime.js").read_text()

    for expected in (
        'installEdgeSuiteReportRuntime(runtime, globalThis)',
        'export * from "./edgeui/report_runtime"',
        'import { installEdgeSuiteReportRuntime } from "./edgeui/report_runtime"',
    ):
        assert expected in bundle

    for expected in (
        'REPORT_RUNTIME_VERSION = "1.0.0"',
        'QUERY: "query-report"',
        'PAGINATED: "paginated"',
        'createQueryReportProvider',
        'createPaginatedReportProvider',
        'createReportProviderRegistry',
        'normalizeReportPayload',
        'supports_server_pagination: true',
        'supports_server_pagination: false',
        'max_page_length',
        'target.EdgeSuiteReports = reports',
        'edgesuite:report-runtime-ready',
        'CustomEvent("edgesuite:report-runtime-ready"',
    ):
        assert expected in runtime


def test_paginated_provider_keeps_interactive_and_export_paths_separate():
    runtime = (APP / "public/js/edgeui/report_runtime.js").read_text()

    assert 'loadPage({ filters, start: safeStart, page_length: safeLength })' in runtime
    assert 'loadSummary({ filters })' in runtime
    assert 'loadChart({ filters })' in runtime
    assert 'export: typeof exportReport === "function" ? exportReport : null' in runtime
    assert 'Math.min(maximumLength' in runtime

    for forbidden in (
        'ignore_permissions',
        'frappe.get_all',
        'setInterval(',
        'window.location',
    ):
        assert forbidden not in runtime
