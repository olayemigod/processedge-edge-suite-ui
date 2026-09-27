from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"
RUNTIME = APP / "public/js/edgeui/report_runtime.js"
PRESENTATION = APP / "public/js/edgeui/report_presentation.js"
SHELL = APP / "public/js/edgeui/report_shell_actions.js"
CSS = APP / "public/css/edgeui_reporting_presentation.css"


def test_report_runtime_has_product_neutral_sorting_contract():
    source = RUNTIME.read_text(encoding="utf-8")

    for expected in (
        'const REPORT_RUNTIME_VERSION = "1.2.0"',
        'const SORT_DIRECTIONS = new Set(["asc", "desc"])',
        "function normalizeSort(sort = null)",
        "function sortMaterializedRows(rows = [], columns = [], sort = null)",
        'supports_sorting: true',
        'sorting_strategy: "materialized"',
        'sorting_strategy: "server"',
        "loadPage({ filters, start: safeStart, page_length: safeLength, sort: normalizedSort })",
        "sort: normalizeSort(payload.sort || request.sort)",
        "sortMaterializedRows(normalized.rows, normalized.columns, normalizedSort)",
    ):
        assert expected in source

    for forbidden in (
        "frappe.call",
        "frappe.db",
        "Sales Invoice",
        "Veterinary",
        "RetailEdge",
        "VetEdge",
        "EduEdge",
    ):
        assert forbidden not in source


def test_materialized_sorting_is_typed_stable_and_null_safe():
    source = RUNTIME.read_text(encoding="utf-8")

    for expected in (
        '["currency", "float", "int", "percent", "number", "check"]',
        '["date", "datetime", "time"]',
        "Date.parse(String(value))",
        "if (a.empty) return 1;",
        "if (b.empty) return -1;",
        "return comparison ? comparison * factor : left.index - right.index;",
        'column?.sortable !== false',
    ):
        assert expected in source


def test_report_table_headers_are_sortable_and_accessible():
    source = PRESENTATION.read_text(encoding="utf-8")

    for expected in (
        'sort: { type: Object, default: null }',
        'sortingEnabled: { type: Boolean, default: true }',
        'emits: ["cell-click", "row-click", "sort-change"]',
        '"aria-sort": canSort ? this.ariaSort(column, index) : undefined',
        'class: "edge-report-table__sort"',
        'activeSort ? (activeSort.direction === "desc" ? "↓" : "↑") : "↕"',
        'this.$emit("sort-change", nextSort(this.sort, columnKey(column, index)))',
        'if (current.direction === "asc") return { field, direction: "desc" };',
        "return null;",
    ):
        assert expected in source


def test_utility_columns_can_disable_sorting():
    source = PRESENTATION.read_text(encoding="utf-8")

    for expected in (
        'const NON_SORTABLE_FIELDTYPES = new Set(["button", "html", "image", "attach", "attach image"])',
        'if (column?.sortable === false || column?.actions === true) return false;',
    ):
        assert expected in source


def test_report_shell_preserves_sort_in_view_state_and_export():
    source = SHELL.read_text(encoding="utf-8")

    for expected in (
        'emits: ["export", "print", "view-state-change", "sort-change"]',
        "currentSort()",
        "return normalizedSort(this.$attrs.sort ?? this.viewState?.sort ?? null);",
        'this.$emit("sort-change", normalized);',
        "this.emitViewState(normalized);",
        "sort: sortOverride === undefined ? this.currentSort() : normalizedSort(sortOverride)",
        "onSortChange: this.handleSortChange",
        'this.$emit("export", { ...options, sort: this.currentSort() });',
    ):
        assert expected in source

    for forbidden in (
        "localStorage",
        "sessionStorage",
        "frappe.call",
        "frappe.db",
        "ignore_permissions",
    ):
        assert forbidden not in source


def test_sorting_styles_use_shared_semantic_tokens():
    css = CSS.read_text(encoding="utf-8")

    for expected in (
        ".edge-report-table__sort",
        ".edge-report-table__sort-indicator",
        ".edge-report-table th.is-sorted",
        ".edge-report-table__sort:focus-visible",
        "var(--edge-color-accent",
        "var(--edge-color-surface-soft",
    ):
        assert expected in css
