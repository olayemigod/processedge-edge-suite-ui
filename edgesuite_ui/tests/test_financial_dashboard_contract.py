from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"
SOURCE = APP / "public/js/edgeui/financial_dashboard.js"
BUNDLE = APP / "public/js/edgeui.bundle.js"
HOOKS = APP / "hooks.py"
CSS = APP / "public/css/edgeui_financial_dashboard.css"


def test_signature_financial_dashboard_is_registered_as_shared_component():
    source = SOURCE.read_text()
    bundle = BUNDLE.read_text()
    hooks = HOOKS.read_text()

    for expected in (
        'name: "EdgeFinancialDashboard"',
        'name: "EdgeFinancialMetricCard"',
        'name: "EdgeFinancialCompositionPanel"',
        "FINANCIAL_DASHBOARD_SCHEMA_VERSION = 1",
        "financialDashboardComponents",
    ):
        assert expected in source

    assert 'import { financialDashboardComponents } from "./edgeui/financial_dashboard"' in bundle
    assert "...financialDashboardComponents" in bundle
    assert 'export * from "./edgeui/financial_dashboard"' in bundle
    assert '"/assets/edgesuite_ui/css/edgeui_financial_dashboard.css"' in hooks


def test_signature_financial_dashboard_reuses_edgesuite_primitives_and_one_smart_date():
    source = SOURCE.read_text()

    for expected in (
        "EdgeDashboardShell",
        "EdgeDashboardGrid",
        "EdgeDashboardSection",
        "EdgeReportTable",
        "EdgeSmartDateRange",
        'label: "Date"',
        '"update:dateModel"',
        '"date-resolved"',
        '"quick-reports"',
        '"refresh"',
        '"action"',
    ):
        assert expected in source

    assert source.count("EdgeSmartDateRange") >= 2
    assert "From Date" not in source
    assert "To Date" not in source


def test_signature_financial_dashboard_contract_distinguishes_state_basis_and_actions():
    source = SOURCE.read_text()

    for expected in (
        '"available", "empty", "unavailable", "restricted", "partial", "error"',
        'period: "Selected period"',
        'current: "Current"',
        'invoice_cohort: "Invoice cohort"',
        'as_of: "As of"',
        '"page", "report", "route"',
        "validAction",
        "Unsupported financial dashboard schema",
    ):
        assert expected in source


def test_composition_renderer_pairs_visual_and_table_and_falls_back_for_signed_values():
    source = SOURCE.read_text()
    css = CSS.read_text()

    for expected in (
        "conic-gradient",
        'composition.chart_kind === "bar"',
        "Number(row.value) < 0",
        "EdgeReportTable",
        "display_share",
        "display_value",
    ):
        assert expected in source

    for expected in (
        ".edge-financial-composition",
        ".edge-financial-composition__donut",
        ".edge-financial-composition__bars",
        ".edge-financial-composition__bar",
        "@media(max-width:48rem)",
    ):
        assert expected in css


def test_shared_financial_dashboard_contains_no_product_data_or_accounting_queries():
    source = SOURCE.read_text()

    for forbidden in (
        "frappe.call",
        "frappe.db",
        "ignore_permissions",
        "Sales Invoice",
        "Payment Entry",
        "Purchase Invoice",
        "RetailEdge",
        "VetEdge",
        "Veterinary",
        "Consultation",
        "NGN",
        "setInterval(",
    ):
        assert forbidden not in source


def test_restricted_metrics_do_not_render_payload_values():
    source = SOURCE.read_text()
    assert 'if (state !== "available" && state !== "partial") return "—";' in source


def test_financial_dashboard_preserves_restricted_and_unavailable_section_states():
    source = SOURCE.read_text()
    for expected in (
        '"Composition restricted"',
        '"Composition unavailable"',
        "composition.reason",
        'if (!["restricted", "unavailable", "error", "partial"].includes(state)) return null;',
        "data.reason || data.empty_description",
        'state === "restricted" ?',
    ):
        assert expected in source


def test_empty_optional_sections_can_still_remain_hidden():
    source = SOURCE.read_text()
    assert 'data.availability || (rows.length ? "available" : "empty")' in source
    assert 'if (!["restricted", "unavailable", "error", "partial"].includes(state)) return null;' in source
