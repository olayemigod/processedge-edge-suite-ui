from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def test_report_and_dashboard_shells_are_shared_runtime_components():
    bundle = (APP / "public/js/edgeui.bundle.js").read_text()
    source = (APP / "public/js/edgeui/report_presentation.js").read_text()
    hooks = (APP / "hooks.py").read_text()

    for expected in (
        'import { reportPresentationComponents } from "./edgeui/report_presentation"',
        'import { reportShellActionComponents } from "./edgeui/report_shell_actions"',
        "...reportPresentationComponents",
        "...reportShellActionComponents",
        'export * from "./edgeui/report_presentation"',
        'export * from "./edgeui/report_shell_actions"',
    ):
        assert expected in bundle

    for expected in (
        'name: "EdgeReportShell"',
        'name: "EdgeReportTable"',
        'name: "EdgeDashboardShell"',
        'name: "EdgeDashboardGrid"',
        'name: "EdgeDashboardSection"',
        "reportPresentationComponents",
    ):
        assert expected in source

    assert '"/assets/edgesuite_ui/css/edgeui_reporting_presentation.css"' in hooks


def test_report_shell_centralizes_common_report_states_and_pagination():
    source = (APP / "public/js/edgeui/report_presentation.js").read_text()

    for expected in (
        "EdgePageLayout",
        "EdgePageHeader",
        "EdgeFilterBar",
        "EdgeStatCard",
        "EdgeLoadingState",
        "EdgeErrorState",
        "EdgeEmptyState",
        "EdgeReportTable",
        'emits: ["retry", "page-change", "page-size-change", "cell-click", "row-click"]',
        '"Rows per page"',
        '"Previous"',
        '"Next"',
    ):
        assert expected in source


def test_shell_action_wrappers_add_opt_in_export_print_tier_and_view_state_without_product_logic():
    source = (APP / "public/js/edgeui/report_shell_actions.js").read_text()

    for expected in (
        'name: "EdgeReportShell"',
        'name: "EdgeDashboardShell"',
        "EdgeReportExportDialog",
        'exportEnabled: { type: Boolean, default: false }',
        'printEnabled: { type: Boolean, default: false }',
        'tier: { type: String, default: "" }',
        'subscriptionEntitled: { type: Boolean, default: true }',
        'columnChooserEnabled: { type: Boolean, default: false }',
        'viewState: { type: Object, default: () => ({}) }',
        '"view-state-change"',
        'visible_columns: [...this.ensureVisibleColumnState()]',
        '"Advanced · Locked"',
        'exportButtonLabel: { type: String, default: "Download / Export" }',
        'exportButtonLabel: { type: String, default: "Download Dashboard" }',
        'artifact_kind: "dashboard"',
        "reportShellActionComponents",
    ):
        assert expected in source

    for forbidden in (
        "frappe.call",
        "frappe.db",
        "ignore_permissions",
        "advanced_reports",
        "localStorage",
        "sessionStorage",
        "Sales Invoice",
        "Veterinary",
        "RetailEdge",
        "VetEdge",
        "EduEdge",
    ):
        assert forbidden not in source


def test_column_chooser_is_opt_in_serializable_and_cannot_hide_every_column():
    source = (APP / "public/js/edgeui/report_shell_actions.js").read_text()

    for expected in (
        "normalizedVisibleKeys",
        "visibleColumnKeys",
        "visibleColumns()",
        "toggleColumn(key)",
        "resetColumns()",
        'if (!next.length) return;',
        'disabled: visible.size === 1 && visible.has(key)',
        'class: "edge-report-columns__panel"',
        '"Visible columns"',
        '"Show all"',
        "const columns = this.visibleColumns();",
        "const baseAttrs = { ...this.$attrs, columns };",
        "columns,\n            initialOptions: this.exportInitialOptions",
    ):
        assert expected in source

    # The shared shell reports state upward; persistence/URL/permission policy
    # remains product-owned and is intentionally absent from EdgeSuite UI.
    assert "save_view" not in source
    assert "saved_view" not in source


def test_report_table_has_reporting_specific_format_and_drilldown_contract():
    source = (APP / "public/js/edgeui/report_presentation.js").read_text()

    for expected in (
        "numericColumn",
        "defaultFormat",
        '"currency"',
        '"percent"',
        '"edge-report-table__link"',
        'this.$emit("cell-click"',
        'this.$emit("row-click"',
        'fieldtype === "link"',
        "stickyHeader",
    ):
        assert expected in source


def test_dashboard_shell_is_compositional_not_a_report_table_alias():
    source = (APP / "public/js/edgeui/report_presentation.js").read_text()

    start = source.index("export const EdgeDashboardShell")
    end = source.index("export const reportPresentationComponents")
    dashboard = source[start:end]
    assert "EdgePageLayout" in dashboard
    assert "EdgePageHeader" in dashboard
    assert "EdgeStatCard" in dashboard
    assert 'slot(this.$slots, "default"' in dashboard
    assert "EdgeReportTable" not in dashboard
    assert "pagination" not in dashboard.lower()


def test_presentation_layer_does_not_own_product_data_or_permissions():
    source = (APP / "public/js/edgeui/report_presentation.js").read_text()

    for forbidden in (
        "frappe.call",
        "frappe.db",
        "ignore_permissions",
        "fetch(",
        "XMLHttpRequest",
        "setInterval(",
        "Sales Invoice",
        "Purchase Invoice",
        "Veterinary",
        "RetailEdge",
        "VetEdge",
        "EduEdge",
    ):
        assert forbidden not in source


def test_presentation_css_is_responsive_and_uses_semantic_tokens():
    css = (APP / "public/css/edgeui_reporting_presentation.css").read_text()

    for expected in (
        ".edge-report-shell__summary",
        ".edge-report-table",
        ".edge-report-columns__panel",
        ".edge-report-columns__option",
        ".edge-dashboard-shell__summary",
        ".edge-dashboard-grid",
        ".edge-dashboard-section",
        "var(--edge-color-surface",
        "var(--edge-color-border",
        "@media(max-width:48rem)",
        "overflow:auto",
    ):
        assert expected in css
