import { defineComponent, h } from "vue";

export function suppressNativeNotificationRuntime(edgeUI) {
  if (!edgeUI || edgeUI.__nativeNotificationRuntimeSuppressed) return edgeUI;
  const SharedShell = edgeUI.components?.EdgeAppShell;
  if (!SharedShell || typeof edgeUI.registerComponent !== "function") return edgeUI;

  const SharedNotificationShell = defineComponent({
    name: "SharedNotificationShell",
    inheritAttrs: false,
    setup(_props, context) {
      return () => {
        const attrs = { ...(context.attrs || {}) };
        if (attrs.useSharedNotifications !== false) {
          // The shared notification slot remains visible, but the underlying
          // professional shell no longer polls or reacts through its legacy
          // native Notification Log implementation.
          attrs.showNotifications = false;
        }
        return h(SharedShell, attrs, context.slots || {});
      };
    },
  });

  edgeUI.registerComponent("EdgeAppShell", SharedNotificationShell, { replace: true });
  edgeUI.__nativeNotificationRuntimeSuppressed = true;
  return edgeUI;
}
