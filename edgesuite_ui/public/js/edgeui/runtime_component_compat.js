import { defineComponent, h } from "vue";

const STAT_ICON_ALIASES = Object.freeze({
  "file-pen-line": "clipboard",
  "credit-card": "wallet",
  "clipboard-check": "clipboard",
  "circle-check": "check",
});

export function normalizeEdgeStatIcon(icon) {
  const name = String(icon || "").trim();
  return STAT_ICON_ALIASES[name] || name;
}

export function normalizeEdgeDataTableColumns(columns = []) {
  return (Array.isArray(columns) ? columns : []).map((column = {}) => ({
    ...column,
    fieldname: column.fieldname || column.key || "",
    status:
      column.status === true ||
      column.type === "status" ||
      column.fieldtype === "Status",
  }));
}

export function createCompatibleEdgeStatCard(BaseStatCard, EdgeIcon) {
  return defineComponent({
    name: "EdgeStatCard",
    inheritAttrs: false,
    props: {
      label: { type: String, default: "" },
      value: { type: [String, Number], default: "—" },
      helper: { type: String, default: "" },
      tone: { type: String, default: "neutral" },
      icon: { type: String, default: "" },
      tooltip: { type: String, default: "" },
    },
    setup(props, { attrs, slots }) {
      return () => {
        const iconName = normalizeEdgeStatIcon(props.icon);
        const iconSlot =
          slots.icon ||
          (iconName && EdgeIcon
            ? () => h(EdgeIcon, { name: iconName, size: "lg", label: `${props.label} icon` })
            : undefined);

        return h(
          BaseStatCard,
          {
            ...attrs,
            label: props.label,
            value: props.value,
            helper: props.helper,
            tone: props.tone,
            icon: iconSlot ? "" : props.icon,
            tooltip: props.tooltip,
          },
          iconSlot ? { ...slots, icon: iconSlot } : slots,
        );
      };
    },
  });
}

export function createCompatibleEdgeDataTable(BaseDataTable) {
  return defineComponent({
    name: "EdgeDataTable",
    inheritAttrs: false,
    props: {
      columns: { type: Array, default: () => [] },
      rows: { type: Array, default: () => [] },
      rowKey: { type: String, default: "name" },
      actions: { type: Array, default: () => [] },
      selectable: { type: Boolean, default: false },
      selected: { type: Array, default: () => [] },
      emptyTitle: { type: String, default: "No records" },
      emptyDescription: { type: String, default: "No matching records were found." },
      compact: { type: Boolean, default: false },
    },
    emits: ["row-click", "action", "update:selected", "select"],
    setup(props, { attrs, slots, emit }) {
      return () =>
        h(
          BaseDataTable,
          {
            ...attrs,
            columns: normalizeEdgeDataTableColumns(props.columns),
            rows: props.rows,
            rowKey: props.rowKey,
            actions: props.actions,
            selectable: props.selectable,
            selected: props.selected,
            emptyTitle: props.emptyTitle,
            emptyDescription: props.emptyDescription,
            compact: props.compact,
            onRowClick: (row) => emit("row-click", row),
            onAction: (payload) => emit("action", payload),
            "onUpdate:selected": (selected) => emit("update:selected", selected),
            onSelect: (payload) => emit("select", payload),
          },
          slots,
        );
    },
  });
}

export function createCompatibleRuntimeComponents({
  baseComponents,
  professionalComponents,
  modalComponents,
  formComponents,
  contextComponents,
  documentComponents,
}) {
  return {
    ...baseComponents,
    ...professionalComponents,
    ...modalComponents,
    ...formComponents,
    ...contextComponents,
    ...documentComponents,
    EdgeStatCard: createCompatibleEdgeStatCard(
      baseComponents.EdgeStatCard,
      professionalComponents.EdgeIcon,
    ),
    EdgeDataTable: createCompatibleEdgeDataTable(documentComponents.EdgeDataTable),
  };
}
