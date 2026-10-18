import { defineComponent, h } from "vue";

// This server-derived exposure gate never grants document or workspace access.
export function nativeDeskTarget(target = globalThis) {
  const boot = target?.frappe?.boot;
  const access = boot?.edgesuite_ui_access;
  if (access?.mode !== "native_desk" || access.can_use_native_desk !== true) return null;
  return "/desk";
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const EdgeShellInformationBar = defineComponent({
  name: "EdgeShellInformationBar",
  props: {
    communication: { type: Object, default: null },
  },
  setup(props) {
    return () => {
      const target = nativeDeskTarget();
      const translate = typeof globalThis.__ === "function" ? globalThis.__ : (value) => value;
      const communication = props.communication || globalThis.frappe?.boot?.edgesuite_ui_communication;
      const title = text(communication?.title);
      const message = text(communication?.message);
      const hasMessage = Boolean(title || message);
      return h("section", {
        class: "edge-shell-information-bar",
        "aria-label": translate("Workspace information"),
      }, [
        target ? h("a", {
          class: "edge-button edge-button--secondary edge-shell-information-bar__desk",
          href: target,
          title: translate("Advanced ERPNext"),
          "aria-label": translate("Back to Desk — Advanced ERPNext"),
        }, translate("Back to Desk")) : null,
        h("div", {
          class: "edge-shell-information-bar__communications",
          "data-edge-shell-communications": "",
          "aria-label": hasMessage ? translate("News and updates") : undefined,
          "aria-hidden": hasMessage ? undefined : "true",
          role: hasMessage ? "status" : undefined,
          "aria-live": hasMessage ? "polite" : undefined,
        }, [
          title ? h("strong", title) : null,
          message ? h("span", message) : null,
        ]),
      ]);
    };
  },
});
