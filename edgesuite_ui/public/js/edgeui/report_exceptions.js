import { defineComponent, h } from "vue";

function itemKey(item, index) {
  return String(item?.key || item?.name || item?.reference_name || `exception_${index + 1}`);
}

export const EdgeReportExceptionPanel = defineComponent({
  name: "EdgeReportExceptionPanel",
  props: {
    title: { type: String, default: "Exceptions requiring attention" },
    description: { type: String, default: "" },
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    emptyMessage: { type: String, default: "No exceptions require attention." },
  },
  emits: ["open"],
  render() {
    const items = Array.isArray(this.items) ? this.items : [];
    return h("section", { class: "edge-report-exceptions", "aria-label": this.title }, [
      h("header", { class: "edge-report-exceptions__header" }, [
        h("div", {}, [
          h("h3", {}, this.title),
          this.description ? h("p", {}, this.description) : null,
        ]),
      ]),
      this.loading
        ? h("p", { class: "edge-report-exceptions__empty" }, "Loading exceptions…")
        : items.length
          ? h(
              "div",
              { class: "edge-report-exceptions__list" },
              items.map((item, index) =>
                h("article", { class: ["edge-report-exceptions__item", item.tone ? `is-${item.tone}` : ""], key: itemKey(item, index) }, [
                  h("div", { class: "edge-report-exceptions__content" }, [
                    h("strong", {}, item.title || item.label || "Exception"),
                    item.detail ? h("p", {}, item.detail) : null,
                    item.meta ? h("span", { class: "edge-report-exceptions__meta" }, item.meta) : null,
                  ]),
                  item.reference_name
                    ? h(
                        "button",
                        {
                          type: "button",
                          class: "edge-button edge-button--secondary",
                          onClick: () => this.$emit("open", item),
                        },
                        item.action_label || "Open",
                      )
                    : null,
                ]),
              ),
            )
          : h("p", { class: "edge-report-exceptions__empty" }, this.emptyMessage),
    ]);
  },
});

export const reportExceptionComponents = Object.freeze({
  EdgeReportExceptionPanel,
});
