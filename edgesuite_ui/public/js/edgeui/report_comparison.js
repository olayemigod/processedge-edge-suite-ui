import { defineComponent, h } from "vue";

function numberFormat(value, datatype = "Data") {
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

function metricKey(metric, index) {
  return String(metric?.key || metric?.label || `comparison_${index + 1}`);
}

function deltaText(metric = {}) {
  if (metric.formatted_delta !== undefined) return String(metric.formatted_delta);
  if (metric.delta_percent !== undefined && metric.delta_percent !== null) {
    const value = Number(metric.delta_percent);
    if (Number.isFinite(value)) return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }
  if (metric.delta !== undefined && metric.delta !== null) {
    const value = Number(metric.delta);
    if (Number.isFinite(value)) return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return String(metric.delta);
  }
  return "";
}

export const EdgeReportComparisonPanel = defineComponent({
  name: "EdgeReportComparisonPanel",
  props: {
    title: { type: String, default: "Period comparison" },
    currentLabel: { type: String, default: "Current period" },
    comparisonLabel: { type: String, default: "Previous period" },
    metrics: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    emptyMessage: { type: String, default: "No comparison metrics are available." },
  },
  render() {
    const metrics = Array.isArray(this.metrics) ? this.metrics : [];
    return h("section", { class: "edge-report-comparison", "aria-label": this.title }, [
      h("header", { class: "edge-report-comparison__header" }, [
        h("div", {}, [
          h("h3", {}, this.title),
          h("p", {}, `${this.currentLabel} vs ${this.comparisonLabel}`),
        ]),
      ]),
      this.loading
        ? h("p", { class: "edge-report-comparison__empty" }, "Loading comparison…")
        : metrics.length
          ? h(
              "div",
              { class: "edge-report-comparison__grid" },
              metrics.map((metric, index) => {
                const delta = deltaText(metric);
                return h("article", { class: "edge-report-comparison__metric", key: metricKey(metric, index) }, [
                  h("span", { class: "edge-report-comparison__label" }, metric.label || "Metric"),
                  h("strong", { class: "edge-report-comparison__current" }, metric.formatted_current ?? numberFormat(metric.current, metric.datatype)),
                  h("div", { class: "edge-report-comparison__previous" }, [
                    h("span", {}, this.comparisonLabel),
                    h("b", {}, metric.formatted_comparison ?? numberFormat(metric.comparison, metric.datatype)),
                  ]),
                  delta
                    ? h(
                        "span",
                        {
                          class: ["edge-report-comparison__delta", metric.delta_tone ? `is-${metric.delta_tone}` : ""],
                          title: metric.delta_helper || "Change from comparison period",
                        },
                        delta,
                      )
                    : null,
                ]);
              }),
            )
          : h("p", { class: "edge-report-comparison__empty" }, this.emptyMessage),
    ]);
  },
});

export const reportComparisonComponents = Object.freeze({
  EdgeReportComparisonPanel,
});
