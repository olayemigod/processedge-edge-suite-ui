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
        'REPORT_RUNTIME_VERSION = "1.2.0"',
        'QUERY: "query-report"',
        'PAGINATED: "paginated"',
        'BOUNDED_PAGINATED: "bounded-paginated"',
        'createQueryReportProvider',
        'createPaginatedReportProvider',
        'createBoundedPaginatedReportProvider',
        'createReportProviderRegistry',
        'normalizeReportPayload',
        'supports_server_pagination: true',
        'supports_server_pagination: false',
        'supports_query_level_pagination: true',
        'supports_query_level_pagination: false',
        'supports_sorting: true',
        'sorting_strategy: "materialized"',
        'sorting_strategy: "server"',
        'pagination_strategy: "query-level"',
        'pagination_strategy: "bounded-materialized"',
        'max_dataset_rows',
        'max_page_length',
        'export: exportHandler',
        'exportReport: exportHandler',
        'target.EdgeSuiteReports = reports',
        'edgesuite:report-runtime-ready',
        'CustomEvent("edgesuite:report-runtime-ready"',
    ):
        assert expected in runtime


def test_paginated_provider_keeps_interactive_and_export_paths_separate():
    runtime = (APP / "public/js/edgeui/report_runtime.js").read_text()

    assert 'loadPage({ filters, start: safeStart, page_length: safeLength, sort: normalizedSort })' in runtime
    assert 'loadSummary({ filters })' in runtime
    assert 'loadChart({ filters })' in runtime
    assert 'export: exportHandler' in runtime
    assert 'exportReport: exportHandler' in runtime
    assert 'Math.min(maximumLength' in runtime

    for forbidden in (
        'ignore_permissions',
        'frappe.get_all',
        'setInterval(',
        'window.location',
    ):
        assert forbidden not in runtime


def test_bounded_provider_requires_declared_dataset_cap_and_does_not_claim_query_level_pagination():
    runtime = (APP / "public/js/edgeui/report_runtime.js").read_text()

    bounded_start = runtime.index("export function createBoundedPaginatedReportProvider")
    bounded_end = runtime.index("function providerKey", bounded_start)
    bounded = runtime[bounded_start:bounded_end]

    assert "maxDatasetRows" in bounded
    assert "datasetLimit < 1" in bounded
    assert 'kind: PROVIDER_KINDS.BOUNDED_PAGINATED' in bounded
    assert "supports_server_pagination: true" in bounded
    assert "supports_query_level_pagination: false" in bounded
    assert "supports_sorting: true" in bounded
    assert 'sorting_strategy: "server"' in bounded
    assert 'pagination_strategy: "bounded-materialized"' in bounded
    assert "max_dataset_rows: datasetLimit" in bounded
    assert 'loadPage({ filters, start: safeStart, page_length: safeLength, sort: normalizedSort })' in bounded
    assert 'export: exportHandler' in bounded
    assert 'exportReport: exportHandler' in bounded
