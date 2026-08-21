import { defineComponent, h } from "vue";

import { EdgeReportExportDialog } from "./report_export";
import {
  EdgeDashboardShell as BaseDashboardShell,
  EdgeReportShell as BaseReportShell,
} from "./report_presentation";

function enabled(value) {
  return Boolean(value);
}

function actionButton(label, onClick, disabled = false, primary = false) {
  return h(
    "button",
    {
      type: "button",
      class: ["edge-button", primary ? "edge-button--primary" : "edge-button--secondary"],
      disabled,
      onClick,
    },
    label,
  );
}

function columnKey(column, index) {
  return String(column?.fieldname || column?.key || `column_${index + 1}`);
}

function normalizedColumnKeys(columns = []) {
  return (Array.isArray(columns) ? columns : []).map((column, index) => columnKey(column, index));
}

function normalizedVisibleKeys(columns = [], requested = null) {
  const available = normalizedColumnKeys(columns);
  if (!Array.isArray(requested) || !requested.length) return available;
  const allowed = new Set(available);
  const visible = requested.map(String).filter((key) => allowed.has(key));
  return visible.length ? visible : available;
}

function normalizedSort(sort = null) {
  if (!sort || typeof sort !== "object") return null;
  const field = String(sort.field || sort.fieldname || sort.key || "").trim();
  const direction = String(sort.direction || sort.order || "").trim().toLowerCase();
  if (!field || !["asc", "desc"].includes(direction)) return null;
  return { field, direction };
}

function tierBadge(tier, entitled = true) {
  const normalized = String(tier || "").trim().toLowerCase();
  if (!normalized) return null;
  const advanced = normalized === "advanced";
  const label = advanced ? (entitled ? "Advanced" : "Advanced · Locked") : "Standard";
  return h(
    "span",
    {
      class: ["edge-report-tier-badge", `edge-report-tier-badge--${advanced ? "advanced" : "standard"}`],
      title: advanced
        ? "Product subscription metadata classifies this reporting surface as Advanced."
        : "Product subscription metadata classifies this reporting surface as Standard.",
      style: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: "32px",
        padding: "0 10px",
        border: "1px solid var(--edge-border, #dfe5ef)",
        borderRadius: "999px",
        background: "var(--edge-surface, #fff)",
        color: "var(--edge-text-muted, #667085)",
        fontSize: "12px",
        fontWeight: "600",
      },
    },
    label,
  );
}

function forwardedSlots(slots, actionsFactory) {
  const forwarded = { ...slots };
  forwarded.actions = actionsFactory;
  return forwarded;
}

function customActions(slots) {
  return slots.actions ? slots.actions() || [] : [];
}

export const EdgeReportShell = defineComponent({
  name: "EdgeReportShell",
  inheritAttrs: false,
  props: {
    exportEnabled: { type: Boolean, default: false },
    printEnabled: { type: Boolean, default: false },
    exportBusy: { type: Boolean, default: false },
    printBusy: { type: Boolean, default: false },
    exportInitialOptions: { type: Object, default: () => ({}) },
    exportButtonLabel: { type: String, default: "Download / Export" },
    printButtonLabel: { type: String, default: "Print" },
    tier: { type: String, default: "" },
    subscriptionEntitled: { type: Boolean, default: true },
    columnChooserEnabled: { type: Boolean, default: false },
    columnChooserLabel: { type: String, default: "Columns" },
    viewState: { type: Object, default: () => ({}) },
  },
  emits: ["export", "print", "view-state-change", "sort-change"],
  data() {
    return {
      exportOpen: false,
      columnsOpen: false,
      visibleColumnKeys: null,
      appliedViewStateSignature: "",
    };
  },
  methods: {
    allColumns() {
      return Array.isArray(this.$attrs.columns) ? this.$attrs.columns : [];
    },
    currentSort() {
      return normalizedSort(this.$attrs.sort ?? this.viewState?.sort ?? null);
    },
    viewStateSignature() {
      const visible = Array.isArray(this.viewState?.visible_columns)
        ? this.viewState.visible_columns.map(String)
        : [];
      return JSON.stringify(visible);
    },
    ensureVisibleColumnState() {
      const columns = this.allColumns();
      const available = normalizedColumnKeys(columns);
      const signature = this.viewStateSignature();
      const current = Array.isArray(this.visibleColumnKeys) ? this.visibleColumnKeys : [];
      const availableSet = new Set(available);
      const currentValid = current.filter((key) => availableSet.has(String(key)));
      const externalChanged = signature !== this.appliedViewStateSignature;
      const columnsChanged = currentValid.length !== current.length || currentValid.some((key, index) => key !== current[index]);

      if (this.visibleColumnKeys === null || externalChanged || columnsChanged) {
        const requested = externalChanged || this.visibleColumnKeys === null
          ? this.viewState?.visible_columns
          : currentValid;
        this.visibleColumnKeys = normalizedVisibleKeys(columns, requested);
        this.appliedViewStateSignature = signature;
      }
      return this.visibleColumnKeys;
    },
    visibleColumns() {
      const columns = this.allColumns();
      const visible = new Set(this.ensureVisibleColumnState());
      return columns.filter((column, index) => visible.has(columnKey(column, index)));
    },
    emitViewState(sortOverride = undefined) {
      this.$emit("view-state-change", {
        visible_columns: [...this.ensureVisibleColumnState()],
        sort: sortOverride === undefined ? this.currentSort() : normalizedSort(sortOverride),
      });
    },
    handleSortChange(sort) {
      const normalized = normalizedSort(sort);
      this.$emit("sort-change", normalized);
      this.emitViewState(normalized);
    },
    toggleColumn(key) {
      const visible = this.ensureVisibleColumnState();
      const normalized = String(key);
      const next = visible.includes(normalized)
        ? visible.filter((item) => item !== normalized)
        : [...visible, normalized];
      if (!next.length) return;
      this.visibleColumnKeys = normalizedColumnKeys(this.allColumns()).filter((item) => next.includes(item));
      this.appliedViewStateSignature = this.viewStateSignature();
      this.emitViewState();
    },
    resetColumns() {
      this.visibleColumnKeys = normalizedColumnKeys(this.allColumns());
      this.appliedViewStateSignature = this.viewStateSignature();
      this.emitViewState();
    },
    columnChooser() {
      if (!enabled(this.columnChooserEnabled) || !this.allColumns().length) return null;
      const visible = new Set(this.ensureVisibleColumnState());
      return h("div", { class: "edge-report-columns" }, [
        h(
          "button",
          {
            type: "button",
            class: "edge-button edge-button--secondary edge-report-columns__toggle",
            "aria-expanded": this.columnsOpen ? "true" : "false",
            onClick: () => {
              this.columnsOpen = !this.columnsOpen;
            },
          },
          this.columnChooserLabel,
        ),
        this.columnsOpen
          ? h("div", { class: "edge-report-columns__panel", role: "group", "aria-label": "Visible report columns" }, [
              h("div", { class: "edge-report-columns__heading" }, [
                h("strong", {}, "Visible columns"),
                h(
                  "button",
                  { type: "button", class: "edge-report-columns__reset", onClick: this.resetColumns },
                  "Show all",
                ),
              ]),
              ...this.allColumns().map((column, index) => {
                const key = columnKey(column, index);
                return h("label", { class: "edge-report-columns__option", key }, [
                  h("input", {
                    type: "checkbox",
                    checked: visible.has(key),
                    disabled: visible.size === 1 && visible.has(key),
                    onChange: () => this.toggleColumn(key),
                  }),
                  h("span", {}, column?.label || key),
                ]);
              }),
            ])
          : null,
      ]);
    },
  },
  render() {
    const title = this.$attrs.title || "Report";
    const columns = this.visibleColumns();
    const baseAttrs = {
      ...this.$attrs,
      columns,
      sort: this.currentSort(),
      onSortChange: this.handleSortChange,
    };
    const actions = () => {
      const nodes = [];
      const badge = tierBadge(this.tier, this.subscriptionEntitled);
      if (badge) nodes.push(badge);
      nodes.push(...customActions(this.$slots));
      const chooser = this.columnChooser();
      if (chooser) nodes.push(chooser);
      if (enabled(this.printEnabled)) {
        nodes.push(
          actionButton(
            this.printBusy ? "Preparing…" : this.printButtonLabel,
            () => this.$emit("print"),
            this.printBusy || this.exportBusy,
          ),
        );
      }
      if (enabled(this.exportEnabled)) {
        nodes.push(
          actionButton(
            this.exportBusy ? "Preparing…" : this.exportButtonLabel,
            () => {
              this.exportOpen = true;
              this.columnsOpen = false;
            },
            this.exportBusy || this.printBusy,
            true,
          ),
        );
      }
      return nodes;
    };

    return h("div", { class: "edge-report-shell-host" }, [
      h(BaseReportShell, baseAttrs, forwardedSlots(this.$slots, actions)),
      enabled(this.exportEnabled)
        ? h(EdgeReportExportDialog, {
            open: this.exportOpen,
            busy: this.exportBusy,
            reportTitle: String(title || "Report"),
            columns,
            initialOptions: this.exportInitialOptions,
            onClose: () => {
              this.exportOpen = false;
            },
            onExport: (options) => {
              this.exportOpen = false;
              this.$emit("export", { ...options, sort: this.currentSort() });
            },
          })
        : null,
    ]);
  },
});

export const EdgeDashboardShell = defineComponent({
  name: "EdgeDashboardShell",
  inheritAttrs: false,
  props: {
    exportEnabled: { type: Boolean, default: false },
    printEnabled: { type: Boolean, default: false },
    exportBusy: { type: Boolean, default: false },
    printBusy: { type: Boolean, default: false },
    exportInitialOptions: {
      type: Object,
      default: () => ({
        scope: "all_filtered",
        include_summary: true,
        include_filters: true,
        include_charts: true,
        include_title: true,
        include_generated_metadata: true,
      }),
    },
    exportButtonLabel: { type: String, default: "Download Dashboard" },
    printButtonLabel: { type: String, default: "Print" },
    tier: { type: String, default: "" },
    subscriptionEntitled: { type: Boolean, default: true },
  },
  emits: ["export", "print"],
  data() {
    return { exportOpen: false };
  },
  render() {
    const title = this.$attrs.title || "Dashboard";
    const actions = () => {
      const nodes = [];
      const badge = tierBadge(this.tier, this.subscriptionEntitled);
      if (badge) nodes.push(badge);
      nodes.push(...customActions(this.$slots));
      if (enabled(this.printEnabled)) {
        nodes.push(
          actionButton(
            this.printBusy ? "Preparing…" : this.printButtonLabel,
            () => this.$emit("print"),
            this.printBusy || this.exportBusy,
          ),
        );
      }
      if (enabled(this.exportEnabled)) {
        nodes.push(
          actionButton(
            this.exportBusy ? "Preparing…" : this.exportButtonLabel,
            () => {
              this.exportOpen = true;
            },
            this.exportBusy || this.printBusy,
            true,
          ),
        );
      }
      return nodes;
    };

    return h("div", { class: "edge-dashboard-shell-host" }, [
      h(BaseDashboardShell, this.$attrs, forwardedSlots(this.$slots, actions)),
      enabled(this.exportEnabled)
        ? h(EdgeReportExportDialog, {
            open: this.exportOpen,
            busy: this.exportBusy,
            reportTitle: String(title || "Dashboard"),
            columns: [],
            initialOptions: this.exportInitialOptions,
            onClose: () => {
              this.exportOpen = false;
            },
            onExport: (options) => {
              this.exportOpen = false;
              this.$emit("export", { ...options, artifact_kind: "dashboard" });
            },
          })
        : null,
    ]);
  },
});

export const reportShellActionComponents = Object.freeze({
  EdgeReportShell,
  EdgeDashboardShell,
});
