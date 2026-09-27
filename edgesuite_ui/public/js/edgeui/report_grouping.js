import { defineComponent, h } from "vue";

function displayValue(value, datatype = "Data") {
  if (value === null || value === undefined || value === "") return "—";
  const type = String(datatype || "Data").toLowerCase();
  const number = Number(value);
  if (["int", "float", "number", "currency", "percent"].includes(type) && Number.isFinite(number)) {
    const formatted = number.toLocaleString(undefined, {
      maximumFractionDigits: type === "int" ? 0 : 2,
    });
    return type === "percent" ? `${formatted}%` : formatted;
  }
  return String(value);
}

function rowKey(row, index) {
  return String(row?.key || row?.group_key || row?.label || `group_${index + 1}`);
}

export const EdgeReportGroupingPanel = defineComponent({
  name: "EdgeReportGroupingPanel",
  props: {
    title: { type: String, default: "Grouped summary" },
    groupLabel: { type: String, default: "Group" },
    rows: { type: Array, default: () => [] },
    measures: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    emptyMessage: { type: String, default: "No grouped summary is available." },
  },
  render() {
    const rows = Array.isArray(this.rows) ? this.rows : [];
    const measures = Array.isArray(this.measures) ? this.measures : [];
    return h("section", { class: "edge-report-grouping", "aria-label": this.title }, [
      h("header", { class: "edge-report-grouping__header" }, [h("h3", {}, this.title)]),
      this.loading
        ? h("p", { class: "edge-report-grouping__empty" }, "Loading grouped summary…")
        : rows.length
          ? h("div", { class: "edge-report-grouping__table-wrap" }, [
              h("table", { class: "edge-report-grouping__table" }, [
                h("thead", {}, [
                  h("tr", {}, [
                    h("th", { scope: "col" }, this.groupLabel),
                    ...measures.map((measure) =>
                      h("th", { scope: "col", class: "is-number", key: measure.key }, measure.label || measure.key),
                    ),
                  ]),
                ]),
                h(
                  "tbody",
                  {},
                  rows.map((row, index) =>
                    h("tr", { key: rowKey(row, index) }, [
                      h("td", {}, row.label || row.group_label || row.group_key || "Unspecified"),
                      ...measures.map((measure) =>
                        h(
                          "td",
                          {
                            key: measure.key,
                            class: ["is-number", row?.tones?.[measure.key] ? `is-${row.tones[measure.key]}` : ""],
                          },
                          displayValue(row?.[measure.key], measure.datatype),
                        ),
                      ),
                    ]),
                  ),
                ),
              ]),
            ])
          : h("p", { class: "edge-report-grouping__empty" }, this.emptyMessage),
    ]);
  },
});

export const reportGroupingComponents = Object.freeze({
  EdgeReportGroupingPanel,
});
