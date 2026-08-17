from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_export_builder_is_shared_runtime_component():
    bundle = (APP / "public/js/edgeui.bundle.js").read_text()
    compat = (APP / "public/js/edgeui/runtime_component_compat.js").read_text()
    export = (APP / "public/js/edgeui/report_export.js").read_text()
    hooks = (APP / "hooks.py").read_text()

    for expected in (
        'installEdgeSuiteReportExportRuntime, reportComponents',
        'installEdgeSuiteReportExportRuntime(runtime, globalThis)',
        'export * from "./edgeui/report_export"',
        "reportComponents,",
    ):
        assert expected in bundle

    assert "reportComponents = {}" in compat
    assert "...reportComponents" in compat
    assert 'name: "EdgeReportExportDialog"' in export
    assert '"/assets/edgesuite_ui/css/edgeui_report_export.css"' in hooks


def test_no_presentation_options_means_raw_table_only():
    export = (APP / "public/js/edgeui/report_export.js").read_text()

    for key in (
        '"include_summary"',
        '"include_filters"',
        '"include_charts"',
        '"include_letterhead"',
        '"include_title"',
        '"include_generated_metadata"',
        '"include_totals"',
    ):
        assert key in export
    assert "PRESENTATION_KEYS.every((key) => !normalized[key])" in export
    assert "normalized.raw_table_only" in export
    assert "raw table only" in export


def test_export_verifier_rejects_empty_html_and_invalid_binary_files():
    export = (APP / "public/js/edgeui/report_export.js").read_text()

    for expected in (
        'throw new Error("The generated export is empty.")',
        'throw new Error("The server returned an HTML/error page instead of the requested export file.")',
        'throw new Error("The generated PDF is invalid or incomplete.")',
        'throw new Error("The generated XLSX file is invalid or incomplete.")',
        "[0x25, 0x50, 0x44, 0x46, 0x2d]",
        "[0x50, 0x4b]",
        "validateReportExportBytes({ bytes, format, mime })",
    ):
        assert expected in export


def test_export_formats_mime_and_scope_contract():
    export = (APP / "public/js/edgeui/report_export.js").read_text()

    for expected in (
        'Object.freeze(["xlsx", "csv", "pdf"])',
        'Object.freeze(["current_page", "all_filtered"])',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/pdf',
        '"portrait"',
        '"landscape"',
        "repeat_table_headings",
        "normalizedReportFilename",
    ):
        assert expected in export
