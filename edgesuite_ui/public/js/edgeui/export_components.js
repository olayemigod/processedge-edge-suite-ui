import { defineComponent, h, ref } from "vue";

import { EDGE_EXPORT_FORMATS, exportDataset } from "./export_runtime";

function normalizeFormat(entry) {
  if (typeof entry === "string") {
    const match = EDGE_EXPORT_FORMATS.find((format) => format.value === entry);
    return match || { value: entry, label: entry.toUpperCase() };
  }
  return entry?.value ? entry : null;
}

export const EdgeExportMenu = defineComponent({
  name: "EdgeExportMenu",
  props: {
    dataset: { type: Object, default: () => ({}) },
    loadDataset: { type: Function, default: null },
    formats: { type: Array, default: () => EDGE_EXPORT_FORMATS },
    buttonLabel: { type: String, default: "Download" },
    disabled: { type: Boolean, default: false },
  },
  emits: ["export-start", "export-complete", "export-error"],
  setup(props, { emit }) {
    const busy = ref(false);
    const menu = ref(null);

    async function runExport(format) {
      if (busy.value || props.disabled) return;
      busy.value = true;
      emit("export-start", format);
      try {
        const result = await exportDataset({
          format,
          dataset: props.dataset,
          loadDataset: props.loadDataset,
        });
        menu.value?.removeAttribute?.("open");
        emit("export-complete", result);
      } catch (error) {
        emit("export-error", { format, error });
      } finally {
        busy.value = false;
      }
    }

    return () => {
      const formats = props.formats.map(normalizeFormat).filter(Boolean);
      return h(
        "details",
        {
          class: ["edge-export-menu", { "edge-export-menu--busy": busy.value }],
          ref: menu,
        },
        [
          h(
            "summary",
            {
              class: "edge-button edge-export-menu__trigger",
              role: "button",
              tabindex: props.disabled ? -1 : 0,
              "aria-disabled": props.disabled || busy.value ? "true" : "false",
              onClick: (event) => {
                if (props.disabled || busy.value) event.preventDefault();
              },
            },
            busy.value ? "Preparing…" : `${props.buttonLabel} ▾`,
          ),
          h(
            "div",
            { class: "edge-export-menu__options", role: "menu" },
            formats.map((format) =>
              h(
                "button",
                {
                  type: "button",
                  class: "edge-export-menu__option",
                  role: "menuitem",
                  disabled: props.disabled || busy.value,
                  onClick: () => runExport(format.value),
                },
                format.label,
              ),
            ),
          ),
        ],
      );
    };
  },
});

export const exportComponents = {
  EdgeExportMenu,
};
