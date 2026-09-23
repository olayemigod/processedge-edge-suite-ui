import { defineComponent, h } from "vue";

import { EdgeEmptyState, EdgeStatusBadge } from "./components";
import {
  EdgeDashboardGrid,
  EdgeDashboardSection,
  EdgeReportTable,
} from "./report_presentation";
import { EdgeDashboardShell } from "./report_shell_actions";
import { EdgeSmartDateRange } from "./report_smart_date";

export const FINANCIAL_DASHBOARD_SCHEMA_VERSION = 1;

const ALLOWED_AVAILABILITY = new Set(["available", "empty", "unavailable", "restricted", "partial", "error"]);
const ALLOWED_ACTION_KINDS = new Set(["page", "report", "route"]);
const PALETTE = [
  "var(--edge-chart-1, #2563eb)",
  "var(--edge-chart-2, #16a34a)",
  "var(--edge-chart-3, #d97706)",
  "var(--edge-chart-4, #7c3aed)",
  "var(--edge-chart-5, #0891b2)",
  "var(--edge-chart-6, #db2777)",
];

function list(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function availability(value) {
  const normalized = String(value || "available").trim().toLowerCase();
  return ALLOWED_AVAILABILITY.has(normalized) ? normalized : "unavailable";
}

function validAction(value) {
  const action = object(value);
  return ALLOWED_ACTION_KINDS.has(String(action.kind || "").trim().toLowerCase()) &&
    Boolean(String(action.destination || action.target || "").trim());
}

function compactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const absolute = Math.abs(number);
  const units = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "m"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of units) {
    if (absolute >= size) {
      const scaled = number / size;
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/g, "")}${suffix}`;
    }
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number);
}

export function formatFinancialMetric(metric = {}, { compact = false } = {}) {
  const state = availability(metric.availability);
  if (state !== "available" && state !== "partial") return "—";
  if (metric.formatted_value !== undefined && metric.formatted_value !== null) {
    return String(metric.formatted_value);
  }
  const value = metric.value;
  if (value === null || value === undefined || value === "") return "—";
  const datatype = String(metric.datatype || "").toLowerCase();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (datatype === "percent" || datatype === "percentage") {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(numeric)}%`;
  }
  if (datatype === "currency") {
    const currency = String(metric.currency || "").trim();
    const amount = compact ? compactNumber(numeric) : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric);
    return currency ? `${currency} ${amount}` : amount;
  }
  return compact ? compactNumber(numeric) : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric);
}

function comparisonText(metric = {}) {
  const comparison = object(metric.comparison);
  const state = availability(comparison.availability || (comparison.value === null || comparison.value === undefined ? "unavailable" : "available"));
  if (state !== "available" && state !== "partial") {
    return comparison.label || comparison.reason || "";
  }
  if (comparison.formatted_value) return String(comparison.formatted_value);
  const value = Number(comparison.value);
  if (!Number.isFinite(value)) return comparison.label || "";
  const unit = comparison.unit === "percentage_point" ? "pp" : "%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}${unit}`;
}

function basisLabel(metric = {}) {
  const map = {
    period: "Selected period",
    current: "Current",
    invoice_cohort: "Invoice cohort",
    as_of: "As of",
  };
  return map[String(metric.basis || "").trim()] || "";
}

export const EdgeFinancialMetricCard = defineComponent({
  name: "EdgeFinancialMetricCard",
  props: {
    metric: { type: Object, default: () => ({}) },
    compact: { type: Boolean, default: true },
  },
  emits: ["action"],
  setup(props, { emit }) {
    return () => {
      const metric = object(props.metric);
      const state = availability(metric.availability);
      const comparison = comparisonText(metric);
      const actionEnabled = validAction(metric.action) && ["available", "partial"].includes(state);
      const body = [
        h("div", { class: "edge-financial-metric__heading" }, [
          h("span", { class: "edge-financial-metric__label" }, metric.label || "Metric"),
          state !== "available"
            ? h(EdgeStatusBadge, { label: state === "partial" ? "Partial" : state, tone: state === "restricted" ? "warning" : "neutral" })
            : null,
        ]),
        h("strong", {
          class: "edge-financial-metric__value",
          title: metric.full_value || (metric.value !== undefined ? String(metric.value) : undefined),
        }, formatFinancialMetric(metric, { compact: props.compact })),
        h("div", { class: "edge-financial-metric__meta" }, [
          basisLabel(metric) ? h("span", basisLabel(metric)) : null,
          comparison ? h("span", { class: "edge-financial-metric__comparison" }, comparison) : null,
        ].filter(Boolean)),
        metric.helper || metric.reason
          ? h("p", { class: "edge-financial-metric__helper" }, metric.helper || metric.reason)
          : null,
      ];
      return h(
        actionEnabled ? "button" : "article",
        {
          type: actionEnabled ? "button" : undefined,
          class: ["edge-financial-metric", actionEnabled ? "is-actionable" : "", `is-${state}`],
          onClick: actionEnabled ? () => emit("action", metric.action) : undefined,
        },
        body,
      );
    };
  },
});

function compositionRows(composition = {}) {
  return list(composition.rows).map((row, index) => {
    const value = Number(row.value);
    const share = Number(row.share);
    return {
      ...row,
      name: row.id || row.key || row.label || String(index),
      label: row.label || row.id || "Unassigned",
      display_value: row.formatted_value || formatFinancialMetric({
        value: Number.isFinite(value) ? value : row.value,
        datatype: row.datatype || composition.datatype || "Currency",
        currency: row.currency || composition.currency,
        availability: row.availability || "available",
      }),
      display_share: Number.isFinite(share)
        ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(share)}%`
        : "—",
    };
  });
}

function donutStyle(rows) {
  const positive = rows.filter((row) => Number(row.value) > 0);
  const total = positive.reduce((sum, row) => sum + Number(row.value || 0), 0);
  if (!positive.length || total <= 0) return {};
  let cursor = 0;
  const stops = positive.map((row, index) => {
    const start = cursor;
    cursor += (Number(row.value) / total) * 100;
    return `${PALETTE[index % PALETTE.length]} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`;
  });
  return { background: `conic-gradient(${stops.join(", ")})` };
}

export const EdgeFinancialCompositionPanel = defineComponent({
  name: "EdgeFinancialCompositionPanel",
  props: {
    composition: { type: Object, default: () => ({}) },
  },
  emits: ["action"],
  setup(props, { emit }) {
    return () => {
      const composition = object(props.composition);
      const rows = compositionRows(composition);
      if (!rows.length) {
        return h(EdgeEmptyState, {
          title: composition.empty_title || "No composition data",
          description: composition.empty_description || "There is no composition data for this scope.",
        });
      }
      const signed = rows.some((row) => Number(row.value) < 0);
      const chartKind = signed || composition.chart_kind === "bar" ? "bar" : "donut";
      const maxAbs = Math.max(...rows.map((row) => Math.abs(Number(row.value) || 0)), 1);
      const chart = chartKind === "donut"
        ? h("div", { class: "edge-financial-composition__visual" }, [
            h("div", {
              class: "edge-financial-composition__donut",
              style: donutStyle(rows),
              role: "img",
              "aria-label": composition.aria_label || "Financial composition",
            }, [h("span", {}, composition.center_label || "Mix")]),
            h("div", { class: "edge-financial-composition__legend" },
              rows.map((row, index) =>
                h("div", { class: "edge-financial-composition__legend-row", key: row.name }, [
                  h("span", {
                    class: "edge-financial-composition__swatch",
                    style: { background: PALETTE[index % PALETTE.length] },
                    "aria-hidden": "true",
                  }),
                  h("span", row.label),
                  h("strong", row.display_share),
                ]),
              ),
            ),
          ])
        : h("div", { class: "edge-financial-composition__bars" },
            rows.map((row, index) => {
              const width = Math.max(2, (Math.abs(Number(row.value) || 0) / maxAbs) * 100);
              return h("div", { class: "edge-financial-composition__bar-row", key: row.name }, [
                h("span", { class: "edge-financial-composition__bar-label" }, row.label),
                h("div", { class: "edge-financial-composition__bar-track" }, [
                  h("span", {
                    class: ["edge-financial-composition__bar", Number(row.value) < 0 ? "is-negative" : ""],
                    style: { width: `${width}%`, background: PALETTE[index % PALETTE.length] },
                  }),
                ]),
                h("strong", row.display_value),
              ]);
            }),
          );

      return h("div", { class: "edge-financial-composition" }, [
        chart,
        h(EdgeReportTable, {
          columns: [
            { fieldname: "label", label: composition.dimension_label || "Category", fieldtype: "Data", clickable: true, sortable: false },
            { fieldname: "display_value", label: composition.value_label || "Amount", fieldtype: "Data", sortable: false },
            { fieldname: "display_share", label: "Share", fieldtype: "Data", sortable: false },
          ],
          rows,
          rowKey: "name",
          compact: true,
          sortingEnabled: false,
          onCellClick: ({ row }) => {
            if (validAction(row?.action)) emit("action", row.action);
          },
          onRowClick: (row) => {
            if (validAction(row?.action)) emit("action", row.action);
          },
        }),
      ]);
    };
  },
});

function metricGroup(payload, group) {
  return list(payload.summary).filter((metric) => String(metric.group || "executive") === group);
}

function renderMetricGrid(metrics, emit) {
  return h("div", { class: "edge-financial-metric-grid" },
    list(metrics).map((metric, index) =>
      h(EdgeFinancialMetricCard, {
        key: metric.id || metric.label || index,
        metric,
        onAction: (action) => emit("action", action),
      }),
    ),
  );
}

function sectionRows(section) {
  if (Array.isArray(section)) return section;
  return list(object(section).rows);
}

function sectionColumns(section) {
  const candidate = list(object(section).columns);
  if (candidate.length) return candidate;
  const rows = sectionRows(section);
  if (!rows.length) return [];
  return Object.keys(rows[0])
    .filter((key) => !["action", "id", "name"].includes(key))
    .slice(0, 6)
    .map((key) => ({ fieldname: key, label: key.replace(/_/g, " "), fieldtype: "Data", sortable: false }));
}

function panelTitle(section, fallback) {
  return object(section).title || fallback;
}

function panelDescription(section) {
  return object(section).description || "";
}

export const EdgeFinancialDashboard = defineComponent({
  name: "EdgeFinancialDashboard",
  inheritAttrs: false,
  props: {
    payload: { type: Object, default: () => ({}) },
    dateModel: { type: Object, default: () => ({}) },
    dateOrder: { type: String, default: "DMY" },
    showDateControl: { type: Boolean, default: true },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
    exportEnabled: { type: Boolean, default: false },
    printEnabled: { type: Boolean, default: false },
    exportBusy: { type: Boolean, default: false },
    printBusy: { type: Boolean, default: false },
    exportInitialOptions: { type: Object, default: () => ({}) },
  },
  emits: [
    "update:dateModel",
    "date-resolved",
    "refresh",
    "quick-reports",
    "retry",
    "export",
    "print",
    "action",
  ],
  methods: {
    schemaValid() {
      return Number(this.payload?.schema_version || 0) === FINANCIAL_DASHBOARD_SCHEMA_VERSION;
    },
    emitAction(action) {
      if (validAction(action)) this.$emit("action", action);
    },
    renderTableSection(section, fallbackTitle) {
      const rows = sectionRows(section);
      if (!rows.length) return null;
      return h(EdgeDashboardSection, {
        title: panelTitle(section, fallbackTitle),
        description: panelDescription(section),
        span: object(section).span || "auto",
      }, {
        default: () => h(EdgeReportTable, {
          columns: sectionColumns(section),
          rows,
          rowKey: object(section).row_key || "name",
          compact: true,
          sortingEnabled: false,
          onCellClick: ({ row }) => this.emitAction(row?.action),
          onRowClick: (row) => this.emitAction(row?.action),
        }),
      });
    },
  },
  render() {
    const payload = object(this.payload);
    const schemaError = Object.keys(payload).length && !this.schemaValid()
      ? `Unsupported financial dashboard schema. Expected v${FINANCIAL_DASHBOARD_SCHEMA_VERSION}.`
      : "";
    const error = this.error || schemaError;
    const executive = metricGroup(payload, "executive");
    const current = metricGroup(payload, "current_position");
    const context = object(payload.context);
    const metadata = [
      context.from_date && context.to_date ? `${context.from_date} → ${context.to_date}` : "",
      context.currency || "",
      context.generated_at ? `Updated ${context.generated_at}` : "",
    ].filter(Boolean).join(" · ");

    const actions = () => [
      ...(this.$slots.actions ? this.$slots.actions() : []),
      h("button", {
        type: "button",
        class: "edge-button edge-button--secondary",
        disabled: this.loading,
        onClick: () => this.$emit("quick-reports"),
      }, "Quick Reports"),
      h("button", {
        type: "button",
        class: "edge-button edge-button--secondary",
        disabled: this.loading,
        onClick: () => this.$emit("refresh"),
      }, this.loading ? "Refreshing…" : "Refresh"),
    ];

    const filters = () => [
      ...(this.$slots.contextFilters ? this.$slots.contextFilters() : []),
      this.showDateControl
        ? h(EdgeSmartDateRange, {
            modelValue: this.dateModel,
            label: "Date",
            dateOrder: this.dateOrder,
            disabled: this.loading,
            "onUpdate:modelValue": (value) => this.$emit("update:dateModel", value),
            onResolved: (value) => this.$emit("date-resolved", value),
          })
        : null,
      this.$slots.comparison ? this.$slots.comparison() : null,
    ].filter(Boolean);

    const sections = [];
    if (list(payload.alerts).length) {
      sections.push(h(EdgeDashboardSection, {
        title: "Attention",
        description: "Actionable financial exceptions for the current authorised scope.",
        span: "2",
      }, {
        default: () => h("div", { class: "edge-financial-alerts" },
          list(payload.alerts).map((alert, index) =>
            h("button", {
              type: "button",
              class: ["edge-financial-alert", `is-${String(alert.tone || "warning")}`],
              key: alert.id || alert.label || index,
              disabled: !validAction(alert.action),
              onClick: () => this.emitAction(alert.action),
            }, [
              h("span", {}, [
                h("strong", alert.label || "Attention required"),
                alert.description ? h("small", alert.description) : null,
              ]),
              alert.value !== undefined
                ? h("strong", formatFinancialMetric({ ...alert, availability: alert.availability || "available" }))
                : null,
            ]),
          ),
        ),
      }));
    }
    if (executive.length) {
      sections.push(h(EdgeDashboardSection, {
        title: "Executive Summary",
        description: "Period performance using declared accounting and settlement definitions.",
        span: "2",
      }, { default: () => renderMetricGrid(executive, this.$emit.bind(this)) }));
    }
    if (current.length) {
      sections.push(h(EdgeDashboardSection, {
        title: "Current Position",
        description: "Current balances and valuation. These are not reconstructed historical balances.",
        span: "2",
      }, { default: () => renderMetricGrid(current, this.$emit.bind(this)) }));
    }
    if (list(payload.collection_metrics).length) {
      sections.push(h(EdgeDashboardSection, {
        title: "Collection Performance",
        description: object(payload.collection).description || "Invoice-cohort settlement and payment-speed measures.",
        span: "2",
      }, { default: () => renderMetricGrid(payload.collection_metrics, this.$emit.bind(this)) }));
    }
    if (object(payload.composition).rows) {
      sections.push(h(EdgeDashboardSection, {
        title: object(payload.composition).title || "Revenue Composition",
        description: object(payload.composition).description || "",
        span: "2",
      }, {
        default: () => h(EdgeFinancialCompositionPanel, {
          composition: payload.composition,
          onAction: (action) => this.emitAction(action),
        }),
      }));
    }
    for (const [key, title] of [
      ["health", "Financial Health"],
      ["outstanding", "Outstanding Insights"],
      ["trends", "Performance Trends"],
    ]) {
      const rendered = this.renderTableSection(payload[key], title);
      if (rendered) sections.push(rendered);
    }
    if (list(payload.report_links).length) {
      sections.push(h(EdgeDashboardSection, {
        title: "Supporting Reports",
        description: "Open the permitted report with the current dashboard context.",
        span: "2",
      }, {
        default: () => h("div", { class: "edge-financial-report-links" },
          list(payload.report_links).map((item, index) =>
            h("button", {
              type: "button",
              class: "edge-button edge-button--secondary",
              key: item.id || item.label || index,
              disabled: !validAction(item.action),
              onClick: () => this.emitAction(item.action),
            }, item.label || "Open report"),
          ),
        ),
      }));
    }
    if (!this.loading && !error && !sections.length && this.schemaValid()) {
      sections.push(h(EdgeEmptyState, {
        title: payload.empty_title || "No financial data",
        description: payload.empty_description || "There is no financial data available for this authorised scope.",
      }));
    }

    return h(EdgeDashboardShell, {
      ...this.$attrs,
      title: payload.title || "Financial Dashboard",
      eyebrow: payload.eyebrow || "Financial Overview",
      subtitle: payload.subtitle || metadata,
      loading: this.loading,
      error,
      loadingMessage: payload.loading_message || "Building financial overview…",
      exportEnabled: this.exportEnabled,
      printEnabled: this.printEnabled,
      exportBusy: this.exportBusy,
      printBusy: this.printBusy,
      exportInitialOptions: this.exportInitialOptions,
      onRetry: () => this.$emit("retry"),
      onExport: (options) => this.$emit("export", options),
      onPrint: () => this.$emit("print"),
    }, {
      actions,
      filters,
      default: () => h(EdgeDashboardGrid, { minColumnWidth: "20rem" }, { default: () => sections }),
    });
  },
});

export const financialDashboardComponents = Object.freeze({
  EdgeFinancialDashboard,
  EdgeFinancialMetricCard,
  EdgeFinancialCompositionPanel,
});
