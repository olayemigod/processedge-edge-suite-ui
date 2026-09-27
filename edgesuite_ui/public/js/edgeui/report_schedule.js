import { defineComponent, h } from "vue";

import { EdgeModal } from "./modal_components";

export const REPORT_SCHEDULE_FREQUENCIES = Object.freeze(["Daily", "Weekdays", "Weekly", "Monthly"]);
export const REPORT_SCHEDULE_FORMATS = Object.freeze(["XLSX", "CSV", "PDF", "HTML"]);
export const REPORT_SCHEDULE_WEEKDAYS = Object.freeze([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export function normalizeReportScheduleOptions(options = {}) {
  const frequency = REPORT_SCHEDULE_FREQUENCIES.includes(String(options.frequency || ""))
    ? String(options.frequency)
    : "Daily";
  const format = REPORT_SCHEDULE_FORMATS.includes(String(options.format || "").toUpperCase())
    ? String(options.format).toUpperCase()
    : "XLSX";
  const dayOfWeek = frequency === "Weekly" && REPORT_SCHEDULE_WEEKDAYS.includes(String(options.day_of_week || ""))
    ? String(options.day_of_week)
    : frequency === "Weekly" ? "Monday" : "";
  const rowLimit = Math.min(5000, Math.max(1, Number(options.no_of_rows || 500)));
  return {
    email_to: String(options.email_to || "").trim(),
    frequency,
    format,
    day_of_week: dayOfWeek,
    send_if_data: options.send_if_data !== false,
    no_of_rows: Number.isFinite(rowLimit) ? rowLimit : 500,
    columns: Array.isArray(options.columns) ? options.columns.map(String).filter(Boolean) : [],
  };
}

function check(label, checked, onChange, disabled = false) {
  return h("label", { class: "edge-report-export__check" }, [
    h("input", { type: "checkbox", checked, disabled, onChange: (event) => onChange(Boolean(event.target.checked)) }),
    h("span", label),
  ]);
}

export const EdgeReportScheduleDialog = defineComponent({
  name: "EdgeReportScheduleDialog",
  props: {
    open: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    reportTitle: { type: String, default: "Report" },
    columns: { type: Array, default: () => [] },
    initialOptions: { type: Object, default: () => ({}) },
  },
  emits: ["close", "schedule"],
  data() {
    return { options: normalizeReportScheduleOptions(this.initialOptions) };
  },
  watch: {
    open(next) {
      if (next) this.options = normalizeReportScheduleOptions(this.initialOptions);
    },
  },
  methods: {
    set(key, value) {
      this.options = normalizeReportScheduleOptions({ ...this.options, [key]: value });
    },
    toggleColumn(fieldname, selected) {
      const columns = new Set(this.options.columns || []);
      if (selected) columns.add(fieldname);
      else columns.delete(fieldname);
      this.set("columns", [...columns]);
    },
    submit() {
      const options = normalizeReportScheduleOptions(this.options);
      if (!options.email_to) return;
      this.$emit("schedule", options);
    },
  },
  render() {
    const options = this.options;
    const selectableColumns = (this.columns || []).filter((column) => column?.fieldname || column?.key);
    const fieldStyle = { display: "grid", gap: ".35rem" };
    const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(12rem,1fr))", gap: "1rem" };
    const controlStyle = {
      minHeight: "40px",
      padding: ".5rem .65rem",
      border: "1px solid var(--edge-color-border,var(--edge-border,#dfe5ef))",
      borderRadius: "var(--edge-radius-md,8px)",
      background: "var(--edge-color-surface,var(--edge-surface,#fff))",
      color: "var(--edge-color-ink-900,var(--edge-text,#172033))",
    };
    return h(
      EdgeModal,
      {
        open: this.open,
        busy: this.busy,
        title: "Schedule delivery",
        subtitle: this.reportTitle,
        size: "lg",
        onClose: () => this.$emit("close"),
      },
      {
        default: () => h("div", { style: { display: "grid", gap: "1rem" } }, [
          h("label", { style: fieldStyle }, [
            h("span", "Recipients"),
            h("textarea", {
              value: options.email_to,
              disabled: this.busy,
              rows: 3,
              placeholder: "name@example.com, manager@example.com",
              style: controlStyle,
              onInput: (event) => this.set("email_to", event.target.value),
            }),
          ]),
          h("div", { style: gridStyle }, [
            h("label", { style: fieldStyle }, [
              h("span", "Frequency"),
              h("select", { value: options.frequency, disabled: this.busy, style: controlStyle, onChange: (event) => this.set("frequency", event.target.value) }, REPORT_SCHEDULE_FREQUENCIES.map((item) => h("option", { value: item }, item))),
            ]),
            options.frequency === "Weekly"
              ? h("label", { style: fieldStyle }, [
                  h("span", "Day of week"),
                  h("select", { value: options.day_of_week, disabled: this.busy, style: controlStyle, onChange: (event) => this.set("day_of_week", event.target.value) }, REPORT_SCHEDULE_WEEKDAYS.map((item) => h("option", { value: item }, item))),
                ])
              : null,
            h("label", { style: fieldStyle }, [
              h("span", "Format"),
              h("select", { value: options.format, disabled: this.busy, style: controlStyle, onChange: (event) => this.set("format", event.target.value) }, REPORT_SCHEDULE_FORMATS.map((item) => h("option", { value: item }, item))),
            ]),
            h("label", { style: fieldStyle }, [
              h("span", "Maximum rows"),
              h("input", { type: "number", min: 1, max: 5000, value: options.no_of_rows, disabled: this.busy, style: controlStyle, onInput: (event) => this.set("no_of_rows", event.target.value) }),
            ]),
          ].filter(Boolean)),
          check("Send only when the report contains data", options.send_if_data, (value) => this.set("send_if_data", value), this.busy),
          selectableColumns.length
            ? h("section", { class: "edge-report-export__section" }, [
                h("h4", "Columns"),
                h("p", { class: "edge-report-export__hint" }, "Leave all unchecked to use the report's default visible columns."),
                h("div", { class: "edge-report-export__checks edge-report-export__checks--columns" }, selectableColumns.map((column) => {
                  const fieldname = column.fieldname || column.key;
                  return check(column.label || fieldname, options.columns.includes(fieldname), (value) => this.toggleColumn(fieldname, value), this.busy);
                })),
              ])
            : null,
        ]),
        footer: () => h("div", { class: "edge-report-export__footer" }, [
          h("button", { type: "button", class: "edge-button edge-button--secondary", disabled: this.busy, onClick: () => this.$emit("close") }, "Cancel"),
          h("button", { type: "button", class: "edge-button edge-button--primary", disabled: this.busy || !String(options.email_to || "").trim(), onClick: this.submit, "data-edge-autofocus": "1" }, this.busy ? "Saving…" : "Create schedule"),
        ]),
      },
    );
  },
});

export const reportScheduleComponents = Object.freeze({ EdgeReportScheduleDialog });
