import { defineComponent, h } from "vue";

import { EdgeEmptyState as BaseEdgeEmptyState } from "./components";
import { EdgeIcon } from "./professional_components";

export const EdgeEmptyState = defineComponent({
  name: "EdgeEmptyState",
  props: {
    title: { type: String, default: "Nothing here yet" },
    description: { type: String, default: "" },
    actionLabel: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  emits: ["action"],
  setup(props, { slots, emit }) {
    return () => {
      const forwardedSlots = {};

      if (slots.icon) {
        forwardedSlots.icon = () => slots.icon();
      } else if (props.icon) {
        forwardedSlots.icon = () =>
          h(EdgeIcon, {
            name: props.icon,
            size: "lg",
          });
      }

      if (slots.actions) {
        forwardedSlots.actions = () => slots.actions();
      }

      return h(
        BaseEdgeEmptyState,
        {
          title: props.title,
          description: props.description,
          actionLabel: props.actionLabel,
          icon: "",
          onAction: () => emit("action"),
        },
        forwardedSlots,
      );
    };
  },
});

export const emptyStateComponents = Object.freeze({
  EdgeEmptyState,
});
