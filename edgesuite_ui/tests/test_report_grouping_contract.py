from pathlib import Path

APP = Path(__file__).resolve().parents[1]
SOURCE = APP / "public/js/edgeui/report_grouping.js"
BUNDLE = APP / "public/js/edgeui.bundle.js"
HOOKS = APP / "hooks.py"
CSS = APP / "public/css/edgeui_report_grouping.css"


def test_grouping_panel_is_product_neutral_and_runtime_exposed():
    source = SOURCE.read_text(encoding="utf-8")
    bundle = BUNDLE.read_text(encoding="utf-8")

    for expected in (
        "EdgeReportGroupingPanel",
        "groupLabel",
        "measures",
        "group_key",
        "tones",
        "reportGroupingComponents",
    ):
        assert expected in source or expected in bundle

    assert 'export * from "./edgeui/report_grouping"' in bundle

    for forbidden in (
        "vetedge",
        "retailedge",
        "eduedge",
        "frappe.call",
        "frappe.db",
        "localStorage",
        "sessionStorage",
    ):
        haystack = source.lower() if forbidden in {"vetedge", "retailedge", "eduedge"} else source
        assert forbidden not in haystack


def test_grouping_panel_is_responsive_and_loaded_as_shared_css():
    hooks = HOOKS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    assert "/assets/edgesuite_ui/css/edgeui_report_grouping.css" in hooks
    assert ".edge-report-grouping__table" in css
    assert "@media(max-width:48rem)" in css
    assert "@media(max-width:32rem)" in css
