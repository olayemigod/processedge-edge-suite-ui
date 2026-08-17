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
  },
  emits: ["export", "print"],
  data() {
    return { exportOpen: false };
  },
  render() {
    const title = this.$attrs.title || "Report";
    const columns = Array.isArray(this.$attrs.columns) ? this.$attrs.columns : [];
    const actions = () => {
      const nodes = [...customActions(this.$slots)];
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

    return h("div", { class: "edge-report-shell-host" }, [
      h(BaseReportShell, this.$attrs, forwardedSlots(this.$slots, actions)),
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
              this.$emit("export", options);
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
  },
  emits: ["export", "print"],
  data() {
    return { exportOpen: false };
  },
  render() {
    const title = this.$attrs.title || "Dashboard";
    const actions = () => {
      const nodes = [...customActions(this.$slots)];
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