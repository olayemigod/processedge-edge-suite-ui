import { defineComponent, h } from "vue";

import { EdgeModal } from "./modal_components";

export const REPORT_EXPORT_VERSION = "1.0.0";
export const REPORT_EXPORT_FORMATS = Object.freeze(["xlsx", "csv", "pdf"]);
export const REPORT_EXPORT_SCOPES = Object.freeze(["current_page", "all_filtered"]);

const EXPECTED_MIME = Object.freeze({
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pdf: "application/pdf",
});

const PRESENTATION_KEYS = Object.freeze([
  "include_summary",
  "include_filters",
  "include_charts",
  "include_letterhead",
  "include_title",
  "include_generated_metadata",
  "include_totals",
]);

export function normalizeReportExportOptions(options = {}) {
  const format = REPORT_EXPORT_FORMATS.includes(String(options.format || "").toLowerCase())
    ? String(options.format).toLowerCase()
    : "xlsx";
  const scope = REPORT_EXPORT_SCOPES.includes(options.scope) ? options.scope : "all_filtered";
  const normalized = {
    format,
    scope,
    include_summary: Boolean(options.include_summary),
    include_filters: Boolean(options.include_filters),
    include_charts: Boolean(options.include_charts),
    include_letterhead: Boolean(options.include_letterhead),
    include_title: Boolean(options.include_title),
    include_generated_metadata: Boolean(options.include_generated_metadata),
    include_totals: Boolean(options.include_totals),
    columns: Array.isArray(options.columns) ? options.columns.map(String).filter(Boolean) : [],
    orientation: ["auto", "portrait", "landscape"].includes(String(options.orientation || "").toLowerCase())
      ? String(options.orientation).toLowerCase()
      : "auto",
    repeat_table_headings: options.repeat_table_headings !== false,
  };
  normalized.raw_table_only = PRESENTATION_KEYS.every((key) => !normalized[key]);
  return normalized;
}

function startsWithBytes(bytes, signature) {
  if (!bytes || bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function looksLikeHtml(bytes) {
  if (!bytes?.length) return false;
  const head = new TextDecoder("utf-8").decode(bytes.slice(0, Math.min(bytes.length, 256))).trim().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<body");
}

export function expectedReportExportMime(format) {
  return EXPECTED_MIME[String(format || "").toLowerCase()] || "application/octet-stream";
}

export function validateReportExportBytes({ bytes, format, mime = "" } = {}) {
  const normalizedFormat = String(format || "").toLowerCase();
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!view.length) throw new Error("The generated export is empty.");
  if (looksLikeHtml(view)) throw new Error("The server returned an HTML/error page instead of the requested export file.");

  if (normalizedFormat === "pdf" && !startsWithBytes(view, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error("The generated PDF is invalid or incomplete.");
  }
  if (normalizedFormat === "xlsx" && !startsWithBytes(view, [0x50, 0x4b])) {
    throw new Error("The generated XLSX file is invalid or incomplete.");
  }
  if (normalizedFormat === "csv" && String(mime || "").toLowerCase().includes("text/html")) {
    throw new Error("The server returned HTML instead of CSV data.");
  }

  const expected = expectedReportExportMime(normalizedFormat);
  const actual = String(mime || "").toLowerCase();
  if (actual && normalizedFormat !== "csv" && !actual.includes(expected.toLowerCase())) {
    throw new Error(`Unexpected export content type: ${mime}`);
  }
  if (actual && normalizedFormat === "csv" && !actual.includes("text/csv") && !actual.includes("application/csv")) {
    throw new Error(`Unexpected CSV content type: ${mime}`);
  }
  return true;
}

export function normalizedReportFilename(filename, format) {
  const extension = String(format || "xlsx").toLowerCase();
  const safeBase = String(filename || "report")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(new RegExp(`\\.${extension}$`, "i"), "") || "report";
  return `${safeBase}.${extension}`;
}

export function downloadVerifiedReportExport({ bytes, format, mime, filename } = {}, target = globalThis) {
  validateReportExportBytes({ bytes, format, mime });
  if (!target?.document || !target?.URL) return false;
  const blob = new Blob([bytes], { type: mime || expectedReportExportMime(format) });
  const objectUrl = target.URL.createObjectURL(blob);
  const anchor = target.document.createElement("a");
  anchor.style.display = "none";
  anchor.href = objectUrl;
  anchor.download = normalizedReportFilename(filename, format);
  target.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  target.setTimeout?.(() => target.URL.revokeObjectURL(objectUrl), 0);
  return true;
}

function checkbox(label, checked, onChange, disabled = false) {
  return h("label", { class: "edge-report-export__check" }, [
    h("input", { type: "checkbox", checked, disabled, onChange: (event) => onChange(Boolean(event.target.checked)) }),
    h("span", label),
  ]);
}

export const EdgeReportExportDialog = defineComponent({
  name: "EdgeReportExportDialog",
  props: {
    open: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    reportTitle: { type: String, default: "Report" },
    columns: { type: Array, default: () => [] },
    initialOptions: { type: Object, default: () => ({}) },
  },
  emits: ["close", "export"],
  data() {
    return { options: normalizeReportExportOptions(this.initialOptions) };
  },
  watch: {
    open(next) {
      if (next) this.options = normalizeReportExportOptions(this.initialOptions);
    },
  },
  methods: {
    set(key, value) {
      this.options = normalizeReportExportOptions({ ...this.options, [key]: value });
    },
    toggleColumn(fieldname, checked) {
      const selected = new Set(this.options.columns || []);
      if (checked) selected.add(fieldname);
      else selected.delete(fieldname);
      this.options = normalizeReportExportOptions({ ...this.options, columns: [...selected] });
    },
    submit() {
      this.$emit("export", normalizeReportExportOptions(this.options));
    },
  },
  render() {
    const options = this.options;
    const pdf = options.format === "pdf";
    const selectableColumns = (this.columns || []).filter((column) => column?.fieldname || column?.key);
    return h(
      EdgeModal,
      { open: this.open, busy: this.busy, title: "Download / Export", subtitle: this.reportTitle, size: "lg", onClose: () => this.$emit("close") },
      {
        default: () => h("div", { class: "edge-report-export" }, [
          h("div", { class: "edge-report-export__grid" }, [
            h("label", {}, [h("span", "Format"), h("select", { value: options.format, disabled: this.busy, onChange: (event) => this.set("format", event.target.value) }, REPORT_EXPORT_FORMATS.map((format) => h("option", { value: format }, format.toUpperCase())))]),
            h("label", {}, [h("span", "Data"), h("select", { value: options.scope, disabled: this.busy, onChange: (event) => this.set("scope", event.target.value) }, [h("option", { value: "current_page" }, "Current page"), h("option", { value: "all_filtered" }, "All filtered records")])]),
            pdf ? h("label", {}, [h("span", "PDF orientation"), h("select", { value: options.orientation, disabled: this.busy, onChange: (event) => this.set("orientation", event.target.value) }, [h("option", { value: "auto" }, "Auto"), h("option", { value: "portrait" }, "Portrait"), h("option", { value: "landscape" }, "Landscape")])]) : null,
          ].filter(Boolean)),
          h("section", { class: "edge-report-export__section" }, [
            h("h4", "Presentation options"),
            h("p", { class: "edge-report-export__hint" }, options.raw_table_only ? "No presentation options selected: the export will contain the raw table only." : "Selected presentation details will be added around the exported table."),
            h("div", { class: "edge-report-export__checks" }, [
              checkbox("Summary cards", options.include_summary, (value) => this.set("include_summary", value), this.busy),
              checkbox("Filters used", options.include_filters, (value) => this.set("include_filters", value), this.busy),
              checkbox("Charts", options.include_charts, (value) => this.set("include_charts", value), this.busy || options.format === "csv"),
              checkbox("Letterhead", options.include_letterhead, (value) => this.set("include_letterhead", value), this.busy || options.format === "csv"),
              checkbox("Report title", options.include_title, (value) => this.set("include_title", value), this.busy),
              checkbox("Generated date / user", options.include_generated_metadata, (value) => this.set("include_generated_metadata", value), this.busy),
              checkbox("Totals / subtotals", options.include_totals, (value) => this.set("include_totals", value), this.busy),
              pdf ? checkbox("Repeat table headings", options.repeat_table_headings, (value) => this.set("repeat_table_headings", value), this.busy) : null,
            ].filter(Boolean)),
          ]),
          selectableColumns.length ? h("section", { class: "edge-report-export__section" }, [
            h("h4", "Columns"),
            h("p", { class: "edge-report-export__hint" }, "Leave all unchecked to export the report's default visible columns."),
            h("div", { class: "edge-report-export__checks edge-report-export__checks--columns" }, selectableColumns.map((column) => {
              const fieldname = column.fieldname || column.key;
              return checkbox(column.label || fieldname, options.columns.includes(fieldname), (value) => this.toggleColumn(fieldname, value), this.busy);
            })),
          ]) : null,
        ]),
        footer: () => h("div", { class: "edge-report-export__footer" }, [
          h("button", { type: "button", class: "edge-button edge-button--secondary", disabled: this.busy, onClick: () => this.$emit("close") }, "Cancel"),
          h("button", { type: "button", class: "edge-button edge-button--primary", disabled: this.busy, onClick: this.submit, "data-edge-autofocus": "1" }, this.busy ? "Preparing…" : "Download"),
        ]),
      },
    );
  },
});

export const reportComponents = Object.freeze({ EdgeReportExportDialog });

export function installEdgeSuiteReportExportRuntime(runtime, target = globalThis) {
  if (!runtime) return null;
  const api = Object.freeze({
    version: REPORT_EXPORT_VERSION,
    formats: REPORT_EXPORT_FORMATS,
    scopes: REPORT_EXPORT_SCOPES,
    normalizeOptions: normalizeReportExportOptions,
    expectedMime: expectedReportExportMime,
    validateBytes: validateReportExportBytes,
    filename: normalizedReportFilename,
    downloadVerified: downloadVerifiedReportExport,
  });
  runtime.reportExport = api;
  if (target) target.EdgeSuiteReportExport = api;
  return api;
}
