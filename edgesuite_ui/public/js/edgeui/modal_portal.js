import { Teleport, defineComponent, h } from "vue";

import {
  EdgeFormDialog as BaseEdgeFormDialog,
  EdgeModal as BaseEdgeModal,
} from "./modal_components";

function portalComponent(name, component) {
  return defineComponent({
    name,
    inheritAttrs: false,
    render() {
      const child = h(component, { ...this.$attrs }, this.$slots);
      if (typeof document === "undefined" || !document.body) return child;
      return h(Teleport, { to: "body" }, [child]);
    },
  });
}

export const EdgeModal = portalComponent("EdgeModalPortal", BaseEdgeModal);
export const EdgeFormDialog = portalComponent("EdgeFormDialogPortal", BaseEdgeFormDialog);

export const modalPortalComponents = {
  EdgeModal,
  EdgeFormDialog,
};
