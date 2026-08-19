from pathlib import Path

APP = Path(__file__).resolve().parents[1]
SOURCE = APP / "public/js/edgeui/report_comparison.js"
BUNDLE = APP / "public/js/edgeui.bundle.js"
HOOKS = APP / "hooks.py"
CSS = APP / "public/css/edgeui_report_comparison.css"


def test_comparison_panel_is_product_neutral_and_runtime_exposed():
    source = SOURCE.read_text(encoding="utf-8")
    bundle = BUNDLE.read_text(encoding="utf-8")

    for expected in (
        "EdgeReportComparisonPanel",
        "currentLabel",
        "comparisonLabel",
        "delta_percent",
        "delta_tone",
        "formatted_current",
        "formatted_comparison",
    ):
        assert expected in source

    assert "reportComparisonComponents" in bundle
    assert 'export * from "./edgeui/report_comparison"' in bundle

    for forbidden in (
        "vetedge",
        "retailedge",
        "eduedge",
        "frappe.call",
        "frappe.db",
        "localStorage",
        "sessionStorage",
    ):
        assert forbidden not in source.lower() if forbidden in {"vetedge", "retailedge", "eduedge"} else forbidden not in source


def test_comparison_panel_is_responsive_and_loaded_as_shared_css():
    hooks = HOOKS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    assert "/assets/edgesuite_ui/css/edgeui_report_comparison.css" in hooks
    assert ".edge-report-comparison__grid" in css
    assert "@media(max-width:64rem)" in css
    assert "@media(max-width:32rem)" in css
