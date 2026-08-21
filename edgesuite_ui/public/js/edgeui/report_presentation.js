import { defineComponent, h } from "vue";

import {
  EdgeEmptyState,
  EdgeErrorState,
  EdgeFilterBar,
  EdgeLoadingState,
  EdgePageHeader,
  EdgePageLayout,
  EdgeStatCard,
} from "./components";

const REPORT_ROW_TONES = new Set(["neutral", "info", "success", "warning", "danger"]);
const NON_SORTABLE_FIELDTYPES = new Set(["button", "html", "image", "attach", "attach image"]);

function slot(slots, name, fallback = null) {
  return slots[name] ? slots[name]() : fallback;
}

function columnKey(column, index) {
  return column?.fieldname || column?.key || `column_${index + 1}`;
}

function numericColumn(column = {}) {
  const fieldtype = String(column.fieldtype || column.type || "").toLowerCase();
  return ["currency", "float", "int", "percent", "number"].includes(fieldtype);
}

function sortableColumn(column = {}) {
  if (column?.sortable === false || column?.actions === true) return false;
  const fieldtype = String(column.fieldtype || column.type || "").toLowerCase();
  return !NON_SORTABLE_FIELDTYPES.has(fieldtype);
}

function normalizedSort(sort = null) {
  if (!sort || typeof sort !== "object") return null;
  const field = String(sort.field || sort.fieldname || sort.key || "").trim();
  const direction = String(sort.direction || sort.order || "").trim().toLowerCase();
  if (!field || !["asc", "desc"].includes(direction)) return null;
  return { field, direction };
}

function nextSort(sort, field) {
  const current = normalizedSort(sort);
  if (!current || current.field !== field) return { field, direction: "asc" };
  if (current.direction === "asc") return { field, direction: "desc" };
  return null;
}

function defaultFormat(value, column = {}) {
  if (value === null || value === undefined || value === "") return "—";
  const fieldtype = String(column.fieldtype || column.type || "").toLowerCase();
  if (["float", "currency", "number"].includes(fieldtype)) {
    const number = Number(value);
    if (Number.isFinite(number)) return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (fieldtype === "int") {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.trunc(number).toLocaleString();
  }
  if (fieldtype === "percent") {
    const number = Number(value);
    if (Number.isFinite(number)) return `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  }
  return String(value);
}

function normalizedRowPresentation(value) {
  const source = typeof value === "string" ? { tone: value } : value && typeof value === "object" ? value : {};
  const tone = REPORT_ROW_TONES.has(String(source.tone || "").toLowerCase())
    ? String(source.tone).toLowerCase()
    : "";
  return {
    tone,
    title: source.title ? String(source.title) : "",
  };
}

export const EdgeReportTable = defineComponent({
  name: "EdgeReportTable",
  props: {
    columns: { type: Array, default: () => [] },
    rows: { type: Array, default: () => [] },
    rowKey: { type: [String, Function], default: "name" },
    formatter: { type: Function, default: null },
    rowPresentation: { type: Function, default: null },
    compact: { type: Boolean, default: false },
    stickyHeader: { type: Boolean, default: true },
    sort: { type: Object, default: null },
    sortingEnabled: { type: Boolean, default: true },
  },
  emits: ["cell-click", "row-click", "sort-change"],
  methods: {
    keyForRow(row, index) {
      if (typeof this.rowKey === "function") return this.rowKey(row, index);
      return row?.[this.rowKey] ?? row?.name ?? index;
    },
    valueFor(row, column, index) {
      const key = columnKey(column, index);
      const value = row?.[key];
      return this.formatter ? this.formatter(value, column, row) : defaultFormat(value, column);
    },
    presentationForRow(row, index) {
      if (!this.rowPresentation) return normalizedRowPresentation(null);
      return normalizedRowPresentation(this.rowPresentation(row, index));
    },
    sortForColumn(column, index) {
      const key = columnKey(column, index);
      const sort = normalizedSort(this.sort);
      if (!sort || sort.field !== key) return null;
      return sort;
    },
    ariaSort(column, index) {
      const sort = this.sortForColumn(column, index);
      if (!sort) return "none";
      return sort.direction === "desc" ? "descending" : "ascending";
    },
    changeSort(column, index) {
      if (!this.sortingEnabled || !sortableColumn(column)) return;
      this.$emit("sort-change", nextSort(this.sort, columnKey(column, index)));
    },
  },
  render() {
    const columns = Array.isArray(this.columns) ? this.columns : [];
    const rows = Array.isArray(this.rows) ? this.rows : [];
    return h(
      "div",
      {
        class: [
          "edge-report-table-wrap",
          { "is-compact": this.compact, "has-sticky-head": this.stickyHeader },
        ],
      },
      [
        h("table", { class: "edge-report-table" }, [
          h("thead", {}, [
            h(
              "tr",
              {},
              columns.map((column, index) => {
                const key = columnKey(column, index);
                const canSort = this.sortingEnabled && sortableColumn(column);
                const activeSort = this.sortForColumn(column, index);
                return h(
                  "th",
                  {
                    key,
                    class: { "is-number": numericColumn(column), "is-sortable": canSort, "is-sorted": Boolean(activeSort) },
                    scope: "col",
                    "aria-sort": canSort ? this.ariaSort(column, index) : undefined,
                  },
                  canSort
                    ? h(
                        "button",
                        {
                          type: "button",
                          class: "edge-report-table__sort",
                          title: activeSort
                            ? `Sorted ${activeSort.direction === "desc" ? "descending" : "ascending"}. Activate to change sort.`
                            : `Sort by ${column?.label || key}`,
                          onClick: () => this.changeSort(column, index),
                        },
                        [
                          h("span", { class: "edge-report-table__sort-label" }, column?.label || key),
                          h(
                            "span",
                            { class: "edge-report-table__sort-indicator", "aria-hidden": "true" },
                            activeSort ? (activeSort.direction === "desc" ? "↓" : "↑") : "↕",
                          ),
                        ],
                      )
                    : column?.label || key,
                );
              }),
            ),
          ]),
          h(
            "tbody",
            {},
            rows.map((row, rowIndex) => {
              const presentation = this.presentationForRow(row, rowIndex);
              return h(
                "tr",
                {
                  key: this.keyForRow(row, rowIndex),
                  class: presentation.tone ? `edge-report-table__row--${presentation.tone}` : "",
                  title: presentation.title || undefined,
                  "data-edge-row-tone": presentation.tone || undefined,
                  onClick: () => this.$emit("row-click", row),
                },
                columns.map((column, columnIndex) => {
                  const key = columnKey(column, columnIndex);
                  const fieldtype = String(column?.fieldtype || column?.type || "").toLowerCase();
                  const clickable =
                    column?.clickable === true || column?.link === true || fieldtype === "link";
                  const content = this.valueFor(row, column, columnIndex);
                  return h(
                    "td",
                    { key, class: { "is-number": numericColumn(column) } },
                    clickable
                      ? h(
                          "button",
                          {
                            type: "button",
                            class: "edge-report-table__link",
                            onClick: (event) => {
                              event.stopPropagation();
                              this.$emit("cell-click", { row, column, value: row?.[key] });
                            },
                          },
                          content,
                        )
                      : content,
                  );
                }),
              );
            }),
          ),
        ]),
      ],
    );
  },
});

export const EdgeReportShell = defineComponent({
  name: "EdgeReportShell",
  props: {
    title: { type: String, default: "Report" },
    eyebrow: { type: String, default: "Reporting" },
    subtitle: { type: String, default: "" },
    columns: { type: Array, default: () => [] },
    rows: { type: Array, default: () => [] },
    summary: { type: Array, default: () => [] },
    pagination: { type: Object, default: () => ({}) },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
    emptyTitle: { type: String, default: "No matching records" },
    emptyDescription: { type: String, default: "Adjust the filters and try again." },
    loadingMessage: { type: String, default: "Loading report…" },
    pageSizes: { type: Array, default: () => [25, 50, 100] },
    rowKey: { type: [String, Function], default: "name" },
    formatter: { type: Function, default: null },
    rowPresentation: { type: Function, default: null },
    showResultCount: { type: Boolean, default: true },
    sort: { type: Object, default: null },
    sortingEnabled: { type: Boolean, default: true },
  },
  emits: ["retry", "page-change", "page-size-change", "cell-click", "row-click", "sort-change"],
  methods: {
    summaryValue(card = {}) {
      if (card.formatted_value !== undefined) return card.formatted_value;
      return defaultFormat(card.value, { fieldtype: card.datatype || card.fieldtype || "Data" });
    },
  },
  render() {
    const p = this.pagination || {};
    const page = Number(
      p.page ||
        Number(p.start || 0) / Math.max(1, Number(p.page_length || p.page_size || 1)) + 1 ||
        1,
    );
    const pageSize = Number(p.page_size || p.page_length || 50);
    const totalRows = Number(p.total_rows ?? p.total ?? this.rows.length);
    const totalPages = Number(
      p.total_pages || Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize))),
    );
    const hasPrevious = p.has_previous !== undefined ? Boolean(p.has_previous) : page > 1;
    const hasNext = p.has_next !== undefined ? Boolean(p.has_next) : page < totalPages;

    return h(EdgePageLayout, {}, {
      header: () =>
        h(
          EdgePageHeader,
          { eyebrow: this.eyebrow, title: this.title, subtitle: this.subtitle },
          { actions: () => slot(this.$slots, "actions") },
        ),
      filters: this.$slots.filters
        ? () =>
            h(
              EdgeFilterBar,
              { title: "Filters" },
              {
                default: () => slot(this.$slots, "filters"),
                actions: this.$slots.filterActions
                  ? () => slot(this.$slots, "filterActions")
                  : undefined,
              },
            )
        : undefined,
      default: () => [
        this.error
          ? h(EdgeErrorState, {
              title: `${this.title} failed to load`,
              message: this.error,
              onRetry: () => this.$emit("retry"),
            })
          : null,
        !this.error && this.summary.length
          ? h(
              "div",
              { class: "edge-report-shell__summary" },
              this.summary.map((card, index) =>
                h(EdgeStatCard, {
                  key: card.key || card.label || index,
                  label: card.label || "Metric",
                  value: this.summaryValue(card),
                  helper: card.helper || "",
                  tone: card.tone || "neutral",
                  icon: card.icon || "",
                }),
              ),
            )
          : null,
        !this.error && this.$slots.chart
          ? h("section", { class: "edge-report-shell__chart" }, slot(this.$slots, "chart"))
          : null,
        !this.error && this.rows.length
          ? h("section", { class: "edge-report-shell__results" }, [
              h("div", { class: "edge-report-shell__meta" }, [
                this.showResultCount
                  ? h(
                      "span",
                      {},
                      `${totalRows.toLocaleString()} result${totalRows === 1 ? "" : "s"}`,
                    )
                  : null,
                slot(this.$slots, "resultMeta"),
              ]),
              h(EdgeReportTable, {
                columns: this.columns,
                rows: this.rows,
                rowKey: this.rowKey,
                formatter: this.formatter,
                rowPresentation: this.rowPresentation,
                sort: this.sort,
                sortingEnabled: this.sortingEnabled,
                onSortChange: (sort) => this.$emit("sort-change", sort),
                onCellClick: (payload) => this.$emit("cell-click", payload),
                onRowClick: (row) => this.$emit("row-click", row),
              }),
              h("footer", { class: "edge-report-shell__pagination" }, [
                h("span", {}, `Page ${page} of ${totalPages}`),
                h("div", { class: "edge-report-shell__pagination-actions" }, [
                  h(
                    "select",
                    {
                      value: pageSize,
                      disabled: this.loading,
                      "aria-label": "Rows per page",
                      onChange: (event) =>
                        this.$emit("page-size-change", Number(event.target.value)),
                    },
                    this.pageSizes.map((size) =>
                      h("option", { value: Number(size), key: size }, `${size} / page`),
                    ),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "edge-button edge-button--secondary",
                      disabled: !hasPrevious || this.loading,
                      onClick: () => this.$emit("page-change", page - 1),
                    },
                    "Previous",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "edge-button edge-button--secondary",
                      disabled: !hasNext || this.loading,
                      onClick: () => this.$emit("page-change", page + 1),
                    },
                    "Next",
                  ),
                ]),
              ]),
            ])
          : null,
        !this.error && !this.loading && !this.rows.length
          ? h(EdgeEmptyState, {
              title: this.emptyTitle,
              description: this.emptyDescription,
            })
          : null,
        !this.error && this.loading
          ? h(EdgeLoadingState, { message: this.loadingMessage })
          : null,
      ].filter(Boolean),
    });
  },
});

export const EdgeDashboardGrid = defineComponent({
  name: "EdgeDashboardGrid",
  props: { minColumnWidth: { type: String, default: "18rem" } },
  setup(props, { slots }) {
    return () =>
      h(
        "div",
        {
          class: "edge-dashboard-grid",
          style: { "--edge-dashboard-grid-min": props.minColumnWidth },
        },
        slot(slots, "default", []),
      );
  },
});

export const EdgeDashboardSection = defineComponent({
  name: "EdgeDashboardSection",
  props: {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    span: { type: String, default: "auto" },
  },
  setup(props, { slots }) {
    return () =>
      h(
        "section",
        {
          class: "edge-dashboard-section",
          style: { "--edge-dashboard-section-span": props.span },
        },
        [
          props.title || props.description || slots.actions
            ? h("header", { class: "edge-dashboard-section__header" }, [
                h("div", {}, [
                  props.title ? h("h2", {}, props.title) : null,
                  props.description ? h("p", {}, props.description) : null,
                ]),
                slots.actions
                  ? h("div", { class: "edge-dashboard-section__actions" }, slots.actions())
                  : null,
              ])
            : null,
          h("div", { class: "edge-dashboard-section__body" }, slot(slots, "default", [])),
        ],
      );
  },
});

export const EdgeDashboardShell = defineComponent({
  name: "EdgeDashboardShell",
  props: {
    title: { type: String, default: "Dashboard" },
    eyebrow: { type: String, default: "Overview" },
    subtitle: { type: String, default: "" },
    summary: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
    loadingMessage: { type: String, default: "Loading dashboard…" },
  },
  emits: ["retry"],
  render() {
    return h(EdgePageLayout, {}, {
      header: () =>
        h(
          EdgePageHeader,
          { eyebrow: this.eyebrow, title: this.title, subtitle: this.subtitle },
          { actions: () => slot(this.$slots, "actions") },
        ),
      filters: this.$slots.filters
        ? () =>
            h(
              EdgeFilterBar,
              { title: "View" },
              {
                default: () => slot(this.$slots, "filters"),
                actions: this.$slots.filterActions
                  ? () => slot(this.$slots, "filterActions")
                  : undefined,
              },
            )
        : undefined,
      default: () => [
        this.error
          ? h(EdgeErrorState, {
              title: `${this.title} failed to load`,
              message: this.error,
              onRetry: () => this.$emit("retry"),
            })
          : null,
        !this.error && this.summary.length
          ? h(
              "div",
              { class: "edge-dashboard-shell__summary" },
              this.summary.map((card, index) =>
                h(EdgeStatCard, {
                  key: card.key || card.label || index,
                  label: card.label || "Metric",
                  value:
                    card.formatted_value ??
                    defaultFormat(card.value, { fieldtype: card.datatype || "Data" }),
                  helper: card.helper || "",
                  tone: card.tone || "neutral",
                  icon: card.icon || "",
                }),
              ),
            )
          : null,
        !this.error && this.loading
          ? h(EdgeLoadingState, { message: this.loadingMessage })
          : null,
        !this.error
          ? h(
              "div",
              { class: ["edge-dashboard-shell__content", { "is-loading": this.loading }] },
              slot(this.$slots, "default", []),
            )
          : null,
      ].filter(Boolean),
    });
  },
});

export const reportPresentationComponents = Object.freeze({
  EdgeReportShell,
  EdgeReportTable,
  EdgeDashboardShell,
  EdgeDashboardGrid,
  EdgeDashboardSection,
});
